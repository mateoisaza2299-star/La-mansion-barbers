import { negocio } from "./config.js";

const datos = negocio.nosotros || {};
const section = document.getElementById("nosotros");

const texto = (selector, value) => {
  if (!section) return;
  section.querySelectorAll(selector).forEach((node) => {
    node.textContent = value == null ? "" : String(value);
  });
};

const historias = Array.isArray(datos.historias) ? datos.historias : [];
const edades = Array.isArray(datos.edades) ? datos.edades : [];
const valores = Array.isArray(datos.valores) ? datos.valores : [];
const cifras = Array.isArray(datos.cifras) ? datos.cifras : [];

texto("[data-nosotros-etiqueta]", datos.etiqueta);
texto("[data-nosotros-titulo]", datos.titulo);
texto("[data-nosotros-intro]", datos.intro);
texto("[data-nosotros-edades-label]", datos.edadesTitulo);
texto("[data-nosotros-valores-titulo]", datos.valoresTitulo);
texto("[data-nosotros-cita-texto]", datos.cita);
texto("[data-nosotros-firma]", datos.firma);
texto("[data-nosotros-cierre-titulo]", datos.cierreTitulo);
texto("[data-nosotros-reserva]", datos.cierreReserva);
texto("[data-nosotros-llegar]", datos.cierreLlegar);

const chips = section && section.querySelector("[data-nosotros-chips]");
if (chips) {
  chips.replaceChildren();
  edades.forEach((edad) => {
    const item = document.createElement("li");
    item.textContent = edad;
    chips.appendChild(item);
  });
}

const sizesDe = (index) => {
  if (index === 2) return "(max-width: 767px) 82vw, (max-width: 1023px) 92vw, 384px";
  return "(max-width: 767px) 82vw, (max-width: 1023px) 46vw, 384px";
};

const cards = section ? [...section.querySelectorAll("[data-nosotros-card]")] : [];
cards.forEach((card, index) => {
  const historia = historias[index];
  if (!historia) return;
  const titulo = card.querySelector("[data-nosotros-card-titulo]");
  const copia = card.querySelector("[data-nosotros-card-texto]");
  const img = card.querySelector("[data-nosotros-img]");
  const media = card.querySelector(".nosotros-media");
  if (titulo) {
    titulo.id = "nosotros-historia-" + (index + 1);
    titulo.textContent = historia.titulo;
    card.setAttribute("aria-labelledby", titulo.id);
  }
  if (copia) copia.textContent = historia.texto;
  if (!img) return;
  const base = "assets/img/nosotros/0" + (index + 1);
  img.src = base + "-800.webp";
  img.srcset = base + "-480.webp 480w, " + base + "-800.webp 800w, " + base + "-1200.webp 1200w";
  img.sizes = sizesDe(index);
  img.alt = historia.alt || "";
  img.width = 800;
  img.height = 1000;
  const listo = () => {
    if (media) media.classList.add("is-ready");
  };
  img.addEventListener("load", listo);
  if (img.complete && img.naturalWidth) listo();
});

const valorNodes = section ? [...section.querySelectorAll("[data-nosotros-valor]")] : [];
valorNodes.forEach((node, index) => {
  const valor = valores[index];
  if (!valor) return;
  const titulo = node.querySelector("[data-nosotros-valor-titulo]");
  const copia = node.querySelector("[data-nosotros-valor-texto]");
  if (titulo) titulo.textContent = valor.titulo;
  if (copia) copia.textContent = valor.texto;
});

const cifrasBox = section && section.querySelector("[data-nosotros-cifras]");
const cifrasLista = section && section.querySelector("[data-nosotros-cifras-lista]");
if (cifrasBox && cifrasLista) {
  cifrasLista.replaceChildren();
  if (!cifras.length) {
    cifrasBox.hidden = true;
  } else {
    cifras.forEach((item) => {
      const li = document.createElement("li");
      const strong = document.createElement("strong");
      const span = document.createElement("span");
      strong.textContent = String(item.valor ?? "");
      span.textContent = String(item.texto ?? "");
      li.append(strong, span);
      cifrasLista.appendChild(li);
    });
    cifrasBox.hidden = false;
  }
}

const track = section && section.querySelector("[data-nosotros-track]");
const prev = section && section.querySelector("[data-nosotros-prev]");
const next = section && section.querySelector("[data-nosotros-next]");
const dotsWrap = section && section.querySelector("[data-nosotros-dots]");
const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const movil = window.matchMedia("(max-width: 767px)");

if (track && dotsWrap) {
  const slides = [...track.querySelectorAll("[data-nosotros-card]")];
  dotsWrap.replaceChildren();
  const dots = slides.map((slide, index) => {
    const dot = document.createElement("button");
    dot.type = "button";
    const titulo = historias[index] && historias[index].titulo;
    dot.setAttribute("aria-label", titulo ? "Ver " + titulo : "Ver historia " + (index + 1));
    dot.className = "nosotros-dot";
    dot.addEventListener("click", () => ir(index));
    dotsWrap.appendChild(dot);
    return dot;
  });

  const indiceVisible = () => {
    const caja = track.getBoundingClientRect();
    let mejor = 0;
    let distancia = Infinity;
    slides.forEach((slide, index) => {
      const delta = Math.abs(slide.getBoundingClientRect().left - caja.left);
      if (delta < distancia) {
        distancia = delta;
        mejor = index;
      }
    });
    return mejor;
  };

  const pintar = (index) => {
    dots.forEach((dot, i) => {
      const activo = i === index;
      if (activo) dot.setAttribute("aria-current", "true");
      else dot.removeAttribute("aria-current");
    });
    if (prev) prev.disabled = index <= 0;
    if (next) next.disabled = index >= slides.length - 1;
    track.setAttribute("aria-label", "Historias, " + (index + 1) + " de " + slides.length);
  };

  const ir = (index) => {
    const slide = slides[index];
    if (!slide) return;
    const left = track.scrollLeft + slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollTo({ left, behavior: reduce ? "auto" : "smooth" });
    pintar(index);
  };

  const paso = (delta) => {
    const index = Math.min(slides.length - 1, Math.max(0, indiceVisible() + delta));
    ir(index);
  };

  if (prev) prev.addEventListener("click", () => paso(-1));
  if (next) next.addEventListener("click", () => paso(1));

  let marco = 0;
  track.addEventListener("scroll", () => {
    if (marco) return;
    marco = window.requestAnimationFrame(() => {
      marco = 0;
      pintar(indiceVisible());
    });
  }, { passive: true });

  const teclado = (event) => {
    if (!movil.matches) return;
    if (event.key === "ArrowRight") {
      event.preventDefault();
      paso(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      paso(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      ir(0);
    } else if (event.key === "End") {
      event.preventDefault();
      ir(slides.length - 1);
    }
  };
  track.addEventListener("keydown", teclado);
  if (prev) prev.addEventListener("keydown", teclado);
  if (next) next.addEventListener("keydown", teclado);

  const modo = () => {
    const carrusel = movil.matches;
    track.tabIndex = carrusel ? 0 : -1;
    if (!carrusel) track.removeAttribute("aria-keyshortcuts");
    else track.setAttribute("aria-keyshortcuts", "ArrowLeft ArrowRight");
  };
  modo();
  movil.addEventListener("change", modo);
  pintar(0);
}

const revelar = (node) => node && node.classList.add("is-in");
const cabeza = section && section.querySelector("[data-nosotros-head]");
const galeria = section && section.querySelector(".nosotros-galeria");
const tarjetas = section ? [...section.querySelectorAll("[data-nosotros-card]")] : [];
const piezas = section ? [...section.querySelectorAll("[data-nosotros-valor]")] : [];
const cita = section && section.querySelector("[data-nosotros-cita]");
const mostrarTodo = () => {
  revelar(cabeza);
  tarjetas.forEach(revelar);
  piezas.forEach(revelar);
  revelar(cita);
};

if (reduce || !("IntersectionObserver" in window)) {
  mostrarTodo();
} else {
  document.documentElement.classList.add("nosotros-motion");
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      if (entry.target === galeria) tarjetas.forEach(revelar);
      else revelar(entry.target);
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.18, rootMargin: "0px 0px -4% 0px" });
  [cabeza, galeria, ...piezas, cita].filter(Boolean).forEach((node) => observer.observe(node));
}

if (!reduce) document.documentElement.classList.add("nosotros-parallax");
