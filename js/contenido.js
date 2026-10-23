import { faq } from "./faq.js";
import { servicios, pintarPrecio } from "./servicios.js";
import {
  negocio,
  formatoPrecio,
  direccionLinea,
  enlaceMapa,
  enlaceWhatsapp,
  textoHorario,
  estadoApertura,
  avisoDuracion,
  horasDelDia,
  partesBogota
} from "./config.js";

const file = (location.pathname || "").split("/").pop() || "index.html";

const pageKey = !file || file === "index.html" ? "index" : file.replace(/\.html$/, "");

const seo = {
  index: {
    title: negocio.nombre + " — Barbería en " + negocio.direccion.ciudad,
    description: negocio.nombre + " en " + negocio.direccion.ciudad + ". Cortes, barba y cejas con calma. Reserva tu cita. " + direccionLinea() + "."
  },
  historia: {
    title: "Nuestra historia — " + negocio.nombre,
    description: "La historia de " + negocio.nombre + " en " + negocio.direccion.ciudad + ". " + negocio.barbero + ", barbero."
  },
  privacidad: {
    title: "Política de datos — " + negocio.nombre,
    description: "Qué guarda " + negocio.nombre + " cuando reservas: nombre, celular, servicio y fecha. El celular también se usa para la tarjeta de fidelidad y el corte gratis."
  },
  "404": {
    title: "Página no encontrada — " + negocio.nombre,
    description: "Esta página no existe. Vuelve al inicio de " + negocio.nombre + " o reserva tu cita."
  }
};

const setMeta = (selector, value) => {
  document.querySelectorAll(selector).forEach((node) => node.setAttribute("content", value));
};

const applySeo = () => {
  const entry = seo[pageKey];
  if (!entry) return;
  document.title = entry.title;
  setMeta('meta[name="description"]', entry.description);
  setMeta('meta[property="og:title"]', entry.title);
  setMeta('meta[property="og:description"]', entry.description);
  setMeta('meta[name="twitter:title"]', entry.title);
  setMeta('meta[name="twitter:description"]', entry.description);
  setMeta('meta[property="og:site_name"]', negocio.nombre);
};

const applyLinks = () => {
  document.querySelectorAll('a[href*="wa.me"]').forEach((link) => {
    let text = "";
    try {
      text = new URL(link.getAttribute("href"), "https://wa.me").searchParams.get("text") || "";
    } catch (error) {}
    link.href = enlaceWhatsapp(text);
  });
  document.querySelectorAll("[data-tel]").forEach((link) => {
    link.href = "tel:+" + negocio.whatsapp;
    if (!link.querySelector("svg")) link.textContent = negocio.telefonoVisible;
  });
  document.querySelectorAll("[data-maps]").forEach((link) => {
    link.href = enlaceMapa();
  });
  document.querySelectorAll("[data-red]").forEach((link) => {
    const href = negocio.redes[link.getAttribute("data-red")];
    const item = link.closest("li") || link;
    if (!href) {
      item.hidden = true;
      return;
    }
    link.href = href;
    if (link.getAttribute("data-red") === "instagram") {
      const handle = "@" + href.replace(/\/+$/, "").split("/").pop();
      [...link.childNodes].forEach((node) => {
        if (node.nodeType === 3 && node.textContent.trim()) node.textContent = " " + handle;
      });
      if (link.hasAttribute("aria-label")) link.setAttribute("aria-label", "Instagram " + handle);
    }
    item.hidden = false;
  });
  document.querySelectorAll("[data-resenas]").forEach((link) => {
    const url = String(negocio.redes.resenas || "");
    const wrap = link.closest("[data-resenas-wrap]") || link;
    if (!/^https?:\/\//i.test(url)) {
      wrap.hidden = true;
      return;
    }
    link.href = url;
    wrap.hidden = false;
  });
  document.querySelectorAll("[data-email]").forEach((link) => {
    const email = String(negocio.email || "");
    const wrap = link.closest("[data-email-wrap]") || link;
    if (!email.includes("@")) {
      wrap.hidden = true;
      return;
    }
    link.href = "mailto:" + email;
    link.textContent = email;
    wrap.hidden = false;
  });
};

const applyDireccion = () => {
  document.querySelectorAll("[data-direccion]").forEach((node) => {
    if (node.getAttribute("data-direccion") === "linea") {
      node.textContent = direccionLinea();
      return;
    }
    const d = negocio.direccion;
    const br = document.createElement("br");
    node.replaceChildren(
      document.createTextNode(d.calle),
      br,
      document.createTextNode([d.barrio, d.ciudad, d.region].filter(Boolean).join(", "))
    );
  });
  document.querySelectorAll("[data-nombre]").forEach((node) => {
    node.textContent = negocio.nombre;
  });
};

const applyHorario = () => {
  document.querySelectorAll("[data-horario]").forEach((list) => {
    list.replaceChildren();
    negocio.horario.forEach((regla) => {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = regla.etiqueta;
      const time = document.createElement("span");
      time.textContent = textoHorario(regla);
      item.append(name, time);
      list.appendChild(item);
    });
  });
  document.querySelectorAll("[data-horario-resumen]").forEach((node) => {
    node.replaceChildren();
    negocio.horario.forEach((regla, index) => {
      if (index) node.appendChild(document.createElement("br"));
      const cuando = textoHorario(regla);
      node.appendChild(document.createTextNode(regla.etiqueta + " · " + cuando));
    });
  });
  const pintarEstado = (estado) => {
    document.querySelectorAll("[data-open-status]").forEach((node) => {
      node.classList.toggle("is-open", !!estado.abierto);
      node.classList.toggle("is-closed", estado.abierto === false && !estado.pendiente);
      const label = node.querySelector("[data-open-label]");
      if (label) label.textContent = estado.texto;
    });
  };
  const estado = estadoApertura();
  pintarEstado(estado);
  const hoy = partesBogota().iso;
  const slots = horasDelDia(hoy);
  if (!slots.length) return;
  import("./supabase.js").then(async ({ supabase }) => {
    const { data, error } = await supabase.rpc("horas_ocupadas", { p_fecha: hoy });
    if (error) return;
    const taken = new Set((data || []).map((row) => String((row && row.hora) || row).slice(0, 5)));
    if (!slots.every((slot) => taken.has(slot))) return;
    pintarEstado({ abierto: false, texto: "Hoy no hay atención", pendiente: false });
  }).catch(() => {});
};

const applyPrecios = () => {
  document.querySelectorAll("[data-service]").forEach((button) => {
    const item = servicios.find((entry) => entry.nombre === button.getAttribute("data-service"));
    if (!item) return;
    const price = button.querySelector(".price");
    if (price) pintarPrecio(price, item);
  });
  document.querySelectorAll("select[name='servicio']").forEach((select) => {
    const current = select.value;
    select.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Elige uno";
    select.appendChild(empty);
    servicios.forEach((item) => {
      const option = document.createElement("option");
      option.value = item.nombre;
      option.textContent = item.nombre;
      select.appendChild(option);
    });
    if ([...select.options].some((option) => option.value === current)) select.value = current;
  });
};

const applyTextos = () => {
  document.querySelectorAll("[data-politica]").forEach((node) => {
    node.textContent = negocio.politicaReserva;
  });
  document.querySelectorAll("[data-aviso-datos]").forEach((node) => {
    const href = "privacidad.html";
    node.replaceChildren(document.createTextNode(negocio.avisoDatos + " "));
    const link = document.createElement("a");
    link.href = href;
    link.textContent = "Política de datos";
    if (node.closest(".modal")) {
      link.target = "_blank";
      link.rel = "noopener";
    }
    node.append(link, document.createTextNode("."));
  });
  document.querySelectorAll("[data-privacidad]").forEach((node) => {
    node.replaceChildren();
    negocio.privacidad.forEach((paragraph) => {
      const p = document.createElement("p");
      p.textContent = paragraph;
      node.appendChild(p);
    });
    const p = document.createElement("p");
    const link = document.createElement("a");
    link.className = "btn btn-dark";
    link.href = enlaceWhatsapp("Hola, quiero pedir que borren mis datos de " + negocio.nombre + ".");
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Pedir la eliminación por WhatsApp";
    p.appendChild(link);
    node.appendChild(p);
  });
  document.querySelectorAll("[data-frase]").forEach((node) => {
    node.textContent = "Corte con oficio, sin afán. Barbería en " + negocio.direccion.ciudad + ".";
  });
};

const dayNames = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const applySchema = () => {
  const node = document.getElementById("schema-negocio");
  if (!node) return;
  const offers = servicios.map((item) => {
    const offer = {
      "@type": "Offer",
      itemOffered: {
        "@type": "Service",
        name: item.nombre,
        description: item.descripcion
      }
    };
    const price = Number(item.precioNumero);
    if (Number.isFinite(price) && price > 0) {
      offer.price = String(price);
      offer.priceCurrency = "COP";
    }
    return offer;
  });
  const hours = negocio.horario.filter((regla) => !regla.cerrado && regla.abre && regla.cierra).map((regla) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: regla.dias.map((dia) => dayNames[dia === 0 ? 6 : dia - 1]),
    opens: regla.abre,
    closes: regla.cierra
  }));
  const folder = location.origin + (location.pathname || "/").replace(/[^/]*$/, "");
  const data = {
    "@context": "https://schema.org",
    "@type": ["HairSalon", "BarberShop"],
    name: negocio.nombre,
    image: folder + "assets/og.jpg",
    url: location.origin + location.pathname,
    telephone: "+" + negocio.whatsapp,
    currenciesAccepted: "COP",
    address: {
      "@type": "PostalAddress",
      streetAddress: [negocio.direccion.calle, negocio.direccion.barrio].filter(Boolean).join(", "),
      addressLocality: negocio.direccion.ciudad,
      addressRegion: negocio.direccion.region,
      addressCountry: negocio.direccion.pais
    },
    makesOffer: offers,
    hasMap: enlaceMapa()
  };
  const valores = servicios.map((item) => item.precioNumero).filter((n) => n > 0);
  if (valores.length) {
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    data.priceRange = min === max ? formatoPrecio(min) : formatoPrecio(min) + "–" + formatoPrecio(max);
  }
  if (hours.length) data.openingHoursSpecification = hours;
  if (/^https?:\/\//i.test(negocio.redes.instagram || "")) data.sameAs = [negocio.redes.instagram];
  if (negocio.email.includes("@")) data.email = negocio.email;
  node.textContent = JSON.stringify(data);
};

const applyFaq = () => {
  const root = document.querySelector("[data-faq]");
  if (!root || !faq.length) return;
  const list = document.createElement("div");
  list.className = "faq-list";
  faq.forEach((item, index) => {
    const wrap = document.createElement("div");
    wrap.className = "faq-item";
    const heading = document.createElement("h3");
    const button = document.createElement("button");
    const panelId = "faq-a-" + index;
    button.type = "button";
    button.id = "faq-q-" + index;
    button.className = "faq-q";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", panelId);
    button.textContent = item.pregunta;
    heading.appendChild(button);
    const panel = document.createElement("div");
    panel.id = panelId;
    panel.className = "faq-panel";
    panel.setAttribute("role", "region");
    panel.setAttribute("aria-labelledby", button.id);
    panel.hidden = true;
    const copy = document.createElement("p");
    copy.textContent = item.respuesta;
    panel.appendChild(copy);
    button.addEventListener("click", () => {
      const open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      panel.hidden = open;
    });
    wrap.append(heading, panel);
    list.appendChild(wrap);
  });
  list.addEventListener("keydown", (event) => {
    const buttons = [...list.querySelectorAll(".faq-q")];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    let next = -1;
    if (event.key === "ArrowDown") next = (index + 1) % buttons.length;
    if (event.key === "ArrowUp") next = (index - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = buttons.length - 1;
    if (next < 0) return;
    event.preventDefault();
    buttons[next].focus();
  });
  root.replaceChildren(list);
};

const applyMap = () => {
  const frame = document.querySelector("[data-map]");
  if (!frame || frame.querySelector("iframe")) return;
  const load = () => {
    if (frame.querySelector("iframe")) return;
    const iframe = document.createElement("iframe");
    iframe.title = "Mapa de " + negocio.nombre + " en " + negocio.direccion.ciudad;
    iframe.src = negocio.mapaEmbed;
    iframe.loading = "lazy";
    iframe.referrerPolicy = "no-referrer-when-downgrade";
    iframe.width = "600";
    iframe.height = "450";
    const note = frame.querySelector("[data-map-fallback]");
    if (note) note.hidden = true;
    frame.appendChild(iframe);
  };
  if (!("IntersectionObserver" in window)) {
    load();
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    if (!entries.some((entry) => entry.isIntersecting)) return;
    observer.disconnect();
    load();
  }, { rootMargin: "160px 0px" });
  observer.observe(frame);
};

const applyTop = () => {
  const link = document.querySelector("[data-top]");
  if (!link) return;
  const update = () => {
    link.hidden = window.scrollY < 640;
  };
  window.addEventListener("scroll", update, { passive: true });
  update();
};

const applySkip = () => {
  const skip = document.querySelector(".skip-link");
  const main = document.getElementById("contenido");
  if (!skip || !main) return;
  skip.addEventListener("click", () => {
    window.setTimeout(() => main.focus({ preventScroll: true }), 0);
  });
};

const paintDuracion = () => {
  document.querySelectorAll("[data-duracion-note]").forEach((note) => {
    const form = note.closest("form");
    const select = form ? form.querySelector("[name='servicio']") : null;
    if (!select) return;
    const write = () => {
      const text = avisoDuracion(select.value);
      note.hidden = !text;
      note.textContent = text;
      note.classList.toggle("is-warn", /corto/.test(text));
    };
    select.addEventListener("change", write);
    write();
  });
};

document.querySelectorAll("[data-year]").forEach((node) => {
  node.textContent = String(new Date().getFullYear());
});

applySeo();
applyLinks();
applyDireccion();
applyHorario();
applyPrecios();
applyTextos();
applySchema();
applyFaq();
applyMap();
applyTop();
applySkip();
paintDuracion();

export { formatoPrecio };
