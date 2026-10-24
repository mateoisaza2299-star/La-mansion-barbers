import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { iniciar } from "./mock-supabase.mjs";
import { hoyISO, sumarDias, diaSemanaISO, horaLegible, fechaCita } from "../js/tiempo.js";

const require = createRequire("/tmp/pw/package.json");
const { chromium } = require("playwright-core");

const LUIS = "44444444-4444-4444-8444-444444444444";
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

async function radiosControl(page) {
  return page.evaluate(() => {
    const mal = [];
    document.querySelectorAll("button, a.btn, [role='switch'], [role='radio'], [role='tab'], select, input[type='checkbox']").forEach((el) => {
      if (el.closest("[hidden]")) return;
      const estilo = getComputedStyle(el);
      if (estilo.display === "none" || estilo.visibility === "hidden") return;
      const rect = el.getBoundingClientRect();
      if (rect.width < 2 || rect.height < 2) return;
      const px = Math.max(...estilo.borderRadius.split(/\s+/).map((parte) => parseFloat(parte) || 0));
      if (px > 8) mal.push((el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40) + " " + Math.round(px));
    });
    return mal.slice(0, 6);
  });
}

async function fueraDeTarjeta(page) {
  return page.evaluate(() => {
    const fuera = [];
    document.querySelectorAll(".horario-hoja, .pa-cita, .horario-semana-card, .login-card, .visita-tarjeta, .reserva-card, .pagina-simple .caja").forEach((card) => {
      if (card.closest("[hidden]") || card.hidden) return;
      const caja = card.getBoundingClientRect();
      if (caja.width < 2) return;
      card.querySelectorAll("*").forEach((hijo) => {
        if (hijo.closest("[hidden]")) return;
        const estilo = getComputedStyle(hijo);
        if (estilo.display === "none" || estilo.visibility === "hidden") return;
        const r = hijo.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (r.right > caja.right + 2 || r.left < caja.left - 2) fuera.push((hijo.className && String(hijo.className).slice(0, 48)) || hijo.tagName);
      });
    });
    return [...new Set(fuera)].slice(0, 8);
  });
}

async function revisar(page, ancho, nombre) {
  const extra = await desborde(page);
  exigir(extra <= 1, ancho + " desborde " + nombre + " " + extra);
  const radios = await radiosControl(page);
  exigir(radios.length === 0, ancho + " radio " + nombre + " " + radios.join(" | "));
  const fuera = await fueraDeTarjeta(page);
  exigir(fuera.length === 0, ancho + " sale de la tarjeta " + nombre + " " + fuera.join(" | "));
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
  const servicio = page.locator("[data-reserva-pasos] [data-servicio='" + CORTE + "']");
  exigir((await textoDe(servicio)).includes("Precio por confirmar"), "el servicio sin precio no avisa el precio");
  await servicio.click();
  if (await page.locator('[data-barbero="' + opciones.barbero + '"]').count()) {
    await page.locator('[data-barbero="' + opciones.barbero + '"]').click();
  }
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
  const acceso = await page.locator(".login-card .logo img").boundingBox();
  exigir(acceso && Math.abs(acceso.height - 60) <= 2, "logo acceso " + (acceso && acceso.height));
  await page.locator('input[name="email"]').fill(correo);
  await page.locator('input[name="password"]').fill(clave);
  await page.locator("[data-login-submit]").click();
  await page.waitForURL(/admin\.html/, { timeout: 15000 });
  await page.waitForSelector("[data-nav]:visible [data-vista='agenda']", { timeout: 15000 });
}

async function logos(page) {
  return page.locator(".logo img").count();
}

async function capturas(page, ancho) {
  await page.goto(origen + "/index.html#nosotros", { waitUntil: "networkidle" });
  await page.locator("#nosotros").scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  exigir(await logos(page) <= 2, ancho + " logos inicio " + await logos(page));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(200);
  const altoLogo = ancho >= 900 ? 48 : 40;
  const cabecera = await page.locator("header.site-header .logo img").boundingBox();
  exigir(cabecera && Math.abs(cabecera.height - altoLogo) <= 2, ancho + " logo cabecera " + (cabecera && cabecera.height));
  const pieLogo = await page.locator("footer .logo img").boundingBox();
  exigir(pieLogo && Math.abs(pieLogo.height - 68) <= 2, ancho + " logo pie " + (pieLogo && pieLogo.height));
  if (ancho >= 900) {
    await page.evaluate(() => window.scrollTo(0, 500));
    await page.waitForTimeout(400);
    const scrolled = await page.locator("header.site-header .logo img").boundingBox();
    exigir(scrolled && Math.abs(scrolled.height - 40) <= 2, ancho + " logo al bajar " + (scrolled && scrolled.height));
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.locator("#nosotros").screenshot({ path: path.join(dir, ancho + "-nosotros.png") });
  const extraNos = await desborde(page);
  exigir(extraNos <= 1, ancho + " desborde nosotros " + extraNos);
  await page.locator("[data-mapa]").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => {
    const marco = document.querySelector("[data-mapa]");
    if (!marco) return false;
    const espera = marco.querySelector("[data-mapa-espera]");
    if (espera && espera.hidden && marco.querySelector("iframe")) return true;
    const boton = marco.querySelector("[data-mapa-ver]");
    return Boolean(boton && (boton.textContent || "").includes("Abrir en Google Maps"));
  }, null, { timeout: 12000 });
  await page.evaluate(() => document.querySelector("[data-mapa]").scrollIntoView({ block: "center" }));
  await foto(page, ancho + "-visita");
  await page.locator("[data-mapa]").screenshot({ path: path.join(dir, ancho + "-mapa.png") });
  const extraVis = await desborde(page);
  exigir(extraVis <= 1, ancho + " desborde visita " + extraVis);
  await page.locator("[data-carta] [data-reservar][data-servicio-nombre='Corte clásico']:visible").click();
  await page.waitForSelector("[data-paso-titulo]", { timeout: 10000 });
  const titulo = await page.locator("[data-paso-titulo]").innerText();
  exigir(/barbero/i.test(titulo), ancho + " reservar servicio no abrió el paso: " + titulo);
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-reserva-pasos]", { state: "hidden" });

  await page.goto(origen + "/nosotros.html", { waitUntil: "networkidle" });
  await page.waitForSelector("[data-mosaico] .mosaico-item", { timeout: 10000 });
  await page.evaluate(async () => {
    const paso = Math.max(240, Math.round(window.innerHeight * 0.7));
    const alto = document.body.scrollHeight;
    for (let y = 0; y < alto; y += paso) {
      window.scrollTo(0, y);
      await new Promise((resolver) => setTimeout(resolver, 90));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(700);
  exigir((await page.title()).includes("Nuestra historia"), ancho + " title historia");
  exigir(await logos(page) <= 2, ancho + " logos historia");
  await page.screenshot({ path: path.join(dir, ancho + "-historia.png"), fullPage: true });
  const extraHis = await desborde(page);
  exigir(extraHis <= 1, ancho + " desborde historia " + extraHis);
  await page.locator("[data-mosaico] .mosaico-item").first().click();
  await page.waitForSelector("[data-visor]:not([hidden])");
  const pie = await page.locator("[data-visor-pie]").innerText();
  const contador = await page.locator("[data-visor-contador]").innerText();
  exigir(pie.length > 0, ancho + " visor sin pie");
  exigir(/\d+ \/ \d+/.test(contador), ancho + " visor sin contador " + contador);
  await foto(page, ancho + "-visor");
  await page.keyboard.press("Escape");
  await page.waitForSelector("[data-visor]", { state: "hidden" });
}

async function flujoPublico(page, ancho, telefono) {
  const fechaUno = habil(1);
  const fechaDos = habil(diaSemanaISO(fechaUno) === 6 ? 3 : 2);
  const fechaTres = habil(4);
  await reservar(page, {
    barbero: "primero",
    fecha: fechaUno,
    nombre: "Vista " + ancho,
    telefono,
    foto: ancho + "-datos"
  });
  const confirmacion = await textoDe(page.locator("[data-reserva-pasos]"));
  exigir(confirmacion.includes("Ana Rojas"), ancho + " primero no asignó a Ana");
  exigir(/Cita LM-/i.test(confirmacion), ancho + " sin número de cita");
  exigir(confirmacion.includes("Vía Funza - Siberia"), ancho + " sin dirección");
  exigir(!confirmacion.includes("Avisar por WhatsApp"), ancho + " sigue el aviso de WhatsApp");
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
    barbero: LUIS,
    fecha: fechaDos,
    nombre: "Cambio " + ancho,
    telefono: String(Number(telefono) + 1)
  });
  const textoMateo = await textoDe(page.locator("[data-reserva-pasos]"));
  exigir(textoMateo.includes("Luis Gómez"), ancho + " no reservó con Luis");
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
  exigir(detalle.includes("Luis Gómez"), ancho + " se perdió el barbero");

  await abrirReserva(page);
  await page.locator("[data-reserva-pasos] [data-servicio='" + CORTE + "']").click();
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
  await revisar(page, ancho, "publico");
}

async function probarFicha(page) {
  exigir(await page.locator("[data-barbero-form] [name=orden]").count() === 0, "sigue el campo orden");
  const textos = await page.locator("[data-barbero-servicios]").innerText();
  exigir(!textos.includes("Niños") && !textos.includes("Mujer") && !textos.includes("Color"), "servicios inactivos en la ficha: " + textos);
  exigir(textos.includes("7 de 7 servicios"), "contador inicial " + textos);
  exigir(textos.includes("Todos los servicios"), "sin todos los servicios");
  await page.locator("article.pa-cita", { hasText: "Ana Rojas" }).locator("button", { hasText: "Editar" }).click();
  await page.waitForFunction(() => (document.querySelector("[data-servicios-cuenta]") || {}).textContent === "7 de 7 servicios");
  const corte = page.locator(".servicio-op", { hasText: "Degradado" }).locator("input");
  await corte.uncheck();
  await page.waitForFunction(() => (document.querySelector("[data-servicios-cuenta]") || {}).textContent === "6 de 7 servicios");
  const todos = page.locator("[data-servicios-todos]");
  await todos.click();
  await page.waitForFunction(() => (document.querySelector("[data-servicios-cuenta]") || {}).textContent === "7 de 7 servicios");
  await todos.click();
  await page.waitForSelector("[data-servicios-aviso]:not([hidden])");
  exigir(await page.locator("[data-barbero-form] [type=submit]").isDisabled(), "guarda sin servicios");
  await page.locator(".servicio-op", { hasText: "Corte clásico" }).locator("input").check();
  await page.locator("[data-barbero-form] [type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-barbero-form] [name=id]").value === "");
  await page.locator("article.pa-cita", { hasText: "Ana Rojas" }).locator("button", { hasText: "Editar" }).click();
  await page.waitForFunction(() => (document.querySelector("[data-servicios-cuenta]") || {}).textContent === "1 de 7 servicios");
  await page.locator("[data-servicios-todos]").click();
  await page.locator("[data-barbero-form] [type=submit]").click();
  await page.waitForFunction(() => document.querySelector("[data-barbero-form] [name=id]").value === "");
  await page.locator("[data-barbero-form] [name=nombre]").fill("Barbero Nuevo");
  await page.locator("[data-barbero-form] [type=submit]").click();
  await page.waitForSelector("text=Barbero Nuevo", { timeout: 10000 });
  const ordenes = await page.evaluate(async () => {
    const modulo = await import("./js/admin-cliente.js");
    const supabase = await modulo.obtenerAdmin();
    const { data, error } = await supabase.from("barberos").select("nombre,orden,servicios");
    if (error) throw new Error(error.message || "barberos");
    return data;
  });
  const nuevo = ordenes.find((item) => item.nombre === "Barbero Nuevo");
  exigir(nuevo && Number(nuevo.orden) === 3, "orden automático " + JSON.stringify(ordenes));
  const ana = ordenes.find((item) => item.nombre === "Ana Rojas");
  exigir(ana && ana.servicios == null, "no guardó todos los servicios");
}

function textoWhatsapp(href) {
  return new URL(href).searchParams.get("text") || "";
}

async function exigirMensaje(href, tipo, nombre, fecha, hora, ancho) {
  const texto = textoWhatsapp(href);
  const primero = nombre.split(" ")[0];
  const resto = nombre.slice(primero.length).trim();
  exigir(texto.startsWith("👋 Hola " + primero + "\n"), ancho + " saludo");
  exigir(texto.includes("💈 *La Mansión Barber Shop*"), ancho + " sin nombre del local");
  exigir(texto.includes("✂️ Corte clásico"), ancho + " sin servicio");
  exigir(texto.includes("📅 " + fechaCita(fecha)), ancho + " fecha");
  exigir(texto.includes("🕛 " + horaLegible(hora)), ancho + " hora");
  exigir(!texto.includes("m.."), ancho + " doble punto");
  exigir(texto.includes("📍 Vía Funza - Siberia, Km 3.8, La Isla, Ceuta, Funza"), ancho + " sin dirección");
  exigir(!/LM-\d/.test(texto), ancho + " muestra el número interno");
  if (resto) exigir(!texto.includes(resto), ancho + " usa el nombre completo");
  const cierre = tipo === "recordatorio"
    ? "¿No puedes asistir? Cancela aquí y liberamos tu espacio:"
    : "Si necesitas cancelarla, hazlo aquí:";
  exigir(texto.includes("✅ " + cierre), ancho + " cierre " + tipo);
  exigir(/\/cancelar\?token=[0-9a-f-]{36}/i.test(texto), ancho + " sin enlace de cancelación");
}

async function probarCancelacion(page) {
  const datos = await page.evaluate(async ({ ana, corte, fecha }) => {
    const modulo = await import("./js/admin-cliente.js");
    const supabase = await modulo.obtenerAdmin();
    const horasLibres = await supabase.rpc("horas_disponibles", { p_barbero: ana, p_fecha: fecha, p_duracion: 45 });
    if (horasLibres.error) throw new Error("horas");
    const hora = horasLibres.data && horasLibres.data[0] && String(horasLibres.data[0].slot).slice(0, 5);
    if (!hora) throw new Error("sin hora");
    const alta = await supabase.rpc("crear_reserva", {
      p_barbero: ana,
      p_servicio: corte,
      p_fecha: fecha,
      p_hora: hora,
      p_nombre: "Cita Cancelable",
      p_telefono: "3005556677",
      p_notas: "",
      p_autoriza: true
    });
    if (alta.error) throw new Error(alta.error.message || "alta");
    const lista = await supabase.from("reservas").select("cancel_token,id").eq("nombre", "Cita Cancelable");
    if (lista.error || !lista.data || !lista.data[0]) throw new Error("sin token");
    const pasadas = await supabase.from("reservas").select("cancel_token").eq("estado", "completada").limit(1);
    if (pasadas.error || !pasadas.data || !pasadas.data[0]) throw new Error("sin pasada");
    return { token: lista.data[0].cancel_token, id: lista.data[0].id, pasada: pasadas.data[0].cancel_token, fecha, hora };
  }, { ana: "33333333-3333-4333-8333-333333333333", corte: CORTE, fecha: habil(9) });
  exigir(datos.token && datos.token !== datos.id, "el enlace usa el id de la cita");
  await page.goto(origen + "/cancelar?token=" + encodeURIComponent(datos.token), { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-cancelar-servicio]:not([hidden])", { timeout: 10000 });
  const cuerpo = await textoDe(page.locator("[data-cancelar]"));
  exigir(cuerpo.includes("Corte clásico"), "cancelar sin servicio");
  exigir(cuerpo.includes(fechaCita(datos.fecha)), "cancelar sin fecha");
  exigir(cuerpo.includes(horaLegible(datos.hora)), "cancelar sin hora");
  await revisar(page, 1366, "cancelar");
  await foto(page, "1366-cancelar");
  await page.locator("[data-cancelar-abrir]").click();
  await page.waitForSelector("[data-cancelar-confirma]:not([hidden])");
  await page.locator("[data-cancelar-no]").click();
  await page.waitForSelector("[data-cancelar-confirma]", { state: "hidden" });
  await page.locator("[data-cancelar-abrir]").click();
  await page.locator("[data-cancelar-si]").click();
  await page.waitForSelector("[data-cancelar-otra]:not([hidden])", { timeout: 10000 });
  exigir((await textoDe(page.locator("[data-cancelar]"))).includes("Tu cita quedó cancelada"), "sin confirmación de cancelación");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("[data-cancelar-estado]") || {}).textContent === "Esta cita ya fue cancelada");
  await page.goto(origen + "/cancelar?token=" + encodeURIComponent(datos.pasada), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => (document.querySelector("[data-cancelar-estado]") || {}).textContent === "Esta cita ya pasó");
  await page.goto(origen + "/admin.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-nav]:visible [data-vista='reservas']", { timeout: 15000 });
  await navVisible(page, "reservas");
  await page.waitForFunction(() => {
    const nodo = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cita Cancelable"));
    return nodo && nodo.textContent.includes("Cancelada");
  });
}

async function flujoPanel(page, ancho) {
  await entrar(page, "dueno@lamansion.test", "ClaveDueno123");
  await page.waitForSelector("text=Cliente Ana Uno", { timeout: 10000 });
  await foto(page, ancho + "-agenda");
  const extraAgenda = await desborde(page);
  exigir(extraAgenda <= 1, ancho + " desborde agenda " + extraAgenda);
  const puesta = await textoDe(page.locator("[data-puesta]"));
  exigir(puesta.includes("Puesta en marcha"), ancho + " sin puesta en marcha");
  exigir(puesta.includes("Precio por confirmar"), ancho + " sin aviso de precio");
  await navVisible(page, "reservas");
  const ana = page.locator("article.pa-cita", { hasText: "Cliente Ana Uno" });
  await ana.locator("[data-accion='confirmar']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Ana Uno"));
    return card && card.textContent.includes("Confirmada");
  });
  await exigirMensaje(await ana.locator("[data-accion='avisar']").getAttribute("href"), "recordatorio", "Cliente Ana Uno", hoyISO(), "10:00", ancho);
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
  await exigirMensaje(href, "confirmacion", "Cliente Ana Aviso", hoyISO(), "15:00", ancho);
  await aviso.locator("[data-accion='avisar']").click();
  await page.waitForFunction(() => {
    const card = [...document.querySelectorAll("article.pa-cita")].find((el) => el.textContent.includes("Cliente Ana Aviso"));
    return card && !card.querySelector(".falta-avisar");
  });
  if (ancho === 1366) await probarCancelacion(page);
  await foto(page, ancho + "-reservas");

  await navVisible(page, "equipo");
  await page.locator("[data-barbero-servicios]").screenshot({ path: path.join(dir, ancho + "-servicios-barbero.png") });
  await page.waitForSelector("[data-horario-dia='2'][data-horario-campo='abre']");
  const martesInicial = await page.locator("[data-horario-dia='2']").evaluateAll((nodos) => nodos.map((nodo) => nodo.dataset.horarioCampo + ":" + nodo.value));
  exigir(martesInicial.includes("abre:09:00") && martesInicial.includes("cierra:13:00") && martesInicial.includes("abre:14:00") && martesInicial.includes("cierra:19:00"), ancho + " martes inicial " + martesInicial.join(","));
  if (ancho === 1366) await probarFicha(page);
  const bloqueo = sumarDias(hoyISO(), 3 + (ancho === 390 ? 0 : ancho === 768 ? 1 : 2));
  const opcionLocal = await page.locator("[data-bloqueo-barbero] option").first().innerText();
  exigir(opcionLocal.includes("Cerrar el local"), ancho + " sin cerrar el local: " + opcionLocal);
  await page.locator("[data-bloqueo-fecha]").fill(bloqueo);
  await page.locator("[data-bloqueo-dia]").uncheck();
  await page.locator("[name='desde']").selectOption("10:00");
  await page.locator("[name='hasta']").selectOption("12:00");
  await page.locator("[data-bloqueo-motivo]").fill("Capacitación");
  await page.locator("[data-bloqueo-guardar]").click();
  await page.waitForSelector("[data-bloqueos] >> text=Capacitación", { timeout: 10000 });
  const textoBloqueo = await textoDe(page.locator("[data-bloqueos]"));
  exigir(textoBloqueo.includes("Cerrar el local"), ancho + " el bloqueo no dice cerrar el local");
  const publica = await page.context().newPage();
  await publica.goto(origen + "/index.html#reservar", { waitUntil: "domcontentloaded" });
  await publica.waitForSelector("[data-reserva-pasos]:not([hidden]) [data-servicio='" + CORTE + "']", { timeout: 15000 });
  await publica.locator("[data-reserva-pasos] [data-servicio='" + CORTE + "']").click();
  await publica.locator('[data-barbero="primero"]').click();
  await elegirDia(publica, bloqueo);
  const horas = await publica.locator("[data-hora]").evaluateAll((nodos) => nodos.map((nodo) => nodo.getAttribute("data-hora")));
  exigir(!horas.includes("10:00") && !horas.includes("11:00"), ancho + " la franja cerrada sigue libre " + horas.join(","));
  exigir(horas.includes("14:00"), ancho + " se cerró el local entero " + horas.join(","));
  await publica.close();
  const cierra = page.locator("[data-horario-dia='1'][data-horario-campo='cierra']").first();
  await cierra.selectOption(CIERRES[ancho]);
  await page.locator("[data-horario-guardar]").click();
  await page.waitForFunction((valor) => {
    const campo = document.querySelector("[data-horario-dia='1'][data-horario-campo='cierra']");
    return campo && campo.value.slice(0, 5) === valor;
  }, CIERRES[ancho]);
  await foto(page, ancho + "-equipo");
  await page.locator(".pa-top").screenshot({ path: path.join(dir, ancho + "-panel-cabecera.png") });
  await page.getByRole("button", { name: "Lunes a sábado" }).click();
  const lunes = page.locator(".horario-dia", { has: page.locator(".horario-nombre", { hasText: "Lunes" }) });
  await lunes.locator("[data-horario-campo='cierra']").selectOption("13:00");
  await lunes.getByRole("button", { name: "Agregar turno" }).click();
  await lunes.locator("[data-horario-campo='abre']").nth(1).selectOption("14:00");
  await page.getByRole("button", { name: "Copiar el lunes a todos los días" }).click();
  const domingo = page.locator(".horario-dia", { has: page.locator(".horario-nombre", { hasText: "Domingo" }) });
  if ((await domingo.getByRole("radio", { name: "Abierto" }).getAttribute("aria-checked")) === "true") {
    await domingo.getByRole("radio", { name: "Cerrado" }).click();
  }
  await page.locator("[data-horario-guardar]").click();
  await page.waitForFunction(() => {
    const aviso = document.querySelector("[data-horario-aviso]");
    return aviso && aviso.hidden;
  });
  await page.locator("[data-horario-editor]").screenshot({ path: path.join(dir, ancho + "-horarios.png") });
  const extraHorario = await desborde(page);
  exigir(extraHorario <= 1, ancho + " desborde horarios " + extraHorario);
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-nav]:visible [data-vista='agenda']", { timeout: 15000 });
  await navVisible(page, "equipo");
  await page.waitForSelector("[data-horario-dia='2'][data-horario-campo='abre']");
  const leido = await page.locator("[data-horario-dia='2'][data-horario-campo='abre']").evaluateAll((nodos) => nodos.map((nodo) => nodo.value));
  exigir(leido.includes("10:00") && leido.includes("14:00"), ancho + " horario no se leyó " + leido.join(","));
  const domingoCerrado = await page.locator(".horario-dia", { has: page.locator(".horario-nombre", { hasText: "Domingo" }) }).getByRole("radio", { name: "Cerrado" }).getAttribute("aria-checked");
  exigir(domingoCerrado === "true", ancho + " el domingo quedó abierto");
  await revisar(page, ancho, "horarios");

  await navVisible(page, "ajustes");
  await page.locator("[data-ajuste='paso_min']").selectOption("45");
  await page.locator("[data-ajuste='anticipacion_min']").selectOption("120");
  await page.locator("[data-ajuste='dias_max']").selectOption("30");
  await page.locator("[data-ajuste='cancelar_min']").selectOption("60");
  await page.locator("[data-ajuste='reservas_activas'] [data-valor='0']").click();
  await page.waitForFunction(() => {
    const estado = document.querySelector("[data-ajuste-estado]");
    return estado && (estado.textContent || "").includes("Pausadas");
  });
  await page.locator("[data-ajuste='reservas_activas'] [data-valor='1']").click();
  await page.locator("[data-ajuste='fidelidad_meta'] [data-mas]").click();
  const frase = await page.locator("[data-ajuste-frase]").innerText();
  exigir(frase.includes("Horas cada 45 min") && frase.includes("30 días adelante") && frase.includes("1 h antes"), ancho + " frase " + frase);
  await page.locator("[data-ajustes-guardar]").click();
  await page.waitForSelector("[data-ajustes-ok]:not([hidden])", { timeout: 10000 });
  await page.locator("[data-panel='ajustes']").screenshot({ path: path.join(dir, ancho + "-ajustes.png") });
  await revisar(page, ancho, "ajustes");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-nav]:visible [data-vista='agenda']", { timeout: 15000 });
  await navVisible(page, "ajustes");
  exigir(await page.locator("[data-ajuste='paso_min']").inputValue() === "45", ancho + " no guardó el intervalo");
  exigir(await page.locator("[data-ajuste='anticipacion_min']").inputValue() === "120", ancho + " no guardó la anticipación");
  exigir(await page.locator("[data-ajuste='dias_max']").inputValue() === "30", ancho + " no guardó los días");
  exigir(await page.locator("[data-ajuste='cancelar_min']").inputValue() === "60", ancho + " no guardó el plazo");
  exigir(await page.locator("[data-ajuste='fidelidad_meta'] [data-valor]").innerText() === "9", ancho + " no guardó la meta");

  await page.evaluate(async ({ ana, corte, fecha }) => {
    const modulo = await import("./js/admin-cliente.js");
    const supabase = await modulo.obtenerAdmin();
    const horasLibres = await supabase.rpc("horas_disponibles", { p_barbero: ana, p_fecha: fecha, p_duracion: 45 });
    if (horasLibres.error) throw new Error("horas");
    const hora = horasLibres.data && horasLibres.data[0] && String(horasLibres.data[0].slot).slice(0, 5);
    if (!hora) throw new Error("sin hora");
    const alta = await supabase.rpc("crear_reserva", {
      p_barbero: ana,
      p_servicio: corte,
      p_fecha: fecha,
      p_hora: hora,
      p_nombre: "Aviso Visual",
      p_telefono: "3007778899",
      p_notas: "",
      p_autoriza: true
    });
    if (alta.error) throw new Error(alta.error.message || "alta");
  }, { ana: "33333333-3333-4333-8333-333333333333", corte: CORTE, fecha: habil(6) });
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await page.waitForSelector("[data-llegada]:not([hidden])", { timeout: 10000 });
  exigir((await page.locator("[data-llegada]").innerText()).includes("Llegó una reserva nueva"), ancho + " sin aviso visual");
  exigir(await page.locator("[data-nav]:visible [data-nuevas]").isVisible(), ancho + " sin contador");

  await navVisible(page, "resumen");
  await page.waitForSelector("[data-resumen-tarjetas] .pa-cifra", { timeout: 10000 });
  await foto(page, ancho + "-resumen");
  const extra = await desborde(page);
  exigir(extra <= 1, ancho + " desborde panel " + extra);

  await page.locator("[data-salir]").click();
  await page.waitForURL(/admin-login\.html/);
  await entrar(page, "barbero@lamansion.test", "ClaveBarbero123");
  const vistas = await page.locator("[data-nav]:visible [data-vista]").evaluateAll((nodos) => nodos.map((nodo) => nodo.dataset.vista));
  exigir(!vistas.includes("ajustes") && !vistas.includes("equipo") && !vistas.includes("servicios") && !vistas.includes("fidelidad") && !vistas.includes("resumen"), ancho + " barbero ve " + vistas.join(","));
  await navVisible(page, "reservas");
  const lista = await textoDe(page.locator("[data-reservas-lista]"));
  exigir(!lista.includes("Cliente Luis"), ancho + " barbero ve cita ajena");
  exigir(lista.includes("Cliente Ana Uno"), ancho + " barbero no ve su agenda");
  await foto(page, ancho + "-barbero");
}

async function casosAcceso(browser) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    serviceWorkers: "block",
    locale: "es-CO"
  });
  await context.addCookies([{ name: "lm_activo", value: "1", url: origen }]);
  const page = await context.newPage();
  const errores = [];
  page.on("pageerror", (error) => errores.push(String(error)));
  page.on("console", (msg) => {
    if (msg.type() === "error" && consolaUtil(msg.text())) errores.push(msg.text());
  });
  const intentar = async (correo, clave) => {
    await page.goto(origen + "/admin-login.html", { waitUntil: "domcontentloaded" });
    await page.waitForSelector("[data-login]", { state: "visible", timeout: 15000 });
    await page.locator('input[name="email"]').fill(correo);
    await page.locator('input[name="password"]').fill(clave);
    await page.locator("[data-login-submit]").click();
    await page.waitForSelector("[data-login-error]:not([hidden])", { timeout: 10000 });
    return page.locator("[data-login-error]").innerText();
  };
  const sesion = () => page.evaluate(() => {
    const raw = sessionStorage.getItem("lamansion-admin-auth") || "";
    return raw.includes("access_token");
  });
  const desconocido = await intentar("nadie@lamansion.test", "ClaveFalsa123");
  exigir(desconocido.includes("Correo o contraseña incorrectos."), "correo desconocido: " + desconocido);
  const clave = await intentar("dueno@lamansion.test", "clave-mal");
  exigir(clave.includes("Correo o contraseña incorrectos."), "clave mala: " + clave);
  const confirmar = await intentar("sinconfirma@lamansion.test", "ClaveNo123");
  exigir(confirmar.includes("Debes confirmar tu correo."), "sin confirmar: " + confirmar);
  const sinFila = await intentar("sinpermiso@lamansion.test", "ClaveSin123");
  exigir(sinFila.includes("Tu cuenta existe, pero todavía no tiene permisos"), "sin fila: " + sinFila);
  exigir(!(await sesion()), "la cuenta sin permisos conservó la sesión");
  const permisos = await intentar("fallopermiso@lamansion.test", "ClaveFallo123");
  exigir(permisos.includes("No pudimos verificar tus permisos."), "42501: " + permisos);
  exigir((await page.locator("[data-login-codigo]").innerText()).includes("42501"), "sin código 42501");
  exigir(await page.locator("[data-login-reintentar]").isVisible(), "42501 sin reintentar");
  exigir(await sesion(), "el error 42501 cerró la sesión");
  await page.locator("[data-login-reintentar]").click();
  await page.waitForFunction(() => {
    const caja = document.querySelector("[data-login-codigo]");
    return caja && (caja.textContent || "").includes("42501");
  });
  await page.evaluate(() => sessionStorage.clear());
  const tabla = await intentar("tablano@lamansion.test", "ClaveTabla123");
  exigir(tabla.includes("No pudimos verificar tus permisos."), "42P01: " + tabla);
  exigir((await page.locator("[data-login-codigo]").innerText()).includes("42P01"), "sin código 42P01");
  exigir(await sesion(), "el error 42P01 cerró la sesión");
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(origen + "/admin-login.html", { waitUntil: "domcontentloaded" });
  await page.waitForSelector("[data-login]", { state: "visible", timeout: 15000 });
  await context.setOffline(true);
  await page.locator('input[name="email"]').fill("dueno@lamansion.test");
  await page.locator('input[name="password"]').fill("ClaveDueno123");
  await page.locator("[data-login-submit]").click();
  await page.waitForSelector("[data-login-error]:not([hidden])", { timeout: 10000 });
  const red = await page.locator("[data-login-error]").innerText();
  exigir(red.includes("No pudimos conectar."), "sin conexión: " + red);
  exigir(await page.locator("[data-login-reintentar]").isVisible(), "sin red sin reintentar");
  await context.setOffline(false);
  exigir(errores.length === 0, "consola acceso: " + errores.join(" | "));
  await context.close();
}

async function sinRed(browser) {
  const context = await browser.newContext({
    viewport: { width: 1366, height: 800 },
    serviceWorkers: "block"
  });
  await context.addCookies([{ name: "lm_preparacion", value: "1", url: origen }]);
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
  await page.locator("[data-reservar]").first().click();
  await page.waitForSelector("[data-reserva-pasos]:not([hidden])");
  const aviso = await textoDe(page.locator("[data-reserva-pasos]"));
  exigir(aviso.includes("La agenda en línea no está disponible por ahora"), "sin aviso de agenda: " + aviso);
  exigir(errores.length === 0, "consola en preparación: " + errores.join(" | "));
  await context.close();
}

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});

try {
  await sinRed(browser);
  await casosAcceso(browser);
  for (const ancho of [360, 1920]) {
    await fetch(origen + "/__reset", { method: "POST" });
    const context = await browser.newContext({
      viewport: { width: ancho, height: ancho === 360 ? 800 : 1080 },
      serviceWorkers: "block",
      locale: "es-CO"
    });
    await context.addCookies([{ name: "lm_activo", value: "1", url: origen }]);
    const page = await context.newPage();
    const errores = [];
    page.on("pageerror", (error) => errores.push(String(error)));
    page.on("console", (msg) => {
      if (msg.type() === "error" && consolaUtil(msg.text())) errores.push(msg.text());
    });
    try {
      await page.goto(origen + "/index.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("[data-reserva-abrir]", { timeout: 15000 });
      await revisar(page, ancho, "inicio");
      await page.goto(origen + "/nosotros.html", { waitUntil: "domcontentloaded" });
      await page.waitForSelector("h1", { timeout: 15000 });
      await revisar(page, ancho, "nosotros");
      await entrar(page, "dueno@lamansion.test", "ClaveDueno123");
      await page.waitForSelector("text=Cliente Ana Uno", { timeout: 10000 });
      for (const vista of ["agenda", "reservas", "equipo", "servicios", "fidelidad", "resumen", "ajustes"]) {
        await navVisible(page, vista);
        await revisar(page, ancho, vista);
        if (vista === "equipo") {
          await page.locator("[data-horario-editor]").screenshot({ path: path.join(dir, ancho + "-horarios.png") });
          await page.locator("[data-barbero-servicios]").screenshot({ path: path.join(dir, ancho + "-servicios-barbero.png") });
        }
        if (vista === "ajustes") await page.locator("[data-panel='ajustes']").screenshot({ path: path.join(dir, ancho + "-ajustes.png") });
      }
    } catch (error) {
      await foto(page, ancho + "-error").catch(() => {});
      falla(ancho + " " + (error && error.stack ? error.stack.split("\n").slice(0, 6).join(" ") : error));
    }
    if (errores.length) falla(ancho + " consola: " + errores.join(" | "));
    await context.close();
  }
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
      await capturas(page, ancho);
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
