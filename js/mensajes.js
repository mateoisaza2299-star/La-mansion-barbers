import { negocio, urlSitio } from "./config.js";
import { fechaCita, horaLegible } from "./tiempo.js";

const DIRECCION = "Vía Funza - Siberia, Km 3.8, La Isla, Ceuta, Funza";

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
