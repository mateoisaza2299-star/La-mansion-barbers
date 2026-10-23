import { negocio, formatoPrecio, enlaceWhatsapp } from "./config.js";

const base = [
  {
    id: "corte-basico",
    nombre: "Corte básico",
    precio: 22000,
    descripcion: "Asesoría, corte y cejas.",
    experiencia: "Llegas, te sientas y Brayan te asesora el corte que va con tu cara y tu estilo. Rápido, cómodo y con las cejas listas para salir impecable.",
    incluye: ["Asesoría", "Corte", "Cejas"],
    fotos: [
      { src: "assets/servicios/corte-basico/1.jpg", width: 1050, height: 1600, alt: "Araña rapada en el lateral de un corte corto." }
    ]
  },
  {
    id: "corte-bebida",
    nombre: "Corte + bebida",
    precio: 24000,
    descripcion: "Asesoría, corte y cejas, con una bebida para acompañar.",
    experiencia: "Llegas, te sientas y te tomas algo mientras Brayan te asesora el corte que va con tu cara y tu estilo. Rápido, cómodo y con las cejas listas para salir impecable.",
    incluye: ["Asesoría", "Corte", "Cejas", "Bebida"],
    fotos: [
      { src: "assets/servicios/corte-bebida/1.jpg", width: 1080, height: 1049, alt: "Degradado medio con el cabello peinado hacia atrás, visto de perfil." },
      { src: "assets/servicios/corte-bebida/2.jpg", width: 1080, height: 1465, alt: "Línea curva rapada sobre un degradado." }
    ]
  },
  {
    id: "corte-especial",
    nombre: "Corte especial",
    precio: 30000,
    descripcion: "Corte con exfoliación, limpieza facial, cejas, mascarilla y barba.",
    experiencia: "Más que un corte: un rato para ti. La exfoliación, la limpieza facial y la mascarilla te dejan la piel fresca, y el corte con barba y cejas cierra el look completo, sin afán.",
    incluye: ["Corte", "Exfoliación", "Limpieza facial", "Cejas", "Mascarilla", "Barba"],
    fotos: [
      { src: "assets/servicios/corte-especial/1.jpg", width: 1170, height: 1595, alt: "Degradado con rulos arriba y puntas claras, visto de perfil." },
      { src: "assets/servicios/corte-especial/2.jpg", width: 1079, height: 1437, alt: "Líneas rapadas en abanico sobre un degradado." }
    ]
  },
  {
    id: "corte-miami-cuts",
    nombre: "Corte Miami Cuts",
    precio: 35000,
    descripcion: "Todo el corte especial, más lavado capilar, tratamiento capilar y bebida.",
    experiencia: "La experiencia completa de la casa. Cuidado del rostro, lavado y tratamiento capilar, barba, cejas y una bebida para acompañar. Sales renovado de pies a cabeza.",
    incluye: ["Corte", "Exfoliación", "Limpieza facial", "Cejas", "Mascarilla", "Barba", "Lavado capilar", "Tratamiento capilar", "Bebida"],
    fotos: [
      { src: "assets/servicios/corte-miami-cuts/1.jpg", width: 902, height: 1599, alt: "Degradado bajo con el cabello corto y texturizado, visto de perfil." },
      { src: "assets/servicios/corte-miami-cuts/2.jpg", width: 1200, height: 1600, alt: "Perfil con la ceja y la mejilla visibles, y una flor rapada en el lateral." },
      { src: "assets/servicios/corte-miami-cuts/3.jpg", width: 1170, height: 1194, alt: "Corazón rapado en la nuca, sobre un degradado." }
    ]
  },
  {
    id: "barba-cejas",
    nombre: "Barba y cejas",
    precio: 10000,
    descripcion: "Asesoramiento, perfilado de barba y cejas.",
    experiencia: "Barba y cejas con precisión. Te asesoramos la forma que va con tu rostro y las dejamos definidas, limpias y con un acabado natural.",
    incluye: ["Asesoramiento", "Perfilado de barba", "Cejas"],
    fotos: [
      { src: "assets/servicios/barba-cejas/1.jpg", width: 1079, height: 1533, alt: "Perfil con la ceja visible y una mariposa rapada en el lateral." }
    ]
  },
  {
    id: "limpieza-facial",
    nombre: "Limpieza facial",
    precio: 12000,
    descripcion: "Exfoliación, mascarilla y tratamiento facial.",
    experiencia: "Un respiro para tu piel. Exfoliación, mascarilla y tratamiento facial que la dejan limpia, suave y fresca, en un momento cómodo y sin prisa.",
    incluye: ["Exfoliación", "Mascarilla", "Tratamiento facial"],
    fotos: [
      { src: "assets/servicios/limpieza-facial/1.jpg", width: 1163, height: 1600, alt: "Perfil con la mejilla y la piel visibles, y un diseño en el lateral." }
    ]
  }
];

export const servicios = base.map((item) => {
  const numero = Number(item.precio);
  const tienePrecio = Number.isFinite(numero) && numero > 0;
  return {
    id: item.id,
    nombre: item.nombre,
    precio: tienePrecio ? formatoPrecio(numero) : "",
    precioNumero: tienePrecio ? numero : 0,
    duracion: "",
    minutos: 0,
    descripcion: item.descripcion,
    experiencia: item.experiencia,
    incluye: item.incluye,
    ideal: "",
    cuidado: "",
    fotos: item.fotos || []
  };
});

export function pintarPrecio(node, item) {
  node.replaceChildren();
  if (item.precio) {
    node.textContent = item.precio;
    return;
  }
  const link = document.createElement("a");
  link.href = enlaceWhatsapp("Hola, quiero consultar el precio de " + item.nombre + " en " + negocio.nombre + ".");
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = "Consultar precio";
  link.addEventListener("click", (event) => event.stopPropagation());
  node.appendChild(link);
}

const pictureOf = (foto, sizes, lazy) => {
  const picture = document.createElement("picture");
  const source = document.createElement("source");
  const stem = foto.src.replace(/\.jpe?g$/, "");
  source.type = "image/webp";
  source.srcset = stem + "-640.webp 640w, " + stem + ".webp " + foto.width + "w";
  source.sizes = sizes;
  const img = document.createElement("img");
  img.src = foto.src;
  img.srcset = stem + "-640.jpg 640w, " + foto.src + " " + foto.width + "w";
  img.sizes = sizes;
  img.alt = foto.alt;
  img.width = foto.width;
  img.height = foto.height;
  img.decoding = "async";
  img.loading = lazy ? "lazy" : "eager";
  picture.append(source, img);
  return picture;
};

const modal = document.querySelector("[data-service-modal]");
const panel = document.querySelector("[data-service-panel]");
const title = document.querySelector("#servicio-title");
const price = document.querySelector("[data-service-price]");
const duration = document.querySelector("[data-service-duration]");
const desc = document.querySelector("[data-service-desc]");
const experience = document.querySelector("[data-service-experience]");
const includes = document.querySelector("[data-service-includes]");
const ideal = document.querySelector("[data-service-ideal]");
const tip = document.querySelector("[data-service-tip]");
const reserve = document.querySelector("[data-service-reserve]");
const gallery = document.querySelector("[data-service-gallery]");

if (modal && panel && title && price && duration && desc && experience && includes && ideal && tip && reserve && gallery) {
  let lastFocus = null;

  const focusable = () => [...panel.querySelectorAll("button, a[href], input, select, textarea")].filter((el) => {
    if (el.disabled) return false;
    return el.getClientRects().length > 0;
  });

  const lockPage = (sheetOpen) => {
    const reserva = document.querySelector("[data-modal]");
    const nav = document.querySelector("[data-nav]");
    const reservaOpen = !!(reserva && !reserva.hidden);
    const navOpen = !!(nav && nav.classList.contains("is-open"));
    document.body.classList.toggle("is-locked", sheetOpen || reservaOpen || navOpen);
  };

  const lightbox = document.createElement("div");
  lightbox.className = "photo-lightbox";
  lightbox.hidden = true;
  const lightBackdrop = document.createElement("button");
  lightBackdrop.type = "button";
  lightBackdrop.className = "photo-lightbox-backdrop";
  lightBackdrop.setAttribute("aria-label", "Cerrar foto");
  const lightPicture = document.createElement("picture");
  const lightSource = document.createElement("source");
  lightSource.type = "image/webp";
  const lightImg = document.createElement("img");
  lightImg.alt = "";
  lightPicture.append(lightSource, lightImg);
  const lightClose = document.createElement("button");
  lightClose.type = "button";
  lightClose.className = "photo-lightbox-close";
  lightClose.setAttribute("aria-label", "Cerrar");
  lightClose.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>';
  lightbox.append(lightBackdrop, lightPicture, lightClose);
  document.body.appendChild(lightbox);
  let lightReturn = null;

  const closeLightbox = () => {
    if (lightbox.hidden) return;
    lightbox.hidden = true;
    lightImg.removeAttribute("src");
    lightSource.removeAttribute("srcset");
    const back = lightReturn;
    lightReturn = null;
    if (back && typeof back.focus === "function") back.focus();
  };

  const openLightbox = (foto, trigger) => {
    const stem = foto.src.replace(/\.jpe?g$/, "");
    lightSource.srcset = stem + ".webp";
    lightImg.src = foto.src;
    lightImg.alt = foto.alt;
    lightImg.width = foto.width;
    lightImg.height = foto.height;
    lightReturn = trigger || null;
    lightbox.hidden = false;
    lightClose.focus();
  };

  lightClose.addEventListener("click", closeLightbox);
  lightBackdrop.addEventListener("click", closeLightbox);

  const mountGallery = (fotos) => {
    gallery.replaceChildren();
    if (!fotos.length) {
      gallery.hidden = true;
      return;
    }
    gallery.hidden = false;
    let index = 0;
    let swiped = false;
    const many = fotos.length > 1;
    const stage = document.createElement("div");
    stage.className = "service-stage";
    const zoom = document.createElement("button");
    zoom.type = "button";
    zoom.className = "service-zoom";
    zoom.setAttribute("aria-label", "Ampliar foto");
    stage.appendChild(zoom);
    const arrow = (dir, label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "service-arrow service-arrow-" + dir;
      button.setAttribute("aria-label", label);
      button.innerHTML = dir === "prev"
        ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5 8 12l7 7"/></svg>'
        : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7"/></svg>';
      button.addEventListener("click", () => show(dir === "prev" ? index - 1 : index + 1));
      return button;
    };
    if (many) {
      stage.append(arrow("prev", "Foto anterior"), arrow("next", "Foto siguiente"));
    }
    const thumbs = document.createElement("div");
    thumbs.className = "service-thumbs";
    thumbs.setAttribute("role", "tablist");
    thumbs.setAttribute("aria-label", "Fotos del servicio");
    const count = document.createElement("p");
    count.className = "service-count";
    const thumbButtons = fotos.map((foto, i) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "service-thumb";
      button.setAttribute("role", "tab");
      button.setAttribute("aria-label", "Foto " + (i + 1));
      const shot = pictureOf(foto, "54px", true);
      const thumbImg = shot.querySelector("img");
      if (thumbImg) thumbImg.alt = "";
      button.appendChild(shot);
      button.addEventListener("click", () => show(i));
      thumbs.appendChild(button);
      return button;
    });
    const show = (nextIndex) => {
      index = (nextIndex + fotos.length) % fotos.length;
      const foto = fotos[index];
      zoom.replaceChildren(pictureOf(foto, "(min-width: 700px) 560px, 92vw", false));
      if (many) {
        count.textContent = (index + 1) + " / " + fotos.length;
        thumbButtons.forEach((button, i) => {
          const on = i === index;
          button.setAttribute("aria-selected", String(on));
          button.tabIndex = on ? 0 : -1;
        });
      }
    };
    zoom.addEventListener("click", () => {
      if (swiped) {
        swiped = false;
        return;
      }
      openLightbox(fotos[index], zoom);
    });
    if (many) {
      let tracking = false;
      let startX = 0;
      let startY = 0;
      let pointerId = null;
      stage.addEventListener("pointerdown", (event) => {
        if (event.target.closest(".service-arrow")) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        tracking = true;
        pointerId = event.pointerId;
        startX = event.clientX;
        startY = event.clientY;
      });
      const finish = (event, allow) => {
        if (!tracking || event.pointerId !== pointerId) return;
        const dx = event.clientX - startX;
        const dy = event.clientY - startY;
        tracking = false;
        pointerId = null;
        if (allow && Math.abs(dx) >= 42 && Math.abs(dx) > Math.abs(dy) * 1.2) {
          swiped = true;
          show(dx < 0 ? index + 1 : index - 1);
        }
      };
      stage.addEventListener("pointerup", (event) => finish(event, true));
      stage.addEventListener("pointercancel", (event) => finish(event, false));
    }
    gallery.appendChild(stage);
    if (many) gallery.append(thumbs, count);
    show(0);
  };

  const fill = (item) => {
    title.textContent = item.nombre;
    pintarPrecio(price, item);
    duration.hidden = true;
    duration.textContent = "";
    desc.textContent = item.descripcion;
    experience.textContent = item.experiencia;
    const idealHeading = ideal.previousElementSibling;
    if (idealHeading) idealHeading.hidden = true;
    ideal.hidden = true;
    ideal.textContent = "";
    const after = tip.closest(".service-tip");
    if (after) after.hidden = true;
    tip.textContent = "";
    includes.replaceChildren();
    item.incluye.forEach((line) => {
      const li = document.createElement("li");
      li.textContent = line;
      includes.appendChild(li);
    });
    reserve.dataset.servicio = item.nombre;
    closeLightbox();
    mountGallery(item.fotos || []);
  };

  let closingSheet = false;
  let closeToken = 0;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const closeSheet = (restore, done) => {
    if (modal.hidden || closingSheet) return;
    closeLightbox();
    const token = ++closeToken;
    const finish = () => {
      if (token !== closeToken || modal.hidden) return;
      closingSheet = false;
      modal.classList.remove("is-closing");
      modal.hidden = true;
      document.removeEventListener("keydown", onKey, true);
      lockPage(false);
      if (restore && lastFocus && typeof lastFocus.focus === "function") lastFocus.focus();
      if (typeof done === "function") done();
    };
    if (reduceMotion) {
      finish();
      return;
    }
    closingSheet = true;
    modal.classList.add("is-closing");
    const onEnd = (event) => {
      if (event.target !== panel) return;
      panel.removeEventListener("animationend", onEnd);
      finish();
    };
    panel.addEventListener("animationend", onEnd);
    window.setTimeout(finish, 460);
  };

  function onKey(event) {
    if (modal.hidden) return;
    if (!lightbox.hidden) {
      if (event.key === "Escape" || event.key === "Tab") {
        event.preventDefault();
        event.stopPropagation();
        if (event.key === "Escape") closeLightbox();
        else lightClose.focus();
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closeSheet(true);
      return;
    }
    if (event.key !== "Tab") return;
    const nodes = focusable();
    if (!nodes.length) {
      event.preventDefault();
      panel.focus();
      return;
    }
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement;
    if (event.shiftKey && (active === first || active === panel || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !panel.contains(active))) {
      event.preventDefault();
      first.focus();
    }
  }

  const openSheet = (trigger, item) => {
    if (!modal.hidden) return;
    closeToken += 1;
    closingSheet = false;
    modal.classList.remove("is-closing");
    lastFocus = trigger || null;
    fill(item);
    modal.hidden = false;
    lockPage(true);
    document.addEventListener("keydown", onKey, true);
    panel.focus({ preventScroll: true });
  };

  document.querySelectorAll("[data-service]").forEach((button) => {
    button.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      const name = button.getAttribute("data-service");
      const item = servicios.find((entry) => entry.nombre === name);
      if (!item) return;
      openSheet(button, item);
    });
  });

  modal.querySelectorAll("[data-service-close]").forEach((el) => {
    el.addEventListener("click", () => closeSheet(true));
  });

  reserve.addEventListener("click", () => {
    const servicio = reserve.dataset.servicio || title.textContent;
    const trigger = lastFocus;
    closeSheet(false, () => {
      document.dispatchEvent(new CustomEvent("mc:reservar", {
        detail: { servicio, trigger }
      }));
    });
  });
}
