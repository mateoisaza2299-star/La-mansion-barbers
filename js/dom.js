export function nodo(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto != null && texto !== false) el.textContent = texto;
  return el;
}

export function limpiar(el) {
  if (el) el.replaceChildren();
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
