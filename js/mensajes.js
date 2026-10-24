import { negocio, urlSitio } from "./config.js";
import * as tiempo from "./tiempo.js";

const DIRECCION = "Vía Funza - Siberia, Km 3.8, La Isla, Ceuta, Funza";
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

function primerNombre(nombre) {
  const limpio = String(nombre || "").replace(/\s+/g, " ").trim();
  return limpio.split(" ")[0] || "";
}

export function enlaceCancelar(token) {
  const limpio = String(token || "").trim();
  if (!limpio) return "";
  return urlSitio("cancelar") + "?token=" + encodeURIComponent(limpio);
}

export function mensajeCita(reserva) {
  const tipo = reserva.estado === "cancelada" ? "cancelada" : reserva.estado === "confirmada" ? "recordatorio" : "confirmacion";
  const lineas = [
    "👋 Hola " + primerNombre(reserva.nombre),
    "💈 *" + negocio.nombre + "*",
    "✂️ " + (reserva.servicio || ""),
    "📅 " + fechaCita(reserva.fecha),
    "🕛 " + horaLegible(reserva.hora),
    "📍 " + DIRECCION
  ];
  if (tipo === "cancelada") {
    lineas.push("✅ Tu cita fue cancelada.");
    return lineas.join("\n");
  }
  const cierre = tipo === "recordatorio"
    ? "¿No puedes asistir? Cancela aquí y liberamos tu espacio:"
    : "Si necesitas cancelarla, hazlo aquí:";
  lineas.push("✅ " + cierre);
  const enlace = enlaceCancelar(reserva.cancel_token);
  if (enlace) lineas.push(enlace);
  return lineas.join("\n");
}
