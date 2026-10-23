import { negocio, enlaceWhatsapp, enlaceMapa, formatoPrecio, reservasEnLinea } from "./config.js";
import { obtenerSupabase } from "./supabase.js";
import { traducir, celularValido, nombreValido } from "./errores.js";
import { hoyISO, sumarDias, fechaLegible, fechaCorta, horaLegible, aMinutos, instanteBogota } from "./tiempo.js";
import { nodo, hojaEstilos } from "./dom.js";

const LLAVE = "lamansion_citas";
const VISITA = "lamansion_visita";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ESTADOS = {
  pendiente: "Pendiente de confirmación",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
  no_asistio: "No asististe"
};

const estado = {
  config: null,
  sedes: [],
  barberos: [],
  servicios: [],
  paso: 0,
  sedeId: "",
  servicioId: "",
  barberoId: "",
  fecha: "",
  hora: "",
  ofertas: new Map(),
  fechas: 14,
  modo: "",
  token: "",
  citas: new Map(),
  supabase: null
};

const movil = () => window.matchMedia("(max-width: 767px)").matches;
const hoja = hojaEstilos();
const reglas = new Set();

function leerTokens() {
  try {
    const lista = JSON.parse(localStorage.getItem(LLAVE) || "[]");
    if (!Array.isArray(lista)) return [];
    const unicos = [];
    lista.forEach((item) => {
      const token = String(item || "").trim().toLowerCase();
      if (!UUID.test(token) || unicos.includes(token)) return;
      unicos.push(token);
    });
    return unicos.slice(0, 5);
  } catch (error) {
    return [];
  }
}

function guardarToken(token) {
  const limpio = String(token || "").trim().toLowerCase();
  if (!UUID.test(limpio)) return;
  const lista = [limpio, ...leerTokens().filter((item) => item !== limpio)].slice(0, 5);
  try {
    localStorage.setItem(LLAVE, JSON.stringify(lista));
  } catch (error) {}
}

function olvidarToken(token) {
  const lista = leerTokens().filter((item) => item !== token);
  try {
    localStorage.setItem(LLAVE, JSON.stringify(lista));
  } catch (error) {}
}

async function registrar(tipo) {
  try {
    if (!estado.supabase) return;
    await estado.supabase.rpc("registrar_evento", { p_tipo: tipo });
  } catch (error) {}
}

function precioDe(servicio) {
  if (!servicio || servicio.precio == null || servicio.precio === "") return "Consultar por WhatsApp";
  return formatoPrecio(servicio.precio);
}

function sedesActivas() {
  return estado.sedes.filter((item) => item.activa !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function serviciosActivos() {
  return estado.servicios.filter((item) => item.activo !== false).sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function servicioActual() {
  return estado.servicios.find((item) => item.id === estado.servicioId) || null;
}

function barberoPorId(id) {
  return estado.barberos.find((item) => item.id === id) || null;
}

function ofrece(barbero, servicioId) {
  if (!barbero || barbero.activo === false) return false;
  if (barbero.servicios == null) return true;
  return Array.isArray(barbero.servicios) && barbero.servicios.includes(servicioId);
}

function barberosDelPaso() {
  return estado.barberos
    .filter((item) => item.sede_id === estado.sedeId && ofrece(item, estado.servicioId))
    .sort((a, b) => (a.orden || 0) - (b.orden || 0));
}

function pasos() {
  const lista = [];
  if (sedesActivas().length > 1) lista.push("sede");
  lista.push("servicio", "barbero", "horario", "datos");
  return lista;
}

function nombrePaso(clave) {
  return { sede: "Sede", servicio: "Servicio", barbero: "Barbero", horario: "Horario", datos: "Datos" }[clave] || clave;
}

function app() {
  return document.querySelector("[data-reserva-app]");
}

function pasosCaja() {
  return document.querySelector("[data-reserva-pasos]");
}

function cerrarHoja() {
  const caja = pasosCaja();
  if (caja) {
    caja.hidden = true;
    caja.classList.remove("abierta");
  }
  document.body.classList.remove("reserva-lock");
  const abrir = document.querySelector("[data-reserva-abrir]");
  if (abrir) abrir.focus();
}

function abrirHoja() {
  const caja = pasosCaja();
  if (!caja) return;
  caja.hidden = false;
  caja.classList.add("abierta");
  document.body.classList.toggle("reserva-lock", movil());
  registrar("reserva_iniciada");
  const atraso = caja.querySelector("[data-reserva-atras]");
  if (atraso) atraso.focus();
}

function atrapar(caja, evento) {
  if (evento.key !== "Tab" || !caja || caja.hidden) return;
  const focos = [...caja.querySelectorAll("a, button, input, textarea, select")].filter((el) => !el.disabled && el.offsetParent !== null);
  if (!focos.length) return;
  const primero = focos[0];
  const ultimo = focos[focos.length - 1];
  if (evento.shiftKey && document.activeElement === primero) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primero.focus();
  }
}

function preguntar(texto) {
  return new Promise((resolve) => {
    let capa = document.querySelector("[data-reserva-confirma]");
    if (!capa) {
      capa = nodo("div", "reserva-confirma");
      capa.dataset.reservaConfirma = "1";
      capa.hidden = true;
      const card = nodo("div", "reserva-confirma-card");
      card.setAttribute("role", "dialog");
      card.setAttribute("aria-modal", "true");
      const copia = nodo("p");
      copia.dataset.reservaConfirmaTexto = "1";
      const acciones = nodo("div", "reserva-confirma-acciones");
      const si = nodo("button", "btn", "Sí, cancelar");
      si.type = "button";
      si.dataset.confirmarSi = "1";
      const no = nodo("button", "btn btn-sec", "No");
      no.type = "button";
      no.dataset.confirmarNo = "1";
      acciones.append(si, no);
      card.append(copia, acciones);
      capa.appendChild(card);
      document.body.appendChild(capa);
    }
    capa.querySelector("[data-reserva-confirma-texto]").textContent = texto;
    capa.hidden = false;
    const si = capa.querySelector("[data-confirmar-si]");
    const no = capa.querySelector("[data-confirmar-no]");
    const cerrar = (valor) => {
      capa.hidden = true;
      si.removeEventListener("click", alSi);
      no.removeEventListener("click", alNo);
      resolve(valor);
    };
    const alSi = () => cerrar(true);
    const alNo = () => cerrar(false);
    si.addEventListener("click", alSi);
    no.addEventListener("click", alNo);
    si.focus();
  });
}

function enlaceCita(fila) {
  const texto = "Hola, soy " + (fila.nombre || "") + ". Mi cita " + (fila.numero || "") + " en " + negocio.nombre + ": " + (fila.servicio || "") + " con " + (fila.barbero || "") + " el " + fechaLegible(fila.fecha) + " a las " + horaLegible(fila.hora) + ".";
  return enlaceWhatsapp(texto);
}

function descargarIcs(fila) {
  const inicio = instanteBogota(fila.fecha, fila.hora);
  const fin = inicio + (Number(fila.duracion_min) || 30) * 60000;
  const marca = (ms) => {
    const fecha = new Date(ms - 5 * 3600000);
    const y = fecha.getUTCFullYear();
    const m = String(fecha.getUTCMonth() + 1).padStart(2, "0");
    const d = String(fecha.getUTCDate()).padStart(2, "0");
    const h = String(fecha.getUTCHours()).padStart(2, "0");
    const min = String(fecha.getUTCMinutes()).padStart(2, "0");
    return y + m + d + "T" + h + min + "00";
  };
  const limpio = (valor) => String(valor || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//La Mansion Barber Shop//Citas//ES",
    "BEGIN:VTIMEZONE",
    "TZID:America/Bogota",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:-0500",
    "TZOFFSETTO:-0500",
    "TZNAME:COT",
    "END:STANDARD",
    "END:VTIMEZONE",
    "BEGIN:VEVENT",
    "UID:" + (fila.numero || "cita") + "@lamansion",
    "DTSTART;TZID=America/Bogota:" + marca(inicio),
    "DTEND;TZID=America/Bogota:" + marca(fin),
    "SUMMARY:" + limpio((fila.servicio || "Cita") + " en " + negocio.nombre),
    "LOCATION:" + limpio(fila.direccion || negocio.direccion),
    "END:VEVENT",
    "END:VCALENDAR"
  ];
  const blob = new Blob([lineas.join("\r\n")], { type: "text/calendar" });
  const url = URL.createObjectURL(blob);
  const enlace = nodo("a");
  enlace.href = url;
  enlace.download = "cita-" + (fila.numero || "mansion") + ".ics";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function botonWhatsapp(texto, clase) {
  const enlace = nodo("a", clase || "btn", texto || "Agenda por WhatsApp");
  const href = enlaceWhatsapp();
  if (href) {
    enlace.href = href;
    enlace.target = "_blank";
    enlace.rel = "noopener";
  }
  enlace.dataset.wa = "1";
  return enlace;
}

function pintarCita() {
  const host = document.querySelector("[data-cita-host]");
  if (!host) return;
  host.replaceChildren();
  const tokens = leerTokens();
  let fila = null;
  let token = "";
  for (const item of tokens) {
    const candidata = estado.citas.get(item);
    if (!candidata) continue;
    if (candidata.estado === "pendiente" || candidata.estado === "confirmada") {
      fila = candidata;
      token = item;
      break;
    }
  }
  if (!fila) {
    for (const item of tokens) {
      const candidata = estado.citas.get(item);
      if (!candidata) continue;
      fila = candidata;
      token = item;
      break;
    }
  }
  if (!fila) return;
  const tarjeta = nodo("article", "cita-card");
  tarjeta.appendChild(nodo("h3", null, "Tu cita"));
  const estadoTexto = ESTADOS[fila.estado] || fila.estado;
  const badge = nodo("p", "cita-estado estado-" + fila.estado, estadoTexto);
  tarjeta.appendChild(badge);
  tarjeta.appendChild(nodo("p", "cita-numero", "Cita " + (fila.numero || "")));
  const detalle = nodo("p", "cita-detalle");
  detalle.textContent = [fila.servicio, fila.barbero, fechaLegible(fila.fecha), horaLegible(fila.hora), fila.sede].filter(Boolean).join(" · ");
  tarjeta.appendChild(detalle);
  const terminal = fila.estado === "completada" || fila.estado === "cancelada" || fila.estado === "no_asistio";
  if (terminal) tarjeta.appendChild(nodo("p", "cita-gracias", "Gracias por venir"));
  const acciones = nodo("div", "cita-acciones");
  if (!terminal && fila.puede_cancelar) {
    const cancelar = nodo("button", "btn btn-sec", "Cancelar");
    cancelar.type = "button";
    cancelar.dataset.citaCancelar = "1";
    cancelar.addEventListener("click", () => cancelarCita(token, cancelar));
    const cambiar = nodo("button", "btn btn-sec", "Cambiar fecha u hora");
    cambiar.type = "button";
    cambiar.dataset.citaCambiar = "1";
    cambiar.addEventListener("click", () => abrirReagendar(token, fila));
    acciones.append(cancelar, cambiar);
  }
  if (terminal) {
    const descartar = nodo("button", "btn btn-sec", "Descartar");
    descartar.type = "button";
    descartar.dataset.citaDescartar = "1";
    descartar.addEventListener("click", () => {
      olvidarToken(token);
      estado.citas.delete(token);
      pintarCita();
    });
    acciones.appendChild(descartar);
  }
  const calendario = nodo("button", "btn btn-sec", "Agregar al calendario");
  calendario.type = "button";
  calendario.dataset.ics = "1";
  calendario.addEventListener("click", () => descargarIcs(fila));
  const aviso = nodo("a", "btn", "Avisar por WhatsApp");
  aviso.href = enlaceCita(fila);
  aviso.target = "_blank";
  aviso.rel = "noopener";
  aviso.dataset.wa = "1";
  acciones.append(calendario, aviso);
  tarjeta.appendChild(acciones);
  const nota = nodo("p", "form-error");
  nota.dataset.citaNota = "1";
  nota.hidden = true;
  nota.setAttribute("role", "alert");
  tarjeta.appendChild(nota);
  host.appendChild(tarjeta);
}

async function cancelarCita(token, boton) {
  const aceptar = await preguntar("¿Cancelar esta cita?");
  if (!aceptar) return;
  boton.disabled = true;
  try {
    const { error } = await estado.supabase.rpc("cancelar_reserva", { p_token: token });
    if (error) throw error;
    await refrescarCitas();
  } catch (error) {
    const nota = document.querySelector("[data-cita-nota]");
    if (nota) {
      nota.hidden = false;
      nota.textContent = traducir(error);
    }
  } finally {
    boton.disabled = false;
  }
}

function abrirReagendar(token, fila) {
  const barbero = estado.barberos.find((item) => item.nombre === fila.barbero);
  if (!barbero) return;
  estado.modo = "reagendar";
  estado.token = token;
  estado.barberoId = barbero.id;
  estado.servicioId = "";
  estado.fecha = fila.fecha;
  estado.hora = "";
  estado.ofertas = new Map();
  const lista = pasos();
  estado.paso = lista.indexOf("horario");
  if (estado.paso < 0) estado.paso = 0;
  abrirHoja();
  pintarPasos();
}

async function refrescarCitas() {
  const tokens = leerTokens();
  if (!tokens.length || !estado.supabase) {
    pintarCita();
    return;
  }
  for (const token of tokens) {
    try {
      const { data, error } = await estado.supabase.rpc("estado_reserva", { p_token: token });
      if (error || !data) {
        estado.citas.delete(token);
        continue;
      }
      const fila = Array.isArray(data) ? data[0] : data;
      if (!fila || !fila.estado) {
        estado.citas.delete(token);
        continue;
      }
      estado.citas.set(token, fila);
    } catch (error) {}
  }
  pintarCita();
}

function pintarFidelidad() {
  const host = document.querySelector("[data-fidelidad-host]");
  if (!host) return;
  host.replaceChildren();
  if (!estado.config || !estado.config.fidelidad_activa) return;
  const tarjeta = nodo("article", "fid-card");
  tarjeta.appendChild(nodo("h3", null, "Tu tarjeta"));
  const formulario = nodo("form", "fid-form");
  const label = nodo("label", "campo");
  label.appendChild(nodo("span", null, "Consulta tu tarjeta"));
  const input = document.createElement("input");
  input.type = "tel";
  input.inputMode = "numeric";
  input.autocomplete = "off";
  input.maxLength = 12;
  input.dataset.fidCel = "1";
  input.setAttribute("aria-label", "Celular para consultar la tarjeta");
  label.appendChild(input);
  const boton = nodo("button", "btn", "Consultar");
  boton.type = "submit";
  boton.dataset.fidVer = "1";
  formulario.append(label, boton);
  const error = nodo("p", "form-error");
  error.hidden = true;
  error.setAttribute("role", "alert");
  const resultado = nodo("div", "fid-resultado");
  resultado.dataset.fidResultado = "1";
  formulario.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    error.hidden = true;
    const cel = celularValido(input.value);
    if (!cel.ok) {
      error.hidden = false;
      error.textContent = "Revisa tu celular: 10 dígitos y empieza por 3.";
      return;
    }
    boton.disabled = true;
    try {
      const { data, error: falloRpc } = await estado.supabase.rpc("mi_fidelidad", { p_telefono: cel.digitos });
      if (falloRpc) throw falloRpc;
      const ficha = Array.isArray(data) ? data[0] : data;
      pintarSellos(resultado, ficha);
    } catch (fallo) {
      error.hidden = false;
      error.textContent = traducir(fallo);
    } finally {
      boton.disabled = false;
    }
  });
  tarjeta.append(formulario, error, resultado);
  host.appendChild(tarjeta);
}

function pintarSellos(host, ficha) {
  host.replaceChildren();
  if (!ficha || ficha.activa === false) {
    host.appendChild(nodo("p", null, "La tarjeta de fidelidad no está activa."));
    return;
  }
  const meta = Math.max(1, Number(ficha.meta) || 1);
  const progreso = Math.max(0, Math.min(meta, Number(ficha.progreso) || 0));
  const grilla = nodo("div", "fid-sellos");
  grilla.setAttribute("role", "img");
  grilla.setAttribute("aria-label", progreso + " de " + meta + " sellos");
  for (let i = 0; i < meta; i += 1) {
    grilla.appendChild(nodo("span", "sello" + (i < progreso ? " is-on" : "")));
  }
  host.appendChild(grilla);
  if (ficha.gratis_disponible) {
    const aviso = nodo("p", "fid-gratis", "¡Tu próximo corte es gratis!");
    aviso.dataset.gratis = "1";
    host.appendChild(aviso);
    host.appendChild(nodo("p", null, "Pídelo al reservar."));
  }
}

function esqueleto(host, cantidad) {
  host.replaceChildren();
  host.setAttribute("aria-busy", "true");
  for (let i = 0; i < cantidad; i += 1) host.appendChild(nodo("div", "esqueleto"));
}

function progreso() {
  const lista = pasos();
  const barra = document.querySelector("[data-progreso]");
  if (!barra) return;
  const actual = Math.min(estado.paso + 1, lista.length);
  barra.setAttribute("aria-valuenow", String(actual));
  barra.setAttribute("aria-valuemax", String(lista.length));
  barra.replaceChildren();
  const texto = nodo("span", "progreso-texto", "Paso " + actual + " de " + lista.length + ": " + nombrePaso(lista[estado.paso] || "listo"));
  const pista = nodo("span", "progreso-pista");
  const relleno = nodo("span", "progreso-relleno");
  pista.appendChild(relleno);
  barra.append(texto, pista);
  const porcentaje = Math.round((actual / lista.length) * 100);
  aplicarRelleno(relleno, porcentaje);
}

function aplicarRelleno(el, porcentaje) {
  const id = "relleno-" + porcentaje;
  el.classList.add(id);
  if (!hoja || reglas.has(id)) return;
  reglas.add(id);
  try {
    hoja.insertRule("." + id + "{transform:scaleX(" + (porcentaje / 100) + ")}", hoja.cssRules.length);
  } catch (error) {}
}

function pintarPasos() {
  const caja = pasosCaja();
  if (!caja) return;
  const cuerpo = caja.querySelector("[data-paso]");
  if (!cuerpo) return;
  const lista = pasos();
  if (estado.paso >= lista.length) estado.paso = lista.length - 1;
  if (estado.paso < 0) estado.paso = 0;
  progreso();
  const clave = estado.modo === "reagendar" ? "horario" : lista[estado.paso];
  cuerpo.replaceChildren();
  if (clave === "sede") pintarSedes(cuerpo);
  if (clave === "servicio") pintarServicios(cuerpo);
  if (clave === "barbero") pintarBarberos(cuerpo);
  if (clave === "horario") pintarHorario(cuerpo);
  if (clave === "datos") pintarDatos(cuerpo);
  const titulo = caja.querySelector("[data-paso-titulo]");
  if (titulo) titulo.textContent = estado.modo === "reagendar" ? "Cambiar fecha u hora" : nombrePaso(clave);
}

function avanzar() {
  estado.paso += 1;
  pintarPasos();
  const titulo = pasosCaja() && pasosCaja().querySelector("[data-paso-titulo]");
  if (titulo) titulo.focus();
}

function pintarSedes(host) {
  host.appendChild(nodo("p", null, "Elige la sede."));
  const lista = nodo("div", "opciones");
  sedesActivas().forEach((sede) => {
    const boton = nodo("button", "opcion", "");
    boton.type = "button";
    boton.dataset.sede = sede.id;
    boton.append(nodo("strong", null, sede.nombre), nodo("span", null, sede.direccion || ""));
    boton.addEventListener("click", () => {
      estado.sedeId = sede.id;
      avanzar();
    });
    lista.appendChild(boton);
  });
  host.appendChild(lista);
}

function pintarServicios(host) {
  const categorias = ["Todos", ...new Set(serviciosActivos().map((item) => item.categoria).filter(Boolean))];
  let activa = "Todos";
  const chips = nodo("div", "chips");
  chips.setAttribute("role", "group");
  chips.setAttribute("aria-label", "Categorías");
  const lista = nodo("div", "opciones");
  const pintar = () => {
    lista.replaceChildren();
    serviciosActivos().filter((item) => activa === "Todos" || item.categoria === activa).forEach((servicio) => {
      const sinPrecio = servicio.precio == null || servicio.precio === "";
      if (sinPrecio) {
        const enlace = nodo("a", "opcion", "");
        enlace.href = enlaceWhatsapp("Hola, quiero preguntar por " + servicio.nombre + " en " + negocio.nombre + ".");
        enlace.target = "_blank";
        enlace.rel = "noopener";
        enlace.dataset.wa = "1";
        enlace.append(nodo("strong", null, servicio.nombre), nodo("span", null, servicio.descripcion || ""), nodo("span", null, (servicio.duracion_min || "") + " min · Consultar por WhatsApp"));
        lista.appendChild(enlace);
        return;
      }
      const boton = nodo("button", "opcion", "");
      boton.type = "button";
      boton.dataset.servicio = servicio.id;
      boton.append(nodo("strong", null, servicio.nombre), nodo("span", null, servicio.descripcion || ""), nodo("span", null, (servicio.duracion_min || "") + " min · " + precioDe(servicio)));
      boton.addEventListener("click", () => {
        estado.servicioId = servicio.id;
        estado.barberoId = "";
        avanzar();
      });
      lista.appendChild(boton);
    });
  };
  categorias.forEach((categoria) => {
    const chip = nodo("button", "chip" + (categoria === activa ? " is-on" : ""), categoria);
    chip.type = "button";
    chip.setAttribute("aria-pressed", categoria === activa ? "true" : "false");
    chip.addEventListener("click", () => {
      activa = categoria;
      [...chips.children].forEach((item) => {
        const on = item.textContent === categoria;
        item.classList.toggle("is-on", on);
        item.setAttribute("aria-pressed", on ? "true" : "false");
      });
      pintar();
    });
    chips.appendChild(chip);
  });
  host.append(chips, lista);
  pintar();
}

function pintarBarberos(host) {
  const lista = nodo("div", "opciones");
  const primero = nodo("button", "opcion", "");
  primero.type = "button";
  primero.dataset.barbero = "primero";
  primero.append(nodo("strong", null, "El primero disponible"), nodo("span", null, "Te asignamos al primer barbero con esa hora."));
  primero.addEventListener("click", () => {
    estado.barberoId = "";
    estado.fecha = hoyISO();
    avanzar();
  });
  lista.appendChild(primero);
  barberosDelPaso().forEach((barbero) => {
    const boton = nodo("button", "opcion", "");
    boton.type = "button";
    boton.dataset.barbero = barbero.id;
    const texto = nodo("span", "opcion-texto");
    texto.append(nodo("strong", null, barbero.nombre), nodo("span", null, barbero.especialidad || ""));
    if (barbero.foto) {
      const foto = document.createElement("img");
      foto.src = "assets/img/fotos/" + barbero.foto + "-480.webp";
      foto.width = 96;
      foto.height = 120;
      foto.alt = "";
      boton.append(foto, texto);
    } else {
      boton.appendChild(texto);
    }
    boton.addEventListener("click", () => {
      estado.barberoId = barbero.id;
      estado.fecha = hoyISO();
      avanzar();
    });
    lista.appendChild(boton);
  });
  if (barberosDelPaso().length === 0) {
    host.appendChild(nodo("p", null, "Ese servicio o barbero ya no está disponible. Elige otro."));
    return;
  }
  host.appendChild(lista);
}

async function cargarHoras(fecha) {
  const servicio = servicioActual();
  const duracion = estado.modo === "reagendar"
    ? Number((estado.citas.get(estado.token) || {}).duracion_min) || 30
    : Number(servicio && servicio.duracion_min) || 30;
  const mapa = new Map();
  if (estado.modo === "reagendar" || estado.barberoId) {
    const idBarbero = estado.barberoId;
    const { data, error } = await estado.supabase.rpc("horas_disponibles", {
      p_barbero: idBarbero,
      p_fecha: fecha,
      p_duracion: duracion
    });
    if (error) throw error;
    (Array.isArray(data) ? data : []).forEach((fila) => {
      const slot = String(fila.slot || "").slice(0, 5);
      if (slot) mapa.set(slot, [idBarbero]);
    });
    return mapa;
  }
  const candidatos = barberosDelPaso();
  const respuestas = await Promise.all(candidatos.map((barbero) => estado.supabase.rpc("horas_disponibles", {
    p_barbero: barbero.id,
    p_fecha: fecha,
    p_duracion: duracion
  })));
  candidatos.forEach((barbero, indice) => {
    const respuesta = respuestas[indice];
    if (!respuesta || respuesta.error || !Array.isArray(respuesta.data)) return;
    respuesta.data.forEach((fila) => {
      const slot = String(fila.slot || "").slice(0, 5);
      if (!slot) return;
      const lista = mapa.get(slot) || [];
      lista.push(barbero.id);
      mapa.set(slot, lista);
    });
  });
  return mapa;
}

async function sugerirDia(desde) {
  const maximo = Math.max(1, Number(estado.config && estado.config.dias_max) || 14);
  const hoy = hoyISO();
  for (let salto = 1; salto <= Math.min(14, maximo); salto += 1) {
    const fecha = sumarDias(desde, salto);
    if (fecha > sumarDias(hoy, maximo - 1)) break;
    try {
      const mapa = await cargarHoras(fecha);
      if (mapa.size) return fecha;
    } catch (error) {
      return "";
    }
  }
  return "";
}

function pintarHorario(host) {
  const maximo = Math.max(1, Number(estado.config && estado.config.dias_max) || 14);
  const hoy = hoyISO();
  if (!estado.fecha) estado.fecha = hoy;
  const tira = nodo("div", "dias-tira");
  tira.setAttribute("role", "listbox");
  tira.setAttribute("aria-label", "Fechas");
  const visibles = Math.min(estado.fechas, maximo);
  for (let i = 0; i < visibles; i += 1) {
    const fecha = sumarDias(hoy, i);
    const boton = nodo("button", "dia-btn" + (fecha === estado.fecha ? " is-on" : ""), "");
    boton.type = "button";
    boton.dataset.dia = fecha;
    if (fecha === hoy) boton.dataset.hoy = "1";
    boton.setAttribute("aria-pressed", fecha === estado.fecha ? "true" : "false");
    boton.append(nodo("span", "dia-nombre", fecha === hoy ? "Hoy" : fechaCorta(fecha).split(" ")[0]), nodo("span", "dia-numero", String(Number(fecha.slice(8)))));
    boton.addEventListener("click", () => {
      estado.fecha = fecha;
      estado.hora = "";
      pintarPasos();
    });
    tira.appendChild(boton);
  }
  tira.addEventListener("keydown", (evento) => {
    const botones = [...tira.querySelectorAll("[data-dia]")];
    const indice = botones.indexOf(document.activeElement);
    if (indice < 0) return;
    if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
      evento.preventDefault();
      const siguiente = botones[indice + (evento.key === "ArrowRight" ? 1 : -1)];
      if (siguiente) siguiente.focus();
    }
  });
  host.appendChild(tira);
  if (visibles < maximo) {
    const mas = nodo("button", "btn btn-sec", "Ver más fechas");
    mas.type = "button";
    mas.dataset.masFechas = "1";
    mas.addEventListener("click", () => {
      estado.fechas = Math.min(maximo, estado.fechas + 14);
      pintarPasos();
    });
    host.appendChild(mas);
  }
  const horas = nodo("div", "horas");
  horas.dataset.horas = "1";
  host.appendChild(horas);
  esqueleto(horas, 4);
  cargarHoras(estado.fecha).then((mapa) => {
    estado.ofertas = mapa;
    pintarHoras(horas, mapa);
  }).catch(() => {
    horas.removeAttribute("aria-busy");
    horas.replaceChildren(nodo("p", null, "No pudimos cargar las horas. Intenta de nuevo."));
  });
}

function pintarHoras(host, mapa) {
  host.removeAttribute("aria-busy");
  host.replaceChildren();
  const slots = [...mapa.keys()].sort();
  if (!slots.length) {
    const vacio = nodo("div");
    vacio.dataset.sinHoras = "1";
    vacio.appendChild(nodo("p", null, "Sin horarios este día"));
    host.appendChild(vacio);
    sugerirDia(estado.fecha).then((fecha) => {
      if (!fecha || !vacio.isConnected) return;
      const ir = nodo("button", "btn btn-sec", "Ver " + fechaLegible(fecha));
      ir.type = "button";
      ir.addEventListener("click", () => {
        estado.fecha = fecha;
        const distancia = Math.round((instanteBogota(fecha, "12:00") - instanteBogota(hoyISO(), "12:00")) / 86400000);
        estado.fechas = Math.max(estado.fechas, distancia + 1);
        pintarPasos();
      });
      vacio.appendChild(ir);
    });
    vacio.appendChild(botonWhatsapp("Agenda por WhatsApp", "btn"));
    return;
  }
  const grupos = [
    ["Mañana", (slot) => aMinutos(slot) < 12 * 60],
    ["Tarde", (slot) => aMinutos(slot) >= 12 * 60 && aMinutos(slot) < 18 * 60],
    ["Noche", (slot) => aMinutos(slot) >= 18 * 60]
  ];
  grupos.forEach(([titulo, filtro]) => {
    const delGrupo = slots.filter(filtro);
    if (!delGrupo.length) return;
    const bloque = nodo("div", "hora-grupo");
    bloque.appendChild(nodo("p", "hora-titulo", titulo));
    const fila = nodo("div", "hora-fila");
    delGrupo.forEach((slot) => {
      const boton = nodo("button", "hora-btn" + (slot === estado.hora ? " is-on" : ""), horaLegible(slot));
      boton.type = "button";
      boton.dataset.hora = slot;
      boton.addEventListener("click", () => elegirHora(slot));
      fila.appendChild(boton);
    });
    fila.addEventListener("keydown", (evento) => {
      const botones = [...fila.querySelectorAll("[data-hora]")];
      const indice = botones.indexOf(document.activeElement);
      if (indice < 0) return;
      if (evento.key === "ArrowRight" || evento.key === "ArrowLeft") {
        evento.preventDefault();
        const siguiente = botones[indice + (evento.key === "ArrowRight" ? 1 : -1)];
        if (siguiente) siguiente.focus();
      }
    });
    bloque.appendChild(fila);
    host.appendChild(bloque);
  });
}

function elegirHora(slot) {
  estado.hora = slot;
  if (estado.modo === "reagendar") {
    const boton = nodo("button", "btn", "Guardar nueva hora");
    boton.type = "button";
    boton.dataset.reagendar = "1";
    let existente = document.querySelector("[data-reagendar]");
    if (!existente) {
      const horas = document.querySelector("[data-horas]");
      if (horas) horas.after(boton);
      existente = boton;
      boton.addEventListener("click", () => guardarReagendo(boton));
    }
    return;
  }
  avanzar();
}

async function guardarReagendo(boton) {
  boton.disabled = true;
  try {
    const { error } = await estado.supabase.rpc("reagendar_reserva", {
      p_token: estado.token,
      p_fecha: estado.fecha,
      p_hora: estado.hora
    });
    if (error) throw error;
    estado.modo = "";
    cerrarHoja();
    await refrescarCitas();
  } catch (error) {
    const horas = document.querySelector("[data-horas]");
    if (horas) horas.appendChild(nodo("p", "form-error", traducir(error)));
  } finally {
    boton.disabled = false;
  }
}

function resumenCita() {
  const servicio = servicioActual();
  const oferta = estado.ofertas.get(estado.hora) || [];
  const barbero = estado.barberoId ? barberoPorId(estado.barberoId) : barberoPorId(oferta[0]);
  const caja = nodo("aside", "reserva-resumen");
  caja.appendChild(nodo("p", "etiqueta", "Tu cita"));
  caja.appendChild(nodo("p", null, servicio ? servicio.nombre : ""));
  caja.appendChild(nodo("p", null, barbero ? barbero.nombre : "El primero disponible"));
  caja.appendChild(nodo("p", null, fechaLegible(estado.fecha) + " · " + horaLegible(estado.hora)));
  caja.appendChild(nodo("p", null, precioDe(servicio)));
  return caja;
}

function pintarDatos(host) {
  const formulario = nodo("form", "reserva-datos");
  const ofertaInicial = estado.ofertas.get(estado.hora) || [];
  formulario.dataset.barbero = estado.barberoId || ofertaInicial[0] || "";
  formulario.dataset.servicio = estado.servicioId;
  formulario.dataset.fecha = estado.fecha;
  formulario.dataset.hora = estado.hora;
  const campos = nodo("div", "reserva-campos");
  const nombre = document.createElement("input");
  nombre.name = "nombre";
  nombre.autocomplete = "name";
  nombre.required = true;
  nombre.maxLength = 80;
  const labelNombre = nodo("label", "campo");
  labelNombre.append(nodo("span", null, "Nombre"), nombre);
  const celular = document.createElement("input");
  celular.name = "celular";
  celular.type = "tel";
  celular.inputMode = "numeric";
  celular.autocomplete = "tel";
  celular.required = true;
  celular.maxLength = 12;
  celular.dataset.cel = "1";
  const ayuda = nodo("p", "ayuda");
  ayuda.dataset.celAyuda = "1";
  celular.addEventListener("input", () => {
    if (!celular.value) {
      ayuda.textContent = "";
      return;
    }
    ayuda.textContent = celularValido(celular.value).ok ? "" : "Revisa tu celular: 10 dígitos y empieza por 3.";
  });
  const labelCel = nodo("label", "campo");
  labelCel.append(nodo("span", null, "Celular"), celular, ayuda);
  const notas = document.createElement("textarea");
  notas.name = "notas";
  notas.maxLength = 200;
  notas.rows = 3;
  const cuenta = nodo("p", "ayuda", "0/200");
  notas.addEventListener("input", () => {
    if (notas.value.length > 200) notas.value = notas.value.slice(0, 200);
    cuenta.textContent = notas.value.length + "/200";
  });
  const labelNotas = nodo("label", "campo");
  labelNotas.append(nodo("span", null, "Notas"), notas, cuenta);
  const check = document.createElement("input");
  check.type = "checkbox";
  check.name = "autoriza";
  check.required = true;
  const labelCheck = nodo("label", "reserva-check");
  const textoCheck = nodo("span", null, "He leído la Política de Tratamiento de Datos Personales y autorizo el tratamiento de mi nombre y celular para gestionar mi cita y avisarme por WhatsApp.");
  labelCheck.append(check, textoCheck);
  const legales = nodo("p", "legales");
  const trata = nodo("a", null, "Tratamiento de datos");
  trata.href = "tratamiento-datos.html";
  const priva = nodo("a", null, "Privacidad");
  priva.href = "privacidad.html";
  legales.append(trata, document.createTextNode(" · "), priva);
  const error = nodo("p", "form-error");
  error.hidden = true;
  error.dataset.formError = "1";
  error.setAttribute("role", "alert");
  const enviar = nodo("button", "btn", "Confirmar reserva");
  enviar.type = "submit";
  enviar.dataset.reservaEnviar = "1";
  campos.append(labelNombre, labelCel, labelNotas, labelCheck, legales, error, enviar);
  formulario.append(campos, resumenCita());
  formulario.addEventListener("submit", (evento) => enviarReserva(evento, formulario, enviar, error));
  host.appendChild(formulario);
}

async function enviarReserva(evento, formulario, boton, error) {
  evento.preventDefault();
  error.hidden = true;
  const datos = new FormData(formulario);
  const nombre = nombreValido(datos.get("nombre"));
  const cel = celularValido(datos.get("celular"));
  if (!nombre) {
    error.hidden = false;
    error.textContent = "Escribe tu nombre.";
    return;
  }
  if (!cel.ok) {
    error.hidden = false;
    error.textContent = "Revisa tu celular: 10 dígitos y empieza por 3.";
    return;
  }
  if (!datos.get("autoriza")) {
    error.hidden = false;
    error.textContent = "Debes aceptar el tratamiento de datos para reservar.";
    return;
  }
  const oferta = estado.ofertas.get(estado.hora) || [];
  const barbero = estado.barberoId || oferta[0];
  if (!barbero) {
    error.hidden = false;
    error.textContent = "Esa hora acaba de ocuparse. Elige otra.";
    return;
  }
  boton.disabled = true;
  boton.textContent = "Reservando…";
  try {
    const { data, error: falloRpc } = await estado.supabase.rpc("crear_reserva", {
      p_barbero: barbero,
      p_servicio: estado.servicioId,
      p_fecha: estado.fecha,
      p_hora: estado.hora,
      p_nombre: nombre,
      p_telefono: cel.digitos,
      p_notas: String(datos.get("notas") || "").slice(0, 200),
      p_autoriza: true
    });
    if (falloRpc) throw falloRpc;
    const fila = Array.isArray(data) ? data[0] : data;
    if (!fila || !fila.token) throw new Error("sin token");
    guardarToken(fila.token);
    await refrescarCitas();
    pintarConfirmacion(fila, nombre);
  } catch (fallo) {
    error.hidden = false;
    error.textContent = traducir(fallo);
    boton.disabled = false;
    boton.textContent = "Confirmar reserva";
  }
}

function pintarConfirmacion(creada, nombre) {
  const caja = pasosCaja();
  if (!caja) return;
  const cuerpo = caja.querySelector("[data-paso]");
  const titulo = caja.querySelector("[data-paso-titulo]");
  if (titulo) titulo.textContent = "Listo";
  const fila = estado.citas.get(String(creada.token).toLowerCase()) || {
    numero: creada.numero,
    nombre,
    servicio: (servicioActual() || {}).nombre,
    barbero: (barberoPorId(estado.barberoId) || barberoPorId((estado.ofertas.get(estado.hora) || [])[0]) || {}).nombre,
    fecha: estado.fecha,
    hora: estado.hora,
    duracion_min: (servicioActual() || {}).duracion_min,
    direccion: (sedesActivas().find((item) => item.id === estado.sedeId) || {}).direccion,
    precio: (servicioActual() || {}).precio
  };
  cuerpo.replaceChildren();
  const listo = nodo("div", "reserva-lista");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 64 64");
  svg.setAttribute("width", "64");
  svg.setAttribute("height", "64");
  svg.setAttribute("class", "check");
  svg.setAttribute("aria-hidden", "true");
  const circulo = document.createElementNS(svg.namespaceURI, "circle");
  circulo.setAttribute("cx", "32");
  circulo.setAttribute("cy", "32");
  circulo.setAttribute("r", "26");
  circulo.setAttribute("class", "check-anillo");
  const palo = document.createElementNS(svg.namespaceURI, "path");
  palo.setAttribute("d", "M20 33 l8 8 16-18");
  palo.setAttribute("class", "check-palo");
  svg.append(circulo, palo);
  listo.appendChild(svg);
  const numero = nodo("p", "cita-numero", "Cita " + (creada.numero || fila.numero || ""));
  numero.dataset.reservaNumero = "1";
  listo.append(numero, nodo("p", null, fila.servicio || ""), nodo("p", null, fila.barbero || ""), nodo("p", null, fechaLegible(fila.fecha) + " · " + horaLegible(fila.hora)));
  const acciones = nodo("div", "cita-acciones");
  const aviso = nodo("a", "btn", "Avisar por WhatsApp");
  aviso.href = enlaceCita({ ...fila, nombre, numero: creada.numero || fila.numero });
  aviso.target = "_blank";
  aviso.rel = "noopener";
  aviso.dataset.wa = "1";
  const calendario = nodo("button", "btn btn-sec", "Agregar al calendario");
  calendario.type = "button";
  calendario.dataset.ics = "1";
  calendario.addEventListener("click", () => descargarIcs({ ...fila, nombre, numero: creada.numero || fila.numero }));
  const llegar = nodo("a", "btn btn-sec", "Cómo llegar");
  llegar.href = enlaceMapa();
  llegar.target = "_blank";
  llegar.rel = "noopener";
  llegar.dataset.maps = "1";
  acciones.append(aviso, calendario, llegar);
  listo.appendChild(acciones);
  cuerpo.appendChild(listo);
  const barra = caja.querySelector("[data-progreso]");
  if (barra) barra.hidden = true;
  if (titulo) titulo.focus();
}

function montarInterfaz(mensaje, conFlujo) {
  const raiz = app();
  const cerrada = document.querySelector("[data-reserva-cerrada]");
  if (!raiz) return;
  if (cerrada) cerrada.hidden = true;
  raiz.hidden = false;
  raiz.replaceChildren();
  const seccion = document.getElementById("reservas");
  const titulo = nodo("h2", null, "Reservas");
  titulo.id = "reservas-vivo";
  if (seccion) seccion.setAttribute("aria-labelledby", "reservas-vivo");
  const cita = nodo("div");
  cita.dataset.citaHost = "1";
  const fid = nodo("div");
  fid.dataset.fidelidadHost = "1";
  raiz.append(titulo, cita, fid);
  if (!conFlujo) {
    const aviso = nodo("article", "reserva-card");
    aviso.appendChild(nodo("p", null, mensaje));
    aviso.appendChild(botonWhatsapp());
    raiz.appendChild(aviso);
    return;
  }
  const abrir = nodo("button", "btn", "Reservar cita");
  abrir.type = "button";
  abrir.dataset.reservaAbrir = "1";
  const caja = nodo("div", "reserva-pasos");
  caja.dataset.reservaPasos = "1";
  caja.hidden = true;
  const barraTop = nodo("div", "reserva-top");
  const atras = nodo("button", "btn btn-sec", "Atrás");
  atras.type = "button";
  atras.dataset.reservaAtras = "1";
  const h = nodo("h3");
  h.tabIndex = -1;
  h.dataset.pasoTitulo = "1";
  const barra = nodo("div", "progreso");
  barra.dataset.progreso = "1";
  barra.setAttribute("role", "progressbar");
  barra.setAttribute("aria-valuemin", "1");
  barraTop.append(atras, h);
  const cuerpo = nodo("div");
  cuerpo.dataset.paso = "1";
  caja.append(barraTop, barra, cuerpo);
  raiz.append(abrir, caja);
  abrir.addEventListener("click", () => {
    estado.modo = "";
    estado.paso = 0;
    if (sedesActivas().length === 1) estado.sedeId = sedesActivas()[0].id;
    abrirHoja();
    pintarPasos();
  });
  atras.addEventListener("click", () => {
    if (estado.modo === "reagendar" || caja.querySelector("[data-reserva-numero]") || estado.paso === 0) {
      estado.modo = "";
      cerrarHoja();
      return;
    }
    if (estado.paso === 0) {
      cerrarHoja();
      return;
    }
    estado.paso -= 1;
    pintarPasos();
  });
}

async function cargarCatalogo() {
  const supabase = estado.supabase;
  const [config, sedes, barberos, servicios] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).limit(1),
    supabase.from("sedes").select("*").eq("activa", true).order("orden"),
    supabase.from("barberos").select("*").eq("activo", true).order("orden"),
    supabase.from("servicios").select("*").order("orden")
  ]);
  if (config.error || sedes.error || barberos.error || servicios.error) throw new Error("carga");
  estado.config = (config.data && config.data[0]) || null;
  estado.sedes = sedes.data || [];
  estado.barberos = barberos.data || [];
  estado.servicios = servicios.data || [];
}

export async function iniciarReservas() {
  if (!reservasEnLinea()) return;
  estado.supabase = await obtenerSupabase();
  if (!estado.supabase) return;
  try {
    if (!sessionStorage.getItem(VISITA)) {
      sessionStorage.setItem(VISITA, "1");
      registrar("visita");
    }
  } catch (error) {}
  document.addEventListener("click", (evento) => {
    const nodoClic = evento.target.closest("[data-wa], [data-tel], [data-maps]");
    if (!nodoClic) return;
    if (nodoClic.hasAttribute("data-wa")) registrar("clic_whatsapp");
    else if (nodoClic.hasAttribute("data-tel")) registrar("clic_llamar");
    else registrar("clic_mapa");
  });
  const raiz = app();
  if (raiz) {
    raiz.hidden = false;
    esqueleto(raiz, 3);
  }
  try {
    await cargarCatalogo();
  } catch (error) {
    montarInterfaz("No pudimos cargar la agenda. Escríbenos por WhatsApp.", false);
    return;
  }
  const hayAgenda = serviciosActivos().some((item) => item.precio != null) && estado.barberos.length && sedesActivas().length;
  if (!estado.config || estado.config.reservas_activas === false) {
    montarInterfaz("Por ahora no estamos recibiendo reservas en línea. Escríbenos por WhatsApp.", false);
  } else if (!hayAgenda) {
    montarInterfaz("Estamos configurando la agenda. Escríbenos por WhatsApp.", false);
  } else {
    montarInterfaz("", true);
  }
  pintarFidelidad();
  await refrescarCitas();
  window.setInterval(() => {
    if (document.visibilityState === "visible") refrescarCitas();
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refrescarCitas();
  });
  document.addEventListener("keydown", (evento) => {
    const caja = pasosCaja();
    if (evento.key === "Escape") {
      const confirma = document.querySelector("[data-reserva-confirma]");
      if (confirma && !confirma.hidden) {
        const no = confirma.querySelector("[data-confirmar-no]");
        if (no) no.click();
        return;
      }
      if (caja && !caja.hidden) cerrarHoja();
      return;
    }
    if (movil() && caja && !caja.hidden) atrapar(caja, evento);
  });
  window.addEventListener("resize", () => {
    const caja = pasosCaja();
    document.body.classList.toggle("reserva-lock", !!(caja && !caja.hidden && movil()));
  });
}
