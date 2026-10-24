import { hojaEstilos } from "./dom.js";

const hoja = hojaEstilos();
const reglas = new Set();

function regla(texto, id) {
  if (!hoja || reglas.has(id)) return;
  reglas.add(id);
  try {
    hoja.insertRule(texto, hoja.cssRules.length);
  } catch (error) {}
}

const GRUPOS = [
  { id: "todo", texto: "Todo", vale: () => true },
  { id: "cortes", texto: "Cortes", vale: (foto) => foto.categoria === "corte" },
  { id: "local", texto: "El local", vale: (foto) => ["ambiente", "interior", "fachada", "equipo"].includes(foto.categoria) },
  { id: "productos", texto: "Productos", vale: (foto) => foto.categoria === "producto" }
];

function nodo(tag, clase, texto) {
  const el = document.createElement(tag);
  if (clase) el.className = clase;
  if (texto) el.textContent = texto;
  return el;
}

function paresDe(fotos) {
  const antes = new Map();
  const despues = new Map();
  fotos.forEach((foto) => {
    const marca = /^(antes|despues)-(\d+)$/.exec(String(foto.id || ""));
    if (!marca) return;
    const bolsa = marca[1] === "antes" ? antes : despues;
    bolsa.set(marca[2], foto);
  });
  const pares = [];
  antes.forEach((foto, clave) => {
    if (despues.has(clave)) pares.push({ antes: foto, despues: despues.get(clave) });
  });
  return pares;
}

function visible(el) {
  if (!el || el.disabled || el.hidden) return false;
  const estilo = window.getComputedStyle(el);
  return estilo.display !== "none" && estilo.visibility !== "hidden" && el.getClientRects().length > 0;
}

export function prepararTrabajo({ fotos, puede, marcar, crearImagen, reducir }) {
  const seccion = document.querySelector("[data-trabajo]");
  if (!seccion) return;
  const utiles = (Array.isArray(fotos) ? fotos : []).filter((foto) => (
    foto &&
    ["corte", "ambiente", "interior", "fachada", "producto", "equipo"].includes(foto.categoria) &&
    !String(foto.id || "").startsWith("nosotros-") &&
    puede(foto)
  ));
  if (utiles.length < 4) {
    seccion.hidden = true;
    return;
  }
  seccion.hidden = false;
  utiles.forEach((foto) => marcar(foto));
  prepararPares(seccion, paresDe(utiles), crearImagen, reducir);
  const mosaico = seccion.querySelector("[data-mosaico]");
  const mas = seccion.querySelector("[data-ver-mas]");
  const chips = seccion.querySelector("[data-filtros]");
  if (!mosaico || !chips) return;
  let filtro = GRUPOS[0];
  let visibles = 12;
  const pintar = () => {
    const lista = utiles.filter(filtro.vale);
    mosaico.replaceChildren();
    lista.slice(0, visibles).forEach((foto, indice) => {
      const figura = nodo("figure", "mosaico-item" + (indice % 5 === 0 ? " t-alto" : indice % 4 === 0 ? " t-ancho" : ""));
      figura.tabIndex = 0;
      figura.setAttribute("role", "button");
      figura.dataset.indice = String(indice);
      const img = crearImagen(foto, { alt: foto.alt || "", sizes: "(max-width: 699px) 46vw, 22vw", ancho: 800 });
      if (img) figura.appendChild(img);
      const pie = nodo("figcaption", "sr-only", foto.alt || "");
      figura.appendChild(pie);
      const abrir = () => abrirVisor(lista, indice, crearImagen, reducir);
      figura.addEventListener("click", abrir);
      figura.addEventListener("keydown", (evento) => {
        if (evento.key !== "Enter" && evento.key !== " ") return;
        evento.preventDefault();
        abrir();
      });
      mosaico.appendChild(figura);
    });
    if (mas) mas.hidden = visibles >= lista.length;
  };
  GRUPOS.forEach((grupo) => {
    const boton = nodo("button", "chip" + (grupo === filtro ? " is-on" : ""), grupo.texto);
    boton.type = "button";
    boton.setAttribute("aria-pressed", grupo === filtro ? "true" : "false");
    boton.addEventListener("click", () => {
      filtro = grupo;
      visibles = 12;
      [...chips.children].forEach((item) => {
        const activo = item.textContent === grupo.texto;
        item.classList.toggle("is-on", activo);
        item.setAttribute("aria-pressed", activo ? "true" : "false");
      });
      pintar();
    });
    chips.appendChild(boton);
  });
  if (mas) mas.addEventListener("click", () => {
    visibles += 12;
    pintar();
  });
  pintar();
}

function prepararPares(seccion, pares, crearImagen, reducir) {
  const host = seccion.querySelector("[data-comparador]");
  if (!host) return;
  if (!pares.length) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.replaceChildren();
  host.appendChild(nodo("h3", null, "Antes y después"));
  pares.forEach((par) => host.appendChild(comparador(par, crearImagen, reducir)));
}

function comparador(par, crearImagen, reducir) {
  const caja = nodo("div", "comparador");
  caja.tabIndex = 0;
  caja.setAttribute("role", "slider");
  caja.setAttribute("aria-valuemin", "0");
  caja.setAttribute("aria-valuemax", "100");
  caja.setAttribute("aria-valuenow", "50");
  caja.setAttribute("aria-label", "Antes y después");
  const antes = nodo("div", "comparador-lado comparador-antes");
  const despues = nodo("div", "comparador-lado comparador-despues");
  const imgAntes = crearImagen(par.antes, { alt: par.antes.alt || "Antes", sizes: "(max-width: 699px) 92vw, 40vw", ancho: 800 });
  const imgDespues = crearImagen(par.despues, { alt: par.despues.alt || "Después", sizes: "(max-width: 699px) 92vw, 40vw", ancho: 800 });
  if (imgAntes) antes.appendChild(imgAntes);
  if (imgDespues) despues.appendChild(imgDespues);
  const barra = nodo("span", "comparador-barra");
  barra.setAttribute("aria-hidden", "true");
  caja.append(despues, antes, barra);
  let valor = 50;
  const aplicar = (siguiente) => {
    valor = Math.max(0, Math.min(100, Math.round(siguiente)));
    caja.setAttribute("aria-valuenow", String(valor));
    const id = "cmp-" + valor;
    antes.className = "comparador-lado comparador-antes " + id;
    barra.className = "comparador-barra " + id + "-b";
    regla("." + id + "{clip-path:inset(0 " + (100 - valor) + "% 0 0)}", id);
    regla("." + id + "-b{left:" + valor + "%}", id + "-b");
  };
  aplicar(50);
  const desdeEvento = (evento) => {
    const rect = caja.getBoundingClientRect();
    if (!rect.width) return;
    const x = (evento.clientX - rect.left) / rect.width;
    aplicar(x * 100);
  };
  caja.addEventListener("pointerdown", (evento) => {
    caja.setPointerCapture(evento.pointerId);
    desdeEvento(evento);
  });
  caja.addEventListener("pointermove", (evento) => {
    if (!caja.hasPointerCapture(evento.pointerId)) return;
    desdeEvento(evento);
  });
  caja.addEventListener("keydown", (evento) => {
    const paso = evento.shiftKey ? 10 : 5;
    if (evento.key === "ArrowLeft" || evento.key === "ArrowDown") {
      evento.preventDefault();
      aplicar(valor - paso);
    }
    if (evento.key === "ArrowRight" || evento.key === "ArrowUp") {
      evento.preventDefault();
      aplicar(valor + paso);
    }
    if (evento.key === "Home") aplicar(0);
    if (evento.key === "End") aplicar(100);
  });
  if (reducir) caja.classList.add("is-quiet");
  return caja;
}

function flechaSvg(direccion) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("class", "icono");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(svg.namespaceURI, "path");
  path.setAttribute("d", direccion < 0 ? "M14 6 L8 12 l6 6" : "M10 6 l6 6 -6 6");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", "currentColor");
  path.setAttribute("stroke-width", "1.6");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.appendChild(path);
  return svg;
}

function abrirVisor(lista, indice, crearImagen, reducir) {
  let actual = indice;
  let visor = document.querySelector("[data-visor]");
  if (!visor) {
    visor = nodo("div", "visor");
    visor.dataset.visor = "1";
    visor.hidden = true;
    visor.tabIndex = -1;
    const marco = nodo("div", "visor-marco");
    marco.setAttribute("role", "dialog");
    marco.setAttribute("aria-modal", "true");
    marco.setAttribute("aria-label", "Foto ampliada");
    const figura = nodo("figure", "visor-foto");
    figura.dataset.visorFoto = "1";
    const pie = nodo("figcaption");
    pie.dataset.visorPie = "1";
    const contador = nodo("p", "visor-contador");
    contador.dataset.visorContador = "1";
    const cerrar = nodo("button", "btn btn-sec", "Cerrar");
    cerrar.type = "button";
    cerrar.dataset.visorCerrar = "1";
    const prev = nodo("button", "visor-flecha visor-prev");
    prev.type = "button";
    prev.setAttribute("aria-label", "Foto anterior");
    prev.dataset.visorPrev = "1";
    prev.appendChild(flechaSvg(-1));
    const next = nodo("button", "visor-flecha visor-next");
    next.type = "button";
    next.setAttribute("aria-label", "Foto siguiente");
    next.dataset.visorNext = "1";
    next.appendChild(flechaSvg(1));
    marco.append(cerrar, prev, next, figura, pie, contador);
    visor.appendChild(marco);
    document.body.appendChild(visor);
  }
  const foto = visor.querySelector("[data-visor-foto]");
  const pie = visor.querySelector("[data-visor-pie]");
  const contador = visor.querySelector("[data-visor-contador]");
  const pintar = () => {
    const item = lista[actual];
    if (!item || !foto) return;
    const img = crearImagen(item, { alt: item.alt || "", sizes: "90vw", ancho: 1200 });
    foto.replaceChildren();
    if (img) foto.appendChild(img);
    if (pie) pie.textContent = item.alt || "";
    if (contador) contador.textContent = (actual + 1) + " / " + lista.length;
  };
  const mover = (delta) => {
    actual = (actual + delta + lista.length) % lista.length;
    pintar();
  };
  const cerrar = () => {
    visor.hidden = true;
    document.body.classList.remove("reserva-lock");
    document.removeEventListener("keydown", teclas);
    visor.removeEventListener("touchstart", tocar);
    visor.removeEventListener("touchend", soltar);
  };
  let toque = 0;
  const tocar = (evento) => {
    toque = evento.changedTouches[0] ? evento.changedTouches[0].clientX : 0;
  };
  const soltar = (evento) => {
    const x = evento.changedTouches[0] ? evento.changedTouches[0].clientX : toque;
    if (x - toque > 40) mover(-1);
    if (toque - x > 40) mover(1);
  };
  const teclas = (evento) => {
    if (evento.key === "Escape") {
      evento.preventDefault();
      cerrar();
      return;
    }
    if (evento.key === "ArrowLeft") mover(-1);
    if (evento.key === "ArrowRight") mover(1);
    if (evento.key !== "Tab" || visor.hidden) return;
    const focos = [...visor.querySelectorAll("button")].filter(visible);
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
  };
  visor.querySelector("[data-visor-cerrar]").onclick = cerrar;
  visor.querySelector("[data-visor-prev]").onclick = () => mover(-1);
  visor.querySelector("[data-visor-next]").onclick = () => mover(1);
  visor.hidden = false;
  document.body.classList.add("reserva-lock");
  pintar();
  document.addEventListener("keydown", teclas);
  if (!reducir) {
    visor.addEventListener("touchstart", tocar, { passive: true });
    visor.addEventListener("touchend", soltar, { passive: true });
  }
  const cerrarBoton = visor.querySelector("[data-visor-cerrar]");
  if (cerrarBoton) cerrarBoton.focus();
}
