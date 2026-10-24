import { negocio, enlaceTelefono, enlaceDirecciones, formatoPrecio, reservasEnLinea } from "./config.js";
import { obtenerSupabase } from "./supabase.js";
import { traducir, celularValido, nombreValido } from "./errores.js";
import { hoyISO, sumarDias, fechaLegible, fechaCorta, horaLegible, aMinutos, instanteBogota } from "./tiempo.js";
import { nodo, hojaEstilos, marcaCasilla } from "./dom.js";

const LLAVE = "lamansion_citas";
const VISITA = "lamansion_visita";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = {
  pendiente: "Pendiente de confirmación",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asististe"
};

const estado = {
  config: null,
  sedes: [],
  barberos: [],
  servicios: [],
  paso: 0,
  sedeId: "",
  servicioId: "",
  barberoId: "",
  fecha: "",
  hora: "",
  ofertas: new Map(),
  fechas: 14,
  modo: "",
  token: "",
  citas: new Map(),
  horarios: [],
  supabase: null,
  lista: false,
  empujado: false,
  claveServicio: "",
  nombreServicio: ""
};

const movil = () => window.matchMedia("(max-width: 767px)").matches;
const hoja = hojaEstilos();
const reglas = new Set();

function leerTokens() {
  try {
    const lista = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    if (!Array.isArray(lista)) return [];
    const unicos = [];
    lista.forEach((item) => {
      const token = String(item || "").trim().toLowerCase();
      if (!UUID.test(token) || unicos.includes(token)) return;
      unicos.push(token);
    });
    return unicos.slice(0, 5);
  } catch (error) {
    return [];
  }
}

function guardarToken(token) {
  const limpio = String(token || "").trim().toLowerCase();
  if (!UUID.test(limpio)) return;
  const lista = [limpio, ...leerTokens().filter((item) => item !== limpio)].slice(0, 5);
  try {
    localStorage.setItem(LLAVE, JSON.stringify(lista));
  } catch (error) {}
}

function olvidarToken(token) {
  const lista = leerTokens().filter((item) => item !== token);
  try {
    localStorage.setItem(LLAVE, JSON.stringify(lista));
  } catch (error) {}
}

async function registrar(tipo) {
  try {
    if (!estado.supabase) return;
    await estado.supabase.rpc("registrar_evento", { p_tipo: tipo });
  } catch (error) {}
}

function precioDe(servicio) {
  if (!servicio || servicio.precio == null || servicio.precio === "") return "";
  const numero = Number(servicio.precio);
  if (!Number.isFinite(numero)) return "";
  return formatoPrecio(servicio.precio);
}

function slug(valor) {
  return String(valor || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function sedesActivas() {
  return estado.sedes.filter((item) => item.activa !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function serviciosActivos() {
  return estado.servicios.filter((item) => item.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function servicioActual() {
  return estado.servicios.find((item) => item.id === estado.servicioId) || null;
}

function barberoPorId(id) {
  return estado.barberos.find((item) => item.id === id) || null;
}

function ofrece(barbero, servicioId) {
  if (!barbero || barbero.activo === false) return false;
  if (barbero.servicios == null) return true;
  return Array.isArray(barbero.servicios) && barbero.servicios.includes(servicioId);
}

function conHorario(barbero) {
  return estado.horarios.some((item) => item.barbero_id === barbero.id);
}

function sedeUnica() {
  return sedesActivas()
    .slice()
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"))[0] || null;
}

function fijarSede() {
  const sede = sedeUnica();
  estado.sedeId = sede ? sede.id : "";
  return Boolean(estado.sedeId);
}

function barberosDelPaso() {
  return estado.barberos
    .filter((item) => item.sede_id === estado.sedeId && ofrece(item, estado.servicioId) && conHorario(item))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function pasos() {
  return ["servicio", "barbero", "horario", "datos"];
}

function nombrePaso(clave) {
  return { servicio: "Servicio", barbero: "Barbero", horario: "Fecha y hora", datos: "Datos" }[clave] || clave;
}

function agendaLista() {
  if (!estado.config || estado.config.reservas_activas === false) return false;
  if (!serviciosActivos().length) return false;
  if (!fijarSede()) return false;
  return estado.barberos.some((item) => item.activo !== false && item.sede_id === estado.sedeId && conHorario(item));
}

function resolverServicio(clave, nombre) {
  const lista = serviciosActivos();
  const limpia = String(clave || "");
  const porNombre = String(nombre || "");
  return lista.find((item) => item.id === limpia)
    || lista.find((item) => porNombre && item.nombre === porNombre)
    || lista.find((item) => slug(item.nombre) === limpia)
    || lista.find((item) => slug(item.nombre).replace(/-y-/g, "-") === limpia.replace(/-y-/g, "-"))
    || null;
}

function visible(el) {
  if (!el || el.disabled || el.hidden) return false;
  const estilo = window.getComputedStyle(el);
  return estilo.display !== "none" && estilo.visibility !== "hidden" && el.getClientRects().length > 0;
}

function app() {
  return document.querySelector("[data-reserva-app]");
}

function pasosCaja() {
  return document.querySelector("[data-reserva-pasos]");
}

function cerrarHoja(desdePop) {
  const caja = pasosCaja();
  if (caja) {
    caja.hidden = true;
    caja.classList.remove("abierta");
  }
  const velo = document.querySelector("[data-reserva-velo]");
  if (velo) velo.hidden = true;
  document.body.classList.remove("reserva-lock");
  const volver = estado.empujado && !desdePop;
  estado.empujado = false;
  if (volver) history.back();
  const abrir = document.querySelector("[data-reserva-abrir]");
  if (abrir && !desdePop) abrir.focus();
}

function abrirHoja() {
  const caja = pasosCaja();
  if (!caja) return;
  caja.hidden = false;
  caja.classList.add("abierta");
  const velo = document.querySelector("[data-reserva-velo]");
  if (velo) velo.hidden = false;
  document.body.classList.add("reserva-lock");
  if (!estado.empujado) {
    history.pushState({ reserva: 1 }, "");
    estado.empujado = true;
  }
  registrar("reserva_iniciada");
  const atraso = caja.querySelector("[data-reserva-atras]");
  if (atraso) atraso.focus();
}

function atrapar(caja, evento) {
  if (evento.key !== "Tab" || !caja || caja.hidden) return;
  const focos = [...caja.querySelectorAll("a, button, input, textarea, select")].filter(visible);
  if (!focos.length) return;
  const primero = focos[0];
  const ultimo = focos[focos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

function preguntar(texto) {
  return new Promise((resolve) => {
    let capa = document.querySelector("[data-reserva-confirma]");
    if (!capa) {
      capa = nodo("div", "reserva-confirma");
      capa.dataset.reservaConfirma = "1";
      capa.hidden = true;
      const card = nodo("div", "reserva-confirma-card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      const copia = nodo("p");
      copia.dataset.reservaConfirmaTexto = "1";
      const acciones = nodo("div", "reserva-confirma-acciones");
      const si = nodo("button", "btn", "Sí, cancelar");
      si.type = "button";
      si.dataset.confirmarSi = "1";
      const no = nodo("button", "btn btn-sec", "No");
      no.type = "button";
      no.dataset.confirmarNo = "1";
      acciones.append(si, no);
      card.append(copia, acciones);
      capa.appendChild(card);
      document.body.appendChild(capa);
    }
    capa.querySelector("[data-reserva-confirma-texto]").textContent = texto;
    capa.hidden = false;
    const si = capa.querySelector("[data-confirmar-si]");
    const no = capa.querySelector("[data-confirmar-no]");
    const cerrar = (valor) => {
      capa.hidden = true;
      si.removeEventListener("click", alSi);
      no.removeEventListener("click", alNo);
      resolve(valor);
    };
    const alSi = () => cerrar(true);
    const alNo = () => cerrar(false);
    si.addEventListener("click", alSi);
    no.addEventListener("click", alNo);
    si.focus();
  });
}

function descargarIcs(fila) {
  const inicio = instanteBogota(fila.fecha, fila.hora);
  const fin = inicio + (Number(fila.duracion_min) || 30) * 60000;
  const marca = (ms) => {
    const fecha = new Date(ms - 5 * 3600000);
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    const h = String(fecha.getUTCHours()).padStart(2, "0");
    const min = String(fecha.getUTCMinutes()).padStart(2, "0");
    return y + m + d + "T" + h + min + "00";
  };
  const limpio = (valor) => String(valor || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Mansion Barber Shop//Citas//ES",
    "BEGIN:VTIMEZONE",
    "TZID:America/Bogota",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0500",
    "TZNAME:COT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:" + (fila.numero || "cita") + "@lamansion",
    "DTSTART;TZID=America/Bogota:" + marca(inicio),
    "DTEND;TZID=America/Bogota:" + marca(fin),
    "SUMMARY:" + limpio((fila.servicio || "Cita") + " en " + negocio.nombre),
    "LOCATION:" + limpio(fila.direccion || negocio.direccion),
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const enlace = nodo("a");
  enlace.href = url;
  enlace.download = "cita-" + (fila.numero || "mansion") + ".ics";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function enlaceLlegar() {
  const enlace = nodo("a", "btn btn-sec", "Cómo llegar");
  enlace.href = enlaceDirecciones();
  enlace.target = "_blank";
  enlace.rel = "noopener";
  enlace.dataset.maps = "1";
  return enlace;
}

function pintarCita() {
  const host = document.querySelector("[data-cita-host]");
  if (!host) return;
  host.replaceChildren();
  const tokens = leerTokens();
  let fila = null;
  let token = "";
  for (const item of tokens) {
    const candidata = estado.citas.get(item);
    if (!candidata) continue;
    if (candidata.estado === "pendiente" || candidata.estado === "confirmada") {
      fila = candidata;
      token = item;
      break;
    }
  }
  if (!fila) {
    for (const item of tokens) {
      const candidata = estado.citas.get(item);
      if (!candidata) continue;
      fila = candidata;
      token = item;
      break;
    }
  }
  if (!fila) return;
  const tarjeta = nodo("article", "cita-card");
  tarjeta.appendChild(nodo("h3", null, "Tu cita"));
  const estadoTexto = ESTADOS[fila.estado] || fila.estado;
  const badge = nodo("p", "cita-estado estado-" + fila.estado, estadoTexto);
  tarjeta.appendChild(badge);
  tarjeta.appendChild(nodo("p", "cita-numero", "Cita " + (fila.numero || "")));
  const detalle = nodo("p", "cita-detalle");
  detalle.textContent = [fila.servicio, fila.barbero, fechaLegible(fila.fecha), horaLegible(fila.hora), negocio.direccion].filter(Boolean).join(" · ");
  tarjeta.appendChild(detalle);
  const terminal = fila.estado === "completada" || fila.estado === "cancelada" || fila.estado === "no_asistio";
  if (terminal) tarjeta.appendChild(nodo("p", "cita-gracias", "Gracias por venir"));
  const acciones = nodo("div", "cita-acciones");
  if (!terminal && fila.puede_cancelar) {
    const cancelar = nodo("button", "btn btn-sec", "Cancelar");
    cancelar.type = "button";
    cancelar.dataset.citaCancelar = "1";
    cancelar.addEventListener("click", () => cancelarCita(token, cancelar));
    const cambiar = nodo("button", "btn btn-sec", "Cambiar fecha u hora");
    cambiar.type = "button";
    cambiar.dataset.citaCambiar = "1";
    cambiar.addEventListener("click", () => abrirReagendar(token, fila));
    acciones.append(cancelar, cambiar);
  }
  if (terminal) {
    const descartar = nodo("button", "btn btn-sec", "Descartar");
    descartar.type = "button";
    descartar.dataset.citaDescartar = "1";
    descartar.addEventListener("click", () => {
      olvidarToken(token);
      estado.citas.delete(token);
      pintarCita();
    });
    acciones.appendChild(descartar);
  }
  const calendario = nodo("button", "btn btn-sec", "Agregar al calendario");
  calendario.type = "button";
  calendario.dataset.ics = "1";
  calendario.addEventListener("click", () => descargarIcs({ ...fila, direccion: negocio.direccion }));
  acciones.append(calendario, enlaceLlegar());
  tarjeta.appendChild(acciones);
  const nota = nodo("p", "form-error");
  nota.dataset.citaNota = "1";
  nota.hidden = true;
  nota.setAttribute("role", "alert");
  tarjeta.appendChild(nota);
  host.appendChild(tarjeta);
}

async function cancelarCita(token, boton) {
  const aceptar = await preguntar("¿Cancelar esta cita?");
  if (!aceptar) return;
  boton.disabled = true;
  try {
    const { error } = await estado.supabase.rpc("cancelar_reserva", { p_token: token });
    if (error) throw error;
    await refrescarCitas();
  } catch (error) {
    const nota = document.querySelector("[data-cita-nota]");
    if (nota) {
      nota.hidden = false;
      nota.textContent = traducir(error);
    }
  } finally {
    boton.disabled = false;
  }
}

function abrirReagendar(token, fila) {
  const barbero = estado.barberos.find((item) => item.nombre === fila.barbero);
  if (!barbero) return;
  estado.modo = "reagendar";
  estado.token = token;
  estado.barberoId = barbero.id;
  estado.servicioId = "";
  estado.fecha = fila.fecha;
  estado.hora = "";
  estado.ofertas = new Map();
  const lista = pasos();
  estado.paso = lista.indexOf("horario");
  if (estado.paso < 0) estado.paso = 0;
  abrirHoja();
  pintarPasos();
}

async function refrescarCitas() {
  const tokens = leerTokens();
  if (!tokens.length || !estado.supabase) {
    pintarCita();
    return;
  }
  for (const token of tokens) {
    try {
      const { data, error } = await estado.supabase.rpc("estado_reserva", { p_token: token });
      if (error || !data) {
        estado.citas.delete(token);
        continue;
      }
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila || !fila.estado) {
        estado.citas.delete(token);
        continue;
      }
      estado.citas.set(token, fila);
    } catch (error) {}
  }
  pintarCita();
}

function pintarFidelidad() {
  const host = document.querySelector("[data-fidelidad-host]");
  if (!host) return;
  host.replaceChildren();
  if (!estado.config || !estado.config.fidelidad_activa) return;
  const tarjeta = nodo("article", "fid-card");
  tarjeta.appendChild(nodo("h3", null, "Tu tarjeta"));
  const formulario = nodo("form", "fid-form");
  const label = nodo("label", "campo");
  label.appendChild(nodo("span", null, "Consulta tu tarjeta"));
  const input = document.createElement("input");
  input.type = "tel";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = 12;
  input.dataset.fidCel = "1";
  input.setAttribute("aria-label", "Celular para consultar la tarjeta");
  label.appendChild(input);
  const boton = nodo("button", "btn", "Consultar");
  boton.type = "submit";
  boton.dataset.fidVer = "1";
  formulario.append(label, boton);
  const error = nodo("p", "form-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  const resultado = nodo("div", "fid-resultado");
  resultado.dataset.fidResultado = "1";
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    const cel = celularValido(input.value);
    if (!cel.ok) {
      error.hidden = false;
      error.textContent = "Revisa tu celular: 10 dígitos y empieza por 3.";
      return;
    }
    boton.disabled = true;
    try {
      const { data, error: falloRpc } = await estado.supabase.rpc("mi_fidelidad", { p_telefono: cel.digitos });
      if (falloRpc) throw falloRpc;
      const ficha = Array.isArray(data) ? data[0] : data;
      pintarSellos(resultado, ficha);
    } catch (fallo) {
      error.hidden = false;
      error.textContent = traducir(fallo);
    } finally {
      boton.disabled = false;
    }
  });
  tarjeta.append(formulario, error, resultado);
  host.appendChild(tarjeta);
}

function pintarSellos(host, ficha) {
  host.replaceChildren();
  if (!ficha || ficha.activa === false) {
    host.appendChild(nodo("p", null, "La tarjeta de fidelidad no está activa."));
    return;
  }
  const meta = Math.max(1, Number(ficha.meta) || 1);
  const progreso = Math.max(0, Math.min(meta, Number(ficha.progreso) || 0));
  const grilla = nodo("div", "fid-sellos");
  grilla.setAttribute("role", "img");
  grilla.setAttribute("aria-label", progreso + " de " + meta + " sellos");
  for (let i = 0; i < meta; i += 1) {
    grilla.appendChild(nodo("span", "sello" + (i < progreso ? " is-on" : "")));
  }
  host.appendChild(grilla);
  if (ficha.gratis_disponible) {
    const aviso = nodo("p", "fid-gratis", "¡Tu próximo corte es gratis!");
    aviso.dataset.gratis = "1";
    host.appendChild(aviso);
    host.appendChild(nodo("p", null, "Pídelo al reservar."));
  }
}

function esqueleto(host, cantidad) {
  host.replaceChildren();
  host.setAttribute("aria-busy", "true");
  for (let i = 0; i < cantidad; i += 1) host.appendChild(nodo("div", "esqueleto"));
}

function progreso() {
  const lista = pasos();
  const barra = document.querySelector("[data-progreso]");
  if (!barra) return;
  const actual = Math.min(estado.paso + 1, lista.length);
  barra.setAttribute("aria-valuenow", String(actual));
  barra.setAttribute("aria-valuemax", String(lista.length));
  barra.replaceChildren();
  const texto = nodo("span", "progreso-texto", "Paso " + actual + " de " + lista.length + ": " + nombrePaso(lista[estado.paso] || "listo"));
  const pista = nodo("span", "progreso-pista");
  const relleno = nodo("span", "progreso-relleno");
  pista.appendChild(relleno);
  barra.append(texto, pista);
  const porcentaje = Math.round((actual / lista.length) * 100);
  aplicarRelleno(relleno, porcentaje);
}

function aplicarRelleno(el, porcentaje) {
  const id = "relleno-" + porcentaje;
  el.classList.add(id);
  if (!hoja || reglas.has(id)) return;
  reglas.add(id);
  try {
    hoja.insertRule("." + id + "{transform:scaleX(" + (porcentaje / 100) + ")}", hoja.cssRules.length);
  } catch (error) {}
}

function elegirServicio(servicio) {
  estado.servicioId = servicio.id;
  estado.barberoId = "";
  estado.hora = "";
  estado.fecha = hoyISO();
  const disponibles = barberosDelPaso();
  if (disponibles.length === 1) {
    estado.barberoId = disponibles[0].id;
    estado.paso = Math.max(0, pasos().indexOf("horario"));
  } else {
    estado.paso = Math.max(0, pasos().indexOf("barbero"));
  }
  pintarPasos();
  const titulo = pasosCaja() && pasosCaja().querySelector("[data-paso-titulo]");
  if (titulo) titulo.focus();
}

function retroceder() {
  const caja = pasosCaja();
  if (estado.modo === "reagendar" || (caja && caja.querySelector("[data-reserva-numero]")) || estado.paso <= 0) {
    estado.modo = "";
    cerrarHoja(false);
    return;
  }
  const clave = pasos()[estado.paso];
  if (clave === "horario" && barberosDelPaso().length <= 1) estado.paso = pasos().indexOf("servicio");
  else estado.paso -= 1;
  if (estado.paso < 0) estado.paso = 0;
  pintarPasos();
}

function pintarPasos() {
  const caja = pasosCaja();
  if (!caja) return;
  const cuerpo = caja.querySelector("[data-paso]");
  if (!cuerpo) return;
  const lista = pasos();
  if (estado.paso >= lista.length) estado.paso = lista.length - 1;
  if (estado.paso < 0) estado.paso = 0;
  progreso();
  const clave = estado.modo === "reagendar" ? "horario" : lista[estado.paso];
  cuerpo.replaceChildren();
  if (clave === "servicio") pintarServicios(cuerpo);
  if (clave === "barbero") pintarBarberos(cuerpo);
  if (clave === "horario") pintarHorario(cuerpo);
  if (clave === "datos") pintarDatos(cuerpo);
  const titulo = caja.querySelector("[data-paso-titulo]");
  if (titulo) titulo.textContent = estado.modo === "reagendar" ? "Cambiar fecha u hora" : nombrePaso(clave);
}

function avanzar() {
  estado.paso += 1;
  pintarPasos();
  const titulo = pasosCaja() && pasosCaja().querySelector("[data-paso-titulo]");
  if (titulo) titulo.focus();
}

function categoriaPublica(nombre) {
  return nombre && !["Niños", "Mujer", "Color"].includes(nombre);
}

function pintarServicios(host) {
  const visibles = serviciosActivos().filter((item) => categoriaPublica(item.categoria));
  const categorias = ["Todos", ...new Set(visibles.map((item) => item.categoria).filter(Boolean))];
  let activa = "Todos";
  const chips = nodo("div", "chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Categorías");
  const lista = nodo("div", "opciones");
  const pintar = () => {
    lista.replaceChildren();
    visibles.filter((item) => activa === "Todos" || item.categoria === activa).forEach((servicio) => {
      const boton = nodo("button", "opcion", "");
      boton.type = "button";
      boton.dataset.servicio = servicio.id;
      const meta = [];
      if (servicio.duracion_min) meta.push(servicio.duracion_min + " min");
      const precio = precioDe(servicio);
      if (precio) meta.push(precio);
      boton.append(nodo("strong", null, servicio.nombre), nodo("span", null, servicio.descripcion || ""));
      if (meta.length) boton.append(nodo("span", null, meta.join(" · ")));
      boton.addEventListener("click", () => elegirServicio(servicio));
      lista.appendChild(boton);
    });
  };
  categorias.forEach((categoria) => {
    const chip = nodo("button", "chip" + (categoria === activa ? " is-on" : ""), categoria);
    chip.type = "button";
    chip.setAttribute("aria-pressed", categoria === activa ? "true" : "false");
    chip.addEventListener("click", () => {
      activa = categoria;
      [...chips.children].forEach((item) => {
        const on = item.textContent === categoria;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-pressed", on ? "true" : "false");
      });
      pintar();
    });
    chips.appendChild(chip);
  });
  host.append(chips, lista);
  pintar();
}

function pintarBarberos(host) {
  const lista = nodo("div", "opciones");
  const primero = nodo("button", "opcion", "");
  primero.type = "button";
  primero.dataset.barbero = "primero";
  primero.append(nodo("strong", null, "El primero disponible"), nodo("span", null, "Te asignamos al primer barbero con esa hora."));
  primero.addEventListener("click", () => {
    estado.barberoId = "";
    estado.fecha = hoyISO();
    avanzar();
  });
  lista.appendChild(primero);
  barberosDelPaso().forEach((barbero) => {
    const boton = nodo("button", "opcion", "");
    boton.type = "button";
    boton.dataset.barbero = barbero.id;
    const texto = nodo("span", "opcion-texto");
    texto.append(nodo("strong", null, barbero.nombre), nodo("span", null, barbero.especialidad || ""));
    if (barbero.foto) {
      const foto = document.createElement("img");
      foto.src = "assets/img/fotos/" + barbero.foto + "-480.webp";
      foto.width = 96;
      foto.height = 120;
      foto.alt = "";
      boton.append(foto, texto);
    } else {
      boton.appendChild(texto);
    }
    boton.addEventListener("click", () => {
      estado.barberoId = barbero.id;
      estado.fecha = hoyISO();
      avanzar();
    });
    lista.appendChild(boton);
  });
  if (barberosDelPaso().length === 0) {
    host.appendChild(nodo("p", null, "Ese servicio o barbero ya no está disponible. Elige otro."));
    return;
  }
  host.appendChild(lista);
}

async function cargarHoras(fecha) {
  const servicio = servicioActual();
  const duracion = estado.modo === "reagendar"
    ? Number((estado.citas.get(estado.token) || {}).duracion_min) || 30
    : Number(servicio && servicio.duracion_min) || 30;
  const mapa = new Map();
  if (estado.modo === "reagendar" || estado.barberoId) {
    const idBarbero = estado.barberoId;
    const { data, error } = await estado.supabase.rpc("horas_disponibles", {
      p_barbero: idBarbero,
      p_fecha: fecha,
      p_duracion: duracion
    });
    if (error) throw error;
    (Array.isArray(data) ? data : []).forEach((fila) => {
      const slot = String(fila.slot || "").slice(0, 5);
      if (slot) mapa.set(slot, [idBarbero]);
    });
    return mapa;
  }
  const candidatos = barberosDelPaso();
  const respuestas = await Promise.all(candidatos.map((barbero) => estado.supabase.rpc("horas_disponibles", {
    p_barbero: barbero.id,
    p_fecha: fecha,
    p_duracion: duracion
  })));
  candidatos.forEach((barbero, indice) => {
    const respuesta = respuestas[indice];
    if (!respuesta || respuesta.error || !Array.isArray(respuesta.data)) return;
    respuesta.data.forEach((fila) => {
      const slot = String(fila.slot || "").slice(0, 5);
      if (!slot) return;
      const lista = mapa.get(slot) || [];
      lista.push(barbero.id);
      mapa.set(slot, lista);
    });
  });
  return mapa;
}

async function sugerirDia(desde) {
  const maximo = Math.max(1, Number(estado.config && estado.config.dias_max) || 14);
  const hoy = hoyISO();
  for (let salto = 1; salto <= Math.min(14, maximo); salto += 1) {
    const fecha = sumarDias(desde, salto);
    if (fecha > sumarDias(hoy, maximo - 1)) break;
    try {
      const mapa = await cargarHoras(fecha);
      if (mapa.size) return fecha;
    } catch (error) {
      return "";
    }
  }
  return "";
}

function pintarHorario(host) {
  const maximo = Math.max(1, Number(estado.config && estado.config.dias_max) || 14);
  const hoy = hoyISO();
  if (!estado.fecha) estado.fecha = hoy;
  const tira = nodo("div", "dias-tira");
  tira.setAttribute("role", "listbox");
  tira.setAttribute("aria-label", "Fechas");
  const visibles = Math.min(estado.fechas, maximo);
  for (let i = 0; i < visibles; i += 1) {
    const fecha = sumarDias(hoy, i);
    const boton = nodo("button", "dia-btn" + (fecha === estado.fecha ? " is-on" : ""), "");
    boton.type = "button";
    boton.dataset.dia = fecha;
    if (fecha === hoy) boton.dataset.hoy = "1";
    boton.setAttribute("aria-pressed", fecha === estado.fecha ? "true" : "false");
    boton.append(nodo("span", "dia-nombre", fecha === hoy ? "Hoy" : fechaCorta(fecha).split(" ")[0]), nodo("span", "dia-numero", String(Number(fecha.slice(8)))));
    boton.addEventListener("click", () => {
      estado.fecha = fecha;
      estado.hora = "";
      pintarPasos();
    });
    tira.appendChild(boton);
  }
  tira.addEventListener("keydown", (evento) => {
    const botones = [...tira.querySelectorAll("[data-dia]")];
    const indice = botones.indexOf(document.activeElement);
    if (indice < 0) return;
    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      evento.preventDefault();
      const siguiente = botones[indice + (evento.key === "ArrowRight" ? 1 : -1)];
      if (siguiente) siguiente.focus();
    }
  });
  host.appendChild(tira);
  if (visibles < maximo) {
    const mas = nodo("button", "btn btn-sec", "Ver más fechas");
    mas.type = "button";
    mas.dataset.masFechas = "1";
    mas.addEventListener("click", () => {
      estado.fechas = Math.min(maximo, estado.fechas + 14);
      pintarPasos();
    });
    host.appendChild(mas);
  }
  const horas = nodo("div", "horas");
  horas.dataset.horas = "1";
  host.appendChild(horas);
  esqueleto(horas, 4);
  cargarHoras(estado.fecha).then((mapa) => {
    estado.ofertas = mapa;
    pintarHoras(horas, mapa);
  }).catch(() => {
    horas.removeAttribute("aria-busy");
    horas.replaceChildren(nodo("p", null, "No pudimos cargar las horas. Intenta de nuevo."));
  });
}

function pintarHoras(host, mapa) {
  host.removeAttribute("aria-busy");
  host.replaceChildren();
  const slots = [...mapa.keys()].sort();
  if (!slots.length) {
    const vacio = nodo("div");
    vacio.dataset.sinHoras = "1";
    vacio.appendChild(nodo("p", null, "Sin horarios este día"));
    host.appendChild(vacio);
    sugerirDia(estado.fecha).then((fecha) => {
      if (!fecha || !vacio.isConnected) return;
      const ir = nodo("button", "btn btn-sec", "Ver " + fechaLegible(fecha));
      ir.type = "button";
      ir.addEventListener("click", () => {
        estado.fecha = fecha;
        const distancia = Math.round((instanteBogota(fecha, "12:00") - instanteBogota(hoyISO(), "12:00")) / 86400000);
        estado.fechas = Math.max(estado.fechas, distancia + 1);
        pintarPasos();
      });
      vacio.appendChild(ir);
    });
    return;
  }
  const grupos = [
    ["Mañana", (slot) => aMinutos(slot) < 12 * 60],
    ["Tarde", (slot) => aMinutos(slot) >= 12 * 60 && aMinutos(slot) < 18 * 60],
    ["Noche", (slot) => aMinutos(slot) >= 18 * 60]
  ];
  grupos.forEach(([titulo, filtro]) => {
    const delGrupo = slots.filter(filtro);
    if (!delGrupo.length) return;
    const bloque = nodo("div", "hora-grupo");
    bloque.appendChild(nodo("p", "hora-titulo", titulo));
    const fila = nodo("div", "hora-fila");
    delGrupo.forEach((slot) => {
      const boton = nodo("button", "hora-btn" + (slot === estado.hora ? " is-on" : ""), horaLegible(slot));
      boton.type = "button";
      boton.dataset.hora = slot;
      boton.addEventListener("click", () => elegirHora(slot));
      fila.appendChild(boton);
    });
    fila.addEventListener("keydown", (evento) => {
      const botones = [...fila.querySelectorAll("[data-hora]")];
      const indice = botones.indexOf(document.activeElement);
      if (indice < 0) return;
      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        evento.preventDefault();
        const siguiente = botones[indice + (evento.key === "ArrowRight" ? 1 : -1)];
        if (siguiente) siguiente.focus();
      }
    });
    bloque.appendChild(fila);
    host.appendChild(bloque);
  });
}

function elegirHora(slot) {
  estado.hora = slot;
  if (estado.modo === "reagendar") {
    const boton = nodo("button", "btn", "Guardar nueva hora");
    boton.type = "button";
    boton.dataset.reagendar = "1";
    let existente = document.querySelector("[data-reagendar]");
    if (!existente) {
      const horas = document.querySelector("[data-horas]");
      if (horas) horas.after(boton);
      existente = boton;
      boton.addEventListener("click", () => guardarReagendo(boton));
    }
    return;
  }
  avanzar();
}

async function guardarReagendo(boton) {
  boton.disabled = true;
  try {
    const { error } = await estado.supabase.rpc("reagendar_reserva", {
      p_token: estado.token,
      p_fecha: estado.fecha,
      p_hora: estado.hora
    });
    if (error) throw error;
    estado.modo = "";
    cerrarHoja();
    await refrescarCitas();
  } catch (error) {
    const horas = document.querySelector("[data-horas]");
    if (horas) horas.appendChild(nodo("p", "form-error", traducir(error)));
  } finally {
    boton.disabled = false;
  }
}

function resumenCita() {
  const servicio = servicioActual();
  const oferta = estado.ofertas.get(estado.hora) || [];
  const barbero = estado.barberoId ? barberoPorId(estado.barberoId) : barberoPorId(oferta[0]);
  const caja = nodo("aside", "reserva-resumen");
  caja.appendChild(nodo("p", "etiqueta", "Tu cita"));
  caja.appendChild(nodo("p", null, servicio ? servicio.nombre : ""));
  caja.appendChild(nodo("p", null, barbero ? barbero.nombre : "El primero disponible"));
  caja.appendChild(nodo("p", null, fechaLegible(estado.fecha) + " · " + horaLegible(estado.hora)));
  const precio = precioDe(servicio);
  if (precio) caja.appendChild(nodo("p", null, precio));
  return caja;
}

function pintarDatos(host) {
  const formulario = nodo("form", "reserva-datos");
  const ofertaInicial = estado.ofertas.get(estado.hora) || [];
  formulario.dataset.barbero = estado.barberoId || ofertaInicial[0] || "";
  formulario.dataset.servicio = estado.servicioId;
  formulario.dataset.fecha = estado.fecha;
  formulario.dataset.hora = estado.hora;
  const campos = nodo("div", "reserva-campos");
  const nombre = document.createElement("input");
  nombre.name = "nombre";
  nombre.autocomplete = "name";
  nombre.required = true;
  nombre.maxLength = 80;
  const labelNombre = nodo("label", "campo");
  labelNombre.append(nodo("span", null, "Nombre"), nombre);
  const celular = document.createElement("input");
  celular.name = "celular";
  celular.type = "tel";
  celular.inputMode = "numeric";
  celular.autocomplete = "tel";
  celular.required = true;
  celular.maxLength = 12;
  celular.dataset.cel = "1";
  const ayuda = nodo("p", "ayuda");
  ayuda.dataset.celAyuda = "1";
  celular.addEventListener("input", () => {
    if (!celular.value) {
      ayuda.textContent = "";
      return;
    }
    ayuda.textContent = celularValido(celular.value).ok ? "" : "Revisa tu celular: 10 dígitos y empieza por 3.";
  });
  const labelCel = nodo("label", "campo");
  labelCel.append(nodo("span", null, "Celular"), celular, ayuda);
  const notas = document.createElement("textarea");
  notas.name = "notas";
  notas.maxLength = 200;
  notas.rows = 3;
  const cuenta = nodo("p", "ayuda", "0/200");
  notas.addEventListener("input", () => {
    if (notas.value.length > 200) notas.value = notas.value.slice(0, 200);
    cuenta.textContent = notas.value.length + "/200";
  });
  const labelNotas = nodo("label", "campo");
  labelNotas.append(nodo("span", null, "Notas"), notas, cuenta);
  const trampa = document.createElement("input");
  trampa.type = "text";
  trampa.name = "website";
  trampa.tabIndex = -1;
  trampa.autocomplete = "off";
  trampa.autocapitalize = "off";
  trampa.spellcheck = false;
  trampa.setAttribute("aria-hidden", "true");
  trampa.dataset.trampa = "1";
  const trampaCaja = nodo("div", "reserva-trampa");
  const trampaLabel = document.createElement("label");
  trampaLabel.append(document.createTextNode("Sitio web"), trampa);
  trampaCaja.appendChild(trampaLabel);
  const check = document.createElement("input");
  check.type = "checkbox";
  check.name = "autoriza";
  check.required = true;
  check.checked = false;
  const labelCheck = nodo("label", "reserva-check casilla");
  const politica = nodo("a", null, "Política de tratamiento de datos");
  politica.href = "politica-de-datos.html";
  politica.target = "_blank";
  politica.rel = "noopener";
  politica.addEventListener("click", (evento) => evento.stopPropagation());
  const textoCheck = document.createElement("span");
  textoCheck.append(document.createTextNode("Autorizo el tratamiento de mis datos personales según la "), politica);
  labelCheck.append(check, marcaCasilla(), textoCheck);
  const menor = nodo("p", "reserva-menor", "Si reservas para un menor, declaras ser su padre, madre o representante.");
  const error = nodo("p", "form-error");
  error.hidden = true;
  error.dataset.formError = "1";
  error.setAttribute("role", "alert");
  const enviar = nodo("button", "btn", "Confirmar reserva");
  enviar.type = "submit";
  enviar.dataset.reservaEnviar = "1";
  enviar.disabled = true;
  check.addEventListener("change", () => {
    enviar.disabled = !check.checked;
  });
  campos.append(trampaCaja, labelNombre, labelCel, labelNotas, labelCheck, menor, error, enviar);
  formulario.noValidate = true;
  formulario.append(campos, resumenCita());
  formulario.addEventListener("submit", (evento) => enviarReserva(evento, formulario, enviar, error));
  host.appendChild(formulario);
}

async function enviarReserva(evento, formulario, boton, error) {
  evento.preventDefault();
  error.hidden = true;
  const datos = new FormData(formulario);
  const trampa = String(datos.get("website") || "").trim();
  if (trampa) {
    const ofertaTrampa = estado.ofertas.get(estado.hora) || [];
    const barberoTrampa = estado.barberoId || ofertaTrampa[0];
    const nombreTrampa = nombreValido(datos.get("nombre"));
    const celTrampa = celularValido(datos.get("celular"));
    if (barberoTrampa && nombreTrampa && celTrampa.ok && estado.supabase) {
      estado.supabase.rpc("crear_reserva", {
        p_barbero: barberoTrampa,
        p_servicio: estado.servicioId,
        p_fecha: estado.fecha,
        p_hora: estado.hora,
        p_nombre: nombreTrampa,
        p_telefono: celTrampa.digitos,
        p_notas: "",
        p_autoriza: true,
        p_trampa: trampa
      }).then(() => {}).catch(() => {});
    }
    pintarConfirmacion({ token: "", numero: "" }, nombreTrampa || "");
    return;
  }
  const nombre = nombreValido(datos.get("nombre"));
  const cel = celularValido(datos.get("celular"));
  if (!nombre) {
    error.hidden = false;
    error.textContent = "Escribe tu nombre.";
    return;
  }
  if (!cel.ok) {
    error.hidden = false;
    error.textContent = "Revisa tu celular: 10 dígitos y empieza por 3.";
    return;
  }
  if (!datos.get("autoriza")) {
    error.hidden = false;
    error.textContent = "Debes aceptar el tratamiento de datos para reservar.";
    boton.disabled = true;
    return;
  }
  const oferta = estado.ofertas.get(estado.hora) || [];
  const barbero = estado.barberoId || oferta[0];
  if (!barbero) {
    error.hidden = false;
    error.textContent = "Esa hora acaba de ocuparse. Elige otra.";
    return;
  }
  boton.disabled = true;
  boton.textContent = "Reservando…";
  try {
    const payload = {
      p_barbero: barbero,
      p_servicio: estado.servicioId,
      p_fecha: estado.fecha,
      p_hora: estado.hora,
      p_nombre: nombre,
      p_telefono: cel.digitos,
      p_notas: String(datos.get("notas") || "").slice(0, 200),
      p_autoriza: true,
      p_trampa: ""
    };
    let respuesta = await estado.supabase.rpc("crear_reserva", payload);
    const avisoRpc = String((respuesta.error && (respuesta.error.message || respuesta.error.details)) || "");
    if (respuesta.error && /p_trampa|schema cache/i.test(avisoRpc)) {
      delete payload.p_trampa;
      respuesta = await estado.supabase.rpc("crear_reserva", payload);
    }
    const data = respuesta.data;
    const falloRpc = respuesta.error;
    if (falloRpc) throw falloRpc;
    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila || !fila.token) throw new Error("sin token");
    guardarToken(fila.token);
    await refrescarCitas();
    pintarConfirmacion(fila, nombre);
  } catch (fallo) {
    error.hidden = false;
    error.textContent = traducir(fallo);
    boton.disabled = !formulario.elements.autoriza.checked;
    boton.textContent = "Confirmar reserva";
  }
}

function pintarConfirmacion(creada, nombre) {
  const caja = pasosCaja();
  if (!caja) return;
  const cuerpo = caja.querySelector("[data-paso]");
  const titulo = caja.querySelector("[data-paso-titulo]");
  if (titulo) titulo.textContent = "Listo";
  const fila = estado.citas.get(String(creada.token).toLowerCase()) || {
    numero: creada.numero,
    nombre,
    servicio: (servicioActual() || {}).nombre,
    barbero: (barberoPorId(estado.barberoId) || barberoPorId((estado.ofertas.get(estado.hora) || [])[0]) || {}).nombre,
    fecha: estado.fecha,
    hora: estado.hora,
    duracion_min: (servicioActual() || {}).duracion_min,
    direccion: negocio.direccion,
    precio: (servicioActual() || {}).precio
  };
  cuerpo.replaceChildren();
  const listo = nodo("div", "reserva-lista");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");
  svg.setAttribute("class", "check");
  svg.setAttribute("aria-hidden", "true");
  const palo = document.createElementNS(svg.namespaceURI, "path");
  palo.setAttribute("d", "M18 33 l8 8 18-18");
  palo.setAttribute("class", "check-palo");
  svg.appendChild(palo);
  listo.appendChild(svg);
  const numero = nodo("p", "cita-numero", "Cita " + (creada.numero || fila.numero || ""));
  numero.dataset.reservaNumero = "1";
  listo.append(numero, nodo("p", null, fila.servicio || ""), nodo("p", null, fila.barbero || ""), nodo("p", null, fechaLegible(fila.fecha) + " · " + horaLegible(fila.hora)), nodo("p", null, negocio.direccion));
  const acciones = nodo("div", "cita-acciones");
  const calendario = nodo("button", "btn btn-sec", "Agregar al calendario");
  calendario.type = "button";
  calendario.dataset.ics = "1";
  calendario.addEventListener("click", () => descargarIcs({ ...fila, nombre, numero: creada.numero || fila.numero, direccion: negocio.direccion }));
  const cambiar = nodo("button", "btn btn-sec", "Cambiar o cancelar");
  cambiar.type = "button";
  cambiar.addEventListener("click", () => {
    estado.modo = "";
    cerrarHoja(false);
    const cita = document.querySelector("[data-cita-host]");
    if (cita) cita.focus();
  });
  acciones.append(calendario, enlaceLlegar(), cambiar);
  listo.appendChild(acciones);
  cuerpo.appendChild(listo);
  const barra = caja.querySelector("[data-progreso]");
  if (barra) barra.hidden = true;
  if (titulo) titulo.focus();
}

function pintarNoDisponible(cuerpo) {
  if (!cuerpo) return;
  cuerpo.replaceChildren();
  const titulo = pasosCaja() && pasosCaja().querySelector("[data-paso-titulo]");
  if (titulo) titulo.textContent = "Reserva tu cita";
  const barra = document.querySelector("[data-progreso]");
  if (barra) barra.hidden = true;
  cuerpo.appendChild(nodo("p", null, "La agenda en línea no está disponible por ahora. Intenta de nuevo en unos minutos."));
  const acciones = nodo("div", "cita-acciones");
  const reintentar = nodo("button", "btn", "Reintentar");
  reintentar.type = "button";
  reintentar.addEventListener("click", () => reintentarCarga(reintentar));
  const llamar = nodo("a", "btn btn-sec", "Llamar");
  const tel = enlaceTelefono();
  if (tel) llamar.href = tel;
  llamar.dataset.tel = "1";
  acciones.append(reintentar, llamar);
  cuerpo.appendChild(acciones);
}

function aplicarPrecarga() {
  const servicio = resolverServicio(estado.claveServicio, estado.nombreServicio);
  if (!servicio) {
    estado.paso = 0;
    return;
  }
  elegirServicio(servicio);
}

let carga = Promise.resolve();

async function abrirPublico(clave, nombre) {
  await carga;
  estado.claveServicio = clave || "";
  estado.nombreServicio = nombre || "";
  estado.modo = "";
  if (!estado.lista) {
    const cuerpo = pasosCaja() && pasosCaja().querySelector("[data-paso]");
    pintarNoDisponible(cuerpo);
    abrirHoja();
    return;
  }
  fijarSede();
  estado.paso = 0;
  estado.servicioId = "";
  estado.barberoId = "";
  estado.hora = "";
  abrirHoja();
  if (estado.claveServicio || estado.nombreServicio) aplicarPrecarga();
  else pintarPasos();
}

async function reintentarCarga(boton) {
  if (boton) boton.disabled = true;
  if (reservasEnLinea()) {
    if (!estado.supabase) estado.supabase = await obtenerSupabase();
    try {
      await cargarCatalogo();
      estado.lista = agendaLista();
    } catch (error) {
      estado.lista = false;
    }
  }
  if (boton) boton.disabled = false;
  if (!estado.lista) {
    pintarNoDisponible(pasosCaja() && pasosCaja().querySelector("[data-paso]"));
    return;
  }
  const barra = document.querySelector("[data-progreso]");
  if (barra) barra.hidden = false;
  estado.paso = 0;
  estado.modo = "";
  fijarSede();
  if (estado.claveServicio || estado.nombreServicio) aplicarPrecarga();
  else pintarPasos();
  pintarFidelidad();
  refrescarCitas();
}

function montarInterfaz() {
  const raiz = app();
  const cerrada = document.querySelector("[data-reserva-cerrada]");
  if (cerrada) cerrada.hidden = true;
  if (raiz) {
    raiz.hidden = false;
    raiz.replaceChildren();
    const seccion = document.getElementById("reservas");
    const titulo = nodo("h2", null, "Reserva tu cita en línea");
    titulo.id = "reservas-vivo";
    if (seccion) seccion.setAttribute("aria-labelledby", "reservas-vivo");
    const cita = nodo("div");
    cita.dataset.citaHost = "1";
    cita.tabIndex = -1;
    const fid = nodo("div");
    fid.dataset.fidelidadHost = "1";
    const abrir = nodo("button", "btn", "Reserva tu cita");
    abrir.type = "button";
    abrir.dataset.reservaAbrir = "1";
    abrir.dataset.reservar = "1";
    raiz.append(titulo, abrir, cita, fid);
  }
  if (pasosCaja()) return;
  const velo = nodo("div", "reserva-velo");
  velo.dataset.reservaVelo = "1";
  velo.hidden = true;
  velo.addEventListener("click", () => cerrarHoja(false));
  const caja = nodo("div", "reserva-pasos");
  caja.dataset.reservaPasos = "1";
  caja.hidden = true;
  caja.setAttribute("role", "dialog");
  caja.setAttribute("aria-modal", "true");
  caja.setAttribute("aria-labelledby", "reserva-paso-titulo");
  const barraTop = nodo("div", "reserva-top");
  const atras = nodo("button", "btn btn-sec", "Atrás");
  atras.type = "button";
  atras.dataset.reservaAtras = "1";
  const h = nodo("h3");
  h.id = "reserva-paso-titulo";
  h.tabIndex = -1;
  h.dataset.pasoTitulo = "1";
  const barra = nodo("div", "progreso");
  barra.dataset.progreso = "1";
  barra.setAttribute("role", "progressbar");
  barra.setAttribute("aria-valuemin", "1");
  barraTop.append(atras, h);
  const cuerpo = nodo("div");
  cuerpo.dataset.paso = "1";
  caja.append(barraTop, barra, cuerpo);
  atras.addEventListener("click", retroceder);
  document.body.append(velo, caja);
}

async function cargarCatalogo() {
  const supabase = estado.supabase;
  const [config, sedes, barberos, servicios, horarios] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).limit(1),
    supabase.from("sedes").select("*").eq("activa", true).order("orden"),
    supabase.from("barberos").select("*").eq("activo", true).order("orden"),
    supabase.from("servicios").select("*").order("orden"),
    supabase.from("horarios").select("*")
  ]);
  if (config.error || sedes.error || barberos.error || servicios.error || horarios.error) throw new Error("carga");
  estado.config = (config.data && config.data[0]) || null;
  estado.sedes = sedes.data || [];
  estado.barberos = barberos.data || [];
  estado.servicios = servicios.data || [];
  estado.horarios = horarios.data || [];
}

function leerPrecarga() {
  const params = new URLSearchParams(window.location.search);
  const servicio = params.get("servicio") || "";
  if (window.location.hash === "#reservar" || servicio) abrirPublico(servicio, "");
}

async function prepararCatalogo() {
  if (!reservasEnLinea()) {
    estado.lista = false;
    return;
  }
  estado.supabase = await obtenerSupabase();
  if (!estado.supabase) {
    estado.lista = false;
    return;
  }
  try {
    if (!sessionStorage.getItem(VISITA)) {
      sessionStorage.setItem(VISITA, "1");
      registrar("visita");
    }
  } catch (error) {}
  try {
    await cargarCatalogo();
    estado.lista = agendaLista();
  } catch (error) {
    estado.lista = false;
  }
  if (!estado.lista) return;
  pintarFidelidad();
  await refrescarCitas();
  window.setInterval(() => {
    if (document.visibilityState === "visible") refrescarCitas();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refrescarCitas();
  });
}

export async function iniciarReservas() {
  montarInterfaz();
  carga = prepararCatalogo();
  document.addEventListener("click", (evento) => {
    const reservar = evento.target.closest("[data-reservar]");
    if (reservar) {
      if (reservar.tagName === "A") evento.preventDefault();
      abrirPublico(reservar.getAttribute("data-servicio") || "", reservar.getAttribute("data-servicio-nombre") || "");
      return;
    }
    const nodoClic = evento.target.closest("[data-wa], [data-wa-contacto], [data-tel], [data-maps]");
    if (!nodoClic || !estado.supabase) return;
    if (nodoClic.hasAttribute("data-wa") || nodoClic.hasAttribute("data-wa-contacto")) registrar("clic_whatsapp");
    else if (nodoClic.hasAttribute("data-tel")) registrar("clic_llamar");
    else registrar("clic_mapa");
  });
  window.addEventListener("popstate", () => {
    const caja = pasosCaja();
    if (caja && !caja.hidden) cerrarHoja(true);
  });
  document.addEventListener("keydown", (evento) => {
    const caja = pasosCaja();
    const visor = document.querySelector("[data-visor]");
    if (visor && !visor.hidden) return;
    if (evento.key === "Escape") {
      const confirma = document.querySelector("[data-reserva-confirma]");
      if (confirma && !confirma.hidden) {
        const no = confirma.querySelector("[data-confirmar-no]");
        if (no) no.click();
        return;
      }
      if (caja && !caja.hidden) cerrarHoja(false);
      return;
    }
    if (caja && !caja.hidden) atrapar(caja, evento);
  });
  await carga;
  leerPrecarga();
}
