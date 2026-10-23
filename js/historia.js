import { direccionLinea, textoHorario, negocio } from "./config.js";

const horarioTexto = negocio.horario
  .filter((regla) => !regla.cerrado && regla.abre && regla.cierra)
  .map((regla) => regla.etiqueta + " de " + textoHorario(regla).replace(" – ", " a "))
  .join(". ");

const momentos = [
  {
    ano: "Ene 2024",
    titulo: "Perfeccionamiento en tijera",
    texto: "Seminario de beunik PRO y AGON EVENTS, el 25 de enero de 2024 en Guatapé, Antioquia. 8 horas de técnicas y perfeccionamiento en tijera."
  },
  {
    ano: "May 2024",
    titulo: "Técnicas de cortes europeos, barbería clásica, tijera, freestyle y colorimetría",
    texto: "Seminario internacional de beunik PRO y aWe, el 8 de mayo de 2024 en Bogotá. 8 horas de colorimetría, cortes de tendencia europea, barbería clásica, manejo de barba, fundamentos de tijera, freestyle y técnicas de peinado y moldeo de competencia en cabezote."
  }
];

const certificados = [
  {
    titulo: "Perfeccionamiento en tijera",
    institucion: "beunik PRO y AGON EVENTS",
    ano: "2024",
    src: "assets/historia/perfeccionamiento-tijera.jpg",
    width: 720,
    height: 540,
    alt: "Certificado del seminario Perfeccionamiento en tijera, de beunik PRO y AGON EVENTS, en 2024."
  },
  {
    titulo: "Técnicas de cortes europeos, barbería clásica, tijera, freestyle y colorimetría",
    institucion: "beunik PRO y aWe",
    ano: "2024",
    src: "assets/historia/seminario-cortes.jpg",
    width: 740,
    height: 572,
    alt: "Certificado del seminario internacional de técnicas de cortes europeos, barbería clásica, tijera, freestyle y colorimetría, de beunik PRO y aWe, en 2024."
  }
];

const pictureOf = (item) => {
  const picture = document.createElement("picture");
  const source = document.createElement("source");
  const stem = item.src.replace(/\.jpe?g$/, "");
  source.type = "image/webp";
  source.srcset = stem + "-640.webp 640w, " + stem + ".webp " + item.width + "w";
  source.sizes = "(min-width: 800px) 46vw, 100vw";
  const img = document.createElement("img");
  img.src = item.src;
  img.srcset = stem + "-640.jpg 640w, " + item.src + " " + item.width + "w";
  img.sizes = "(min-width: 800px) 46vw, 100vw";
  img.alt = item.alt;
  img.width = item.width;
  img.height = item.height;
  img.loading = "lazy";
  img.decoding = "async";
  picture.append(source, img);
  return picture;
};

const timeline = document.querySelector("[data-historia-timeline]");
if (timeline) {
  momentos.forEach((momento, index) => {
    const item = document.createElement("li");
    item.className = "timeline-item reveal";
    if (index % 2 === 1) item.dataset.delay = "1";
    const year = document.createElement("p");
    year.className = "timeline-year";
    year.textContent = momento.ano;
    const copy = document.createElement("div");
    const heading = document.createElement("h3");
    heading.textContent = momento.titulo;
    const text = document.createElement("p");
    text.textContent = momento.texto;
    copy.append(heading, text);
    item.append(year, copy);
    timeline.appendChild(item);
  });
}

const grid = document.querySelector("[data-certificados]");
if (grid) {
  const lightbox = document.createElement("div");
  lightbox.className = "photo-lightbox";
  lightbox.hidden = true;
  const backdrop = document.createElement("button");
  backdrop.type = "button";
  backdrop.className = "photo-lightbox-backdrop";
  backdrop.setAttribute("aria-label", "Cerrar certificado");
  const picture = document.createElement("picture");
  const source = document.createElement("source");
  source.type = "image/webp";
  const img = document.createElement("img");
  img.alt = "";
  picture.append(source, img);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "photo-lightbox-close";
  close.setAttribute("aria-label", "Cerrar");
  close.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  lightbox.append(backdrop, picture, close);
  document.body.appendChild(lightbox);
  let back = null;

  const closeLightbox = () => {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    img.removeAttribute("src");
    source.removeAttribute("srcset");
    const node = back;
    back = null;
    if (node && typeof node.focus === "function") node.focus();
  };

  const openLightbox = (item, trigger) => {
    const stem = item.src.replace(/\.jpe?g$/, "");
    source.srcset = stem + ".webp";
    img.src = item.src;
    img.alt = item.alt;
    img.width = item.width;
    img.height = item.height;
    back = trigger || null;
    lightbox.hidden = false;
    close.focus();
  };

  close.addEventListener("click", closeLightbox);
  backdrop.addEventListener("click", closeLightbox);
  document.addEventListener("keydown", (event) => {
    if (lightbox.hidden || event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeLightbox();
  }, true);

  certificados.forEach((item) => {
    const card = document.createElement("article");
    card.className = "cert-card reveal";
    const shot = document.createElement("button");
    shot.type = "button";
    shot.className = "cert-shot";
    shot.setAttribute("aria-label", "Ampliar certificado: " + item.titulo);
    shot.appendChild(pictureOf(item));
    shot.addEventListener("click", () => openLightbox(item, shot));
    const copy = document.createElement("div");
    copy.className = "cert-copy";
    const heading = document.createElement("h3");
    heading.textContent = item.titulo;
    const place = document.createElement("p");
    place.textContent = item.institucion;
    const year = document.createElement("p");
    year.className = "cert-year";
    year.textContent = item.ano;
    copy.append(heading, place, year);
    card.append(shot, copy);
    grid.appendChild(card);
  });
}

const cierre = document.querySelector("[data-cierre]");
if (cierre) cierre.textContent = direccionLinea() + (horarioTexto ? ". " + horarioTexto + "." : ".");
