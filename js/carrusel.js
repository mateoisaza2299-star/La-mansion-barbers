const srcsetDe = (foto, urlDe) => {
  const todas = Array.isArray(foto.variantes) ? foto.variantes.filter((item) => item && item.ancho) : [];
  const grandes = todas.filter((item) => item.ancho === 1200 || item.ancho === 1800 || item.ancho === 2400);
  const lista = grandes.length ? grandes : todas;
  return lista.map((item) => urlDe(foto, item.ancho) + " " + item.ancho + "w").join(", ");
};

const cargarFoto = (slide, foto, urlDe, anchoDe) => {
  const img = slide.querySelector("img.principal");
  if (!img || img.getAttribute("src")) return;
  const ancho = anchoDe(foto, 1200) || anchoDe(foto, 480);
  if (!ancho) return;
  const src = urlDe(foto, ancho);
  const srcset = srcsetDe(foto, urlDe);
  img.src = src;
  if (srcset) img.srcset = srcset;
  const fondo = slide.querySelector("img.local-fondo");
  if (fondo) {
    fondo.src = src;
    if (srcset) fondo.srcset = srcset;
  }
};

export function iniciarCarrusel(opciones) {
  const raiz = opciones.raiz;
  const fotos = opciones.fotos || [];
  const marco = raiz.querySelector("[data-local]");
  const pista = raiz.querySelector("[data-local-pista]");
  const puntos = raiz.querySelector("[data-local-puntos]");
  const vivo = raiz.querySelector("[data-local-vivo]");
  const frase = raiz.querySelector("[data-local-frase]");
  const pausa = raiz.querySelector("[data-local-pausa]");
  if (!marco || !pista || !puntos || fotos.length < 3) return;

  const estatico = !!opciones.estatico;
  const urlDe = opciones.urlDe;
  const anchoDe = opciones.anchoDe;
  const fraseDe = opciones.frase;
  const total = fotos.length;
  const holds = new Set();
  if (estatico) {
    raiz.classList.add("is-quiet");
    holds.add("quieto");
  }

  let indice = 0;
  let timer = 0;
  let manualPausa = estatico;
  let origenX = 0;
  let origenY = 0;
  let arrastrando = false;

  const slides = fotos.map((foto, posicion) => {
    const slide = document.createElement("div");
    slide.className = "local-slide mate-" + foto.id + (foto.orientacion === "vertical" ? " es-vertical" : "");
    slide.setAttribute("aria-label", (posicion + 1) + " de " + total + ". " + (foto.alt || ""));
    slide.setAttribute("aria-hidden", posicion === 0 ? "false" : "true");
    if (foto.orientacion === "vertical") {
      const capa = document.createElement("div");
      capa.className = "local-blur";
      capa.setAttribute("aria-hidden", "true");
      const fondo = document.createElement("img");
      fondo.className = "local-fondo mate-" + foto.id;
      fondo.alt = "";
      fondo.width = foto.ancho;
      fondo.height = foto.alto;
      fondo.decoding = "async";
      capa.appendChild(fondo);
      slide.appendChild(capa);
    }
    const img = document.createElement("img");
    img.className = "principal mate-" + foto.id;
    img.alt = "";
    img.width = foto.ancho;
    img.height = foto.alto;
    img.decoding = "async";
    img.sizes = "(max-width: 767px) 100vw, 1600px";
    slide.appendChild(img);
    pista.appendChild(slide);
    const boton = document.createElement("button");
    boton.type = "button";
    boton.setAttribute("aria-label", "Foto " + (posicion + 1));
    const marca = document.createElement("i");
    boton.appendChild(marca);
    boton.addEventListener("click", () => irHacia(posicion));
    puntos.appendChild(boton);
    return slide;
  });

  const marcas = [...puntos.querySelectorAll("button")];

  const enMarcha = () => !manualPausa && holds.size === 0;

  const pintarPausa = () => {
    if (!pausa) return;
    pausa.setAttribute("aria-pressed", manualPausa ? "true" : "false");
    pausa.textContent = manualPausa ? "Reproducir" : "Pausar";
  };

  const relleno = () => {
    const boton = marcas[indice];
    const img = slides[indice] && slides[indice].querySelector("img.principal");
    if (boton) {
      boton.classList.remove("is-llena");
      void boton.offsetWidth;
      if (enMarcha()) boton.classList.add("is-llena");
    }
    if (img) {
      img.classList.remove("is-zoom");
      void img.offsetWidth;
      if (enMarcha()) img.classList.add("is-zoom");
    }
  };

  const programar = () => {
    window.clearTimeout(timer);
    raiz.classList.toggle("is-play", !estatico);
    raiz.classList.toggle("is-hold", !enMarcha());
    if (!enMarcha()) return;
    relleno();
    timer = window.setTimeout(() => mover(1, false), 6000);
  };

  const mostrar = (manual) => {
    slides.forEach((slide, posicion) => {
      const activo = posicion === indice;
      slide.classList.toggle("is-on", activo);
      slide.setAttribute("aria-hidden", activo ? "false" : "true");
    });
    marcas.forEach((boton, posicion) => {
      boton.setAttribute("aria-current", posicion === indice ? "true" : "false");
      if (posicion !== indice) boton.classList.remove("is-llena");
    });
    if (frase) frase.textContent = fraseDe(fotos[indice].categoria);
    cargarFoto(slides[indice], fotos[indice], urlDe, anchoDe);
    const siguiente = (indice + 1) % total;
    cargarFoto(slides[siguiente], fotos[siguiente], urlDe, anchoDe);
    if (manual && vivo) {
      vivo.setAttribute("aria-live", "polite");
      vivo.textContent = (indice + 1) + " de " + total + ". " + (fotos[indice].alt || "");
    }
    programar();
  };

  const mover = (delta, manual) => {
    indice = (indice + delta + total) % total;
    mostrar(manual);
  };

  const irHacia = (posicion) => {
    if (posicion === indice) return;
    indice = posicion;
    mostrar(true);
  };

  if (pausa) {
    pausa.addEventListener("click", () => {
      if (estatico) return;
      manualPausa = !manualPausa;
      pintarPausa();
      programar();
    });
  }

  const previo = raiz.querySelector("[data-local-prev]");
  const siguienteBtn = raiz.querySelector("[data-local-next]");
  if (previo) previo.addEventListener("click", () => mover(-1, true));
  if (siguienteBtn) siguienteBtn.addEventListener("click", () => mover(1, true));

  marco.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      mover(1, true);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      mover(-1, true);
    }
  });

  const fino = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (fino) {
    marco.addEventListener("pointerenter", () => {
      holds.add("hover");
      programar();
    });
    marco.addEventListener("pointerleave", () => {
      holds.delete("hover");
      holds.delete("toque");
      arrastrando = false;
      programar();
    });
  }

  marco.addEventListener("focusin", () => {
    holds.add("foco");
    programar();
  });
  marco.addEventListener("focusout", (event) => {
    if (marco.contains(event.relatedTarget)) return;
    holds.delete("foco");
    programar();
  });

  marco.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button")) return;
    origenX = event.clientX;
    origenY = event.clientY;
    arrastrando = true;
    holds.add("toque");
    programar();
  });
  marco.addEventListener("pointerup", (event) => {
    if (!arrastrando) return;
    arrastrando = false;
    holds.delete("toque");
    const dx = event.clientX - origenX;
    const dy = event.clientY - origenY;
    if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) mover(dx < 0 ? 1 : -1, true);
    else programar();
  });
  marco.addEventListener("pointercancel", () => {
    arrastrando = false;
    holds.delete("toque");
    programar();
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") holds.add("oculto");
    else holds.delete("oculto");
    programar();
  });

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) holds.delete("fuera");
      else holds.add("fuera");
    });
    programar();
  }, { threshold: 0.4 });
  io.observe(raiz);

  pintarPausa();
  slides[0].classList.add("is-on");
  if (frase) frase.textContent = fraseDe(fotos[0].categoria);
  mostrar(false);
}
