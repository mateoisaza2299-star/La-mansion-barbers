const root = document.documentElement;

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  window.matchMedia("(display-mode: fullscreen)").matches ||
  window.navigator.standalone === true;

const ios = () => {
  const ua = window.navigator.userAgent || "";
  if (/iPhone|iPad|iPod/i.test(ua)) return true;
  return window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
};

const markApp = () => {
  root.classList.toggle("is-app", standalone());
};

markApp();
const displayMode = window.matchMedia("(display-mode: standalone)");

const offline = document.createElement("div");
offline.className = "client-offline";
offline.setAttribute("role", "status");
const offlineText = document.createElement("p");
offlineText.textContent = "Sin conexión";
offline.appendChild(offlineText);
document.body.appendChild(offline);

const markOffline = () => {
  root.classList.toggle("is-client-offline", !window.navigator.onLine);
};

let startedOffline = !window.navigator.onLine;
markOffline();
window.addEventListener("offline", markOffline);
window.addEventListener("online", () => {
  markOffline();
  if (!startedOffline) return;
  startedOffline = false;
  window.location.reload();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
}

const installSlots = () => document.querySelectorAll("[data-cliente-install-slot]");

const mostrarInstalar = (on) => {
  if (standalone()) on = false;
  installSlots().forEach((node) => {
    node.hidden = !on;
  });
};

const guide = document.createElement("div");
guide.className = "client-guide";
guide.hidden = true;
const guideCard = document.createElement("div");
guideCard.className = "client-guide-card";
guideCard.setAttribute("role", "dialog");
guideCard.setAttribute("aria-modal", "true");
guideCard.setAttribute("aria-labelledby", "cliente-install-title");
const guideKicker = document.createElement("p");
guideKicker.className = "kicker";
guideKicker.textContent = "App";
const guideTitle = document.createElement("h2");
guideTitle.id = "cliente-install-title";
guideTitle.textContent = "Instalar app";
const guideList = document.createElement("ol");
["Toca Compartir.", "Elige Agregar a pantalla de inicio.", "Toca Agregar."].forEach((step) => {
  const item = document.createElement("li");
  const span = document.createElement("span");
  span.textContent = step;
  item.appendChild(span);
  guideList.appendChild(item);
});
const guideClose = document.createElement("button");
guideClose.className = "btn btn-dark btn-block";
guideClose.type = "button";
guideClose.textContent = "Listo";
guideCard.append(guideKicker, guideTitle, guideList, guideClose);
guide.appendChild(guideCard);
document.body.appendChild(guide);

const cerrarGuia = () => {
  guide.hidden = true;
};

guideClose.addEventListener("click", cerrarGuia);
guide.addEventListener("click", (event) => {
  if (event.target === guide) cerrarGuia();
});

let promptEvent = null;

if (standalone()) {
  mostrarInstalar(false);
} else if (ios()) {
  mostrarInstalar(true);
}

if (displayMode.addEventListener) {
  displayMode.addEventListener("change", () => {
    markApp();
    if (standalone()) mostrarInstalar(false);
  });
}

window.addEventListener("appinstalled", () => {
  promptEvent = null;
  markApp();
  mostrarInstalar(false);
});

window.addEventListener("beforeinstallprompt", (event) => {
  if (standalone() || ios()) return;
  event.preventDefault();
  promptEvent = event;
  mostrarInstalar(true);
});

const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const leerLista = (key) => {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "[]");
    if (!Array.isArray(parsed)) return [];
    const unique = [];
    parsed.forEach((item) => {
      const token = String(item || "").trim().toLowerCase();
      if (!uuidRe.test(token) || unique.includes(token)) return;
      unique.push(token);
    });
    return unique;
  } catch (error) {
    return [];
  }
};

const primerToken = () => {
  const propia = leerLista("pb_citas");
  if (propia.length) return propia[0];
  const cita = leerLista("mc_citas");
  return cita[0] || "";
};

const filaFidelidad = (data) => {
  let value = data;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch (error) {
      return null;
    }
  }
  if (Array.isArray(value)) value = value[0];
  if (!value || typeof value !== "object") return null;
  if (value.hechos == null && value.meta == null && value.nombre == null && value.faltan == null) return null;
  return value;
};

const entero = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
};

const tarjeta = document.createElement("div");
tarjeta.className = "modal";
tarjeta.id = "tarjeta";
tarjeta.hidden = true;
const tarjetaBackdrop = document.createElement("div");
tarjetaBackdrop.className = "modal-backdrop";
tarjetaBackdrop.dataset.cerrarTarjeta = "1";
const tarjetaPanel = document.createElement("div");
tarjetaPanel.className = "modal-panel";
tarjetaPanel.setAttribute("role", "dialog");
tarjetaPanel.setAttribute("aria-modal", "true");
tarjetaPanel.setAttribute("aria-labelledby", "tarjeta-title");
tarjetaPanel.tabIndex = -1;
const tarjetaClose = document.createElement("button");
tarjetaClose.className = "modal-close";
tarjetaClose.type = "button";
tarjetaClose.dataset.cerrarTarjeta = "1";
tarjetaClose.setAttribute("aria-label", "Cerrar");
tarjetaClose.innerHTML = "<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 6l12 12M18 6 6 18\"/></svg>";
const tarjetaKicker = document.createElement("p");
tarjetaKicker.className = "kicker";
tarjetaKicker.textContent = "Fidelidad";
const tarjetaTitle = document.createElement("h2");
tarjetaTitle.id = "tarjeta-title";
tarjetaTitle.textContent = "Mi tarjeta";
const tarjetaSellos = document.createElement("div");
tarjetaSellos.className = "tarjeta-sellos";
tarjetaSellos.setAttribute("aria-hidden", "true");
const tarjetaAviso = document.createElement("p");
tarjetaAviso.className = "tarjeta-gratis";
tarjetaAviso.hidden = true;
const tarjetaCopy = document.createElement("p");
tarjetaCopy.className = "tarjeta-copy";
tarjetaPanel.append(tarjetaClose, tarjetaKicker, tarjetaTitle, tarjetaAviso, tarjetaSellos, tarjetaCopy);
tarjeta.append(tarjetaBackdrop, tarjetaPanel);
document.body.appendChild(tarjeta);

let tarjetaTimer = 0;
let tarjetaToken = 0;
let supabasePromise = null;

const supabaseClient = () => {
  if (!supabasePromise) supabasePromise = import("./supabase.js").then((mod) => mod.supabase);
  return supabasePromise;
};

const pintarVacia = () => {
  tarjetaTitle.textContent = "Mi tarjeta";
  tarjetaSellos.replaceChildren();
  tarjetaAviso.hidden = true;
  tarjetaCopy.textContent = "Haz tu primera reserva y empieza a sumar cortes";
};

const pintarTarjeta = (row) => {
  const meta = entero(row.meta) || 10;
  const hechos = entero(row.hechos);
  const gratis = entero(row.gratis_disponibles);
  const resto = hechos % meta;
  const faltanDato = row.faltan == null ? (resto === 0 ? meta : meta - resto) : entero(row.faltan);
  const llenos = gratis > 0 ? meta : resto;
  tarjetaTitle.textContent = String(row.nombre || "Mi tarjeta");
  tarjetaSellos.replaceChildren();
  for (let i = 0; i < meta; i += 1) {
    const sello = document.createElement("span");
    sello.className = "sello" + (i < llenos ? " is-on" : "");
    tarjetaSellos.appendChild(sello);
  }
  if (gratis > 0) {
    tarjetaAviso.hidden = false;
    tarjetaAviso.textContent = "¡Tienes un corte gratis! Avísale al barbero cuando llegues";
    tarjetaCopy.textContent = "";
    return;
  }
  tarjetaAviso.hidden = true;
  tarjetaCopy.textContent = "Te faltan " + faltanDato + " cortes para tu corte gratis";
};

const cargarTarjeta = async () => {
  const token = primerToken();
  const request = ++tarjetaToken;
  if (!token) {
    pintarVacia();
    return;
  }
  try {
    const supabase = await supabaseClient();
    const { data, error } = await supabase.rpc("mi_fidelidad", { p_token: token });
    if (request !== tarjetaToken) return;
    if (error) throw error;
    const row = filaFidelidad(data);
    if (!row) {
      pintarVacia();
      return;
    }
    pintarTarjeta(row);
  } catch (error) {
    if (request !== tarjetaToken) return;
    pintarVacia();
  }
};

const cerrarMenu = () => {
  const nav = document.querySelector("[data-nav]");
  const toggle = document.querySelector("[data-nav-toggle]");
  if (nav && nav.classList.contains("is-open") && toggle) toggle.click();
};

const abrirTarjeta = () => {
  cerrarMenu();
  tarjeta.hidden = false;
  document.body.classList.add("is-locked");
  cargarTarjeta();
  if (tarjetaTimer) window.clearInterval(tarjetaTimer);
  tarjetaTimer = window.setInterval(() => {
    if (tarjeta.hidden || document.visibilityState !== "visible") return;
    cargarTarjeta();
  }, 60000);
  tarjetaPanel.focus();
};

const cerrarTarjeta = () => {
  tarjeta.hidden = true;
  if (tarjetaTimer) {
    window.clearInterval(tarjetaTimer);
    tarjetaTimer = 0;
  }
  const reserva = document.querySelector("#reserva");
  const servicio = document.querySelector("#servicio-ficha");
  if ((!reserva || reserva.hidden) && (!servicio || servicio.hidden)) document.body.classList.remove("is-locked");
};

document.addEventListener("click", (event) => {
  const install = event.target.closest("[data-cliente-install]");
  if (install) {
    event.preventDefault();
    if (standalone()) return;
    if (ios()) {
      guide.hidden = false;
      guideClose.focus();
      return;
    }
    if (!promptEvent) return;
    const pending = promptEvent;
    promptEvent = null;
    pending.prompt();
    pending.userChoice.then((choice) => {
      if (choice && choice.outcome === "accepted") mostrarInstalar(false);
    }).catch(() => {});
    return;
  }
  if (event.target.closest("[data-fidelidad]")) {
    event.preventDefault();
    abrirTarjeta();
    return;
  }
  if (event.target.closest("[data-cerrar-tarjeta]")) {
    event.preventDefault();
    cerrarTarjeta();
    return;
  }
  const cita = event.target.closest("[data-app-cita]");
  if (!cita) return;
  event.preventDefault();
  if (!document.querySelector("[data-cita]")) {
    window.location.href = "index.html";
    return;
  }
  document.dispatchEvent(new CustomEvent("mc-mostrar-cita"));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!guide.hidden) {
    event.stopImmediatePropagation();
    cerrarGuia();
    return;
  }
  if (!tarjeta.hidden) {
    event.stopImmediatePropagation();
    cerrarTarjeta();
  }
});
