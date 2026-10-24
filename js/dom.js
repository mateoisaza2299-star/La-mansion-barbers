export function nodo(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto != null && texto !== false) el.textContent = texto;
  return el;
}

export function limpiar(el) {
  if (el) el.replaceChildren();
}

export function marcaCasilla() {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 22 22");
  svg.setAttribute("class", "casilla-svg");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", "M5 11.5 9 15.5 17 6.5");
  svg.appendChild(path);
  return svg;
}

export function hojaEstilos() {
  try {
    const creada = new CSSStyleSheet();
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, creada];
    return creada;
  } catch (error) {
    const estilo = document.createElement("style");
    document.head.appendChild(estilo);
    return estilo.sheet;
  }
}
