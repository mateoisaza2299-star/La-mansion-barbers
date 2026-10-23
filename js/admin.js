import { supabase } from "./supabase.js";
import { negocio, horasDelDia, diaSemana, direccionLinea } from "./config.js";
import { servicios } from "./servicios.js";

const EMPTY = "Aún no hay datos en este periodo";
const COLS = "id, nombre, telefono, servicio, barbero, fecha, hora, nota, estado, gratis, avisado, token";
const WEEKDAYS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const STATUS = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  cancelada: "Cancelada",
  completada: "Completada"
};

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const errorBox = document.querySelector("[data-admin-error]");
const rangeBox = document.querySelector("[data-range]");
const rangeError = document.querySelector("[data-range-error]");
const desdeInput = document.querySelector("[data-desde]");
const hastaInput = document.querySelector("[data-hasta]");

const state = {
  period: "hoy",
  reservas: [],
  reservasReady: false,
  pendingKnown: null,
  diaModo: "hoy",
  diaFecha: "",
  fidelidad: [],
  fidelidadLista: false,
  meta: 10,
  serviciosFidelidad: null,
  bloqueos: [],
  servicioFilas: []
};

const charts = new Map();
const pendingCharts = new Map();
let resToken = 0;
let svcToken = 0;
let lastFetch = 0;
let saving = false;
let askResolve = null;
let sheetId = null;
let sheetPhone = "";
let copyTimer = 0;
const hitos = new Map();

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
};

const bogotaParts = () => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Bogota",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23"
}).formatToParts(new Date());

const bogotaToday = () => {
  const parts = bogotaParts();
  const pick = (type) => parts.find((item) => item.type === type).value;
  return pick("year") + "-" + pick("month") + "-" + pick("day");
};

const addDays = (iso, days) => {
  const [year, month, day] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return y + "-" + m + "-" + d;
};

const dayCount = (desde, hasta) => {
  const start = Date.parse(desde + "T00:00:00Z");
  const end = Date.parse(hasta + "T00:00:00Z");
  return Math.round((end - start) / 86400000) + 1;
};

const num = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const integer = (value) => new Intl.NumberFormat("es-CO").format(num(value));

const shortDay = (iso) => new Intl.DateTimeFormat("es-CO", {
  timeZone: "UTC",
  day: "numeric",
  month: "short"
}).format(new Date(iso + "T00:00:00Z"));

const diaTexto = (iso) => {
  const clean = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;
  const text = new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long"
  }).format(new Date(clean + "T00:00:00Z"));
  return text.replace(/,/g, "").replace(/\s+/g, " ").trim();
};

const tituloDia = (iso) => {
  const today = bogotaToday();
  if (iso === today) return "Hoy";
  if (iso === addDays(today, 1)) return "Mañana";
  const text = diaTexto(iso);
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : iso;
};

const hourKey = (value) => {
  const match = String(value ?? "").match(/\d{1,2}/);
  if (!match) return null;
  const hour = Number(match[0]);
  if (hour < 0 || hour > 23) return null;
  return hour;
};

const hourLabel = (value) => {
  const hour = typeof value === "number" ? value : hourKey(value);
  if (hour == null) return String(value || "");
  const suffix = hour < 12 ? "am" : "pm";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return hour12 + ":00 " + suffix;
};

const capitalizar = (value) => {
  const text = String(value || "").replace(/\./g, "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
};

const fechaCita = (iso) => {
  const clean = String(iso || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(clean)) return "Sin fecha";
  const parts = new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  }).formatToParts(new Date(clean + "T00:00:00Z"));
  const pick = (type) => {
    const part = parts.find((item) => item.type === type);
    return part ? part.value : "";
  };
  return capitalizar(pick("weekday")) + ", " + pick("day") + " " + capitalizar(pick("month")) + " " + pick("year");
};

const horaCita = (value) => {
  const match = String(value ?? "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return "Sin hora";
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return "Sin hora";
  const suffix = hour < 12 ? "AM" : "PM";
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return String(hour12).padStart(2, "0") + ":" + match[2] + " " + suffix;
};

const refCita = (row) => {
  const id = String((row && row.id) ?? "").trim();
  if (!id) return "";
  if (/^\d+$/.test(id)) return "#" + id;
  return "#" + id.replace(/-/g, "").slice(0, 4).toUpperCase();
};

const fechaDe = (row) => String(row.fecha || "").slice(0, 10);

const nombreDe = (row) => String((row && row.nombre) || "").trim() || "cliente";

const fail = (message) => {
  if (!errorBox) return;
  errorBox.hidden = !message;
  errorBox.textContent = message || "";
};

const digitos = (telefono) => String(telefono || "").replace(/\D/g, "").slice(-10);

const waNumero = (telefono) => "https://wa.me/57" + digitos(telefono);

const waMensaje = (telefono, texto) => waNumero(telefono) + "?text=" + encodeURIComponent(texto);

const numeroCliente = (telefono) => {
  const limpio = String(telefono || "").replace(/[\s()+-]/g, "");
  if (!/^\d+$/.test(limpio)) return "";
  if (limpio.length === 10) return "57" + limpio;
  if (limpio.length === 12 && limpio.startsWith("57")) return limpio;
  return "";
};

const enlaceWhatsappCliente = (telefono, texto) => {
  const numero = numeroCliente(telefono);
  if (!numero) return "";
  return "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
};

const precioTexto = (row) => {
  if (row.gratis === true) return "Gratis 🎁";
  const nombre = String(row.servicio || "").trim().toLowerCase();
  const item = servicios.find((entry) => String(entry.nombre || "").trim().toLowerCase() === nombre);
  return item && item.precio ? item.precio : "";
};

const lineaServicio = (row) => {
  const servicio = String(row.servicio || "").trim() || "servicio";
  const precio = precioTexto(row);
  return precio ? servicio + " (" + precio + ")" : servicio;
};

const fichaFidelidad = (telefono) => state.fidelidad.find((item) => digitos(item.telefono) === digitos(telefono)) || null;

const cuentaServicio = (nombre) => {
  const lista = state.serviciosFidelidad;
  if (lista == null) return true;
  if (!Array.isArray(lista)) return false;
  const key = String(nombre || "").trim().toLowerCase();
  return lista.some((item) => String(item || "").trim().toLowerCase() === key);
};

const mensajeConfirmacion = (row, hechos) => {
  const nombre = nombreDe(row);
  const lineas = [
    "Hola " + nombre + " 👋, tu cita en " + negocio.nombre + " quedó *confirmada*.",
    "",
    "📅 " + diaTexto(fechaDe(row)) + " a las " + hourLabel(row.hora),
    "✂️ " + lineaServicio(row)
  ];
  const direccion = direccionLinea();
  if (direccion) lineas.push("📍 " + direccion);
  lineas.push("", "Si necesitas cancelarla o cambiarla, avísanos por aquí. ¡Te esperamos!");
  if (hechos) lineas.push("🎉 Con esta cita completas " + hechos + " cortes: ¡tu próximo corte es gratis!");
  return lineas.join("\n");
};

const mensajeCancelacion = (row) => {
  const nombre = nombreDe(row);
  const servicio = String(row.servicio || "").trim() || "servicio";
  return "Hola " + nombre + ", lamentamos avisarte que tu cita del " + diaTexto(fechaDe(row)) + " a las " + hourLabel(row.hora) + " (" + servicio + ") en " + negocio.nombre + " fue *cancelada*. ¿Quieres que la reagendemos? Respóndenos por aquí.";
};

const mensajeGratis = (row, hechos) => {
  const nombre = nombreDe(row);
  return "¡Hola " + nombre + "! 🎉 Completaste " + hechos + " cortes en " + negocio.nombre + " y tu próximo corte es gratis. Cuando quieras reservarlo, escríbenos por aquí.";
};

const mensajeBloqueo = (row) => {
  const nombre = String((row && row.nombre) || "").trim() || "cliente";
  return "Hola " + nombre + ", por un imprevisto no podremos atenderte el " + diaTexto(fechaDe(row)) + " a las " + hourLabel(row.hora) + " en " + negocio.nombre + ". Disculpa las molestias, ¿te reagendamos? Respóndenos por aquí.";
};

const diaSeleccionado = () => {
  const today = bogotaToday();
  if (state.diaModo === "manana") return addDays(today, 1);
  if (state.diaModo === "fecha" && /^\d{4}-\d{2}-\d{2}$/.test(state.diaFecha)) return state.diaFecha;
  return today;
};

const currentRange = () => {
  const today = bogotaToday();
  if (state.period === "hoy") return { desde: today, hasta: today };
  if (state.period === "7") return { desde: addDays(today, -6), hasta: today };
  if (state.period === "30") return { desde: addDays(today, -29), hasta: today };
  return { desde: desdeInput ? desdeInput.value : "", hasta: hastaInput ? hastaInput.value : "" };
};

const validRange = (range) => {
  if (!range.desde || !range.hasta) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(range.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(range.hasta)) return false;
  if (range.desde > range.hasta) return false;
  if (dayCount(range.desde, range.hasta) > 366) return false;
  return true;
};

const vibrar = () => {
  try {
    if (navigator.vibrate) navigator.vibrate([220, 80, 220]);
  } catch (error) {}
};

const paintHeader = () => {
  const parts = bogotaParts();
  const hour = Number(parts.find((item) => item.type === "hour").value);
  const greet = hour < 12 ? "Buenos días" : hour < 19 ? "Buenas tardes" : "Buenas noches";
  const greetNode = document.querySelector("[data-greet]");
  if (greetNode) greetNode.textContent = greet;
  const label = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date());
  const todayNode = document.querySelector("[data-today-label]");
  if (todayNode) todayNode.textContent = label.charAt(0).toUpperCase() + label.slice(1);
  const clock = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date());
  const time = document.querySelector("[data-updated]");
  if (time) {
    time.textContent = clock;
    time.dateTime = new Date().toISOString();
  }
};

const paintPendientes = () => {
  const total = state.reservas.filter((row) => row.estado === "pendiente").length;
  document.querySelectorAll("[data-pendientes]").forEach((node) => {
    node.hidden = total < 1;
    node.textContent = total > 99 ? "99+" : String(total);
  });
  document.querySelectorAll("[data-view='reservas']").forEach((button) => {
    if (total > 0) button.setAttribute("aria-label", "Reservas, " + total + (total === 1 ? " pendiente" : " pendientes"));
    else button.removeAttribute("aria-label");
  });
};

const anunciarNueva = (cantidad) => {
  const box = document.querySelector("[data-nueva]");
  const text = document.querySelector("[data-nueva-text]");
  if (box && text) {
    text.textContent = cantidad === 1 ? "Llegó una reserva nueva." : "Llegaron " + cantidad + " reservas nuevas.";
    box.hidden = false;
  }
  vibrar();
};

const syncDia = () => {
  document.querySelectorAll("[data-dia]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-dia") === state.diaModo));
  });
  const pick = document.querySelector("[data-dia-pick]");
  const input = document.querySelector("[data-dia-input]");
  if (pick) pick.hidden = state.diaModo !== "fecha";
  if (input && state.diaModo === "fecha") {
    if (!state.diaFecha) state.diaFecha = bogotaToday();
    input.value = state.diaFecha;
  }
};

const ordenar = (rows) => rows.slice().sort((a, b) => {
  const byDate = fechaDe(a).localeCompare(fechaDe(b));
  if (byDate) return byDate;
  return String(a.hora || "").localeCompare(String(b.hora || ""));
});

const abrirAviso = (row, hechos) => {
  const cancelada = row.estado === "cancelada";
  const cortes = hechos || hitos.get(row.id) || 0;
  abrirHoja({
    id: row.id,
    titulo: cancelada ? "Cita cancelada" : "Cita confirmada",
    texto: cancelada ? mensajeCancelacion(row) : mensajeConfirmacion(row, cortes),
    telefono: row.telefono
  });
};

const whenBlock = (label, value, dateTime) => {
  const block = el("div", "when-block");
  block.appendChild(el("span", "when-label", label));
  const time = document.createElement("time");
  time.className = "when-value";
  time.textContent = value;
  if (dateTime) time.dateTime = dateTime;
  block.appendChild(time);
  return block;
};

const bookingCard = (row) => {
  const article = el("article", "booking");
  const header = el("header", "booking-head");
  const fecha = fechaDe(row);
  const hora = String(row.hora || "").slice(0, 5);
  const when = el("div", "booking-when");
  when.append(
    whenBlock("Fecha", fechaCita(fecha), /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : ""),
    whenBlock("Hora", horaCita(row.hora), fecha && hora ? fecha + "T" + hora : "")
  );
  const badges = el("div", "badges");
  badges.appendChild(el("span", "badge badge-" + (row.estado || ""), STATUS[row.estado] || row.estado || ""));
  if (row.gratis === true) badges.appendChild(el("span", "badge badge-gratis", "Gratis"));
  header.append(when, badges);
  article.append(header, el("h3", null, row.nombre || "Sin nombre"));
  const ref = refCita(row);
  if (ref) article.appendChild(el("p", "booking-id", "Cita " + ref));
  if (String(row.servicio || "").trim()) article.appendChild(el("p", "booking-service", String(row.servicio).trim()));
  const phone = el("p", "booking-phone");
  const link = document.createElement("a");
  link.href = waNumero(row.telefono);
  link.target = "_blank";
  link.rel = "noopener";
  link.textContent = row.telefono || "WhatsApp";
  link.setAttribute("aria-label", "WhatsApp de " + nombreDe(row));
  phone.appendChild(link);
  article.appendChild(phone);
  if (String(row.nota || "").trim()) article.appendChild(el("p", "note", String(row.nota).trim()));
  const cancelBtn = () => {
    const cancel = el("button", "act act-no", "Cancelar");
    cancel.type = "button";
    cancel.addEventListener("click", () => cancelarCita(row, cancel));
    return cancel;
  };
  if (row.estado === "pendiente") {
    const actions = el("div", "booking-actions is-split");
    const ok = el("button", "act act-ok", "Confirmar");
    ok.type = "button";
    ok.addEventListener("click", () => confirmar(row, ok));
    actions.append(ok, cancelBtn());
    article.appendChild(actions);
  }
  if (row.estado === "confirmada" || row.estado === "cancelada") {
    const avisado = row.avisado === true;
    article.appendChild(el("p", avisado ? "aviso-ok" : "aviso-falta", avisado ? "Cliente avisado ✓" : "Falta avisar al cliente"));
    const actions = el("div", "booking-actions");
    const send = el("button", "act act-send", "Enviar WhatsApp");
    send.type = "button";
    send.addEventListener("click", () => abrirAviso(row));
    actions.appendChild(send);
    if (row.estado === "confirmada") actions.appendChild(cancelBtn());
    article.appendChild(actions);
  }
  return article;
};

const seccion = (titulo, rows, clase, vacio) => {
  const box = el("section", "queue" + (clase ? " " + clase : ""));
  box.appendChild(el("h2", null, titulo));
  if (!rows.length) {
    box.appendChild(el("p", "empty-note", vacio));
    return box;
  }
  rows.forEach((row) => box.appendChild(bookingCard(row)));
  return box;
};

const paintReservas = () => {
  const host = document.querySelector("[data-reservas]");
  if (!host) return;
  paintPendientes();
  if (!state.reservasReady) return;
  const selected = diaSeleccionado();
  const pendientes = ordenar(state.reservas.filter((row) => row.estado === "pendiente"));
  const delDia = ordenar(state.reservas.filter((row) => fechaDe(row) === selected && row.estado !== "pendiente"));
  const proximas = ordenar(state.reservas.filter((row) => fechaDe(row) > selected && row.estado !== "pendiente" && row.estado !== "completada"));
  host.replaceChildren(
    seccion("Pendientes por confirmar", pendientes, "queue-hot", "No hay citas pendientes."),
    seccion(tituloDia(selected), delDia, "", "No hay citas este día."),
    seccion("Próximas", proximas, "", "No hay citas próximas.")
  );
};

const chartBase = () => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: reduceMotion ? false : { duration: 520 },
  plugins: {
    legend: { labels: { color: "#5c5148", font: { family: "Outfit, sans-serif", size: 14 } } },
    tooltip: { backgroundColor: "#161210", titleFont: { family: "Outfit, sans-serif" }, bodyFont: { family: "Outfit, sans-serif" } }
  }
});

const renderChart = (key) => {
  const host = document.querySelector(`[data-chart="${key}"]`);
  if (!host) return;
  const panel = host.closest(".dash-panel");
  if (panel && panel.hidden) return;
  const config = pendingCharts.get(key);
  const prev = charts.get(key);
  if (prev) {
    prev.destroy();
    charts.delete(key);
  }
  host.replaceChildren();
  if (!config) {
    host.appendChild(el("p", "empty-note", EMPTY));
    return;
  }
  if (!globalThis.Chart) {
    host.appendChild(el("p", "empty-note", "No se pudo cargar el gráfico."));
    return;
  }
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute("aria-label", config.ariaLabel || "Gráfico");
  host.appendChild(canvas);
  try {
    charts.set(key, new globalThis.Chart(canvas, {
      type: config.type,
      data: config.data,
      options: config.options || {}
    }));
  } catch (error) {
    host.replaceChildren(el("p", "empty-note", "No se pudo cargar el gráfico."));
  }
};

const renderVisibleCharts = () => {
  document.querySelectorAll("[data-chart]").forEach((host) => {
    const panel = host.closest(".dash-panel");
    if (panel && panel.hidden) return;
    renderChart(host.getAttribute("data-chart"));
  });
};

const paintServicios = () => {
  const host = document.querySelector("[data-servicios]");
  if (!host) return;
  host.replaceChildren();
  const grouped = new Map();
  state.servicioFilas.forEach((row) => {
    const name = String(row.servicio || "").trim() || "Sin servicio";
    const key = name.toLowerCase();
    const item = grouped.get(key) || { name, total: 0, confirmadas: 0, canceladas: 0 };
    item.total += 1;
    if (row.estado === "confirmada") item.confirmadas += 1;
    if (row.estado === "cancelada") item.canceladas += 1;
    grouped.set(key, item);
  });
  const rows = [...grouped.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "es"));
  if (!rows.length) host.appendChild(el("p", "empty-note", EMPTY));
  else {
    const booked = Math.max(...rows.map((row) => row.total));
    const table = document.createElement("table");
    table.className = "svc-table";
    const head = document.createElement("tr");
    ["Servicio", "Reservas", "Confirmadas", "Canceladas"].forEach((label) => {
      head.appendChild(el("th", null, label));
    });
    const thead = document.createElement("thead");
    thead.appendChild(head);
    const tbody = document.createElement("tbody");
    rows.forEach((row) => {
      const tr = document.createElement("tr");
      const name = document.createElement("td");
      name.dataset.label = "Servicio";
      name.appendChild(el("span", "svc-name", row.name));
      if (booked > 0 && row.total === booked) {
        const tags = el("span", "svc-tags");
        tags.appendChild(el("span", "tag", "Más reservado"));
        name.appendChild(tags);
      }
      const cell = (label, value) => {
        const td = el("td", null, integer(value));
        td.dataset.label = label;
        return td;
      };
      tr.append(name, cell("Reservas", row.total), cell("Confirmadas", row.confirmadas), cell("Canceladas", row.canceladas));
      tbody.appendChild(tr);
    });
    table.append(thead, tbody);
    host.appendChild(table);
  }

  const hours = new Map();
  state.servicioFilas.forEach((row) => {
    const hour = hourKey(row.hora);
    if (hour == null) return;
    hours.set(hour, (hours.get(hour) || 0) + 1);
  });
  const hourEntries = [...hours.entries()].sort((a, b) => a[0] - b[0]);
  if (!hourEntries.length) pendingCharts.set("horas", null);
  else {
    const base = chartBase();
    pendingCharts.set("horas", {
      type: "bar",
      ariaLabel: "Horas con más reservas",
      data: {
        labels: hourEntries.map((entry) => hourLabel(entry[0])),
        datasets: [{
          label: "Reservas",
          data: hourEntries.map((entry) => entry[1]),
          backgroundColor: "#c9a24b",
          borderRadius: 2,
          maxBarThickness: 28
        }]
      },
      options: {
        ...base,
        plugins: { ...base.plugins, legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#5c5148", font: { size: 14 } } },
          y: { beginAtZero: true, ticks: { precision: 0, color: "#5c5148" }, grid: { color: "rgba(26, 21, 18, 0.06)" } }
        }
      }
    });
  }

  const week = [0, 0, 0, 0, 0, 0, 0];
  state.servicioFilas.forEach((row) => {
    const iso = fechaDe(row);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return;
    const day = new Date(iso + "T00:00:00Z").getUTCDay();
    const index = (day + 6) % 7;
    week[index] += 1;
  });
  if (!week.some((value) => value > 0)) pendingCharts.set("dias", null);
  else {
    const base = chartBase();
    pendingCharts.set("dias", {
      type: "bar",
      ariaLabel: "Reservas de lunes a domingo",
      data: {
        labels: WEEKDAYS,
        datasets: [{
          label: "Reservas",
          data: week,
          backgroundColor: "#241c17",
          borderRadius: 2,
          maxBarThickness: 32
        }]
      },
      options: {
        ...base,
        plugins: { ...base.plugins, legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#5c5148", maxRotation: 0, autoSkip: false, font: { size: 13 } } },
          y: { beginAtZero: true, ticks: { precision: 0, color: "#5c5148" }, grid: { color: "rgba(26, 21, 18, 0.06)" } }
        }
      }
    });
  }
  renderChart("horas");
  renderChart("dias");
};

const loadServicios = async () => {
  const range = currentRange();
  if (state.period === "rango" && !validRange(range)) {
    if (rangeError) rangeError.hidden = false;
    return;
  }
  if (rangeError) rangeError.hidden = true;
  const token = ++svcToken;
  try {
    const { data, error } = await supabase
      .from("reservas")
      .select("servicio, estado, fecha, hora")
      .gte("fecha", range.desde)
      .lte("fecha", range.hasta)
      .limit(5000);
    if (token !== svcToken) return;
    if (error) throw error;
    state.servicioFilas = data || [];
    paintServicios();
  } catch (error) {
    if (token !== svcToken) return;
    state.servicioFilas = [];
    const host = document.querySelector("[data-servicios]");
    if (host) host.replaceChildren(el("p", "empty-note", "No pudimos cargar los servicios."));
    pendingCharts.set("horas", null);
    pendingCharts.set("dias", null);
    renderChart("horas");
    renderChart("dias");
  }
};

const loadReservas = async () => {
  const token = ++resToken;
  const selected = diaSeleccionado();
  const today = bogotaToday();
  const desde = selected < today ? selected : today;
  try {
    const [lista, atras] = await Promise.all([
      supabase.from("reservas").select(COLS).gte("fecha", desde).order("fecha").order("hora").limit(800),
      supabase.from("reservas").select(COLS).eq("estado", "pendiente").lt("fecha", desde).order("fecha").order("hora").limit(200)
    ]);
    if (token !== resToken) return;
    if (lista.error) throw lista.error;
    if (atras.error) throw atras.error;
    const merged = new Map();
    [...(lista.data || []), ...(atras.data || [])].forEach((row) => merged.set(row.id, row));
    state.reservas = [...merged.values()];
    state.reservasReady = true;
    const pendingIds = state.reservas.filter((row) => row.estado === "pendiente").map((row) => row.id);
    if (state.pendingKnown) {
      const fresh = pendingIds.filter((id) => !state.pendingKnown.has(id));
      if (fresh.length) anunciarNueva(fresh.length);
    }
    state.pendingKnown = new Set(pendingIds);
    fail("");
    paintReservas();
    lastFetch = Date.now();
  } catch (error) {
    if (token !== resToken) return;
    fail("No pudimos cargar las reservas.");
    if (!state.reservasReady) {
      const host = document.querySelector("[data-reservas]");
      if (host) host.replaceChildren(el("p", "empty-note", "No pudimos cargar las reservas."));
    }
  }
};

const paintFidelidad = () => {
  const host = document.querySelector("[data-fid-table]");
  const input = document.querySelector("[data-fid-q]");
  if (!host) return;
  const query = input ? input.value.trim().toLowerCase() : "";
  const digits = query.replace(/\D/g, "");
  const meta = state.meta || 10;
  const rows = state.fidelidad.filter((row) => {
    if (!query) return true;
    const name = String(row.nombre || "").toLowerCase();
    const phone = digitos(row.telefono);
    if (name.includes(query)) return true;
    if (digits && phone.includes(digits)) return true;
    return phone.includes(query);
  });
  host.replaceChildren();
  if (!rows.length) {
    host.appendChild(el("p", "empty-note", state.fidelidad.length ? "Nadie coincide con esa búsqueda." : "Aún no hay clientes en la tarjeta."));
    return;
  }
  const table = document.createElement("table");
  table.className = "res-table";
  const head = document.createElement("tr");
  ["Cliente", "Celular", "Cortes", "Gratis", "Última visita"].forEach((label) => {
    head.appendChild(el("th", null, label));
  });
  const thead = document.createElement("thead");
  thead.appendChild(head);
  const tbody = document.createElement("tbody");
  rows.forEach((row) => {
    const tr = document.createElement("tr");
    const hechos = num(row.hechos);
    const resto = meta ? hechos % meta : 0;
    const llenos = hechos > 0 && resto === 0 ? meta : resto;
    const cliente = document.createElement("td");
    cliente.dataset.label = "Cliente";
    cliente.appendChild(document.createTextNode(row.nombre || ""));
    if (num(row.gratis_disponibles) > 0) {
      const link = document.createElement("a");
      link.className = "act act-wa";
      link.href = waMensaje(row.telefono, mensajeGratis(row, hechos));
      link.target = "_blank";
      link.rel = "noopener";
      link.textContent = "Avisar por WhatsApp";
      cliente.appendChild(link);
    }
    const tel = document.createElement("td");
    tel.dataset.label = "Celular";
    const phoneLink = document.createElement("a");
    phoneLink.href = waNumero(row.telefono);
    phoneLink.target = "_blank";
    phoneLink.rel = "noopener";
    const phone = digitos(row.telefono);
    phoneLink.textContent = phone ? phone.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : "WhatsApp";
    tel.appendChild(phoneLink);
    const cortes = document.createElement("td");
    cortes.dataset.label = "Cortes";
    const bar = el("div", "fid-bar");
    const fill = el("span", "fid-fill");
    fill.style.width = (meta ? Math.round((llenos / meta) * 100) : 0) + "%";
    bar.appendChild(fill);
    cortes.append(bar, el("span", "fid-count", hechos + "/" + meta));
    const gratis = el("td", null, String(num(row.gratis_disponibles)));
    gratis.dataset.label = "Gratis";
    const ultima = String(row.ultima || "").slice(0, 10);
    const visita = el("td", null, /^\d{4}-\d{2}-\d{2}$/.test(ultima) ? shortDay(ultima) : "—");
    visita.dataset.label = "Última visita";
    tr.append(cliente, tel, cortes, gratis, visita);
    tbody.appendChild(tr);
  });
  table.append(thead, tbody);
  host.appendChild(table);
};

const loadFidelidad = async () => {
  const host = document.querySelector("[data-fid-table]");
  try {
    const [list, cfg] = await Promise.all([
      supabase.rpc("fidelidad_admin"),
      supabase.from("fidelidad_config").select("meta, servicios").limit(1)
    ]);
    if (list.error) throw list.error;
    state.fidelidad = Array.isArray(list.data) ? list.data : [];
    let serviciosCfg = null;
    if (!cfg.error && cfg.data && cfg.data[0]) {
      const meta = num(cfg.data[0].meta);
      state.meta = meta > 0 ? meta : 10;
      serviciosCfg = cfg.data[0].servicios;
      if (typeof serviciosCfg === "string") {
        try { serviciosCfg = JSON.parse(serviciosCfg); } catch (error) { serviciosCfg = null; }
      }
    } else {
      state.meta = 10;
    }
    state.serviciosFidelidad = serviciosCfg == null ? null : serviciosCfg;
    state.fidelidadLista = true;
    paintFidelidad();
  } catch (error) {
    state.fidelidadLista = false;
    if (host) host.replaceChildren(el("p", "empty-note", "No pudimos cargar la fidelidad."));
  }
};

const cerrarAsk = (value) => {
  const box = document.querySelector("[data-ask]");
  if (box) box.hidden = true;
  const resolve = askResolve;
  askResolve = null;
  if (resolve) resolve(value);
};

const preguntar = (texto, si, no, tono) => {
  const box = document.querySelector("[data-ask]");
  const text = document.querySelector("[data-ask-text]");
  const yes = document.querySelector("[data-ask-yes]");
  const noBtn = document.querySelector("[data-ask-no]");
  if (!box || !text || !yes || !noBtn) return Promise.resolve(false);
  text.textContent = texto;
  yes.textContent = si;
  noBtn.textContent = no;
  yes.className = "act " + (tono === "no" ? "act-no" : "act-ok");
  noBtn.className = "act act-quiet";
  box.hidden = false;
  yes.focus();
  return new Promise((resolve) => {
    askResolve = resolve;
  });
};

const refrescarEnlaceHoja = () => {
  const area = document.querySelector("[data-sheet-text]");
  const link = document.querySelector("[data-sheet-wa]");
  if (!area || !link || link.hidden) return;
  const href = enlaceWhatsappCliente(sheetPhone, area.value);
  if (href) link.href = href;
};

const abrirHoja = ({ id, titulo, texto, telefono }) => {
  const sheet = document.querySelector("[data-sheet]");
  const title = document.querySelector("[data-sheet-title]");
  const area = document.querySelector("[data-sheet-text]");
  const link = document.querySelector("[data-sheet-wa]");
  const error = document.querySelector("[data-sheet-error]");
  const copy = document.querySelector("[data-sheet-copy]");
  if (!sheet || !title || !area || !link) return;
  sheetId = id;
  sheetPhone = telefono || "";
  title.textContent = titulo;
  area.value = texto;
  const valido = Boolean(numeroCliente(sheetPhone));
  if (error) error.hidden = valido;
  link.hidden = !valido;
  if (valido) link.href = enlaceWhatsappCliente(sheetPhone, area.value);
  if (copy) copy.textContent = "Copiar mensaje";
  sheet.hidden = false;
  const foco = valido ? link : copy;
  if (foco) foco.focus();
};

const marcarAvisado = async (id) => {
  const { error } = await supabase.from("reservas").update({ avisado: true }).eq("id", id);
  if (error) {
    fail("No se pudo marcar el aviso.");
    return;
  }
  fail("");
  const row = state.reservas.find((item) => item.id === id);
  if (row) row.avisado = true;
  paintReservas();
};

const guardarEstado = async (row, payload) => {
  const { error } = await supabase.from("reservas").update(payload).eq("id", row.id);
  if (error) {
    fail("No se pudo actualizar la cita.");
    return false;
  }
  fail("");
  Object.assign(row, payload);
  return true;
};

const confirmar = async (row, control) => {
  if (saving) return;
  saving = true;
  if (control) control.disabled = true;
  try {
    if (!state.fidelidadLista) await loadFidelidad();
    let aplicar = false;
    if (row.gratis !== true) {
      const ficha = fichaFidelidad(row.telefono);
      if (ficha && num(ficha.gratis_disponibles) > 0 && cuentaServicio(row.servicio)) {
        aplicar = await preguntar(
          nombreDe(row) + " tiene un corte gratis disponible. ¿Aplicarlo a esta cita?",
          "Sí, aplicar",
          "No, cobrar normal",
          "ok"
        );
      }
    }
    const antes = fichaFidelidad(row.telefono);
    const hechosAntes = antes ? num(antes.hechos) : 0;
    const listaAntes = state.fidelidadLista;
    const payload = { estado: "confirmada", avisado: false };
    if (aplicar) payload.gratis = true;
    const ok = await guardarEstado(row, payload);
    if (!ok) return;
    await Promise.all([loadReservas(), loadFidelidad()]);
    let hechosHito = 0;
    if (listaAntes) {
      const despues = fichaFidelidad(row.telefono);
      const hechos = despues ? num(despues.hechos) : 0;
      const meta = state.meta || 10;
      if (hechos > hechosAntes && meta > 0 && hechos % meta === 0) {
        hechosHito = hechos;
        hitos.set(row.id, hechos);
      }
    }
    const actual = state.reservas.find((item) => item.id === row.id) || { ...row, ...payload };
    abrirAviso(actual, hechosHito);
  } finally {
    saving = false;
    if (control) control.disabled = false;
  }
};

const cancelarCita = async (row, control) => {
  if (saving) return;
  const aceptar = await preguntar("¿Cancelar la cita de " + nombreDe(row) + "?", "Sí", "No", "no");
  if (!aceptar) return;
  saving = true;
  if (control) control.disabled = true;
  try {
    const ok = await guardarEstado(row, { estado: "cancelada", avisado: false });
    if (!ok) return;
    await Promise.all([loadReservas(), loadFidelidad()]);
    const actual = state.reservas.find((item) => item.id === row.id) || { ...row, estado: "cancelada", avisado: false };
    abrirAviso(actual);
  } finally {
    saving = false;
    if (control) control.disabled = false;
  }
};

const showView = (name) => {
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    const on = panel.getAttribute("data-panel") === name;
    panel.hidden = !on;
    panel.classList.toggle("is-on", on);
    if (on && !reduceMotion) {
      panel.classList.remove("is-enter");
      void panel.offsetWidth;
      panel.classList.add("is-enter");
    }
  });
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.getAttribute("data-view") === name) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });
  renderVisibleCharts();
};

const setPeriod = (period) => {
  state.period = period;
  document.querySelectorAll("[data-period]").forEach((button) => {
    button.setAttribute("aria-pressed", String(button.getAttribute("data-period") === period));
  });
  if (rangeBox) rangeBox.hidden = period !== "rango";
  if (period === "rango") {
    const today = bogotaToday();
    if (desdeInput && !desdeInput.value) desdeInput.value = addDays(today, -6);
    if (hastaInput && !hastaInput.value) hastaInput.value = today;
  }
  loadServicios();
};

const fechasBloqueo = () => {
  const form = document.querySelector("[data-bloqueo-form]");
  const desde = form ? String(new FormData(form).get("desde") || "") : "";
  const hasta = form ? String(new FormData(form).get("hasta") || "") : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) return [bogotaToday()];
  const fin = /^\d{4}-\d{2}-\d{2}$/.test(hasta) && hasta >= desde ? hasta : desde;
  const fechas = [];
  let cursor = desde;
  for (let i = 0; i < 366 && cursor <= fin; i += 1) {
    fechas.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return fechas.length ? fechas : [bogotaToday()];
};

const horasLocal = (fechas) => {
  const bookable = [];
  const seen = new Set();
  const cierre = new Set();
  fechas.forEach((iso) => {
    horasDelDia(iso).forEach((slot) => {
      if (seen.has(slot)) return;
      seen.add(slot);
      bookable.push(slot);
    });
    const regla = negocio.horario.find((item) => (item.dias || []).includes(diaSemana(iso)));
    const cierra = String((regla && regla.cierra) || "").slice(0, 5);
    if (cierra) cierre.add(cierra);
  });
  bookable.sort();
  const slots = bookable.slice();
  cierre.forEach((slot) => {
    if (!slots.includes(slot)) slots.push(slot);
  });
  slots.sort();
  return {
    inicio: bookable.length ? bookable : ["09:00"],
    slots: slots.length ? slots : ["09:00"]
  };
};

const llenarHorasBloqueo = () => {
  const desde = document.querySelector("[data-bloqueo-form] select[name='hora_desde']");
  const hasta = document.querySelector("[data-bloqueo-form] select[name='hora_hasta']");
  if (!desde || !hasta) return;
  const prevDesde = desde.value;
  const prevHasta = hasta.value;
  const { inicio, slots } = horasLocal(fechasBloqueo());
  const fill = (select, values) => {
    select.replaceChildren();
    values.forEach((slot) => {
      const option = el("option", null, hourLabel(slot));
      option.value = slot;
      select.appendChild(option);
    });
  };
  fill(desde, inicio);
  fill(hasta, slots);
  desde.value = inicio.includes(prevDesde) ? prevDesde : inicio[0];
  hasta.value = slots.includes(prevHasta) ? prevHasta : (inicio[inicio.length - 1] || slots[slots.length - 1]);
};

const bloqueoError = (message) => {
  const node = document.querySelector("[data-bloqueo-error]");
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || "";
};

const leerBloqueo = () => {
  const form = document.querySelector("[data-bloqueo-form]");
  const data = new FormData(form);
  return {
    desde: String(data.get("desde") || ""),
    hasta: String(data.get("hasta") || ""),
    todo: String(data.get("modo") || "dia") !== "horas",
    horaDesde: String(data.get("hora_desde") || ""),
    horaHasta: String(data.get("hora_hasta") || ""),
    motivo: String(data.get("motivo") || "").trim()
  };
};

const bloqueoValido = (bloqueo) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(bloqueo.desde) || !/^\d{4}-\d{2}-\d{2}$/.test(bloqueo.hasta)) {
    bloqueoError("Elige la fecha de inicio y la de fin.");
    return false;
  }
  if (bloqueo.desde > bloqueo.hasta) {
    bloqueoError("La fecha final es anterior a la inicial.");
    return false;
  }
  if (!bloqueo.todo && (!bloqueo.horaDesde || !bloqueo.horaHasta || bloqueo.horaDesde > bloqueo.horaHasta)) {
    bloqueoError("Elige un rango de horas del local.");
    return false;
  }
  bloqueoError("");
  return true;
};

const horaEnRango = (hora, bloqueo) => {
  if (bloqueo.todo) return true;
  const hhmm = String(hora || "").slice(0, 5);
  return hhmm >= bloqueo.horaDesde && hhmm <= bloqueo.horaHasta;
};

let citasEnBloqueo = [];

const ocultarChoques = () => {
  citasEnBloqueo = [];
  const box = document.querySelector("[data-bloqueo-citas]");
  const cancelar = document.querySelector("[data-bloqueo-cancelar-citas]");
  const conservar = document.querySelector("[data-bloqueo-conservar]");
  const guardar = document.querySelector("[data-bloqueo-guardar]");
  if (box) {
    box.hidden = true;
    box.replaceChildren();
  }
  if (cancelar) cancelar.hidden = true;
  if (conservar) conservar.hidden = true;
  if (guardar) guardar.hidden = false;
};

const pintarChoques = (rows) => {
  const box = document.querySelector("[data-bloqueo-citas]");
  const cancelar = document.querySelector("[data-bloqueo-cancelar-citas]");
  const conservar = document.querySelector("[data-bloqueo-conservar]");
  const guardar = document.querySelector("[data-bloqueo-guardar]");
  if (!box) return;
  citasEnBloqueo = rows;
  box.hidden = false;
  box.replaceChildren(el("p", "block-note", "Hay citas en ese horario."));
  rows.forEach((row) => {
    box.appendChild(el("p", "block-cita", [row.nombre || "Sin nombre", fechaCita(fechaDe(row)), horaCita(row.hora)].filter(Boolean).join(" · ")));
  });
  if (cancelar) cancelar.hidden = false;
  if (conservar) conservar.hidden = false;
  if (guardar) guardar.hidden = true;
};

const citasDelBloqueo = async (bloqueo) => {
  const { data, error } = await supabase
    .from("reservas")
    .select("id, nombre, telefono, fecha, hora, estado")
    .in("estado", ["pendiente", "confirmada"])
    .gte("fecha", bloqueo.desde)
    .lte("fecha", bloqueo.hasta);
  if (error) throw error;
  return (data || []).filter((row) => horaEnRango(row.hora, bloqueo));
};

const pintarAvisos = (rows) => {
  const host = document.querySelector("[data-bloqueo-avisos]");
  if (!host) return;
  host.hidden = false;
  host.replaceChildren(el("p", "block-note", "Bloqueo guardado. Avisa a estos clientes:"));
  rows.forEach((row) => {
    const line = el("p", "block-aviso");
    const texto = mensajeBloqueo(row);
    const link = document.createElement("a");
    link.href = waMensaje(row.telefono, texto);
    link.target = "_blank";
    link.rel = "noopener";
    link.textContent = "Avisar por WhatsApp";
    line.append(document.createTextNode((row.nombre || "Cliente") + " · "), link);
    host.appendChild(line);
  });
};

const guardarBloqueo = async (cancelar) => {
  const bloqueo = leerBloqueo();
  if (!bloqueoValido(bloqueo)) return;
  const rows = citasEnBloqueo.slice();
  const guardar = document.querySelector("[data-bloqueo-guardar]");
  const cancelarBtn = document.querySelector("[data-bloqueo-cancelar-citas]");
  const conservar = document.querySelector("[data-bloqueo-conservar]");
  [guardar, cancelarBtn, conservar].forEach((button) => {
    if (button) button.disabled = true;
  });
  try {
    if (cancelar && rows.length) {
      const { error } = await supabase.from("reservas").update({ estado: "cancelada" }).in("id", rows.map((row) => row.id));
      if (error) throw error;
    }
    const payload = {
      desde: bloqueo.desde,
      hasta: bloqueo.hasta,
      hora_desde: bloqueo.todo ? null : bloqueo.horaDesde + ":00",
      hora_hasta: bloqueo.todo ? null : bloqueo.horaHasta + ":00",
      motivo: bloqueo.motivo || null
    };
    const inserted = await supabase.from("bloqueos").insert(payload);
    if (inserted.error) throw inserted.error;
    bloqueoError("");
    ocultarChoques();
    const form = document.querySelector("[data-bloqueo-form]");
    if (form) form.hidden = true;
    if (cancelar && rows.length) {
      pintarAvisos(rows);
      loadReservas();
      loadFidelidad();
    }
    await loadBloqueos();
  } catch (error) {
    bloqueoError(cancelar ? "No pudimos cancelar las citas o guardar el bloqueo." : "No pudimos guardar el bloqueo.");
    if (cancelar && rows.length) {
      pintarAvisos(rows);
      loadReservas();
      loadFidelidad();
    }
  } finally {
    [guardar, cancelarBtn, conservar].forEach((button) => {
      if (button) button.disabled = false;
    });
  }
};

const paintBloqueos = () => {
  const host = document.querySelector("[data-bloqueos]");
  if (!host) return;
  host.replaceChildren();
  if (!state.bloqueos.length) {
    host.appendChild(el("p", "empty-note", "No hay bloqueos vigentes."));
    return;
  }
  state.bloqueos.forEach((row) => {
    const item = el("article", "block-item");
    const desde = String(row.desde || "").slice(0, 10);
    const hasta = String(row.hasta || "").slice(0, 10);
    const fechas = desde === hasta ? shortDay(desde) : shortDay(desde) + " – " + shortDay(hasta);
    const cuando = !row.hora_desde || !row.hora_hasta
      ? fechas + " · Todo el día"
      : fechas + " · " + hourLabel(row.hora_desde) + " – " + hourLabel(row.hora_hasta);
    item.appendChild(el("h3", null, cuando));
    if (row.motivo) item.appendChild(el("p", "block-motivo", row.motivo));
    const button = el("button", "dash-btn", "Quitar bloqueo");
    button.type = "button";
    button.addEventListener("click", async () => {
      if (!window.confirm("¿Quitar este bloqueo?")) return;
      button.disabled = true;
      const { error } = await supabase.from("bloqueos").delete().eq("id", row.id);
      button.disabled = false;
      if (error) {
        fail("No pudimos quitar el bloqueo.");
        return;
      }
      fail("");
      await loadBloqueos();
    });
    item.appendChild(button);
    host.appendChild(item);
  });
};

const loadBloqueos = async () => {
  const host = document.querySelector("[data-bloqueos]");
  const today = bogotaToday();
  try {
    const { data, error } = await supabase
      .from("bloqueos")
      .select("id, desde, hasta, hora_desde, hora_hasta, motivo")
      .gte("hasta", today)
      .order("desde", { ascending: true });
    if (error) throw error;
    state.bloqueos = data || [];
    paintBloqueos();
  } catch (error) {
    if (host) host.replaceChildren(el("p", "empty-note", "No pudimos cargar los bloqueos."));
  }
};

const prepararBloqueos = () => {
  llenarHorasBloqueo();
  const form = document.querySelector("[data-bloqueo-form]");
  const abrir = document.querySelector("[data-bloqueo-abrir]");
  if (abrir && form) {
    abrir.addEventListener("click", () => {
      form.hidden = false;
      const today = bogotaToday();
      const desde = form.querySelector("[name='desde']");
      const hasta = form.querySelector("[name='hasta']");
      if (desde && !desde.value) desde.value = today;
      if (hasta && !hasta.value) hasta.value = today;
      llenarHorasBloqueo();
      ocultarChoques();
      const avisos = document.querySelector("[data-bloqueo-avisos]");
      if (avisos) avisos.hidden = true;
    });
  }
  const ponerDia = (iso) => {
    if (!form) return;
    const desde = form.querySelector("[name='desde']");
    const hasta = form.querySelector("[name='hasta']");
    if (desde) desde.value = iso;
    if (hasta) hasta.value = iso;
    llenarHorasBloqueo();
    ocultarChoques();
  };
  const hoy = document.querySelector("[data-bloqueo-hoy]");
  const manana = document.querySelector("[data-bloqueo-manana]");
  if (hoy) hoy.addEventListener("click", () => ponerDia(bogotaToday()));
  if (manana) manana.addEventListener("click", () => ponerDia(addDays(bogotaToday(), 1)));
  if (form) {
    form.querySelectorAll("[name='modo']").forEach((input) => {
      input.addEventListener("change", () => {
        const horas = document.querySelector("[data-bloqueo-horas]");
        const chosen = form.querySelector("[name='modo']:checked");
        if (horas && chosen) horas.hidden = chosen.value !== "horas";
        ocultarChoques();
      });
    });
    form.querySelectorAll("[name='desde'], [name='hasta']").forEach((input) => {
      input.addEventListener("change", () => {
        llenarHorasBloqueo();
        ocultarChoques();
      });
    });
    form.querySelectorAll("[name='hora_desde'], [name='hora_hasta']").forEach((input) => {
      input.addEventListener("change", ocultarChoques);
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const bloqueo = leerBloqueo();
      if (!bloqueoValido(bloqueo)) return;
      const button = document.querySelector("[data-bloqueo-guardar]");
      if (button) button.disabled = true;
      try {
        const rows = await citasDelBloqueo(bloqueo);
        if (rows.length) {
          pintarChoques(rows);
          return;
        }
        citasEnBloqueo = [];
        await guardarBloqueo(false);
      } catch (error) {
        bloqueoError("No pudimos revisar las citas.");
      } finally {
        if (button) button.disabled = false;
      }
    });
  }
  const cancelar = document.querySelector("[data-bloqueo-cancelar-citas]");
  const conservar = document.querySelector("[data-bloqueo-conservar]");
  if (cancelar) cancelar.addEventListener("click", () => guardarBloqueo(true));
  if (conservar) conservar.addEventListener("click", () => guardarBloqueo(false));
};

const tuneCharts = () => {
  if (!globalThis.Chart) return;
  globalThis.Chart.defaults.font.family = '"Outfit", "Avenir Next", sans-serif';
  globalThis.Chart.defaults.color = "#5c5148";
};

const refreshAll = async () => {
  paintHeader();
  await Promise.all([loadReservas(), loadFidelidad(), loadBloqueos(), loadServicios()]);
};

const guard = async () => {
  if (!navigator.onLine) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!navigator.onLine) return;
  if (!session) {
    window.location.replace("admin-login.html");
    return;
  }
  const { data, error } = await supabase.from("admins").select("id").limit(1);
  if (!navigator.onLine) return;
  if (error || !data || !data.length) {
    await supabase.auth.signOut();
    window.location.replace("admin-login.html");
    return;
  }
  document.documentElement.dataset.panelReady = "1";
  const mail = document.querySelector("[data-admin-email]");
  if (mail) mail.textContent = session.user.email || "";
  tuneCharts();
  paintHeader();
  await refreshAll();
  window.setInterval(() => {
    if (document.visibilityState !== "visible") return;
    refreshAll();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    if (Date.now() - lastFetch < 15000) return;
    refreshAll();
  });
};

document.querySelectorAll("[data-view]").forEach((button) => {
  button.addEventListener("click", () => showView(button.getAttribute("data-view")));
});
document.querySelectorAll("[data-period]").forEach((button) => {
  button.addEventListener("click", () => setPeriod(button.getAttribute("data-period")));
});
if (desdeInput) desdeInput.addEventListener("change", () => {
  if (state.period === "rango") loadServicios();
});
if (hastaInput) hastaInput.addEventListener("change", () => {
  if (state.period === "rango") loadServicios();
});
document.querySelectorAll("[data-dia]").forEach((button) => {
  button.addEventListener("click", () => {
    state.diaModo = button.getAttribute("data-dia");
    if (state.diaModo === "fecha" && !state.diaFecha) state.diaFecha = bogotaToday();
    syncDia();
    const selected = diaSeleccionado();
    const loaded = state.reservas.some((row) => fechaDe(row) === selected) || selected >= bogotaToday();
    if (!loaded) loadReservas();
    else paintReservas();
  });
});
const diaInput = document.querySelector("[data-dia-input]");
if (diaInput) diaInput.addEventListener("change", () => {
  state.diaModo = "fecha";
  state.diaFecha = diaInput.value;
  syncDia();
  loadReservas();
});
const refresh = () => refreshAll();
const refreshBtn = document.querySelector("[data-refresh]");
const refreshCitas = document.querySelector("[data-refresh-citas]");
if (refreshBtn) refreshBtn.addEventListener("click", refresh);
if (refreshCitas) refreshCitas.addEventListener("click", refresh);
const nuevaClose = document.querySelector("[data-nueva-close]");
if (nuevaClose) nuevaClose.addEventListener("click", () => {
  const box = document.querySelector("[data-nueva]");
  if (box) box.hidden = true;
});
const fidInput = document.querySelector("[data-fid-q]");
if (fidInput) fidInput.addEventListener("input", paintFidelidad);
const askYes = document.querySelector("[data-ask-yes]");
const askNo = document.querySelector("[data-ask-no]");
if (askYes) askYes.addEventListener("click", () => cerrarAsk(true));
if (askNo) askNo.addEventListener("click", () => cerrarAsk(false));
const sheetClose = document.querySelector("[data-sheet-close]");
if (sheetClose) sheetClose.addEventListener("click", () => {
  const sheet = document.querySelector("[data-sheet]");
  if (sheet) sheet.hidden = true;
  sheetId = null;
  sheetPhone = "";
});
const sheetText = document.querySelector("[data-sheet-text]");
if (sheetText) sheetText.addEventListener("input", refrescarEnlaceHoja);
const sheetWa = document.querySelector("[data-sheet-wa]");
if (sheetWa) sheetWa.addEventListener("click", (event) => {
  refrescarEnlaceHoja();
  if (!numeroCliente(sheetPhone)) {
    event.preventDefault();
    return;
  }
  if (sheetId) marcarAvisado(sheetId);
});
const sheetCopy = document.querySelector("[data-sheet-copy]");
if (sheetCopy) sheetCopy.addEventListener("click", async () => {
  const area = document.querySelector("[data-sheet-text]");
  const texto = area ? area.value : "";
  let copiado = false;
  try {
    await navigator.clipboard.writeText(texto);
    copiado = true;
  } catch (error) {
    try {
      if (area) {
        area.focus();
        area.select();
        area.setSelectionRange(0, texto.length);
      }
      copiado = document.execCommand("copy");
    } catch (err) {
      copiado = false;
    }
  }
  if (!copiado) return;
  sheetCopy.textContent = "Mensaje copiado";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    sheetCopy.textContent = "Copiar mensaje";
  }, 1600);
});
prepararBloqueos();
const logout = document.querySelector("[data-logout]");
if (logout) logout.addEventListener("click", async () => {
  try {
    await Promise.race([
      supabase.auth.signOut(),
      new Promise((resolve) => window.setTimeout(resolve, 2500))
    ]);
  } catch (error) {}
  window.location.replace("admin-login.html");
});

guard();
