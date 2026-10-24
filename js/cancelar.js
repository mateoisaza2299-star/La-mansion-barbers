import { obtenerSupabase } from "./supabase.js";
import { traducir } from "./errores.js";
import * as tiempo from "./tiempo.js";

const DIAS_CITA = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES_CITA = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaRespaldo(iso) {
  const partes = String(iso || "").split("-").map(Number);
  if (partes.length < 3 || !partes[0] || !partes[1] || !partes[2]) return "";
  const dia = new Date(Date.UTC(partes[0], partes[1] - 1, partes[2])).getUTCDay();
  if (!DIAS_CITA[dia] || !MESES_CITA[partes[1] - 1]) return "";
  return DIAS_CITA[dia] + " " + partes[2] + " de " + MESES_CITA[partes[1] - 1];
}

function horaRespaldo(hhmm) {
  const coincidencia = /^(\d{1,2}):(\d{2})/.exec(String(hhmm || ""));
  if (!coincidencia) return "";
  const hora = Number(coincidencia[1]);
  const minuto = Number(coincidencia[2]);
  if (hora > 23 || minuto > 59) return "";
  const sufijo = hora < 12 ? "a. m." : "p. m.";
  const doce = hora % 12 === 0 ? 12 : hora % 12;
  return doce + ":" + String(minuto).padStart(2, "0") + " " + sufijo;
}

function fechaCita(iso) {
  return typeof tiempo.fechaCita === "function" ? tiempo.fechaCita(iso) : fechaRespaldo(iso);
}

function horaLegible(hhmm) {
  return typeof tiempo.horaLegible === "function" ? tiempo.horaLegible(hhmm) : horaRespaldo(hhmm);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MENSAJES = {
  cancelada: "Esta cita ya fue cancelada",
  pasada: "Esta cita ya pasó",
  no_encontrada: "No encontramos esa cita."
};

function tokenDe() {
  const token = new URLSearchParams(window.location.search).get("token") || "";
  const limpio = String(token).trim();
  return UUID.test(limpio) ? limpio : "";
}

function mostrarDatos(fila) {
  const servicio = document.querySelector("[data-cancelar-servicio]");
  const fecha = document.querySelector("[data-cancelar-fecha]");
  const hora = document.querySelector("[data-cancelar-hora]");
  if (servicio) {
    servicio.hidden = false;
    servicio.textContent = fila.servicio || "";
  }
  if (fecha) {
    fecha.hidden = false;
    fecha.textContent = fechaCita(fila.fecha);
  }
  if (hora) {
    hora.hidden = false;
    hora.textContent = horaLegible(fila.hora);
  }
}

function aviso(texto) {
  const caja = document.querySelector("[data-cancelar-estado]");
  if (!caja) return;
  caja.hidden = false;
  caja.textContent = texto;
}

function listo() {
  const titulo = document.querySelector("[data-cancelar-titulo]");
  const abrir = document.querySelector("[data-cancelar-abrir]");
  const otra = document.querySelector("[data-cancelar-otra]");
  const dialog = document.querySelector("[data-cancelar-confirma]");
  if (titulo) titulo.textContent = "Cita cancelada";
  aviso("Tu cita quedó cancelada. El horario volvió a quedar libre.");
  if (abrir) abrir.hidden = true;
  if (otra) {
    otra.hidden = false;
    otra.focus();
  }
  if (dialog) dialog.hidden = true;
}

async function confirmar(token) {
  const si = document.querySelector("[data-cancelar-si]");
  if (si) si.disabled = true;
  try {
    const supabase = await obtenerSupabase();
    if (!supabase) {
      aviso("La agenda en línea no está disponible por ahora.");
      return;
    }
    const { error } = await supabase.rpc("cancelar_cita", { p_token: token, p_confirmar: true });
    if (error) throw error;
    listo();
  } catch (error) {
    aviso(traducir(error));
    const dialog = document.querySelector("[data-cancelar-confirma]");
    if (dialog) dialog.hidden = true;
  } finally {
    if (si) si.disabled = false;
  }
}

function prepararConfirmacion(token) {
  const abrir = document.querySelector("[data-cancelar-abrir]");
  const dialog = document.querySelector("[data-cancelar-confirma]");
  const si = document.querySelector("[data-cancelar-si]");
  const no = document.querySelector("[data-cancelar-no]");
  if (!abrir || !dialog || !si || !no) return;
  abrir.hidden = false;
  abrir.addEventListener("click", () => {
    dialog.hidden = false;
    si.focus();
  });
  no.addEventListener("click", () => {
    dialog.hidden = true;
    abrir.focus();
  });
  si.addEventListener("click", () => confirmar(token));
}

async function cargar() {
  const token = tokenDe();
  if (!token) {
    aviso(MENSAJES.no_encontrada);
    return;
  }
  const supabase = await obtenerSupabase();
  if (!supabase) {
    aviso("La agenda en línea no está disponible por ahora.");
    return;
  }
  const { data, error } = await supabase.rpc("cancelar_cita", { p_token: token, p_confirmar: false });
  if (error || !data) {
    aviso(traducir(error || "cita no encontrada"));
    return;
  }
  const fila = Array.isArray(data) ? data[0] : data;
  const situacion = fila && fila.situacion;
  if (!fila || situacion === "no_encontrada") {
    aviso(MENSAJES.no_encontrada);
    return;
  }
  mostrarDatos(fila);
  if (situacion === "vigente") {
    aviso("");
    const caja = document.querySelector("[data-cancelar-estado]");
    if (caja) caja.hidden = true;
    prepararConfirmacion(token);
    return;
  }
  aviso(MENSAJES[situacion] || MENSAJES.no_encontrada);
}

cargar();
