import { servicios, pintarPrecio } from "./servicios.js";
import {
  negocio,
  formatoPrecio,
  direccionLinea,
  enlaceMapa,
  enlaceWhatsapp,
  urlInstagram,
  handleInstagram,
  urlSitio,
  textoHorario,
  estadoApertura,
  avisoDuracion,
  horasDelDia,
  partesBogota
} from "./config.js";
import { faq, faqPreparacion } from "./faq.js";

const file = (location.pathname || "").split("/").pop() || "index.html";

const pageKey = !file || file === "index.html" ? "index" : file.replace(/\.html$/, "");

const seo = {
  index: {
    title: negocio.nombre + " | Barbería en " + negocio.ciudad,
    description: negocio.nombre + ", barbería en " + negocio.ciudad + ". Cortes, barba y cuidado personal."
  },
  historia: {
    title: "Nuestra historia — " + negocio.nombre,
    description: negocio.nombre + ", barbería en " + negocio.ciudad + ". Por confirmar."
  },
  privacidad: {
    title: "Política de datos — " + negocio.nombre,
    description: "Qué guarda " + negocio.nombre + " cuando reservas: nombre, celular, servicio y fecha."
  },
  "404": {
    title: "Página no encontrada — " + negocio.nombre,
    description: "Esta página no existe. Vuelve al inicio de " + negocio.nombre + "."
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
  const alt = negocio.nombre + ", barbería en " + negocio.ciudad + ".";
  setMeta('meta[property="og:image:alt"]', alt);
  setMeta('meta[name="twitter:image:alt"]', alt);
  if (pageKey !== "404") {
    setMeta('meta[name="robots"]', negocio.enPreparacion ? "noindex, nofollow" : "index, follow");
  }
  const canon = urlSitio(pageKey === "index" ? "" : pageKey + ".html");
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical && canon) canonical.setAttribute("href", canon);
  if (canon) setMeta('meta[property="og:url"]', canon);
  const image = urlSitio("assets/og.jpg");
  setMeta('meta[property="og:image"]', image);
  setMeta('meta[property="og:image:secure_url"]', image);
  setMeta('meta[name="twitter:image"]', image);
};

const applyLinks = () => {
  document.querySelectorAll("[data-wa]").forEach((link) => {
    const href = enlaceWhatsapp(link.getAttribute("data-wa") || "");
    const item = link.closest("li") || link;
    if (!href) {
      link.hidden = true;
      if (item !== link) item.hidden = true;
      return;
    }
    link.href = href;
    link.hidden = false;
    if (item !== link) item.hidden = false;
  });
  document.querySelectorAll("[data-tel]").forEach((link) => {
    const wrap = link.closest("[data-tel-wrap]") || link;
    const visible = String(negocio.telefono || "").trim();
    if (!visible) {
      wrap.hidden = true;
      return;
    }
    link.href = "tel:+" + visible.replace(/\D/g, "");
    if (!link.querySelector("svg")) link.textContent = visible;
    wrap.hidden = false;
  });
  document.querySelectorAll("[data-maps]").forEach((link) => {
    const href = enlaceMapa();
    const wrap = link.closest("p") || link;
    if (!href) {
      wrap.hidden = true;
      return;
    }
    link.href = href;
    wrap.hidden = false;
  });
  document.querySelectorAll("[data-red]").forEach((link) => {
    const red = link.getAttribute("data-red");
    const href = red === "instagram" ? urlInstagram() : String((negocio.redes && negocio.redes[red]) || "");
    const item = link.closest("li") || link;
    if (!href) {
      item.hidden = true;
      return;
    }
    link.href = href;
    if (red === "instagram") {
      const handle = handleInstagram();
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
  const linea = direccionLinea();
  document.querySelectorAll("[data-direccion]").forEach((node) => {
    if (!linea) {
      node.textContent = "Por confirmar";
      node.classList.add("is-pending");
      return;
    }
    node.classList.remove("is-pending");
    if (node.getAttribute("data-direccion") === "linea" || typeof negocio.direccion === "string") {
      node.textContent = linea;
      return;
    }
    const d = negocio.direccion;
    const br = document.createElement("br");
    node.replaceChildren(
      document.createTextNode(d.calle || ""),
      br,
      document.createTextNode([d.barrio, d.ciudad, d.region].filter(Boolean).join(", "))
    );
  });
  document.querySelectorAll("[data-nombre]").forEach((node) => {
    node.textContent = negocio.nombre;
  });
  document.querySelectorAll("[data-eslogan]").forEach((node) => {
    const icon = node.querySelector("i");
    if (icon) icon.remove();
    node.textContent = "";
    if (icon) node.appendChild(icon);
    node.appendChild(document.createTextNode(negocio.eslogan));
  });
  document.querySelectorAll("[data-lugar]").forEach((node) => {
    node.textContent = negocio.ciudad ? "Estamos en " + negocio.ciudad + "." : "Por confirmar";
  });
  document.querySelectorAll(".logo").forEach((node) => {
    if (node.hasAttribute("aria-label")) node.setAttribute("aria-label", negocio.nombre + ", inicio");
  });
};

const applyHorario = () => {
  const reglas = Array.isArray(negocio.horario) ? negocio.horario : [];
  document.querySelectorAll("[data-horario]").forEach((list) => {
    list.replaceChildren();
    if (!reglas.length) {
      const item = document.createElement("li");
      const name = document.createElement("span");
      name.textContent = "Horario";
      const time = document.createElement("span");
      time.className = "is-pending";
      time.textContent = "Por confirmar";
      item.append(name, time);
      list.appendChild(item);
      return;
    }
    reglas.forEach((regla) => {
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
    if (!reglas.length) {
      node.textContent = "Por confirmar";
      node.classList.add("is-pending");
      return;
    }
    node.classList.remove("is-pending");
    reglas.forEach((regla, index) => {
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
  if (negocio.enPreparacion || !slots.length) return;
  import("./supabase.js").then(async ({ obtenerSupabase }) => {
    const supabase = await obtenerSupabase();
    if (!supabase) return;
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
    const href = enlaceWhatsapp("Hola, quiero pedir que borren mis datos de " + negocio.nombre + ".");
    if (!href) return;
    const p = document.createElement("p");
    const link = document.createElement("a");
    link.className = "btn btn-dark";
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Pedir la eliminación por WhatsApp";
    p.appendChild(link);
    node.appendChild(p);
  });
  document.querySelectorAll("[data-frase]").forEach((node) => {
    node.textContent = negocio.eslogan;
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
  const reglas = Array.isArray(negocio.horario) ? negocio.horario : [];
  const hours = reglas.filter((regla) => !regla.cerrado && regla.abre && regla.cierra).map((regla) => ({
    "@type": "OpeningHoursSpecification",
    dayOfWeek: regla.dias.map((dia) => dayNames[dia === 0 ? 6 : dia - 1]),
    opens: regla.abre,
    closes: regla.cierra
  }));
  const partesCiudad = String(negocio.ciudad || "").split(",").map((parte) => parte.trim());
  const postal = typeof negocio.direccion === "object" && negocio.direccion
    ? negocio.direccion
    : { calle: "", barrio: "", ciudad: partesCiudad[0] || "", region: partesCiudad[1] || "", pais: "CO" };
  const data = {
    "@context": "https://schema.org",
    "@type": ["HairSalon", "BarberShop"],
    name: negocio.nombre,
    image: urlSitio("assets/og.jpg"),
    url: urlSitio(pageKey === "index" ? "" : pageKey + ".html"),
    currenciesAccepted: "COP",
    address: {
      "@type": "PostalAddress",
      addressLocality: postal.ciudad || partesCiudad[0] || "",
      addressRegion: postal.region || partesCiudad[1] || "",
      addressCountry: postal.pais || "CO"
    },
    makesOffer: offers
  };
  const calle = [postal.calle, postal.barrio].filter(Boolean).join(", ");
  if (calle) data.address.streetAddress = calle;
  const mapa = enlaceMapa();
  if (mapa) data.hasMap = mapa;
  const telefono = String(negocio.whatsapp || negocio.telefono || "").replace(/\D/g, "");
  if (telefono) data.telephone = "+" + telefono;
  const valores = servicios.map((item) => item.precioNumero).filter((n) => n > 0);
  if (valores.length) {
    const min = Math.min(...valores);
    const max = Math.max(...valores);
    data.priceRange = min === max ? formatoPrecio(min) : formatoPrecio(min) + "–" + formatoPrecio(max);
  }
  if (hours.length) data.openingHoursSpecification = hours;
  const instagram = urlInstagram();
  if (instagram) data.sameAs = [instagram];
  if (negocio.email.includes("@")) data.email = negocio.email;
  node.textContent = JSON.stringify(data);
};

const applyFaq = () => {
  const root = document.querySelector("[data-faq]");
  const preguntas = negocio.enPreparacion ? faqPreparacion : faq;
  if (!root || !preguntas.length) return;
  const list = document.createElement("div");
  list.className = "faq-list";
  preguntas.forEach((item, index) => {
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
  if (!negocio.mapaEmbed) {
    const note = frame.querySelector("[data-map-fallback]");
    if (note) {
      note.hidden = false;
      note.textContent = "Por confirmar";
    }
    return;
  }
  const load = () => {
    if (frame.querySelector("iframe")) return;
    const iframe = document.createElement("iframe");
    iframe.title = "Mapa de " + negocio.nombre + " en " + negocio.ciudad;
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

const applyPreparacion = () => {
  document.documentElement.classList.toggle("is-preparacion", !!negocio.enPreparacion);
  if (negocio.enPreparacion) return;
  document.querySelectorAll("[data-panel-slot]").forEach((slot) => {
    if (slot.querySelector("a")) return;
    slot.appendChild(document.createTextNode(" · "));
    const link = document.createElement("a");
    link.className = "access-link";
    link.href = "admin-login.html";
    link.textContent = "Acceso";
    slot.hidden = false;
    slot.appendChild(link);
  });
};

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
applyPreparacion();

export { formatoPrecio };
