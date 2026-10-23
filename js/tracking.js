import { supabase } from "./supabase.js";

const file = (window.location.pathname || "").split("/").pop() || "";
const adminPage = file === "admin.html" || file === "admin-login.html";

const visitorKey = "mc_visitor";
const visitKey = "mc_visit";
const inicioKey = "mc_inicio_reserva";

const clean = (value, max) => String(value || "").replace(/[\u0000-\u001f]/g, "").trim().slice(0, max || 120);

const deviceOf = () => {
  const width = window.innerWidth || document.documentElement.clientWidth || 0;
  if (width < 768) return "móvil";
  if (width < 1024) return "tablet";
  return "escritorio";
};

const originOf = () => {
  try {
    const utm = clean(new URLSearchParams(window.location.search).get("utm_source"));
    if (utm) return utm;
    if (document.referrer) {
      const host = new URL(document.referrer).hostname;
      if (host) return clean(host);
    }
  } catch (error) {}
  return "directo";
};

const visitorId = () => {
  try {
    let id = localStorage.getItem(visitorKey);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(visitorKey, id);
    }
    return id;
  } catch (error) {
    return "";
  }
};

let allowPromise = null;
const allow = () => {
  if (!allowPromise) {
    allowPromise = (async () => {
      try {
        const result = await Promise.race([
          supabase.auth.getSession(),
          new Promise((resolve) => window.setTimeout(() => resolve(null), 2000))
        ]);
        if (!result) return true;
        return !(result.data && result.data.session);
      } catch (error) {
        return true;
      }
    })();
  }
  return allowPromise;
};

const insertRow = async (table, row) => {
  try {
    if (!(await allow())) return;
    const id = visitorId();
    if (!id) return;
    await supabase.from(table).insert({ ...row, visitor_id: id }, { returning: "minimal" });
  } catch (error) {}
};

const insertEvent = (tipo, detalle) => {
  const row = { tipo };
  const detail = clean(detalle, 180);
  if (detail) row.detalle = detail;
  insertRow("eventos", row);
};

const sectionOf = (node) => {
  try {
    const section = node.closest("section");
    if (section && section.id) return section.id;
    if (node.closest("header")) return "cabecera";
    if (node.closest("footer")) return "pie";
    if (node.closest(".fab")) return "flotante";
    if (node.closest("[data-modal]")) return "reserva";
    if (node.closest("[data-service-modal]")) return "servicio";
  } catch (error) {}
  return "pagina";
};

let inicioQueued = false;
const noteInicio = () => {
  try {
    if (inicioQueued) return;
    if (sessionStorage.getItem(inicioKey)) return;
    inicioQueued = true;
    window.setTimeout(() => {
      allow().then((ok) => {
        try {
          const modal = document.querySelector("[data-modal]");
          if (!ok || !modal || modal.hidden) {
            inicioQueued = false;
            return;
          }
          if (sessionStorage.getItem(inicioKey)) return;
          sessionStorage.setItem(inicioKey, "1");
          insertEvent("inicio_reserva");
        } catch (error) {
          inicioQueued = false;
        }
      }).catch(() => {
        inicioQueued = false;
      });
    }, 0);
  } catch (error) {}
};

const recordVisit = () => {
  allow().then((ok) => {
    try {
      if (!ok) return;
      if (sessionStorage.getItem(visitKey)) return;
      sessionStorage.setItem(visitKey, "1");
      insertRow("visitas", {
        dispositivo: deviceOf(),
        origen: originOf(),
        pagina: window.location.pathname || "/"
      });
    } catch (error) {}
  }).catch(() => {});
};

const boot = () => {
  try {
    document.addEventListener("click", (event) => {
      try {
        const origin = event.target;
        if (!origin || !origin.closest) return;
        const serviceBtn = origin.closest("[data-service]");
        if (serviceBtn) {
          const sheet = document.querySelector("[data-service-modal]");
          const name = serviceBtn.getAttribute("data-service") || "";
          if (sheet && !sheet.hidden && name) insertEvent("ver_servicio", name);
        }
        const reserveBtn = origin.closest("[data-service-reserve]");
        if (reserveBtn) {
          const title = document.querySelector("#servicio-title");
          const name = reserveBtn.dataset.servicio || (title ? title.textContent : "");
          if (name) insertEvent("reservar_servicio", name);
        }
        const link = origin.closest("a[href]");
        if (link) {
          const href = link.getAttribute("href") || "";
          if (href.includes("wa.me")) insertEvent("click_whatsapp", sectionOf(link));
          if (href.toLowerCase().startsWith("tel:")) insertEvent("click_llamar", sectionOf(link));
          if (/maps\.google\.|google\.[^/\s]+\/maps|maps\.app\.goo\.gl/i.test(href)) insertEvent("click_como_llegar", sectionOf(link));
          const label = (link.textContent || "").replace(/\s+/g, " ").trim();
          if (label === "Conoce nuestra historia") insertEvent("ver_historia", "historia");
        }
        if (origin.closest("[data-open-reserva]")) noteInicio();
      } catch (error) {}
    });
    document.addEventListener("mc:reservar", () => {
      try { noteInicio(); } catch (error) {}
    });
    recordVisit();
  } catch (error) {}
};

if (!adminPage) boot();
