import { direccionLinea, textoHorario, negocio } from "./config.js";

const reglas = Array.isArray(negocio.horario) ? negocio.horario : [];
const horarioTexto = reglas
  .filter((regla) => !regla.cerrado && regla.abre && regla.cierra)
  .map((regla) => regla.etiqueta + " de " + textoHorario(regla).replace(" – ", " a "))
  .join(". ");

const pendiente = "Por confirmar";

const timeline = document.querySelector("[data-historia-timeline]");
if (timeline) {
  const item = document.createElement("li");
  item.className = "timeline-item reveal";
  const year = document.createElement("p");
  year.className = "timeline-year is-pending";
  year.textContent = pendiente;
  const copy = document.createElement("div");
  const heading = document.createElement("h3");
  heading.textContent = pendiente;
  const text = document.createElement("p");
  text.className = "is-pending";
  text.textContent = pendiente;
  copy.append(heading, text);
  item.append(year, copy);
  timeline.appendChild(item);
}

const grid = document.querySelector("[data-certificados]");
if (grid) {
  const note = document.createElement("p");
  note.className = "is-pending";
  note.textContent = pendiente;
  grid.appendChild(note);
}

const cierre = document.querySelector("[data-cierre]");
if (cierre) {
  const partes = [direccionLinea(), horarioTexto].filter(Boolean);
  cierre.textContent = partes.length ? partes.join(". ") + "." : pendiente;
}
