const TABLA = [
  ["reservas cerradas", "La agenda en línea no está disponible por ahora. Intenta de nuevo en unos minutos."],
  ["celular invalido", "Revisa tu celular: 10 dígitos y empieza por 3."],
  ["nombre invalido", "Escribe tu nombre."],
  ["servicio no disponible", "Ese servicio o barbero ya no está disponible. Elige otro."],
  ["barbero no disponible", "Ese servicio o barbero ya no está disponible. Elige otro."],
  ["limite de citas", "Ya tienes 3 citas pendientes con este celular."],
  ["horario no disponible", "Esa hora acaba de ocuparse. Elige otra."],
  ["falta autorizacion", "Debes aceptar el tratamiento de datos para reservar."],
  ["cita no encontrada", "No encontramos esa cita."],
  ["cita no cancelable", "Esta cita ya no se puede cancelar."],
  ["fuera de plazo", "Ya pasó el plazo para cancelar o cambiar la cita."],
  ["esta cita ya fue cancelada", "Esta cita ya fue cancelada"],
  ["esta cita ya pasó", "Esta cita ya pasó"],
  ["esta cita ya paso", "Esta cita ya pasó"]
];

export function traducir(error) {
  const texto = String((error && error.message) || error || "").toLowerCase();
  const hallado = TABLA.find(([clave]) => texto.includes(clave));
  return hallado ? hallado[1] : "No pudimos completar la acción. Intenta de nuevo.";
}

export function celularValido(valor) {
  let digitos = String(valor || "").replace(/\D/g, "");
  if (digitos.startsWith("57") && digitos.length === 12) digitos = digitos.slice(2);
  if (digitos.length === 10 && digitos.startsWith("3")) return { ok: true, digitos };
  return { ok: false, digitos };
}

export function nombreValido(valor) {
  const nombre = String(valor || "").replace(/\s+/g, " ").trim();
  if (nombre.length < 2 || nombre.length > 80) return "";
  return nombre;
}
