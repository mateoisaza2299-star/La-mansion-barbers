export const ZONA = "America/Bogota";

const DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const CORTOS = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function hoyISO(fecha) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(fecha || new Date());
}

export function sumarDias(iso, dias) {
  const [anio, mes, dia] = String(iso || "").split("-").map(Number);
  const fecha = new Date(Date.UTC(anio, mes - 1, dia + dias));
  const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
  const d = String(fecha.getUTCDate()).padStart(2, "0");
  return fecha.getUTCFullYear() + "-" + m + "-" + d;
}

export function diaSemanaISO(iso) {
  const [anio, mes, dia] = String(iso || "").split("-").map(Number);
  if (!anio || !mes || !dia) return -1;
  return new Date(Date.UTC(anio, mes - 1, dia)).getUTCDay();
}

export function minutosAhora(fecha) {
  const partes = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).formatToParts(fecha || new Date());
  const tomar = (tipo) => partes.find((item) => item.type === tipo).value;
  let hora = Number(tomar("hour"));
  if (hora === 24) hora = 0;
  return hora * 60 + Number(tomar("minute"));
}

export function aMinutos(hhmm) {
  const [hora, minuto] = String(hhmm || "0:0").slice(0, 5).split(":").map(Number);
  return (hora || 0) * 60 + (minuto || 0);
}

export function aHora(minutos) {
  const hora = Math.floor(minutos / 60);
  const minuto = minutos % 60;
  return String(hora).padStart(2, "0") + ":" + String(minuto).padStart(2, "0");
}

export function horaLegible(hhmm) {
  const total = aMinutos(hhmm);
  const hora = Math.floor(total / 60);
  const minuto = total % 60;
  const sufijo = hora < 12 ? "a. m." : "p. m.";
  const doce = hora % 12 === 0 ? 12 : hora % 12;
  return doce + ":" + String(minuto).padStart(2, "0") + " " + sufijo;
}

export function fechaLegible(iso) {
  const partes = String(iso || "").split("-").map(Number);
  if (partes.length < 3 || !partes[0]) return "";
  const dia = diaSemanaISO(iso);
  return DIAS[dia] + " " + partes[2] + " " + MESES[partes[1] - 1];
}

export function fechaCorta(iso) {
  const partes = String(iso || "").split("-").map(Number);
  if (!partes[0]) return "";
  return CORTOS[diaSemanaISO(iso)] + " " + partes[2];
}

export function instanteBogota(iso, hhmm) {
  const [anio, mes, dia] = String(iso).split("-").map(Number);
  const minutos = aMinutos(hhmm);
  return Date.UTC(anio, mes - 1, dia, Math.floor(minutos / 60) + 5, minutos % 60);
}

export function lunesDe(iso) {
  const dia = diaSemanaISO(iso);
  const delta = dia === 0 ? -6 : 1 - dia;
  return sumarDias(iso, delta);
}

export function fechaEvento(isoInstante) {
  const fecha = new Date(isoInstante);
  if (Number.isNaN(fecha.getTime())) return "";
  return hoyISO(fecha);
}
