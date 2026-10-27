let avisarPagina;
window.__cuandoPagina = new Promise((resolve) => {
  avisarPagina = resolve;
});
window.__paginaLista = avisarPagina;

const promoverImagenes = () => {
  document.querySelectorAll("img[data-src]").forEach((img) => {
    if (img.getAttribute("src")) return;
    const src = img.getAttribute("data-src");
    const srcset = img.getAttribute("data-srcset");
    if (src) img.src = src;
    if (srcset) img.srcset = srcset;
  });
};

const despertar = () => {
  if (window.__despierto) return window.__cuandoPagina;
  window.__despierto = true;
  if (!document.querySelector("link[data-css]")) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "css/styles.css";
    link.setAttribute("data-css", "");
    document.head.appendChild(link);
  }
  import("./pagina.js").then(() => window.__cuandoPagina.then(promoverImagenes)).catch(promoverImagenes);
  return window.__cuandoPagina;
};

document.addEventListener("click", (evento) => {
  const reservar = evento.target.closest("[data-reservar]");
  if (!reservar || window.__paginaEnganchada) return;
  evento.preventDefault();
  evento.stopPropagation();
  despertar().then(() => reservar.click());
}, true);

const urgente = () => {
  try {
    const params = new URLSearchParams(window.location.search);
    return window.location.hash === "#reservar" || params.get("servicio") || params.get("reservar") === "1";
  } catch (error) {
    return false;
  }
};

const programar = () => {
  if (urgente()) despertar();
  else window.setTimeout(despertar, 200);
};

if (document.readyState === "complete") programar();
else window.addEventListener("load", programar);
