import { reservasEnLinea, formatoPrecio } from "./config.js";
import { obtenerAdmin } from "./admin-cliente.js";
import { traducir, celularValido, nombreValido } from "./errores.js";
import { hoyISO, sumarDias, fechaLegible, horaLegible, aMinutos, minutosAhora, lunesDe, diaSemanaISO } from "./tiempo.js";
import { nodo, hojaEstilos } from "./dom.js";

const SONIDO = "lamansion-sonido";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SEMANA = [
  { dia: 1, nombre: "Lunes" },
  { dia: 2, nombre: "Martes" },
  { dia: 3, nombre: "Miércoles" },
  { dia: 4, nombre: "Jueves" },
  { dia: 5, nombre: "Viernes" },
  { dia: 6, nombre: "Sábado" },
  { dia: 0, nombre: "Domingo" }
];
const NAV = [
  { id: "agenda", texto: "Agenda", roles: ["dueno", "barbero"] },
  { id: "reservas", texto: "Reservas", roles: ["dueno", "barbero"] },
  { id: "equipo", texto: "Equipo y horarios", roles: ["dueno"] },
  { id: "horarios", texto: "Horarios", roles: ["barbero"] },
  { id: "servicios", texto: "Servicios", roles: ["dueno"] },
  { id: "fidelidad", texto: "Fidelidad", roles: ["dueno", "barbero"] },
  { id: "resumen", texto: "Resumen", roles: ["dueno", "barbero"] },
  { id: "ajustes", texto: "Ajustes", roles: ["dueno"] }
];

const estado = {
  supabase: null,
  rol: "",
  barberoId: "",
  correo: "",
  config: null,
  sedes: [],
  barberos: [],
  servicios: [],
  horarios: [],
  bloqueos: [],
  reservas: [],
  fotos: [],
  nav: "agenda",
  agendaFecha: "",
  agendaSede: "",
  agendaModo: "dia",
  agendaBarbero: "",
  horarioBarbero: "",
  horarioModelo: null,
  periodo: "hoy",
  conocidas: null,
  fichas: new Map(),
  sonido: true,
  marca: Date.now()
};

const hoja = hojaEstilos();

function limpiarHoja() {
  if (!hoja) return;
  while (hoja.cssRules && hoja.cssRules.length) hoja.deleteRule(0);
}

function regla(texto) {
  if (!hoja) return;
  try {
    hoja.insertRule(texto, hoja.cssRules.length);
  } catch (error) {}
}

function fail(mensaje) {
  const caja = document.querySelector("[data-pa-error]");
  if (!caja) return;
  caja.hidden = !mensaje;
  caja.textContent = mensaje || "";
}

function dueno() {
  return estado.rol === "dueno";
}

function nombreBarbero(id) {
  const barbero = estado.barberos.find((item) => item.id === id);
  return barbero ? barbero.nombre : "";
}

function nombreServicio(id) {
  const servicio = estado.servicios.find((item) => item.id === id);
  return servicio ? servicio.nombre : "";
}

function nombreSede(id) {
  const sede = estado.sedes.find((item) => item.id === id);
  return sede ? sede.nombre : "";
}

function digitos(valor) {
  let numero = String(valor || "").replace(/\D/g, "");
  if (numero.startsWith("57") && numero.length === 12) numero = numero.slice(2);
  return numero;
}

function waCliente(telefono, texto) {
  const numero = digitos(telefono);
  if (numero.length !== 10) return "";
  return "https://wa.me/57" + numero + "?text=" + encodeURIComponent(texto);
}

function mensajeAviso(reserva) {
  const cuando = fechaLegible(reserva.fecha) + " a las " + horaLegible(reserva.hora);
  const servicio = nombreServicio(reserva.servicio_id);
  if (reserva.estado === "cancelada") {
    return "Hola " + reserva.nombre + ", tu cita " + reserva.numero + " del " + cuando + " en La Mansión fue cancelada.";
  }
  if (reserva.estado === "confirmada") {
    return "Hola " + reserva.nombre + ", te recordamos tu cita " + reserva.numero + " en La Mansión: " + servicio + " el " + cuando + ".";
  }
  return "Hola " + reserva.nombre + ", tu cita " + reserva.numero + " en La Mansión quedó confirmada: " + servicio + " el " + cuando + ".";
}

function preguntar(texto, si, no) {
  const capa = document.querySelector("[data-confirmar]");
  const copia = document.querySelector("[data-confirmar-texto]");
  const botonSi = document.querySelector("[data-confirmar-si]");
  const botonNo = document.querySelector("[data-confirmar-no]");
  if (!capa || !copia || !botonSi || !botonNo) return Promise.resolve(false);
  copia.textContent = texto;
  botonSi.textContent = si || "Sí";
  botonNo.textContent = no || "No";
  capa.hidden = false;
  botonSi.focus();
  return new Promise((resolve) => {
    const cerrar = (valor) => {
      capa.hidden = true;
      botonSi.removeEventListener("click", alSi);
      botonNo.removeEventListener("click", alNo);
      resolve(valor);
    };
    const alSi = () => cerrar(true);
    const alNo = () => cerrar(false);
    botonSi.addEventListener("click", alSi);
    botonNo.addEventListener("click", alNo);
  });
}

function llenarSelect(select, opciones, valor) {
  if (!select) return;
  select.replaceChildren();
  opciones.forEach((opcion) => {
    const nodoOpcion = document.createElement("option");
    nodoOpcion.value = opcion.valor;
    nodoOpcion.textContent = opcion.texto;
    select.appendChild(nodoOpcion);
  });
  if (valor != null) select.value = valor;
}

function vistaDe(nav) {
  return nav === "horarios" ? "equipo" : nav;
}

function abrir(nav) {
  estado.nav = nav;
  const vista = vistaDe(nav);
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== vista;
  });
  document.querySelectorAll("[data-vista]").forEach((boton) => {
    if (boton.dataset.vista === nav) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  if (vista === "agenda") pintarAgenda();
  if (vista === "reservas") pintarReservas();
  if (vista === "equipo") pintarEquipo();
  if (vista === "servicios") pintarServicios();
  if (vista === "resumen") cargarResumen();
  if (vista === "ajustes") pintarAjustes();
}

function montarNav() {
  document.querySelectorAll("[data-nav]").forEach((nav) => {
    nav.replaceChildren();
    NAV.filter((item) => item.roles.includes(estado.rol)).forEach((item) => {
      const boton = nodo("button", "pa-tab", item.texto);
      boton.type = "button";
      boton.dataset.vista = item.id;
      boton.addEventListener("click", () => abrir(item.id));
      nav.appendChild(boton);
    });
  });
  document.querySelectorAll("[data-solo]").forEach((el) => {
    el.hidden = el.dataset.solo === "dueno" ? !dueno() : dueno();
  });
  abrir("agenda");
}

function avisoServicios() {
  const aviso = document.querySelector("[data-servicios-aviso]");
  if (!aviso) return;
  const hay = dueno() && estado.servicios.some((item) => !item.activo);
  aviso.hidden = !hay;
}

async function cargarBase() {
  const supabase = estado.supabase;
  const [config, sedes, barberos, servicios, horarios, bloqueos] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).limit(1),
    supabase.from("sedes").select("*").order("orden"),
    supabase.from("barberos").select("*").order("orden"),
    supabase.from("servicios").select("*").order("orden"),
    supabase.from("horarios").select("*"),
    supabase.from("bloqueos").select("*").order("fecha")
  ]);
  if (config.error || sedes.error || barberos.error || servicios.error || horarios.error || bloqueos.error) {
    throw config.error || sedes.error || barberos.error || servicios.error || horarios.error || bloqueos.error;
  }
  estado.config = (config.data && config.data[0]) || null;
  estado.sedes = sedes.data || [];
  estado.barberos = barberos.data || [];
  estado.servicios = servicios.data || [];
  estado.horarios = horarios.data || [];
  estado.bloqueos = bloqueos.data || [];
  try {
    const respuesta = await fetch("assets/img/fotos/fotos.json", { credentials: "same-origin" });
    const fotos = respuesta.ok ? await respuesta.json() : [];
    estado.fotos = Array.isArray(fotos) ? fotos.filter((foto) => foto.categoria === "equipo") : [];
  } catch (error) {
    estado.fotos = [];
  }
}

async function cargarReservas(anunciar) {
  const { data, error } = await estado.supabase.from("reservas").select("*").order("fecha").order("hora").limit(800);
  if (error) {
    fail("No pudimos cargar las reservas.");
    return;
  }
  const anteriores = estado.conocidas;
  estado.reservas = data || [];
  const ids = new Set(estado.reservas.map((item) => item.id));
  if (anunciar && anteriores) {
    const nuevas = estado.reservas.filter((item) => !anteriores.has(item.id));
    if (nuevas.length) avisarNuevas(nuevas);
  }
  estado.conocidas = ids;
  const pendientes = estado.reservas.filter((item) => item.estado === "pendiente").length;
  document.title = (pendientes ? "(" + pendientes + ") " : "") + "Panel — La Mansión Barber Shop";
  if (estado.nav === "agenda" || estado.nav === "reservas") {
    if (vistaDe(estado.nav) === "agenda") pintarAgenda();
    if (estado.nav === "reservas") pintarReservas();
  }
}

function avisarNuevas(nuevas) {
  if (estado.sonido) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = 880;
        gain.gain.setValueAtTime(0.0001, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.04, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.18);
        osc.onended = () => ctx.close();
      }
    } catch (error) {}
  }
  try {
    if (navigator.vibrate) navigator.vibrate([120, 40, 120]);
  } catch (error) {}
  try {
    if (window.Notification && Notification.permission === "granted") {
      new Notification("Nueva reserva", { body: "Hay una cita nueva en la agenda." });
    }
  } catch (error) {}
  nuevas.forEach((reserva) => {
    document.querySelectorAll('[data-id="' + reserva.id + '"]').forEach((el) => el.classList.add("is-nueva"));
  });
  window.setTimeout(() => {
    document.querySelectorAll(".is-nueva").forEach((el) => el.classList.remove("is-nueva"));
  }, 5000);
}

function barberosDeSede(sedeId) {
  return estado.barberos.filter((item) => !sedeId || item.sede_id === sedeId);
}

function pintarAgenda() {
  const host = document.querySelector("[data-agenda]");
  if (!host) return;
  const sedeSelect = document.querySelector("[data-agenda-sede]");
  const fechaInput = document.querySelector("[data-agenda-fecha]");
  const barberoSelect = document.querySelector("[data-agenda-barbero]");
  if (!estado.agendaFecha) estado.agendaFecha = hoyISO();
  if (!estado.agendaSede) estado.agendaSede = (estado.sedes.find((item) => item.activa !== false) || estado.sedes[0] || {}).id || "";
  llenarSelect(sedeSelect, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })), estado.agendaSede);
  if (fechaInput && fechaInput.value !== estado.agendaFecha) fechaInput.value = estado.agendaFecha;
  const deSede = barberosDeSede(estado.agendaSede).filter((item) => dueno() || item.id === estado.barberoId);
  if (!estado.agendaBarbero || !deSede.some((item) => item.id === estado.agendaBarbero)) {
    estado.agendaBarbero = (deSede[0] || {}).id || "";
  }
  llenarSelect(barberoSelect, deSede.map((item) => ({ valor: item.id, texto: item.nombre })), estado.agendaBarbero);
  host.removeAttribute("aria-busy");
  host.replaceChildren();
  const titulo = nodo("h2", "solo-impresion", "Agenda del " + fechaLegible(estado.agendaFecha));
  host.appendChild(titulo);
  if (estado.agendaModo === "semana") pintarSemana(host);
  else pintarDia(host, deSede);
}

function reservasEn(fecha, sedeId) {
  const ids = new Set(barberosDeSede(sedeId).map((item) => item.id));
  return estado.reservas.filter((item) => item.fecha === fecha && ids.has(item.barbero_id) && (dueno() || item.barbero_id === estado.barberoId));
}

function pintarDia(host, deSede) {
  const columnas = window.matchMedia("(max-width: 899px)").matches
    ? deSede.filter((item) => item.id === estado.agendaBarbero)
    : deSede;
  if (!columnas.length) {
    host.appendChild(nodo("p", "vacio", "No hay barberos en esta sede."));
    return;
  }
  const citas = reservasEn(estado.agendaFecha, estado.agendaSede);
  if (!citas.length) host.appendChild(nodo("p", "vacio", "No hay citas este día."));
  const rejilla = nodo("div", "agenda-rejilla");
  const eje = nodo("div", "agenda-eje");
  for (let hora = 8; hora < 20; hora += 1) eje.appendChild(nodo("span", null, String(hora) + ":00"));
  const cols = nodo("div", "agenda-cols");
  limpiarHoja();
  let indice = 0;
  columnas.forEach((barbero) => {
    const col = nodo("div", "agenda-col");
    col.appendChild(nodo("h3", null, barbero.nombre));
    const lienzo = nodo("div", "agenda-horas");
    citas.filter((item) => item.barbero_id === barbero.id).forEach((reserva) => {
      const bloque = nodo("button", "bloque estado-" + reserva.estado + " blq-" + indice, "");
      bloque.type = "button";
      bloque.dataset.id = reserva.id;
      const fila = Math.max(1, Math.floor((aMinutos(reserva.hora) - 8 * 60) / 30) + 1);
      const span = Math.max(1, Math.ceil((Number(reserva.duracion_min) || 30) / 30));
      regla(".blq-" + indice + "{grid-row:" + fila + " / span " + span + "}");
      bloque.append(nodo("strong", null, horaLegible(reserva.hora)), nodo("span", null, reserva.nombre), nodo("span", null, nombreServicio(reserva.servicio_id)));
      bloque.addEventListener("click", () => abrirCita(reserva));
      lienzo.appendChild(bloque);
      indice += 1;
    });
    col.appendChild(lienzo);
    cols.appendChild(col);
  });
  rejilla.append(eje, cols);
  host.appendChild(rejilla);
}

function pintarSemana(host) {
  const inicio = lunesDe(estado.agendaFecha);
  const scroll = nodo("div", "semana-scroll");
  const grilla = nodo("div", "semana");
  for (let i = 0; i < 7; i += 1) {
    const fecha = sumarDias(inicio, i);
    const col = nodo("div", "semana-col");
    const titulo = nodo("button", "btn btn-sec", DIAS[diaSemanaISO(fecha)] + " " + Number(fecha.slice(8)));
    titulo.type = "button";
    titulo.addEventListener("click", () => {
      estado.agendaFecha = fecha;
      estado.agendaModo = "dia";
      document.querySelectorAll("[data-agenda-modo]").forEach((boton) => {
        boton.setAttribute("aria-pressed", boton.dataset.agendaModo === "dia" ? "true" : "false");
      });
      pintarAgenda();
    });
    col.appendChild(titulo);
    const citas = reservasEn(fecha, estado.agendaSede);
    if (!citas.length) col.appendChild(nodo("p", "vacio", "Sin citas"));
    citas.forEach((reserva) => {
      const boton = nodo("button", "bloque estado-" + reserva.estado, horaLegible(reserva.hora) + " " + reserva.nombre);
      boton.type = "button";
      boton.dataset.id = reserva.id;
      boton.addEventListener("click", () => abrirCita(reserva));
      col.appendChild(boton);
    });
    grilla.appendChild(col);
  }
  scroll.appendChild(grilla);
  host.appendChild(scroll);
}

function abrirCita(reserva) {
  const modal = document.querySelector("[data-cita-modal]");
  const cuerpo = document.querySelector("[data-cita-modal-cuerpo]");
  if (!modal || !cuerpo) return;
  cuerpo.replaceChildren();
  cuerpo.append(
    nodo("p", null, reserva.nombre),
    nodo("p", null, digitos(reserva.telefono)),
    nodo("p", null, nombreServicio(reserva.servicio_id) + " · " + nombreBarbero(reserva.barbero_id)),
    nodo("p", null, fechaLegible(reserva.fecha) + " · " + horaLegible(reserva.hora)),
    nodo("p", "cita-estado estado-" + reserva.estado, etiquetaEstado(reserva.estado)),
    nodo("p", null, reserva.notas || "")
  );
  cuerpo.appendChild(accionesDe(reserva));
  modal.hidden = false;
  const cerrar = modal.querySelector("[data-cita-cerrar]");
  if (cerrar) cerrar.focus();
}

function etiquetaEstado(valor) {
  return { pendiente: "Pendiente", confirmada: "Confirmada", completada: "Completada", cancelada: "Cancelada", no_asistio: "No asistió" }[valor] || valor;
}

function accionesDe(reserva) {
  const caja = nodo("div", "cita-acciones");
  const poner = (texto, accion, clase) => {
    const boton = nodo("button", clase || "btn btn-sec", texto);
    boton.type = "button";
    boton.dataset.accion = accion;
    boton.dataset.id = reserva.id;
    boton.addEventListener("click", () => ejecutar(reserva, accion, boton));
    caja.appendChild(boton);
    return boton;
  };
  if (reserva.estado === "pendiente") poner("Confirmar", "confirmar", "btn");
  if (reserva.estado === "pendiente" || reserva.estado === "confirmada") {
    poner("Marcar completada", "completada");
    poner("No asistió", "no_asistio");
    poner("Cancelar", "cancelar");
  }
  if (!reserva.gratis && (reserva.estado === "pendiente" || reserva.estado === "confirmada")) {
    const gratis = poner("Aplicar corte gratis", "gratis");
    gratis.hidden = true;
    fichaDe(reserva.telefono).then((ficha) => {
      if (ficha && ficha.gratis_disponible && gratis.isConnected) gratis.hidden = false;
    });
  }
  if (reserva.estado === "pendiente" || reserva.estado === "confirmada" || reserva.estado === "cancelada") {
    const href = waCliente(reserva.telefono, mensajeAviso(reserva));
    if (href) {
      const enlace = nodo("a", "btn", "Avisar por WhatsApp");
      enlace.href = href;
      enlace.target = "_blank";
      enlace.rel = "noopener";
      enlace.dataset.accion = "avisar";
      enlace.addEventListener("click", () => marcarAvisado(reserva));
      caja.appendChild(enlace);
    }
  }
  if ((reserva.estado === "pendiente" || reserva.estado === "confirmada") && !reserva.avisado) {
    caja.appendChild(nodo("span", "falta-avisar", "Falta avisar"));
  }
  if (reserva.gratis) caja.appendChild(nodo("span", "fid-gratis", "Corte gratis"));
  return caja;
}

async function fichaDe(telefono) {
  const clave = digitos(telefono);
  if (estado.fichas.has(clave)) return estado.fichas.get(clave);
  const { data, error } = await estado.supabase.rpc("mi_fidelidad", { p_telefono: clave });
  if (error) return null;
  const ficha = Array.isArray(data) ? data[0] : data;
  estado.fichas.set(clave, ficha);
  return ficha;
}

async function ejecutar(reserva, accion, boton) {
  if (accion === "cancelar") {
    const ok = await preguntar("¿Cancelar la cita de " + reserva.nombre + "?", "Cancelar cita", "Volver");
    if (!ok) return;
  }
  if (boton) boton.disabled = true;
  try {
    if (accion === "gratis") {
      const { error } = await estado.supabase.rpc("aplicar_gratis", { p_reserva: reserva.id });
      if (error) throw error;
      reserva.gratis = true;
      estado.fichas.delete(digitos(reserva.telefono));
    } else if (accion !== "avisar") {
      const campos = { estado: accion === "confirmar" ? "confirmada" : accion };
      const { error } = await estado.supabase.from("reservas").update(campos).eq("id", reserva.id);
      if (error) throw error;
      reserva.estado = campos.estado;
    }
    fail("");
    const modal = document.querySelector("[data-cita-modal]");
    if (modal) modal.hidden = true;
    pintarAgenda();
    pintarReservas();
  } catch (error) {
    fail(traducir(error));
  } finally {
    if (boton) boton.disabled = false;
  }
}

async function marcarAvisado(reserva) {
  const { error } = await estado.supabase.from("reservas").update({ avisado: true }).eq("id", reserva.id);
  if (error) {
    fail("No se pudo marcar el aviso.");
    return;
  }
  reserva.avisado = true;
  pintarReservas();
  pintarAgenda();
}

function reservasFiltradas() {
  const buscar = (document.querySelector("[data-buscar]") || {}).value || "";
  const texto = buscar.trim().toLowerCase();
  const numeros = texto.replace(/\D/g, "");
  const desde = (document.querySelector("[data-filtro-desde]") || {}).value || "";
  const hasta = (document.querySelector("[data-filtro-hasta]") || {}).value || "";
  const barbero = (document.querySelector("[data-filtro-barbero]") || {}).value || "";
  const situacion = (document.querySelector("[data-filtro-estado]") || {}).value || "";
  const servicio = (document.querySelector("[data-filtro-servicio]") || {}).value || "";
  return estado.reservas.filter((item) => {
    if (desde && item.fecha < desde) return false;
    if (hasta && item.fecha > hasta) return false;
    if (barbero && item.barbero_id !== barbero) return false;
    if (situacion && item.estado !== situacion) return false;
    if (servicio && item.servicio_id !== servicio) return false;
    if (!texto) return true;
    const nombre = String(item.nombre || "").toLowerCase();
    const tel = digitos(item.telefono);
    const numero = String(item.numero || "").toLowerCase();
    return nombre.includes(texto) || numero.includes(texto) || (numeros && tel.includes(numeros));
  });
}

function pintarReservas() {
  const host = document.querySelector("[data-reservas-lista]");
  if (!host || document.querySelector("[data-panel=reservas]").hidden) return;
  const barbero = document.querySelector("[data-filtro-barbero]");
  const servicio = document.querySelector("[data-filtro-servicio]");
  const situacion = document.querySelector("[data-filtro-estado]");
  if (barbero && !barbero.options.length) {
    llenarSelect(barbero, [{ valor: "", texto: "Todos" }, ...estado.barberos.map((item) => ({ valor: item.id, texto: item.nombre }))]);
  }
  if (servicio && !servicio.options.length) {
    llenarSelect(servicio, [{ valor: "", texto: "Todos" }, ...estado.servicios.map((item) => ({ valor: item.id, texto: item.nombre }))]);
  }
  if (situacion && !situacion.options.length) {
    llenarSelect(situacion, ["", "pendiente", "confirmada", "completada", "cancelada", "no_asistio"].map((valor) => ({
      valor,
      texto: valor ? etiquetaEstado(valor) : "Todos"
    })));
  }
  host.removeAttribute("aria-busy");
  host.replaceChildren();
  const filas = reservasFiltradas();
  if (!filas.length) {
    host.appendChild(nodo("p", "vacio", estado.reservas.length ? "Nadie coincide con ese filtro." : "Aún no hay citas."));
    return;
  }
  filas.forEach((reserva) => {
    const card = nodo("article", "pa-cita estado-" + reserva.estado);
    card.dataset.id = reserva.id;
    card.append(
      nodo("h3", null, reserva.nombre),
      nodo("p", null, reserva.numero + " · " + digitos(reserva.telefono)),
      nodo("p", null, fechaLegible(reserva.fecha) + " · " + horaLegible(reserva.hora)),
      nodo("p", null, nombreServicio(reserva.servicio_id) + " · " + nombreBarbero(reserva.barbero_id)),
      nodo("p", "cita-estado", etiquetaEstado(reserva.estado))
    );
    card.appendChild(accionesDe(reserva));
    host.appendChild(card);
  });
}

async function exportarCsv() {
  const ok = await preguntar("Esta exportación contiene datos personales. ¿Descargarla?", "Descargar", "Cancelar");
  if (!ok) return;
  const filas = reservasFiltradas();
  const encabezado = ["numero", "fecha", "hora", "nombre", "celular", "servicio", "barbero", "estado"];
  const lineas = [encabezado.join(",")];
  filas.forEach((reserva) => {
    const valores = [reserva.numero, reserva.fecha, reserva.hora, reserva.nombre, digitos(reserva.telefono), nombreServicio(reserva.servicio_id), nombreBarbero(reserva.barbero_id), reserva.estado];
    lineas.push(valores.map((valor) => /[",\n]/.test(String(valor || "")) ? '"' + String(valor).replace(/"/g, '""') + '"' : String(valor || "")).join(","));
  });
  const blob = new Blob([lineas.join("\n")], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const enlace = nodo("a");
  enlace.href = url;
  enlace.download = "reservas.csv";
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function pintarEquipo() {
  if (dueno()) {
    pintarSedes();
    pintarBarberos();
    prepararFormulariosDueno();
  }
  const select = document.querySelector("[data-horario-barbero]");
  const lista = dueno() ? estado.barberos : estado.barberos.filter((item) => item.id === estado.barberoId);
  if (!estado.horarioBarbero || !lista.some((item) => item.id === estado.horarioBarbero)) estado.horarioBarbero = (lista[0] || {}).id || "";
  llenarSelect(select, lista.map((item) => ({ valor: item.id, texto: item.nombre })), estado.horarioBarbero);
  if (select) select.disabled = !dueno();
  cargarModelo();
  pintarEditor();
  pintarBloqueos();
  const sede = document.querySelector("[data-bloqueo-sede]");
  const barbero = document.querySelector("[data-bloqueo-barbero]");
  llenarSelect(sede, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  const opciones = [];
  if (dueno()) opciones.push({ valor: "", texto: "Toda la sede" });
  (dueno() ? estado.barberos : lista).forEach((item) => opciones.push({ valor: item.id, texto: item.nombre }));
  llenarSelect(barbero, opciones, dueno() ? "" : estado.barberoId);
  if (barbero && !dueno()) barbero.disabled = true;
}

function pintarSedes() {
  const host = document.querySelector("[data-sedes]");
  if (!host) return;
  host.replaceChildren();
  if (!estado.sedes.length) host.appendChild(nodo("p", "vacio", "Aún no hay sedes."));
  estado.sedes.forEach((sede) => {
    const fila = nodo("article", "pa-cita");
    fila.append(nodo("h3", null, sede.nombre), nodo("p", null, sede.direccion || ""), nodo("p", null, sede.activa ? "Activa" : "Inactiva"));
    const editar = nodo("button", "btn btn-sec", "Editar");
    editar.type = "button";
    editar.addEventListener("click", () => {
      const form = document.querySelector("[data-sede-form]");
      form.elements.id.value = sede.id;
      form.elements.nombre.value = sede.nombre || "";
      form.elements.direccion.value = sede.direccion || "";
      form.elements.telefono.value = sede.telefono || "";
      form.elements.orden.value = sede.orden || 0;
      form.elements.activa.checked = sede.activa !== false;
    });
    const borrar = nodo("button", "btn btn-sec", "Eliminar");
    borrar.type = "button";
    borrar.addEventListener("click", async () => {
      const ok = await preguntar("¿Eliminar la sede " + sede.nombre + "?", "Eliminar", "Cancelar");
      if (!ok) return;
      const { error } = await estado.supabase.from("sedes").delete().eq("id", sede.id);
      if (error) return fail("No se pudo eliminar la sede.");
      estado.sedes = estado.sedes.filter((item) => item.id !== sede.id);
      pintarSedes();
    });
    fila.append(editar, borrar);
    host.appendChild(fila);
  });
}

function pintarBarberos() {
  const host = document.querySelector("[data-barberos]");
  if (!host) return;
  host.replaceChildren();
  if (!estado.barberos.length) host.appendChild(nodo("p", "vacio", "Aún no hay barberos."));
  estado.barberos.forEach((barbero) => {
    const fila = nodo("article", "pa-cita");
    fila.append(nodo("h3", null, barbero.nombre), nodo("p", null, (barbero.especialidad || "") + " · " + nombreSede(barbero.sede_id)));
    if (!estado.horarios.some((item) => item.barbero_id === barbero.id)) {
      fila.appendChild(nodo("p", null, "Sin horarios: no aparecerá disponible para reservar"));
    }
    const editar = nodo("button", "btn btn-sec", "Editar");
    editar.type = "button";
    editar.addEventListener("click", () => llenarBarbero(barbero));
    fila.appendChild(editar);
    host.appendChild(fila);
  });
}

function serviciosChecks(seleccion, todos) {
  const host = document.querySelector("[data-barbero-servicios]");
  if (!host) return;
  host.replaceChildren();
  const general = nodo("label", "reserva-check");
  const caja = document.createElement("input");
  caja.type = "checkbox";
  caja.dataset.serviciosTodos = "1";
  caja.checked = Boolean(todos);
  general.append(caja, document.createTextNode("Todos los servicios"));
  host.appendChild(general);
  estado.servicios.forEach((servicio) => {
    const label = nodo("label", "reserva-check");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = servicio.id;
    input.dataset.servicioId = servicio.id;
    input.checked = !todos && Array.isArray(seleccion) && seleccion.includes(servicio.id);
    label.append(input, document.createTextNode(servicio.nombre));
    host.appendChild(label);
  });
  caja.addEventListener("change", () => {
    host.querySelectorAll("[data-servicio-id]").forEach((input) => {
      input.checked = false;
      input.disabled = caja.checked;
    });
  });
}

function llenarBarbero(barbero) {
  const form = document.querySelector("[data-barbero-form]");
  form.elements.id.value = barbero.id;
  form.elements.nombre.value = barbero.nombre || "";
  form.elements.especialidad.value = barbero.especialidad || "";
  form.elements.sede_id.value = barbero.sede_id || "";
  form.elements.foto.value = barbero.foto || "";
  form.elements.orden.value = barbero.orden || 0;
  form.elements.activo.checked = barbero.activo !== false;
  serviciosChecks(barbero.servicios, barbero.servicios == null);
  const horario = document.querySelector("[data-barbero-horario]");
  if (horario) horario.hidden = true;
}

function prepararFormulariosDueno() {
  const sede = document.querySelector("[data-barbero-form] [name=sede_id]");
  llenarSelect(sede, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  const foto = document.querySelector("[data-barbero-foto]");
  llenarSelect(foto, [{ valor: "", texto: "Sin foto" }, ...estado.fotos.map((item) => ({ valor: item.id, texto: item.alt || item.id }))]);
  if (!document.querySelector("[data-servicios-todos]")) serviciosChecks(null, true);
  prepararHorarioNuevo();
}

function plantillaSede() {
  return SEMANA.map((item) => ({ dia: item.dia, nombre: item.nombre, activo: true, abre: "10:00", cierra: "20:00" }));
}

function prepararHorarioNuevo() {
  const host = document.querySelector("[data-horario-manual]");
  const caja = document.querySelector("[data-horario-sede]");
  if (!host || !caja || host.childElementCount) return;
  plantillaSede().forEach((item) => {
    const fila = nodo("div", "horario-rango horario-manual-dia");
    const marca = document.createElement("input");
    marca.type = "checkbox";
    marca.checked = true;
    marca.dataset.manualDia = String(item.dia);
    const abre = document.createElement("input");
    abre.type = "time";
    abre.value = "10:00";
    abre.dataset.manualAbre = String(item.dia);
    const cierra = document.createElement("input");
    cierra.type = "time";
    cierra.value = "20:00";
    cierra.dataset.manualCierra = String(item.dia);
    fila.append(marca, nodo("span", null, item.nombre), abre, cierra);
    host.appendChild(fila);
  });
  caja.addEventListener("change", () => {
    host.hidden = caja.checked;
  });
}

function leerHorarioManual() {
  const filas = [];
  document.querySelectorAll("[data-manual-dia]").forEach((marca) => {
    if (!marca.checked) return;
    const dia = Number(marca.dataset.manualDia);
    const abre = document.querySelector('[data-manual-abre="' + dia + '"]');
    const cierra = document.querySelector('[data-manual-cierra="' + dia + '"]');
    if (!abre || !cierra || !abre.value || !cierra.value || abre.value >= cierra.value) return;
    filas.push({ dia, abre: abre.value, cierra: cierra.value });
  });
  return filas;
}

function barberosActivos() {
  return estado.barberos.filter((item) => item.activo !== false);
}

function abrirHorarioTodos() {
  const modal = document.querySelector("[data-horario-todos]");
  const dias = document.querySelector("[data-horario-todos-dias]");
  const previa = document.querySelector("[data-horario-todos-previa]");
  const error = document.querySelector("[data-horario-todos-error]");
  const reintentar = document.querySelector("[data-horario-todos-reintentar]");
  if (!modal || !dias) return;
  estado.horarioLote = plantillaSede();
  estado.horarioReintento = 0;
  dias.replaceChildren();
  estado.horarioLote.forEach((item) => {
    const fila = nodo("div", "horario-rango");
    const marca = document.createElement("input");
    marca.type = "checkbox";
    marca.checked = true;
    marca.addEventListener("change", () => { item.activo = marca.checked; });
    const abre = document.createElement("input");
    abre.type = "time";
    abre.value = item.abre;
    abre.addEventListener("input", () => { item.abre = abre.value; });
    const cierra = document.createElement("input");
    cierra.type = "time";
    cierra.value = item.cierra;
    cierra.addEventListener("input", () => { item.cierra = cierra.value; });
    fila.append(marca, nodo("span", null, item.nombre), abre, cierra);
    dias.appendChild(fila);
  });
  if (previa) previa.textContent = "Se aplicará a " + barberosActivos().length + " barberos.";
  if (error) error.hidden = true;
  if (reintentar) reintentar.hidden = true;
  const aplicar = document.querySelector("[data-horario-todos-aplicar]");
  if (aplicar) aplicar.disabled = false;
  modal.hidden = false;
}

async function recargarHorarios() {
  const recarga = await estado.supabase.from("horarios").select("*");
  if (!recarga.error) estado.horarios = recarga.data || [];
  cargarModelo();
  pintarEditor();
  pintarBarberos();
}

async function aplicarHorarioTodos(desde) {
  const error = document.querySelector("[data-horario-todos-error]");
  const reintentar = document.querySelector("[data-horario-todos-reintentar]");
  const aplicar = document.querySelector("[data-horario-todos-aplicar]");
  if (error) error.hidden = true;
  if (reintentar) reintentar.hidden = true;
  const plantilla = (estado.horarioLote || []).filter((item) => item.activo && item.abre && item.cierra && item.abre < item.cierra);
  if (!plantilla.length) {
    if (error) {
      error.hidden = false;
      error.textContent = "Elige al menos un día con apertura y cierre.";
    }
    return;
  }
  const lista = barberosActivos();
  if (!lista.length) {
    if (error) {
      error.hidden = false;
      error.textContent = "No hay barberos activos.";
    }
    return;
  }
  if (aplicar) aplicar.disabled = true;
  const inicio = Number(desde) || 0;
  for (let i = inicio; i < lista.length; i += 1) {
    const barbero = lista[i];
    const borrado = await estado.supabase.from("horarios").delete().eq("barbero_id", barbero.id);
    if (borrado.error) {
      if (error) {
        error.hidden = false;
        error.textContent = "No se pudo cambiar el horario de " + barbero.nombre + ".";
      }
      if (reintentar) reintentar.hidden = false;
      estado.horarioReintento = i;
      if (aplicar) aplicar.disabled = false;
      return;
    }
    const filas = plantilla.map((item) => ({ barbero_id: barbero.id, dia: item.dia, abre: item.abre, cierra: item.cierra }));
    const alta = await estado.supabase.from("horarios").insert(filas).select();
    if (alta.error) {
      if (error) {
        error.hidden = false;
        error.textContent = "No se completó. " + barbero.nombre + " quedó sin horario.";
      }
      if (reintentar) reintentar.hidden = false;
      estado.horarioReintento = i;
      if (aplicar) aplicar.disabled = false;
      await recargarHorarios();
      return;
    }
  }
  estado.horarioReintento = 0;
  await recargarHorarios();
  if (aplicar) aplicar.disabled = false;
  const modal = document.querySelector("[data-horario-todos]");
  if (modal) modal.hidden = true;
  fail("");
}

async function guardarHorarioBarbero(barberoId, filas) {
  const borrado = await estado.supabase.from("horarios").delete().eq("barbero_id", barberoId);
  if (borrado.error) return false;
  if (!filas.length) {
    estado.horarios = estado.horarios.filter((item) => item.barbero_id !== barberoId);
    return true;
  }
  const alta = await estado.supabase.from("horarios").insert(filas).select();
  if (alta.error) {
    estado.horarios = estado.horarios.filter((item) => item.barbero_id !== barberoId);
    return false;
  }
  estado.horarios = estado.horarios.filter((item) => item.barbero_id !== barberoId).concat(alta.data || filas);
  return true;
}

function cargarModelo() {
  const modelo = {};
  for (let dia = 0; dia < 7; dia += 1) modelo[dia] = [];
  estado.horarios.filter((item) => item.barbero_id === estado.horarioBarbero).forEach((item) => {
    const dia = Number(item.dia);
    if (!modelo[dia]) modelo[dia] = [];
    modelo[dia].push({ abre: String(item.abre).slice(0, 5), cierra: String(item.cierra).slice(0, 5) });
  });
  estado.horarioModelo = modelo;
  const desde = document.querySelector("[data-copiar-desde]");
  llenarSelect(desde, DIAS.map((nombre, indice) => ({ valor: String(indice), texto: nombre })), "1");
  const dias = document.querySelector("[data-copiar-dias]");
  if (dias && !dias.children.length) {
    DIAS.forEach((nombre, indice) => {
      const label = nodo("label", "reserva-check");
      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = String(indice);
      input.dataset.copiarDia = "1";
      label.append(input, document.createTextNode(nombre));
      dias.appendChild(label);
    });
  }
}

function pintarEditor() {
  const host = document.querySelector("[data-horario-editor]");
  if (!host || !estado.horarioModelo) return;
  host.replaceChildren();
  DIAS.forEach((nombre, dia) => {
    const bloque = nodo("fieldset", "horario-dia");
    const leyenda = document.createElement("legend");
    leyenda.textContent = nombre;
    bloque.appendChild(leyenda);
    const lista = estado.horarioModelo[dia] || [];
    if (!lista.length) bloque.appendChild(nodo("p", "vacio", "Sin horario"));
    lista.forEach((rango, indice) => {
      const fila = nodo("div", "horario-rango");
      const abre = document.createElement("input");
      abre.type = "time";
      abre.value = rango.abre;
      abre.dataset.horarioDia = String(dia);
      abre.dataset.horarioCampo = "abre";
      abre.dataset.horarioIndice = String(indice);
      const cierra = document.createElement("input");
      cierra.type = "time";
      cierra.value = rango.cierra;
      cierra.dataset.horarioDia = String(dia);
      cierra.dataset.horarioCampo = "cierra";
      cierra.dataset.horarioIndice = String(indice);
      const quitar = nodo("button", "btn btn-sec", "Quitar");
      quitar.type = "button";
      abre.addEventListener("input", () => { estado.horarioModelo[dia][indice].abre = abre.value; });
      cierra.addEventListener("input", () => { estado.horarioModelo[dia][indice].cierra = cierra.value; });
      quitar.addEventListener("click", () => {
        estado.horarioModelo[dia].splice(indice, 1);
        pintarEditor();
      });
      fila.append(abre, cierra, quitar);
      bloque.appendChild(fila);
    });
    const agregar = nodo("button", "btn btn-sec", "Agregar rango");
    agregar.type = "button";
    agregar.addEventListener("click", () => {
      estado.horarioModelo[dia].push({ abre: "09:00", cierra: "13:00" });
      pintarEditor();
    });
    bloque.appendChild(agregar);
    host.appendChild(bloque);
  });
}

async function guardarHorarios() {
  const id = estado.horarioBarbero;
  if (!id) return;
  const { error } = await estado.supabase.from("horarios").delete().eq("barbero_id", id);
  if (error) return fail("No se pudieron guardar los horarios.");
  const filas = [];
  Object.keys(estado.horarioModelo).forEach((dia) => {
    estado.horarioModelo[dia].forEach((rango) => {
      if (!rango.abre || !rango.cierra || rango.abre >= rango.cierra) return;
      filas.push({ barbero_id: id, dia: Number(dia), abre: rango.abre, cierra: rango.cierra });
    });
  });
  if (filas.length) {
    const alta = await estado.supabase.from("horarios").insert(filas).select();
    if (alta.error) return fail("No se pudieron guardar los horarios.");
  }
  const recarga = await estado.supabase.from("horarios").select("*");
  estado.horarios = recarga.data || [];
  fail("");
  cargarModelo();
  pintarEditor();
}

function pintarBloqueos() {
  const host = document.querySelector("[data-bloqueos]");
  if (!host) return;
  host.replaceChildren();
  const lista = estado.bloqueos.filter((item) => dueno() || item.barbero_id === estado.barberoId || !item.barbero_id);
  if (!lista.length) host.appendChild(nodo("p", "vacio", "No hay bloqueos."));
  lista.forEach((bloqueo) => {
    const fila = nodo("article", "pa-cita");
    const quien = bloqueo.barbero_id ? nombreBarbero(bloqueo.barbero_id) : "Toda la sede";
    const franja = bloqueo.todo_dia ? "Todo el día" : (bloqueo.desde || "") + " – " + (bloqueo.hasta || "");
    fila.append(nodo("h3", null, fechaLegible(bloqueo.fecha)), nodo("p", null, quien + " · " + franja), nodo("p", null, bloqueo.motivo || ""));
    if (dueno() || bloqueo.barbero_id === estado.barberoId) {
      const borrar = nodo("button", "btn btn-sec", "Quitar bloqueo");
      borrar.type = "button";
      borrar.addEventListener("click", async () => {
        const { error } = await estado.supabase.from("bloqueos").delete().eq("id", bloqueo.id);
        if (error) return fail("No se pudo quitar el bloqueo.");
        estado.bloqueos = estado.bloqueos.filter((item) => item.id !== bloqueo.id);
        pintarBloqueos();
      });
      fila.appendChild(borrar);
    }
    host.appendChild(fila);
  });
}

function pintarServicios() {
  const host = document.querySelector("[data-servicios]");
  if (!host) return;
  host.replaceChildren();
  const ordenados = estado.servicios.slice().sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (!ordenados.length) host.appendChild(nodo("p", "vacio", "Aún no hay servicios."));
  ordenados.forEach((servicio, indice) => {
    const fila = nodo("article", "pa-cita");
    const precio = servicio.precio == null || servicio.precio === "" ? "Sin precio" : formatoPrecio(servicio.precio);
    fila.append(
      nodo("h3", null, servicio.nombre),
      nodo("p", null, servicio.categoria + " · " + servicio.duracion_min + " min · " + precio),
      nodo("p", null, servicio.activo ? "Activo" : "Inactivo")
    );
    const subir = nodo("button", "btn btn-sec", "Subir");
    subir.type = "button";
    subir.disabled = indice === 0;
    const bajar = nodo("button", "btn btn-sec", "Bajar");
    bajar.type = "button";
    bajar.disabled = indice === ordenados.length - 1;
    subir.addEventListener("click", () => moverServicio(ordenados, indice, -1));
    bajar.addEventListener("click", () => moverServicio(ordenados, indice, 1));
    const editar = nodo("button", "btn btn-sec", "Editar");
    editar.type = "button";
    editar.addEventListener("click", () => {
      const form = document.querySelector("[data-servicio-form]");
      form.elements.id.value = servicio.id;
      form.elements.categoria.value = servicio.categoria || "";
      form.elements.nombre.value = servicio.nombre || "";
      form.elements.descripcion.value = servicio.descripcion || "";
      form.elements.precio.value = servicio.precio == null ? "" : servicio.precio;
      form.elements.duracion_min.value = servicio.duracion_min || 30;
      form.elements.cuenta_fidelidad.checked = Boolean(servicio.cuenta_fidelidad);
      form.elements.orden.value = servicio.orden || 0;
      form.elements.activo.checked = servicio.activo !== false;
    });
    fila.append(subir, bajar, editar);
    host.appendChild(fila);
  });
}

async function moverServicio(lista, indice, delta) {
  const actual = lista[indice];
  const vecino = lista[indice + delta];
  if (!actual || !vecino) return;
  const ordenActual = actual.orden;
  actual.orden = vecino.orden;
  vecino.orden = ordenActual;
  await estado.supabase.from("servicios").update({ orden: actual.orden }).eq("id", actual.id);
  await estado.supabase.from("servicios").update({ orden: vecino.orden }).eq("id", vecino.id);
  pintarServicios();
}

async function buscarFidelidad(evento) {
  evento.preventDefault();
  const host = document.querySelector("[data-fid-resultado]");
  const input = document.querySelector("[data-fid-admin]");
  if (!host || !input) return;
  const cel = celularValido(input.value);
  host.replaceChildren();
  if (!cel.ok) {
    host.appendChild(nodo("p", "form-error", "Revisa tu celular: 10 dígitos y empieza por 3."));
    return;
  }
  const { data, error } = await estado.supabase.rpc("mi_fidelidad", { p_telefono: cel.digitos });
  if (error) {
    host.appendChild(nodo("p", "form-error", traducir(error)));
    return;
  }
  const ficha = Array.isArray(data) ? data[0] : data;
  host.appendChild(nodo("p", null, "Progreso: " + (ficha && ficha.progreso) + " de " + (ficha && ficha.meta)));
  if (ficha && ficha.gratis_disponible) host.appendChild(nodo("p", "fid-gratis", "¡Tu próximo corte es gratis!"));
  const historial = estado.reservas.filter((item) => digitos(item.telefono) === cel.digitos && item.estado === "completada");
  if (!historial.length) host.appendChild(nodo("p", "vacio", "Sin citas completadas."));
  historial.forEach((item) => {
    host.appendChild(nodo("p", null, fechaLegible(item.fecha) + " · " + nombreServicio(item.servicio_id) + (item.gratis ? " · gratis" : "")));
  });
}

function rangoResumen() {
  const hoy = hoyISO();
  if (estado.periodo === "hoy") return { desde: hoy, hasta: hoy };
  if (estado.periodo === "7") return { desde: sumarDias(hoy, -6), hasta: hoy };
  if (estado.periodo === "30") return { desde: sumarDias(hoy, -29), hasta: hoy };
  const desde = (document.querySelector("[data-desde]") || {}).value || hoy;
  const hasta = (document.querySelector("[data-hasta]") || {}).value || hoy;
  return { desde, hasta };
}

async function cargarResumen() {
  const tarjetas = document.querySelector("[data-resumen-tarjetas]");
  const graficos = document.querySelector("[data-resumen-graficos]");
  if (!tarjetas || !graficos) return;
  tarjetas.replaceChildren(nodo("div", "esqueleto"), nodo("div", "esqueleto"), nodo("div", "esqueleto"));
  graficos.replaceChildren();
  const rango = rangoResumen();
  const { data, error } = await estado.supabase.rpc("panel_resumen", { p_desde: rango.desde, p_hasta: rango.hasta });
  if (error) {
    tarjetas.replaceChildren(nodo("p", "form-error", "No pudimos cargar el resumen."));
    return;
  }
  const resumen = Array.isArray(data) ? data[0] : data;
  tarjetas.replaceChildren();
  [
    ["Reservas", resumen.reservas],
    ["Completadas", resumen.completadas],
    ["Canceladas", resumen.canceladas],
    ["No asistió", resumen.no_asistio],
    ["Ingresos estimados", formatoPrecio(resumen.ingresos || 0)],
    ["Visitas", resumen.visitas],
    ["Clics en WhatsApp", resumen.clics_whatsapp]
  ].forEach(([etiqueta, valor]) => {
    const card = nodo("article", "pa-tarjeta");
    card.append(nodo("p", null, etiqueta), nodo("p", "pa-cifra", String(valor ?? 0)));
    tarjetas.appendChild(card);
  });
  graficos.append(
    grafico("Reservas por día", resumen.por_dia || [], "fecha"),
    grafico("Reservas por hora", resumen.por_hora || [], "hora"),
    grafico("Reservas por barbero", resumen.por_barbero || [], "nombre"),
    grafico("Reservas por servicio", resumen.por_servicio || [], "nombre")
  );
}

function grafico(titulo, puntos, clave) {
  const caja = nodo("article", "pa-grafico");
  caja.appendChild(nodo("h3", null, titulo));
  if (!puntos.length) {
    caja.appendChild(nodo("p", "vacio", "Sin datos en este periodo."));
    return caja;
  }
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 320 160");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", titulo);
  const maximo = Math.max(1, ...puntos.map((item) => Number(item.total) || 0));
  const ancho = 320 / puntos.length;
  puntos.forEach((punto, indice) => {
    const alto = ((Number(punto.total) || 0) / maximo) * 110;
    const rect = document.createElementNS(svg.namespaceURI, "rect");
    rect.setAttribute("x", String(indice * ancho + 4));
    rect.setAttribute("y", String(140 - alto));
    rect.setAttribute("width", String(Math.max(2, ancho - 8)));
    rect.setAttribute("height", String(Math.max(alto, 0)));
    rect.setAttribute("fill", "#C9A24B");
    svg.appendChild(rect);
  });
  const lista = nodo("ul", "sr-only");
  puntos.forEach((punto) => lista.appendChild(nodo("li", null, String(punto[clave] || "") + ": " + punto.total)));
  caja.append(svg, lista);
  return caja;
}

function pintarAjustes() {
  const form = document.querySelector("[data-ajustes]");
  const config = estado.config;
  if (!form || !config) return;
  form.elements.reservas_activas.checked = config.reservas_activas !== false;
  form.elements.paso_min.value = config.paso_min ?? 30;
  form.elements.anticipacion_min.value = config.anticipacion_min ?? 0;
  form.elements.dias_max.value = config.dias_max ?? 14;
  form.elements.cancelar_min.value = config.cancelar_min ?? 0;
  form.elements.fidelidad_activa.checked = Boolean(config.fidelidad_activa);
  form.elements.fidelidad_meta.value = config.fidelidad_meta ?? 8;
  form.elements.politica_version.value = config.politica_version || "1";
}

function prepararNueva() {
  const form = document.querySelector("[data-nueva-form]");
  if (!form) return;
  const sedes = dueno() ? estado.sedes : estado.sedes.filter((item) => estado.barberos.some((barbero) => barbero.id === estado.barberoId && barbero.sede_id === item.id));
  llenarSelect(form.elements.sede, sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  const servicios = estado.servicios.filter((item) => item.activo && item.precio != null);
  llenarSelect(form.elements.servicio, servicios.map((item) => ({ valor: item.id, texto: item.nombre })));
  form.elements.fecha.value = hoyISO();
  refrescarNueva(true);
}

function barberosNueva() {
  const form = document.querySelector("[data-nueva-form]");
  const sede = form.elements.sede.value;
  const servicio = form.elements.servicio.value;
  return estado.barberos.filter((item) => item.activo !== false && item.sede_id === sede && (dueno() || item.id === estado.barberoId) && (item.servicios == null || (Array.isArray(item.servicios) && item.servicios.includes(servicio))));
}

async function refrescarNueva(rellenarBarberos) {
  const form = document.querySelector("[data-nueva-form]");
  if (!form) return;
  if (rellenarBarberos) {
    const actual = form.elements.barbero.value;
    const lista = barberosNueva();
    llenarSelect(form.elements.barbero, lista.map((item) => ({ valor: item.id, texto: item.nombre })), lista.some((item) => item.id === actual) ? actual : (lista[0] || {}).id);
  }
  const servicio = estado.servicios.find((item) => item.id === form.elements.servicio.value);
  const { data } = await estado.supabase.rpc("horas_disponibles", {
    p_barbero: form.elements.barbero.value,
    p_fecha: form.elements.fecha.value,
    p_duracion: servicio ? servicio.duracion_min : 30
  });
  const horas = Array.isArray(data) ? data : [];
  llenarSelect(form.elements.hora, horas.map((item) => ({ valor: String(item.slot).slice(0, 5), texto: horaLegible(item.slot) })));
  if (!horas.length) {
    const opcion = document.createElement("option");
    opcion.value = "";
    opcion.textContent = "Sin horarios este día";
    form.elements.hora.appendChild(opcion);
  }
}

function enlazar() {
  document.querySelector("[data-salir]").addEventListener("click", salir);
  document.querySelector("[data-sonido]").addEventListener("click", (evento) => {
    estado.sonido = !estado.sonido;
    evento.currentTarget.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
    try { localStorage.setItem(SONIDO, estado.sonido ? "on" : "off"); } catch (error) {}
  });
  document.querySelector("[data-avisos]").addEventListener("click", async () => {
    try {
      if (window.Notification) await Notification.requestPermission();
    } catch (error) {}
  });
  document.querySelector("[data-agenda-sede]").addEventListener("change", (evento) => {
    estado.agendaSede = evento.target.value;
    pintarAgenda();
  });
  document.querySelector("[data-agenda-fecha]").addEventListener("change", (evento) => {
    estado.agendaFecha = evento.target.value;
    pintarAgenda();
  });
  document.querySelector("[data-agenda-barbero]").addEventListener("change", (evento) => {
    estado.agendaBarbero = evento.target.value;
    pintarAgenda();
  });
  document.querySelectorAll("[data-agenda-modo]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.agendaModo = boton.dataset.agendaModo;
      document.querySelectorAll("[data-agenda-modo]").forEach((item) => {
        item.setAttribute("aria-pressed", item === boton ? "true" : "false");
      });
      pintarAgenda();
    });
  });
  document.querySelector("[data-imprimir]").addEventListener("click", () => {
    estado.agendaModo = "dia";
    document.querySelectorAll("[data-agenda-modo]").forEach((item) => {
      item.setAttribute("aria-pressed", item.dataset.agendaModo === "dia" ? "true" : "false");
    });
    pintarAgenda();
    window.print();
  });
  document.querySelector("[data-nueva]").addEventListener("click", () => {
    prepararNueva();
    document.querySelector("[data-nueva-modal]").hidden = false;
  });
  document.querySelector("[data-nueva-cerrar]").addEventListener("click", () => {
    document.querySelector("[data-nueva-modal]").hidden = true;
  });
  document.querySelector("[data-cita-cerrar]").addEventListener("click", () => {
    document.querySelector("[data-cita-modal]").hidden = true;
  });
  const nueva = document.querySelector("[data-nueva-form]");
  nueva.elements.sede.addEventListener("change", () => refrescarNueva(true));
  nueva.elements.servicio.addEventListener("change", () => refrescarNueva(true));
  nueva.elements.barbero.addEventListener("change", () => refrescarNueva(false));
  nueva.elements.fecha.addEventListener("change", () => refrescarNueva(false));
  nueva.addEventListener("submit", crearCita);
  ["[data-buscar]", "[data-filtro-desde]", "[data-filtro-hasta]", "[data-filtro-barbero]", "[data-filtro-estado]", "[data-filtro-servicio]"].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.addEventListener("input", pintarReservas);
    if (el) el.addEventListener("change", pintarReservas);
  });
  document.querySelector("[data-csv]").addEventListener("click", exportarCsv);
  document.querySelector("[data-sede-form]").addEventListener("submit", guardarSede);
  document.querySelector("[data-barbero-form]").addEventListener("submit", guardarBarbero);
  document.querySelector("[data-servicio-form]").addEventListener("submit", guardarServicio);
  document.querySelector("[data-horario-barbero]").addEventListener("change", (evento) => {
    estado.horarioBarbero = evento.target.value;
    cargarModelo();
    pintarEditor();
  });
  document.querySelector("[data-copiar]").addEventListener("click", () => {
    const desde = Number(document.querySelector("[data-copiar-desde]").value);
    document.querySelectorAll("[data-copiar-dia]:checked").forEach((caja) => {
      const dia = Number(caja.value);
      if (dia === desde) return;
      estado.horarioModelo[dia] = (estado.horarioModelo[desde] || []).map((rango) => ({ abre: rango.abre, cierra: rango.cierra }));
    });
    pintarEditor();
  });
  document.querySelector("[data-horario-guardar]").addEventListener("click", guardarHorarios);
  const abrirTodos = document.querySelector("[data-horario-todos-abrir]");
  if (abrirTodos) abrirTodos.addEventListener("click", abrirHorarioTodos);
  const aplicarTodos = document.querySelector("[data-horario-todos-aplicar]");
  if (aplicarTodos) aplicarTodos.addEventListener("click", () => aplicarHorarioTodos(0));
  const reintentarTodos = document.querySelector("[data-horario-todos-reintentar]");
  if (reintentarTodos) reintentarTodos.addEventListener("click", () => aplicarHorarioTodos(estado.horarioReintento || 0));
  const cerrarTodos = document.querySelector("[data-horario-todos-cerrar]");
  if (cerrarTodos) cerrarTodos.addEventListener("click", () => {
    document.querySelector("[data-horario-todos]").hidden = true;
  });
  document.querySelector("[data-bloqueo-dia]").addEventListener("change", (evento) => {
    document.querySelector("[data-bloqueo-horas]").hidden = evento.target.checked;
  });
  document.querySelector("[data-bloqueo-form]").addEventListener("submit", guardarBloqueo);
  document.querySelector("[data-fid-form]").addEventListener("submit", buscarFidelidad);
  document.querySelectorAll("[data-periodo]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.periodo = boton.dataset.periodo;
      document.querySelectorAll("[data-periodo]").forEach((item) => item.setAttribute("aria-pressed", item === boton ? "true" : "false"));
      document.querySelector("[data-rango]").hidden = estado.periodo !== "rango";
      cargarResumen();
    });
  });
  document.querySelector("[data-desde]").addEventListener("change", cargarResumen);
  document.querySelector("[data-hasta]").addEventListener("change", cargarResumen);
  document.querySelector("[data-ajustes]").addEventListener("submit", guardarAjustes);
  ["pointerdown", "keydown"].forEach((tipo) => {
    window.addEventListener(tipo, () => { estado.marca = Date.now(); }, { passive: true });
  });
  window.setInterval(() => {
    if (Date.now() - estado.marca >= 15 * 60 * 1000) salir();
  }, 20000);
  window.setInterval(() => {
    if (document.visibilityState === "visible") cargarReservas(true);
  }, 30000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") cargarReservas(true);
  });
  document.addEventListener("keydown", (evento) => {
    if (evento.key !== "Escape") return;
    document.querySelectorAll(".pa-modal").forEach((modal) => {
      if (modal.hidden) return;
      if (modal.hasAttribute("data-confirmar")) {
        const no = modal.querySelector("[data-confirmar-no]");
        if (no) no.click();
        return;
      }
      modal.hidden = true;
    });
  });
}

async function guardarSede(evento) {
  evento.preventDefault();
  const form = evento.target;
  const fila = {
    nombre: form.elements.nombre.value.trim(),
    direccion: form.elements.direccion.value.trim(),
    telefono: form.elements.telefono.value.trim(),
    orden: Number(form.elements.orden.value) || 0,
    activa: form.elements.activa.checked
  };
  const id = form.elements.id.value;
  const consulta = id
    ? estado.supabase.from("sedes").update(fila).eq("id", id).select()
    : estado.supabase.from("sedes").insert(fila).select();
  const { data, error } = await consulta;
  if (error) return fail("No se pudo guardar la sede.");
  if (id) {
    const actual = estado.sedes.find((item) => item.id === id);
    if (actual) Object.assign(actual, fila);
  } else if (data && data[0]) {
    estado.sedes.push(data[0]);
  }
  form.reset();
  form.elements.activa.checked = true;
  pintarSedes();
}

async function guardarBarbero(evento) {
  evento.preventDefault();
  const form = evento.target;
  const todos = form.querySelector("[data-servicios-todos]");
  const servicios = todos && todos.checked ? null : [...form.querySelectorAll("[data-servicio-id]:checked")].map((input) => input.value);
  const fila = {
    nombre: form.elements.nombre.value.trim(),
    especialidad: form.elements.especialidad.value.trim(),
    sede_id: form.elements.sede_id.value,
    foto: form.elements.foto.value,
    servicios,
    orden: Number(form.elements.orden.value) || 0,
    activo: form.elements.activo.checked
  };
  if (!nombreValido(fila.nombre)) return fail("Escribe el nombre del barbero.");
  const id = form.elements.id.value;
  const consulta = id
    ? estado.supabase.from("barberos").update(fila).eq("id", id).select()
    : estado.supabase.from("barberos").insert(fila).select();
  const { data, error } = await consulta;
  if (error) return fail("No se pudo guardar el barbero.");
  if (id) {
    const actual = estado.barberos.find((item) => item.id === id);
    if (actual) Object.assign(actual, fila);
  } else if (data && data[0]) {
    estado.barberos.push(data[0]);
    const usarSede = form.elements.horario_sede && form.elements.horario_sede.checked;
    const plantilla = usarSede ? plantillaSede().filter((item) => item.activo) : leerHorarioManual();
    const filas = plantilla.map((item) => ({ barbero_id: data[0].id, dia: item.dia, abre: item.abre, cierra: item.cierra }));
    const guardado = await guardarHorarioBarbero(data[0].id, filas);
    if (!guardado) fail(data[0].nombre + " quedó sin horario.");
  }
  form.reset();
  if (form.elements.horario_sede) form.elements.horario_sede.checked = true;
  if (form.elements.activo) form.elements.activo.checked = true;
  const manual = document.querySelector("[data-horario-manual]");
  if (manual) manual.hidden = true;
  const bloqueHorario = document.querySelector("[data-barbero-horario]");
  if (bloqueHorario) bloqueHorario.hidden = false;
  serviciosChecks(null, true);
  pintarEquipo();
}

async function guardarServicio(evento) {
  evento.preventDefault();
  const form = evento.target;
  const precioTexto = String(form.elements.precio.value || "").trim();
  const fila = {
    categoria: form.elements.categoria.value.trim(),
    nombre: form.elements.nombre.value.trim(),
    descripcion: form.elements.descripcion.value.trim(),
    precio: precioTexto === "" ? null : Number(precioTexto),
    duracion_min: Number(form.elements.duracion_min.value),
    cuenta_fidelidad: form.elements.cuenta_fidelidad.checked,
    orden: Number(form.elements.orden.value) || 0,
    activo: form.elements.activo.checked
  };
  if (!fila.nombre || !fila.categoria || !fila.duracion_min) return fail("Completa categoría, nombre y duración.");
  if (precioTexto !== "" && !Number.isFinite(fila.precio)) return fail("El precio no es válido.");
  const id = form.elements.id.value;
  const consulta = id
    ? estado.supabase.from("servicios").update(fila).eq("id", id).select()
    : estado.supabase.from("servicios").insert(fila).select();
  const { data, error } = await consulta;
  if (error) return fail("No se pudo guardar el servicio.");
  if (id) {
    const actual = estado.servicios.find((item) => item.id === id);
    if (actual) Object.assign(actual, fila);
  } else if (data && data[0]) estado.servicios.push(data[0]);
  avisoServicios();
  pintarServicios();
}

async function guardarBloqueo(evento) {
  evento.preventDefault();
  const form = evento.target;
  const error = document.querySelector("[data-bloqueo-error]");
  error.hidden = true;
  const todo = form.elements.todo_dia.checked;
  const fila = {
    sede_id: form.elements.sede_id.value,
    barbero_id: form.elements.barbero_id.value || null,
    fecha: form.elements.fecha.value,
    todo_dia: todo,
    desde: todo ? null : form.elements.desde.value,
    hasta: todo ? null : form.elements.hasta.value,
    motivo: form.elements.motivo.value.trim()
  };
  if (!dueno()) fila.barbero_id = estado.barberoId;
  if (!fila.fecha) {
    error.hidden = false;
    error.textContent = "Elige la fecha.";
    return;
  }
  if (!todo && (!fila.desde || !fila.hasta || fila.desde >= fila.hasta)) {
    error.hidden = false;
    error.textContent = "Revisa el rango de horas.";
    return;
  }
  const { data, error: errorAlta } = await estado.supabase.from("bloqueos").insert(fila).select();
  if (errorAlta) {
    error.hidden = false;
    error.textContent = "No se pudo guardar el bloqueo.";
    return;
  }
  if (data && data[0]) estado.bloqueos.push(data[0]);
  form.elements.motivo.value = "";
  pintarBloqueos();
}

async function crearCita(evento) {
  evento.preventDefault();
  const form = evento.target;
  const error = document.querySelector("[data-nueva-error]");
  error.hidden = true;
  const nombre = nombreValido(form.elements.nombre.value);
  const cel = celularValido(form.elements.celular.value);
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
  if (!form.elements.hora.value) {
    error.hidden = false;
    error.textContent = "Sin horarios este día";
    return;
  }
  const { error: fallo } = await estado.supabase.rpc("crear_reserva", {
    p_barbero: form.elements.barbero.value,
    p_servicio: form.elements.servicio.value,
    p_fecha: form.elements.fecha.value,
    p_hora: form.elements.hora.value,
    p_nombre: nombre,
    p_telefono: cel.digitos,
    p_notas: "Autorización verbal",
    p_autoriza: true
  });
  if (fallo) {
    error.hidden = false;
    error.textContent = traducir(fallo);
    return;
  }
  document.querySelector("[data-nueva-modal]").hidden = true;
  form.reset();
  await cargarReservas(false);
}

async function guardarAjustes(evento) {
  evento.preventDefault();
  const form = evento.target;
  const error = document.querySelector("[data-ajustes-error]");
  error.hidden = true;
  const fila = {
    reservas_activas: form.elements.reservas_activas.checked,
    paso_min: Number(form.elements.paso_min.value),
    anticipacion_min: Number(form.elements.anticipacion_min.value),
    dias_max: Number(form.elements.dias_max.value),
    cancelar_min: Number(form.elements.cancelar_min.value),
    fidelidad_activa: form.elements.fidelidad_activa.checked,
    fidelidad_meta: Number(form.elements.fidelidad_meta.value),
    politica_version: form.elements.politica_version.value.trim()
  };
  if ([fila.paso_min, fila.dias_max, fila.fidelidad_meta].some((valor) => !Number.isFinite(valor) || valor <= 0)) {
    error.hidden = false;
    error.textContent = "Revisa los valores numéricos.";
    return;
  }
  const { error: fallo } = await estado.supabase.from("config").update(fila).eq("id", 1);
  if (fallo) {
    error.hidden = false;
    error.textContent = "No se pudieron guardar los ajustes.";
    return;
  }
  Object.assign(estado.config, fila);
}

async function salir() {
  try {
    await estado.supabase.auth.signOut();
  } catch (error) {}
  window.location.replace("admin-login.html");
}

async function boot() {
  if (!reservasEnLinea()) {
    document.documentElement.classList.add("is-preparacion");
    return;
  }
  document.documentElement.classList.remove("is-preparacion");
  const supabase = await obtenerAdmin();
  if (!supabase) {
    document.documentElement.classList.add("is-preparacion");
    return;
  }
  estado.supabase = supabase;
  const sesion = await supabase.auth.getSession();
  if (!sesion.data || !sesion.data.session) {
    window.location.replace("admin-login.html");
    return;
  }
  const admins = await supabase.from("admins").select("rol, barbero_id").limit(1);
  const fila = admins.data && admins.data[0];
  if (admins.error || !fila) {
    await supabase.auth.signOut();
    window.location.replace("admin-login.html");
    return;
  }
  estado.rol = fila.rol;
  estado.barberoId = fila.barbero_id || "";
  estado.correo = sesion.data.session.user.email || "";
  try {
    estado.sonido = localStorage.getItem(SONIDO) !== "off";
  } catch (error) {
    estado.sonido = true;
  }
  const sonido = document.querySelector("[data-sonido]");
  if (sonido) sonido.setAttribute("aria-pressed", estado.sonido ? "true" : "false");
  const minutos = minutosAhora();
  const saludo = document.querySelector("[data-saludo]");
  if (saludo) saludo.textContent = minutos < 12 * 60 ? "Buenos días" : minutos < 18 * 60 ? "Buenas tardes" : "Buenas noches";
  const correo = document.querySelector("[data-correo]");
  if (correo) correo.textContent = estado.correo;
  try {
    await cargarBase();
    await cargarReservas(false);
  } catch (error) {
    fail("No pudimos cargar el panel.");
  }
  avisoServicios();
  montarNav();
  enlazar();
  document.documentElement.dataset.panelReady = "1";
  document.documentElement.classList.remove("is-preparacion");
}

boot();
