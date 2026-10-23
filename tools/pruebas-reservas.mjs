import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { iniciar } from "./mock-supabase.mjs";
import { hoyISO, sumarDias, diaSemanaISO, horaLegible } from "../js/tiempo.js";

const require = createRequire("/tmp/pw/package.json");
const { chromium } = require("playwright-core");

const SEDE_CENTRO = "11111111-1111-4111-8111-111111111111";
const SEDE_OCCIDENTE = "22222222-2222-4222-8222-222222222222";
const MATEO = "55555555-5555-4555-8555-555555555555";
const CORTE = "66666666-6666-4666-8666-666666666666";
const CIERRES = { 390: "12:00", 768: "12:30", 1366: "11:30" };
const ALTOS = { 390: 844, 768: 1024, 1366: 800 };
const dir = "/tmp/mansion-reservas";

fs.mkdirSync(dir, { recursive: true });

const { servidor } = await iniciar(0);
const puerto = servidor.address().port;
const origen = "http://127.0.0.1:" + puerto;
const fallos = [];

function falla(mensaje) {
  fallos.push(mensaje);
  process.stderr.write("FALLO " + mensaje + "\n");
}

function exigir(condicion, mensaje) {
  if (!condicion) falla(mensaje);
}

function habil(desde) {
  const hoy = hoyISO();
  for (let salto = desde; salto < 21; salto += 1) {
    const fecha = sumarDias(hoy, salto);
    if (diaSemanaISO(fecha) !== 0) return fecha;
  }
  throw new Error("sin dia habil");
}

function consolaUtil(texto) {
  if (!texto) return false;
  if (/frame-ancestors/i.test(texto)) return false;
  if (/Failed to load resource/i.test(texto)) return false;
  return true;
}

async function textoDe(locator) {
  return locator.evaluate((el) => el.textContent || "");
}

async function desborde(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

async function foto(page, nombre) {
  await page.screenshot({ path: path.join(dir, nombre + ".png"), fullPage: false });
}

async function abrirReserva(page) {
  await page.goto(origen + "/index.html#reservas", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-reserva-abrir]", { timeout: 15000 });
  await page.locator("[data-reserva-abrir]").click();
  await page.waitForSelector("[data-reserva-pasos]:not([hidden])");
}

async function elegirDia(page, fecha) {
  const mas = page.locator("[data-mas-fechas]");
  for (let i = 0; i < 3 && !(await page.locator('[data-dia="' + fecha + '"]').count()); i += 1) {
    if (!(await mas.count())) break;
    await mas.click();
  }
  await page.locator('[data-dia="' + fecha + '"]').click();
  await page.waitForSelector("[data-hora]", { timeout: 10000 });
}

async function llenarDatos(page, nombre, telefono) {
  await page.locator('input[name="nombre"]').fill(nombre);
  await page.locator('input[name="celular"]').fill(telefono);
  await page.locator('input[name="autoriza"]').check();
}

async function reservar(page, opciones) {
  await abrirReserva(page);
  await page.locator('[data-sede="' + opciones.sede + '"]').click();
  await page.locator('[data-servicio="' + CORTE + '"]').click();
  await page.locator('[data-barbero="' + opciones.barbero + '"]').click();
  await elegirDia(page, opciones.fecha);
  const hora = await page.locator("[data-hora]").first().getAttribute("data-hora");
  await page.locator('[data-hora="' + hora + '"]').click();
  if (opciones.detener) return hora;
  await llenarDatos(page, opciones.nombre, opciones.telefono);
  if (opciones.foto) await foto(page, opciones.foto);
  await page.locator("[data-reserva-enviar]").click();
  await page.waitForSelector("[data-reserva-numero]", { timeout: 10000 });
  return hora;
}

async function navVisible(page, vista) {
  const boton = page.locator("[data-nav]:visible [data-vista='" + vista + "']");
  await boton.click();
}

async function entrar(page, correo, clave) {
  await page.goto(origen + "/admin-login.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-login]", { state: "visible", timeout: 15000 });
  await page.locator('input[name="email"]').fill(correo);
  await page.locator('input[name="password"]').fill(clave);
  await page.locator("[data-login-submit]").click();
  await page.waitForURL(/admin\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-nav]:visible [data-vista='agenda']", { timeout: 15000 });
}

async function flujoPublico(page, ancho, telefono) {
  const fechaUno = habil(1);
  const fechaDos = habil(diaSemanaISO(fechaUno) === 6 ? 3 : 2);
  const fechaTres = habil(4);
  await reservar(page, {
    sede: SEDE_CENTRO,
    barbero: "primero",
    fecha: fechaUno,
    nombre: "Vista " + ancho,
    telefono,
    foto: ancho + "-datos"
  });
  const confirmacion = await textoDe(page.locator("[data-reserva-pasos]"));
  exigir(confirmacion.includes("Ana Rojas"), ancho + " primero no asignó a Ana");
  exigir(/Cita LM-/i.test(confirmacion), ancho + " sin número de cita");
  await page.waitForTimeout(700);
  await foto(page, ancho + "-confirmacion");
  await page.locator("[data-reserva-atras]").click();
  await page.waitForSelector("[data-cita-cancelar]", { timeout: 10000 });
  await foto(page, ancho + "-tu-cita");
  await page.locator("[data-cita-cancelar]").click();
  await page.locator("[data-confirmar-si]").click();
  await page.waitForSelector("[data-cita-descartar]", { timeout: 10000 });
  exigir((await page.locator(".cita-gracias").innerText()).includes("Gracias por venir"), ancho + " sin gracias");
  await page.locator("[data-cita-descartar]").click();

  const horaMateo = await reservar(page, {
    sede: SEDE_OCCIDENTE,
    barbero: MATEO,
    fecha: fechaDos,
    nombre: "Cambio " + ancho,
    telefono: String(Number(telefono) + 1)
  });
  const textoMateo = await textoDe(page.locator("[data-reserva-pasos]"));
  exigir(textoMateo.includes("Mateo Díaz"), ancho + " no reservó con Mateo");
  await page.locator("[data-reserva-atras]").click();
  await page.waitForSelector("[data-cita-cambiar]");
  await page.locator("[data-cita-cambiar]").click();
  await page.waitForSelector("[data-hora]");
  const horaNueva = await page.locator("[data-hora]").first().getAttribute("data-hora");
  await page.locator('[data-hora="' + horaNueva + '"]').click();
  exigir(horaNueva !== horaMateo, ancho + " la hora ocupada sigue libre");
  await page.locator("[data-reagendar]").click();
  const legible = horaLegible(horaNueva);
  await page.waitForFunction((hora) => {
    const el = document.querySelector(".cita-detalle");
    return el && (el.textContent || "").includes(hora);
  }, legible);
  const detalle = await textoDe(page.locator(".cita-detalle"));
  exigir(detalle.includes("Mateo Díaz"), ancho + " se perdió el barbero");

  await abrirReserva(page);
  await page.locator('[data-sede="' + SEDE_CENTRO + '"]').click();
  await page.locator('[data-servicio="' + CORTE + '"]').click();
  await page.locator('[data-barbero="primero"]').click();
  await elegirDia(page, fechaTres);
  const horaOcupada = await page.locator("[data-hora]").first().getAttribute("data-hora");
  await page.locator('[data-hora="' + horaOcupada + '"]').click();
  const datos = await page.locator("form.reserva-datos").evaluate((form) => ({
    barbero: form.dataset.barbero,
    servicio: form.dataset.servicio,
    fecha: form.dataset.fecha,
    hora: form.dataset.hora
  }));
  await page.evaluate(async (cita) => {
    const modulo = await import("./js/supabase.js");
    const supabase = await modulo.obtenerSupabase();
    const { error } = await supabase.rpc("crear_reserva", {
      p_barbero: cita.barbero,
      p_servicio: cita.servicio,
      p_fecha: cita.fecha,
      p_hora: cita.hora,
      p_nombre: "Ocupa Slot",
      p_telefono: cita.telefono,
      p_notas: "",
      p_autoriza: true
    });
    if (error) throw new Error(error.message || "ocupar");
  }, { ...datos, telefono: "300555" + String(ancho).padStart(4, "0") });
  await llenarDatos(page, "Tarde " + ancho, String(Number(telefono) + 2));
  await page.locator("[data-reserva-enviar]").click();
  await page.waitForSelector("[data-form-error]:not([hidden])", { timeout: 10000 });
  const error = await page.locator("[data-form-error]").innerText();
  exigir(error.includes("Esa hora acaba de ocuparse"), ancho + " error de horario: " + error);
  for (let i = 0; i < 6 && await page.locator("[data-reserva-pasos]:not([hidden])").count(); i += 1) {
    await page.locator("[data-reserva-atras]").click();
  }

  await page.locator("[data-fid-cel]").fill("3001234567");
  await page.locator("[data-fid-ver]").click();
  await page.waitForSelector("[data-gratis]", { timeout: 10000 });
  exigir((await page.locator("[data-gratis]").innerText()).includes("¡Tu próximo corte es gratis!"), ancho + " sin fidelidad");
  await foto(page, ancho + "-fidelidad");
  const anchoExtra = await desborde(page);
  exigir(anchoExtra <= 1, ancho + " desborde público " + anchoExtra);
}

async function flujoPanel(page, ancho) {
  await entrar(page, "dueno@lamansion.test", "ClaveDueno123");
  await page.waitForSelector("text=Cliente Ana Uno", { timeout: 10000 });
  await foto(page, ancho + "-agenda");
  const extraAgenda = await desborde(page);
  exigir(extraAgenda <= 1, ancho + " desborde agenda " + extraAgenda);
  exigir((await page.locator("[data-servicios-aviso]").innerText()).includes("inactivos"), ancho + " sin aviso de servicios");
  await navVisible(page, "reservas");
  const ana = page.locator("article.pa-cita", { hasText: "Cliente Ana Uno" });
  await ana.locator("[data-accion='confirmar']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Ana Uno"));
    return card && card.textContent.includes("Confirmada");
  });
  const dos = page.locator("article.pa-cita", { hasText: "Cliente Ana Dos" });
  await dos.locator("[data-accion='completada']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Ana Dos"));
    return card && card.textContent.includes("Completada");
  });
  const luis = page.locator("article.pa-cita", { hasText: "Cliente Luis" });
  await luis.locator("[data-accion='no_asistio']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Luis"));
    return card && card.textContent.includes("No asistió");
  });
  const aviso = page.locator("article.pa-cita", { hasText: "Cliente Ana Aviso" });
  const href = await aviso.locator("[data-accion='avisar']").getAttribute("href");
  exigir(href && href.includes("wa.me/573101111114"), ancho + " whatsapp " + href);
  exigir((await aviso.locator(".falta-avisar").count()) === 1, ancho + " sin falta avisar");
  await aviso.locator("[data-accion='avisar']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Ana Aviso"));
    return card && !card.querySelector(".falta-avisar");
  });
  await foto(page, ancho + "-reservas");

  await navVisible(page, "equipo");
  const bloqueo = sumarDias(hoyISO(), 3 + (ancho === 390 ? 0 : ancho === 768 ? 1 : 2));
  await page.locator("[data-bloqueo-fecha]").fill(bloqueo);
  await page.locator("[data-bloqueo-motivo]").fill("Capacitación");
  await page.locator("[data-bloqueo-guardar]").click();
  await page.waitForSelector("[data-bloqueos] >> text=Capacitación", { timeout: 10000 });
  const cierra = page.locator("[data-horario-dia='1'][data-horario-campo='cierra']").first();
  await cierra.fill(CIERRES[ancho]);
  await page.locator("[data-horario-guardar]").click();
  await page.waitForFunction((valor) => {
    const campo = document.querySelector("[data-horario-dia='1'][data-horario-campo='cierra']");
    return campo && campo.value.slice(0, 5) === valor;
  }, CIERRES[ancho]);
  await foto(page, ancho + "-equipo");
  await navVisible(page, "resumen");
  await page.waitForSelector("[data-resumen-tarjetas] .pa-cifra", { timeout: 10000 });
  await foto(page, ancho + "-resumen");
  const extra = await desborde(page);
  exigir(extra <= 1, ancho + " desborde panel " + extra);

  await page.locator("[data-salir]").click();
  await page.waitForURL(/admin-login\.html/);
  await entrar(page, "barbero@lamansion.test", "ClaveBarbero123");
  const vistas = await page.locator("[data-nav]:visible [data-vista]").evaluateAll((nodos) => nodos.map((nodo) => nodo.dataset.vista));
  exigir(!vistas.includes("ajustes") && !vistas.includes("equipo") && !vistas.includes("servicios"), ancho + " barbero ve " + vistas.join(","));
  await navVisible(page, "reservas");
  const lista = await textoDe(page.locator("[data-reservas-lista]"));
  exigir(!lista.includes("Cliente Luis"), ancho + " barbero ve cita ajena");
  exigir(lista.includes("Cliente Ana Uno"), ancho + " barbero no ve su agenda");
  await foto(page, ancho + "-barbero");
}

async function sinRed(browser) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    serviceWorkers: "block"
  });
  const page = await context.newPage();
  const errores = [];
  const urls = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && consolaUtil(msg.text())) errores.push(msg.text());
  });
  page.on("request", (req) => urls.push(req.url()));
  await page.goto(origen + "/index.html", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
  const prohibidas = urls.filter((url) => /supabase\.co|\/rest\/v1|\/auth\/v1/.test(url));
  exigir(prohibidas.length === 0, "en preparación llamó a " + prohibidas.join(" "));
  exigir(await page.locator("[data-reserva-cerrada]").isVisible(), "tarjeta cerrada oculta");
  exigir((await page.locator("[data-reserva-abrir]").count()) === 0, "había flujo con preparación");
  exigir(errores.length === 0, "consola en preparación: " + errores.join(" | "));
  await context.close();
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

try {
  await sinRed(browser);
  for (const ancho of [390, 768, 1366]) {
    await fetch(origen + "/__reset", { method: "POST" });
    const context = await browser.newContext({
      viewport: { width: ancho, height: ALTOS[ancho] },
      serviceWorkers: "block",
      locale: "es-CO"
    });
    await context.addCookies([{ name: "lm_activo", value: "1", url: origen }]);
    const page = await context.newPage();
    const errores = [];
    const red = [];
    page.on("response", (respuesta) => {
      if (respuesta.status() < 400) return;
      const ruta = new URL(respuesta.url()).pathname;
      if (ruta === "/favicon.ico") return;
      if (respuesta.status() === 400 && ruta.startsWith("/rest/v1/rpc/")) return;
      red.push(respuesta.status() + " " + ruta);
    });
    page.on("pageerror", (error) => errores.push(String(error)));
    page.on("console", (msg) => {
      if (msg.type() === "error" && consolaUtil(msg.text())) errores.push(msg.text());
    });
    page.on("popup", (popup) => popup.close().catch(() => {}));
    try {
      await flujoPublico(page, ancho, ancho === 390 ? "3003900001" : ancho === 768 ? "3007680001" : "3013660001");
      await flujoPanel(page, ancho);
    } catch (error) {
      await foto(page, ancho + "-error").catch(() => {});
      falla(ancho + " " + (error && error.stack ? error.stack.split("\n").slice(0, 6).join(" ") : error));
    }
    if (red.length) falla(ancho + " red: " + red.join(" | "));
    if (errores.length) falla(ancho + " consola: " + errores.join(" | "));
    await context.close();
  }
} finally {
  await browser.close();
  servidor.close();
}

if (fallos.length) {
  fallos.forEach((linea) => process.stderr.write(linea + "\n"));
  process.exit(1);
}
process.stdout.write("pruebas ok\n");
