import { reservasEnLinea, formatoPrecio } from "./config.js";
import { obtenerAdmin } from "./admin-cliente.js";
import { traducir, celularValido, nombreValido } from "./errores.js";
import { hoyISO, sumarDias, fechaLegible, horaLegible, aMinutos, aHora, lunesDe, diaSemanaISO } from "./tiempo.js";
import { nodo, hojaEstilos, marcaCasilla } from "./dom.js";

const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const SEMANA = [
  { dia: 1, nombre: "Lunes" },
  { dia: 2, nombre: "Martes" },
  { dia: 3, nombre: "Miércoles" },
  { dia: 4, nombre: "Jueves" },
  { dia: 5, nombre: "Viernes" },
  { dia: 6, nombre: "Sábado" },
  { dia: 7, nombre: "Domingo" }
];
const NAV = [
  { id: "agenda", texto: "Agenda", roles: ["dueno", "barbero"] },
  { id: "reservas", texto: "Reservas", roles: ["dueno", "barbero"] },
  { id: "equipo", texto: "Barberos", roles: ["dueno"] },
  { id: "horarios", texto: "Horarios", roles: ["barbero"] },
  { id: "servicios", texto: "Servicios", roles: ["dueno"] },
  { id: "fidelidad", texto: "Fidelidad", roles: ["dueno"] },
  { id: "resumen", texto: "Resumen", roles: ["dueno"] },
  { id: "ajustes", texto: "Ajustes", roles: ["dueno"] }
];
const PASOS = [15, 20, 30, 45, 60];
const ANTES = [0, 30, 60, 120, 180, 360, 720, 1440];
const DIAS_MAX = [7, 14, 30, 60, 90];
const CANCELAR = [0, 30, 60, 120, 180, 360, 720, 1440];

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
  recien: new Map(),
  nuevas: 0,
  serviciosTab: "activos",
  ajustesFoto: "",
  horarioFoto: "",
  horarioGuardando: false,
  horarioFallo: false,
  reglasSemana: [],
  reglaTab: "",
  horarioAbrir: 0,
  horarioAnima: false,
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

function sedeActual() {
  const activas = estado.sedes.filter((item) => item.activa !== false);
  const lista = (activas.length ? activas : estado.sedes).slice();
  lista.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  return lista[0] || null;
}

function digitos(valor) {
  let numero = String(valor || "").replace(/\D/g, "");
  if (numero.startsWith("57") && numero.length === 12) numero = numero.slice(2);
  return numero;
}

function waCliente(telefono, mensaje) {
  const celular = digitos(telefono);
  if (celular.length !== 10 || !mensaje) return "";
  return `https://api.whatsapp.com/send?phone=57${celular}&text=${encodeURIComponent(mensaje)}`;
}

let armarMensaje = null;

function tomarMensaje(modulo) {
  if (modulo && typeof modulo.mensajeCita === "function") armarMensaje = modulo.mensajeCita;
}

async function prepararMensajes() {
  let aviso;
  const carga = import("./mensajes.js?v=14").then(tomarMensaje).catch(() => {});
  await Promise.race([
    carga,
    new Promise((resolve) => {
      aviso = setTimeout(resolve, 4000);
    })
  ]);
  clearTimeout(aviso);
}

function textoAviso(reserva) {
  if (typeof armarMensaje !== "function") return "";
  try {
    return armarMensaje({
      estado: reserva.estado,
      nombre: reserva.nombre,
      servicio: nombreServicio(reserva.servicio_id),
      fecha: reserva.fecha,
      hora: reserva.hora,
      cancel_token: reserva.cancel_token
    });
  } catch (error) {
    return "";
  }
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

function hayCambios() {
  return Boolean(document.querySelector("[data-ajustes-aviso]:not([hidden])") || document.querySelector("[data-horario-aviso]:not([hidden])"));
}

async function abrir(nav) {
  if (nav !== estado.nav && hayCambios()) {
    const ok = await preguntar("Tienes cambios sin guardar. ¿Salir de esta pantalla?", "Salir", "Quedarme");
    if (!ok) return;
    if (document.querySelector("[data-ajustes-aviso]:not([hidden])")) pintarAjustes();
    if (document.querySelector("[data-horario-aviso]:not([hidden])")) {
      cargarModelo();
      pintarEditor();
    }
  }
  estado.nav = nav;
  const vista = vistaDe(nav);
  document.querySelectorAll("[data-panel]").forEach((panel) => {
    panel.hidden = panel.dataset.panel !== vista;
  });
  document.querySelectorAll("[data-vista]").forEach((boton) => {
    if (boton.dataset.vista === nav) boton.setAttribute("aria-current", "page");
    else boton.removeAttribute("aria-current");
  });
  if (vista === "reservas") {
    estado.nuevas = 0;
    document.title = "Panel — La Mansión Barber Shop";
    pintarContador();
  }
  if (vista === "agenda") pintarAgenda();
  if (vista === "reservas") pintarReservas();
  if (vista === "equipo") pintarEquipo();
  if (vista === "servicios") pintarServicios();
  if (vista === "resumen") cargarResumen();
  if (vista === "ajustes") pintarAjustes();
}

function pintarContador() {
  document.querySelectorAll("[data-vista='reservas']").forEach((boton) => {
    let marca = boton.querySelector("[data-nuevas]");
    if (!estado.nuevas) {
      if (marca) marca.remove();
      return;
    }
    if (!marca) {
      marca = nodo("span", "pa-badge", "");
      marca.dataset.nuevas = "1";
      boton.appendChild(marca);
    }
    marca.textContent = String(estado.nuevas);
  });
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
  pintarContador();
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
  document.title = (estado.nuevas ? "(" + estado.nuevas + ") " : "") + "Panel — La Mansión Barber Shop";
  if (estado.nav === "agenda" || estado.nav === "reservas") {
    if (vistaDe(estado.nav) === "agenda") pintarAgenda();
    if (estado.nav === "reservas") pintarReservas();
  }
}

function avisarNuevas(nuevas) {
  const ahora = Date.now();
  nuevas.forEach((reserva) => estado.recien.set(reserva.id, ahora));
  estado.nuevas += nuevas.length;
  const aviso = document.querySelector("[data-llegada]");
  if (aviso) {
    aviso.hidden = false;
    aviso.textContent = "Llegó una reserva nueva";
  }
  document.title = "(" + estado.nuevas + ") Panel — La Mansión Barber Shop";
  pintarContador();
  if (estado.nav === "reservas") pintarReservas();
  window.setTimeout(() => {
    if (aviso) aviso.hidden = true;
    document.querySelectorAll(".is-nueva").forEach((el) => el.classList.remove("is-nueva"));
    document.querySelectorAll(".pa-nueva-etiq").forEach((el) => el.remove());
  }, 8000);
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
  if (!estado.agendaSede) estado.agendaSede = (sedeActual() || {}).id || "";
  if (sedeSelect) llenarSelect(sedeSelect, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })), estado.agendaSede);
  pintarPuesta();
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
    const vacio = nodo("p", "vacio", "Aún no hay barberos. Agrégalos en Barberos para ver la agenda.");
    host.appendChild(vacio);
    return;
  }
  const citas = reservasEn(estado.agendaFecha, estado.agendaSede);
  if (!citas.length) {
    const vacio = nodo("div", "vacio");
    vacio.appendChild(nodo("p", null, "No hay citas este día."));
    const crear = nodo("button", "btn", "Nueva cita");
    crear.type = "button";
    crear.addEventListener("click", () => {
      const boton = document.querySelector("[data-nueva]");
      if (boton) boton.click();
    });
    vacio.appendChild(crear);
    host.appendChild(vacio);
  }
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
    const texto = textoAviso(reserva);
    const href = texto ? waCliente(reserva.telefono, texto) : "";
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
    const vacio = nodo("div", "vacio");
    vacio.appendChild(nodo("p", null, estado.reservas.length ? "Nadie coincide con ese filtro." : "Aún no hay citas. Crea la primera desde Agenda."));
    if (!estado.reservas.length) {
      const ir = nodo("button", "btn", "Ir a la agenda");
      ir.type = "button";
      ir.addEventListener("click", () => abrir("agenda"));
      vacio.appendChild(ir);
    }
    host.appendChild(vacio);
    return;
  }
  filas.forEach((reserva) => {
    const marca = estado.recien.get(reserva.id);
    const reciente = marca && Date.now() - marca < 8000;
    const card = nodo("article", "pa-cita estado-" + reserva.estado + (reciente ? " is-nueva" : ""));
    card.dataset.id = reserva.id;
    const titulo = nodo("h3", null, reserva.nombre);
    if (reciente) titulo.appendChild(nodo("span", "pa-nueva-etiq", "Nueva"));
    card.append(
      titulo,
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
    pintarBarberos();
    prepararFormulariosDueno();
  }
  const lista = barberosOrdenados(dueno() ? estado.barberos : estado.barberos.filter((item) => item.id === estado.barberoId));
  if (!estado.horarioBarbero || !lista.some((item) => item.id === estado.horarioBarbero)) estado.horarioBarbero = (lista[0] || {}).id || "";
  prepararHorasBloqueo();
  cargarModelo();
  pintarEditor();
  pintarBloqueos();
  const sede = document.querySelector("[data-bloqueo-sede]");
  const barbero = document.querySelector("[data-bloqueo-barbero]");
  if (sede) sede.value = (sedeActual() || {}).id || "";
  const opciones = [];
  if (dueno()) opciones.push({ valor: "", texto: "Cerrar el local" });
  (dueno() ? estado.barberos : lista).forEach((item) => opciones.push({ valor: item.id, texto: "Día libre de " + item.nombre }));
  llenarSelect(barbero, opciones, dueno() ? "" : estado.barberoId);
  if (barbero && !dueno()) barbero.disabled = true;
}

function barberosOrdenados(lista) {
  const copia = (lista || estado.barberos).slice();
  copia.sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
  return copia;
}

function categoriaDeBarbero(nombre) {
  return nombre && !["Niños", "Mujer", "Color"].includes(nombre);
}

function pintarBarberos() {
  const host = document.querySelector("[data-barberos]");
  if (!host) return;
  host.replaceChildren();
  const lista = barberosOrdenados();
  if (!lista.length) host.appendChild(nodo("p", "vacio", "Aún no hay barberos."));
  lista.forEach((barbero) => {
    const fila = nodo("article", "pa-cita");
    fila.append(nodo("h3", null, barbero.nombre), nodo("p", null, barbero.especialidad || ""));
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

function serviciosActivos() {
  return estado.servicios
    .filter((item) => item.activo !== false && categoriaDeBarbero(item.categoria))
    .sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0) || String(a.nombre || "").localeCompare(String(b.nombre || ""), "es"));
}

function serviciosChecks(seleccion, todos) {
  const host = document.querySelector("[data-barbero-servicios]");
  if (!host) return;
  host.replaceChildren();
  const activos = serviciosActivos();
  const elegidos = new Set(todos ? activos.map((item) => item.id) : (Array.isArray(seleccion) ? seleccion : []));
  const grid = nodo("div", "servicios-grid");
  const aviso = nodo("p", "form-error", "Elige al menos un servicio para que este barbero pueda recibir reservas.");
  aviso.dataset.serviciosAviso = "1";
  aviso.hidden = true;
  const general = nodo("label", "servicio-op todos casilla");
  const caja = document.createElement("input");
  caja.type = "checkbox";
  caja.dataset.serviciosTodos = "1";
  const cuenta = nodo("span", "servicio-cuenta", "");
  cuenta.dataset.serviciosCuenta = "1";
  general.append(caja, marcaCasilla(), nodo("span", "servicio-nombre", "Todos los servicios"), cuenta);
  grid.appendChild(general);
  let categoria = "";
  activos.forEach((servicio) => {
    if (servicio.categoria !== categoria) {
      categoria = servicio.categoria;
      grid.appendChild(nodo("p", "servicio-cat", categoria));
    }
    const label = nodo("label", "servicio-op casilla");
    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = servicio.id;
    input.dataset.servicioId = servicio.id;
    input.checked = elegidos.has(servicio.id);
    label.append(input, marcaCasilla(), nodo("span", "servicio-nombre", servicio.nombre));
    input.addEventListener("change", sincronizarServicios);
    grid.appendChild(label);
  });
  caja.addEventListener("change", () => {
    const marcar = caja.checked;
    grid.querySelectorAll("[data-servicio-id]").forEach((input) => { input.checked = marcar; });
    sincronizarServicios();
  });
  host.append(grid, aviso);
  sincronizarServicios();
}

function sincronizarServicios() {
  const host = document.querySelector("[data-barbero-servicios]");
  if (!host) return;
  const cajas = [...host.querySelectorAll("[data-servicio-id]")];
  const marcadas = cajas.filter((caja) => caja.checked).length;
  const todos = host.querySelector("[data-servicios-todos]");
  const tarjeta = todos ? todos.closest(".servicio-op") : null;
  if (todos) {
    todos.indeterminate = marcadas > 0 && marcadas < cajas.length;
    todos.checked = cajas.length > 0 && marcadas === cajas.length;
  }
  if (tarjeta) {
    tarjeta.classList.toggle("is-on", Boolean(todos && todos.checked));
    tarjeta.classList.toggle("is-parcial", Boolean(todos && todos.indeterminate));
  }
  cajas.forEach((caja) => {
    const op = caja.closest(".servicio-op");
    if (op) op.classList.toggle("is-on", caja.checked);
  });
  const cuenta = host.querySelector("[data-servicios-cuenta]");
  if (cuenta) cuenta.textContent = marcadas + " de " + cajas.length + " servicios";
  const aviso = host.querySelector("[data-servicios-aviso]");
  if (aviso) aviso.hidden = marcadas > 0;
  const enviar = document.querySelector("[data-barbero-form] [type=submit]");
  if (enviar) enviar.disabled = marcadas === 0;
}

function llenarBarbero(barbero) {
  const form = document.querySelector("[data-barbero-form]");
  form.elements.id.value = barbero.id;
  form.elements.nombre.value = barbero.nombre || "";
  form.elements.especialidad.value = barbero.especialidad || "";
  if (form.elements.sede_id) form.elements.sede_id.value = barbero.sede_id || (sedeActual() || {}).id || "";
  form.elements.foto.value = barbero.foto || "";
  form.elements.activo.checked = barbero.activo !== false;
  serviciosChecks(barbero.servicios, barbero.servicios == null);
  const horario = document.querySelector("[data-barbero-horario]");
  if (horario) horario.hidden = true;
}

function prepararFormulariosDueno() {
  const sede = document.querySelector("[data-barbero-form] [name=sede_id]");
  if (sede && sede.tagName === "SELECT") llenarSelect(sede, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  else if (sede) sede.value = (sedeActual() || {}).id || "";
  const foto = document.querySelector("[data-barbero-foto]");
  llenarSelect(foto, [{ valor: "", texto: "Sin foto" }, ...estado.fotos.map((item) => ({ valor: item.id, texto: item.alt || item.id }))]);
  if (!document.querySelector("[data-servicios-todos]")) serviciosChecks(null, true);
  prepararHorarioNuevo();
}

function hhmm(valor) {
  const texto = String(valor == null ? "" : valor).trim();
  const encontrado = texto.match(/^(\d{1,2}):(\d{2})/);
  if (!encontrado) return "";
  const hora = Number(encontrado[1]);
  const minuto = Number(encontrado[2]);
  if (hora > 23 || minuto > 59) return "";
  return String(hora).padStart(2, "0") + ":" + String(minuto).padStart(2, "0");
}

function diaPanel(valor) {
  const dia = Number(valor);
  if (dia === 0) return 7;
  return dia;
}

const FRANJA = { inicio: 5 * 60, fin: 23 * 60 + 30, paso: 30 };

function horasDeFranja(desdeMin, hastaMin, extra) {
  const valores = [];
  for (let minuto = desdeMin; minuto <= hastaMin; minuto += FRANJA.paso) valores.push(aHora(minuto));
  const extraCorta = hhmm(extra);
  if (extraCorta && aMinutos(extraCorta) >= desdeMin && aMinutos(extraCorta) <= hastaMin && !valores.includes(extraCorta)) valores.push(extraCorta);
  valores.sort();
  return valores;
}

function opcionesHora(extra) {
  return horasDeFranja(FRANJA.inicio, FRANJA.fin, extra).map((valor) => ({ valor, texto: horaLegible(valor) }));
}

function opcionesDesde(extra) {
  return horasDeFranja(FRANJA.inicio, FRANJA.fin - FRANJA.paso, extra).map((valor) => ({ valor, texto: horaLegible(valor) }));
}

function opcionesHasta(desde, extra) {
  const base = aMinutos(desde);
  const valores = horasDeFranja(base + FRANJA.paso, FRANJA.fin, extra).filter((valor) => aMinutos(valor) > base);
  return valores.map((valor) => ({ valor, texto: horaLegible(valor) }));
}

function selectHora(valor, opciones) {
  const select = document.createElement("select");
  select.className = "pa-select";
  llenarSelect(select, opciones || opcionesHora(valor), hhmm(valor) || "10:00");
  return select;
}

function cajaSelect(select) {
  const caja = nodo("span", "con-flecha");
  caja.appendChild(select);
  return caja;
}

function normalizarRango(abre, cierra) {
  const desde = hhmm(abre) || "10:00";
  let hasta = hhmm(cierra);
  if (!hasta || aMinutos(hasta) <= aMinutos(desde)) {
    const siguiente = aMinutos(desde) + FRANJA.paso;
    hasta = siguiente <= FRANJA.fin ? aHora(siguiente) : hasta || desde;
  }
  return { abre: desde, cierra: hasta };
}

function plantillaSede() {
  return SEMANA.map((item) => ({ dia: item.dia, nombre: item.nombre, activo: true, abre: "10:00", cierra: "20:00" }));
}

function prepararHorasBloqueo() {
  const desde = document.querySelector("[data-bloqueo-form] [name=desde]");
  const hasta = document.querySelector("[data-bloqueo-form] [name=hasta]");
  if (!desde || desde.options.length) return;
  llenarSelect(desde, opcionesHora(), "10:00");
  llenarSelect(hasta, opcionesHora(), "12:00");
}

function prepararHorarioNuevo() {
  const host = document.querySelector("[data-horario-manual]");
  const caja = document.querySelector("[data-horario-sede]");
  if (!host || !caja || host.childElementCount) return;
  plantillaSede().forEach((item) => {
    const fila = nodo("div", "horario-rango horario-manual-dia");
    const etiqueta = nodo("label", "casilla");
    const marca = document.createElement("input");
    marca.type = "checkbox";
    marca.checked = true;
    marca.dataset.manualDia = String(item.dia);
    etiqueta.append(marca, marcaCasilla());
    const abre = selectHora("10:00");
    abre.dataset.manualAbre = String(item.dia);
    const cierra = selectHora("20:00");
    cierra.dataset.manualCierra = String(item.dia);
    fila.append(etiqueta, nodo("span", null, item.nombre), cajaSelect(abre), cajaSelect(cierra));
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
    if (!abre || !cierra || !abre.value || !cierra.value || aMinutos(abre.value) >= aMinutos(cierra.value)) return;
    filas.push({ dia, abre: hhmm(abre.value), cierra: hhmm(cierra.value) });
  });
  return filas;
}

function fotoHorario() {
  return JSON.stringify(estado.horarioModelo || {});
}

function marcarHorario() {
  const aviso = document.querySelector("[data-horario-aviso]");
  const guardar = document.querySelector("[data-horario-guardar]");
  const descartar = document.querySelector("[data-horario-descartar]");
  const error = document.querySelector("[data-horario-error]");
  const ok = document.querySelector("[data-horario-ok]");
  const reintentar = document.querySelector("[data-horario-reintentar]");
  const todos = document.querySelector("[data-horario-todos-abrir]");
  const sucio = fotoHorario() !== estado.horarioFoto;
  const mensaje = validarModelo();
  if (aviso) aviso.hidden = !sucio;
  if (guardar && !estado.horarioGuardando) {
    guardar.disabled = !sucio || Boolean(mensaje);
    guardar.textContent = "Guardar horario";
  }
  if (descartar) descartar.disabled = Boolean(estado.horarioGuardando) || !sucio;
  if (todos && dueno()) todos.disabled = Boolean(estado.horarioGuardando) || Boolean(mensaje);
  if (estado.horarioFallo) {
    if (reintentar) reintentar.hidden = false;
    if (ok) ok.hidden = true;
  } else {
    if (reintentar) reintentar.hidden = true;
    if (error) {
      error.hidden = !mensaje;
      error.textContent = mensaje || "";
    }
    if (ok && (sucio || mensaje)) ok.hidden = true;
  }
}

function inicioDe(item) {
  if (item && item.inicio != null && String(item.inicio).trim() !== "") return item.inicio;
  return item ? item.abre : "";
}

function finDe(item) {
  if (item && item.fin != null && String(item.fin).trim() !== "") return item.fin;
  return item ? item.cierra : "";
}

function horaSql(valor) {
  const corta = hhmm(valor);
  return corta ? corta + ":00" : "";
}

function barberosDelHorario() {
  return barberosOrdenados(dueno() ? estado.barberos : estado.barberos.filter((item) => item.id === estado.barberoId));
}

function validarModelo() {
  const modelo = estado.horarioModelo || {};
  const ids = Object.keys(modelo);
  for (let i = 0; i < ids.length; i += 1) {
    const dias = modelo[ids[i]] || {};
    for (let n = 0; n < SEMANA.length; n += 1) {
      const item = SEMANA[n];
      const rango = dias[item.dia];
      if (!rango) continue;
      if (aMinutos(rango.cierra) <= aMinutos(rango.abre)) return "El " + item.nombre.toLowerCase() + ", Hasta tiene que ser después de Desde.";
    }
  }
  return "";
}

function filasDe(barberoId) {
  const filas = [];
  const dias = (estado.horarioModelo || {})[barberoId] || {};
  SEMANA.forEach((item) => {
    const rango = dias[item.dia];
    if (!rango) return;
    const inicio = horaSql(rango.abre);
    const fin = horaSql(rango.cierra);
    if (!inicio || !fin) return;
    filas.push({ barbero_id: barberoId, dia: item.dia, inicio, fin, activo: true });
  });
  return filas;
}

function reportarHorario(error) {
  const texto = error && error.message ? error.message : "Error al guardar el horario";
  console.error("No se pudo guardar el horario:", texto);
}

async function reemplazarHorario(barberoId, filas) {
  const actuales = estado.horarios.filter((item) => item.barbero_id === barberoId);
  const usados = new Set();
  for (let i = 0; i < filas.length; i += 1) {
    const fila = filas[i];
    const previo = actuales.find((item) => item.id && !usados.has(item.id) && diaPanel(item.dia) === Number(fila.dia));
    if (previo) {
      usados.add(previo.id);
      const cambio = await estado.supabase.from("horarios").update({
        dia: fila.dia,
        inicio: fila.inicio,
        fin: fila.fin,
        activo: true
      }).eq("id", previo.id).select();
      if (cambio.error) {
        reportarHorario(cambio.error);
        return { ok: false, parcial: false, error: cambio.error };
      }
    } else {
      const alta = await estado.supabase.from("horarios").insert(fila).select();
      if (alta.error) {
        reportarHorario(alta.error);
        return { ok: false, parcial: false, error: alta.error };
      }
      if (alta.data && alta.data[0] && alta.data[0].id) usados.add(alta.data[0].id);
    }
  }
  const sobrantes = actuales.map((item) => item.id).filter((id) => id && !usados.has(id));
  if (sobrantes.length) {
    const borrado = await estado.supabase.from("horarios").delete().in("id", sobrantes);
    if (borrado.error) {
      reportarHorario(borrado.error);
      return { ok: false, parcial: true, anteriores: sobrantes, error: borrado.error };
    }
  }
  return { ok: true };
}

function fijarSegmento(grupo, activo) {
  if (!grupo) return;
  grupo.dataset.on = activo ? "1" : "0";
  grupo.querySelectorAll("[role='radio']").forEach((boton) => {
    const on = (boton.dataset.valor === "1") === Boolean(activo);
    boton.setAttribute("aria-checked", on ? "true" : "false");
    boton.tabIndex = on ? 0 : -1;
  });
}

function cablearSegmento(grupo, alCambiar) {
  if (!grupo || grupo.dataset.cableado) return;
  grupo.dataset.cableado = "1";
  grupo.addEventListener("click", (evento) => {
    const boton = evento.target.closest("[role='radio']");
    if (!boton || boton.getAttribute("aria-checked") === "true") return;
    const encendido = boton.dataset.valor === "1";
    fijarSegmento(grupo, encendido);
    if (alCambiar) alCambiar(encendido);
  });
  grupo.addEventListener("keydown", (evento) => {
    if (!["ArrowRight", "ArrowLeft", "ArrowUp", "ArrowDown"].includes(evento.key)) return;
    evento.preventDefault();
    const encendido = grupo.dataset.on !== "1";
    fijarSegmento(grupo, encendido);
    const boton = grupo.querySelector("[data-valor='" + (encendido ? "1" : "0") + "']");
    if (boton) boton.focus();
    if (alCambiar) alCambiar(encendido);
  });
}

function crearSegmento(etiqueta, si, no, activo, alCambiar) {
  const grupo = nodo("div", "segmento");
  grupo.setAttribute("role", "radiogroup");
  grupo.setAttribute("aria-label", etiqueta);
  const indicador = nodo("span", "segmento-indicador", "");
  indicador.setAttribute("aria-hidden", "true");
  const a = nodo("button", null, si);
  a.type = "button";
  a.setAttribute("role", "radio");
  a.dataset.valor = "1";
  const b = nodo("button", null, no);
  b.type = "button";
  b.setAttribute("role", "radio");
  b.dataset.valor = "0";
  grupo.append(indicador, a, b);
  fijarSegmento(grupo, activo);
  cablearSegmento(grupo, alCambiar);
  return grupo;
}

function aplicarHoja() {
  limpiarHoja();
  (estado.reglasSemana || []).forEach(regla);
  if (estado.reglaTab) regla(estado.reglaTab);
}

function avisarFalloHorario(texto) {
  estado.horarioFallo = true;
  const caja = document.querySelector("[data-horario-error]");
  const reintentar = document.querySelector("[data-horario-reintentar]");
  const ok = document.querySelector("[data-horario-ok]");
  if (caja) {
    caja.hidden = false;
    caja.textContent = texto;
  }
  if (reintentar) reintentar.hidden = false;
  if (ok) ok.hidden = true;
}

function horarioCoincide(deseado) {
  const lista = barberosDelHorario();
  for (let i = 0; i < lista.length; i += 1) {
    const barbero = lista[i];
    const dias = deseado[barbero.id] || {};
    for (let n = 0; n < SEMANA.length; n += 1) {
      const item = SEMANA[n];
      const rango = dias[item.dia] || null;
      const filas = estado.horarios.filter((fila) => fila.barbero_id === barbero.id && diaPanel(fila.dia) === item.dia && fila.activo !== false);
      if (!rango) {
        if (filas.length) return false;
        continue;
      }
      if (filas.length !== 1) return false;
      if (hhmm(inicioDe(filas[0])) !== hhmm(rango.abre) || hhmm(finDe(filas[0])) !== hhmm(rango.cierra)) return false;
    }
  }
  return true;
}

function avisarHorario(texto) {
  const ok = document.querySelector("[data-horario-ok]");
  const hoja = document.querySelector(".horario-hoja");
  if (ok) {
    ok.hidden = false;
    ok.textContent = texto;
  }
  if (!hoja) return;
  hoja.classList.remove("is-guardado");
  void hoja.offsetWidth;
  hoja.classList.add("is-guardado");
  window.setTimeout(() => hoja.classList.remove("is-guardado"), 600);
}

async function aplicarHorarioTodos() {
  const caja = document.querySelector("[data-horario-error]");
  const mensaje = validarModelo();
  if (mensaje) {
    if (caja) {
      caja.hidden = false;
      caja.textContent = mensaje;
    }
    return;
  }
  const lista = barberosDelHorario();
  if (lista.length < 2) return;
  const origen = lista[0];
  const ok = await preguntar("¿Aplicar el horario de " + origen.nombre + " a todos los barberos? Se reemplazan sus horas.", "Aplicar", "Cancelar");
  if (!ok) return;
  const plantilla = JSON.parse(JSON.stringify(estado.horarioModelo[origen.id] || {}));
  lista.forEach((barbero) => {
    estado.horarioModelo[barbero.id] = JSON.parse(JSON.stringify(plantilla));
  });
  estado.horarioFallo = false;
  pintarEditor();
  await guardarHorarios();
}

async function guardarHorarioBarbero(barberoId, filas) {
  const lista = (filas || []).map((item) => ({
    barbero_id: barberoId,
    dia: item.dia,
    inicio: horaSql(item.inicio || item.abre),
    fin: horaSql(item.fin || item.cierra),
    activo: item.activo !== false
  })).filter((item) => item.inicio && item.fin);
  const resultado = await reemplazarHorario(barberoId, lista);
  if (!resultado.ok) return false;
  const recarga = await estado.supabase.from("horarios").select("*");
  if (recarga.error) {
    reportarHorario(recarga.error);
    return false;
  }
  estado.horarios = recarga.data || [];
  return true;
}

function rangoDelDia(filas) {
  const vivas = (filas || []).filter((item) => item.activo !== false);
  if (!vivas.length) return null;
  vivas.sort((a, b) => hhmm(inicioDe(a)).localeCompare(hhmm(inicioDe(b))));
  return normalizarRango(inicioDe(vivas[0]), finDe(vivas[vivas.length - 1]));
}

function cargarModelo() {
  const modelo = {};
  barberosDelHorario().forEach((barbero) => {
    const dias = {};
    const porDia = {};
    SEMANA.forEach((item) => { dias[item.dia] = null; });
    estado.horarios.filter((item) => item.barbero_id === barbero.id).forEach((item) => {
      const dia = diaPanel(item.dia);
      if (!Object.prototype.hasOwnProperty.call(dias, dia)) return;
      if (!porDia[dia]) porDia[dia] = [];
      porDia[dia].push(item);
    });
    SEMANA.forEach((item) => { dias[item.dia] = rangoDelDia(porDia[item.dia]); });
    modelo[barbero.id] = dias;
  });
  estado.horarioModelo = modelo;
  estado.horarioTomarFoto = true;
  estado.horarioFallo = false;
}

function marcasFranja() {
  const marcas = [];
  for (let minuto = FRANJA.inicio; minuto <= FRANJA.fin; minuto += FRANJA.paso * 12) marcas.push(minuto);
  if (marcas[marcas.length - 1] !== FRANJA.fin) marcas.push(FRANJA.fin);
  return marcas;
}

function pintarSemanaVisual(host, modelo, indice) {
  if (!host || !modelo) return;
  host.replaceChildren();
  const inicio = FRANJA.inicio;
  const fin = FRANJA.fin;
  const anchoTotal = Math.max(FRANJA.paso, fin - inicio);
  SEMANA.forEach((item) => {
    const fila = nodo("div", "semana-barra");
    fila.appendChild(nodo("span", null, item.nombre.slice(0, 3)));
    const pista = nodo("div", "semana-pista");
    const rango = modelo[item.dia];
    if (rango) {
      const clase = "tramo-b" + indice + "-d" + item.dia;
      const barra = nodo("span", "semana-tramo " + clase);
      const izq = ((aMinutos(rango.abre) - inicio) / anchoTotal) * 100;
      const ancho = ((aMinutos(rango.cierra) - aMinutos(rango.abre)) / anchoTotal) * 100;
      estado.reglasSemana.push("." + clase + "{left:" + Math.max(0, izq).toFixed(2) + "%;width:" + Math.max(0, ancho).toFixed(2) + "%}");
      pista.appendChild(barra);
    }
    fila.appendChild(pista);
    host.appendChild(fila);
  });
  const escala = nodo("div", "semana-escala");
  marcasFranja().forEach((minuto) => escala.appendChild(nodo("span", null, horaLegible(aHora(minuto)))));
  host.appendChild(escala);
}

function ponerHasta(select, desde, valor) {
  const deseado = hhmm(valor);
  const minimo = aMinutos(desde) + FRANJA.paso;
  const elegido = deseado && aMinutos(deseado) > aMinutos(desde) ? deseado : (minimo <= FRANJA.fin ? aHora(minimo) : "");
  llenarSelect(select, opcionesHasta(desde, elegido), elegido);
  return select.value;
}

function refrescarGraficos() {
  estado.reglasSemana = [];
  barberosDelHorario().forEach((barbero, indice) => {
    const host = document.querySelector('[data-horario-semana="' + barbero.id + '"]');
    pintarSemanaVisual(host, (estado.horarioModelo || {})[barbero.id], indice);
  });
  aplicarHoja();
}

function tocarHorario() {
  estado.horarioFallo = false;
  marcarHorario();
}

function filaDia(barbero, item) {
  const bloque = nodo("div", "horario-dia");
  bloque.dataset.horarioFila = String(item.dia);
  const rango = (estado.horarioModelo[barbero.id] || {})[item.dia];
  const trabaja = Boolean(rango);
  bloque.appendChild(nodo("p", "horario-nombre", item.nombre));
  const control = crearSegmento("Horario del " + item.nombre, "Trabaja", "Descanso", trabaja, (encendido) => {
    if (!estado.horarioModelo[barbero.id]) estado.horarioModelo[barbero.id] = {};
    if (encendido) {
      if (!estado.horarioModelo[barbero.id][item.dia]) estado.horarioModelo[barbero.id][item.dia] = { abre: "10:00", cierra: "20:00" };
    } else {
      estado.horarioModelo[barbero.id][item.dia] = null;
    }
    estado.horarioFallo = false;
    pintarEditor();
  });
  bloque.appendChild(control);
  const linea = nodo("div", "turno");
  linea.hidden = !trabaja;
  const actual = rango || { abre: "10:00", cierra: "20:00" };
  const desde = selectHora(actual.abre, opcionesDesde(actual.abre));
  desde.dataset.horarioDia = String(item.dia);
  desde.dataset.horarioCampo = "abre";
  desde.setAttribute("aria-label", "Desde el " + item.nombre);
  const hasta = document.createElement("select");
  hasta.className = "pa-select";
  hasta.dataset.horarioDia = String(item.dia);
  hasta.dataset.horarioCampo = "cierra";
  hasta.setAttribute("aria-label", "Hasta el " + item.nombre);
  const cierre = ponerHasta(hasta, desde.value, actual.cierra);
  if (trabaja) {
    estado.horarioModelo[barbero.id][item.dia].abre = desde.value;
    estado.horarioModelo[barbero.id][item.dia].cierra = cierre;
  }
  const campoDesde = nodo("label", "turno-campo");
  campoDesde.append(nodo("span", null, "Desde"), cajaSelect(desde));
  const campoHasta = nodo("label", "turno-campo");
  campoHasta.append(nodo("span", null, "Hasta"), cajaSelect(hasta));
  desde.addEventListener("change", () => {
    const dia = estado.horarioModelo[barbero.id][item.dia];
    if (!dia) return;
    dia.abre = desde.value;
    dia.cierra = ponerHasta(hasta, desde.value, hasta.value);
    refrescarGraficos();
    tocarHorario();
  });
  hasta.addEventListener("change", () => {
    const dia = estado.horarioModelo[barbero.id][item.dia];
    if (!dia) return;
    dia.cierra = hasta.value;
    refrescarGraficos();
    tocarHorario();
  });
  linea.append(campoDesde, campoHasta);
  bloque.appendChild(linea);
  return bloque;
}

function pintarEditor() {
  const host = document.querySelector("[data-horario-editor]");
  if (!host || !estado.horarioModelo) return;
  host.replaceChildren();
  estado.reglasSemana = [];
  const lista = barberosDelHorario();
  lista.forEach((barbero, indice) => {
    if (!estado.horarioModelo[barbero.id]) return;
    const card = nodo("article", "horario-card");
    card.dataset.horarioBarbero = barbero.id;
    card.appendChild(nodo("h3", null, barbero.nombre));
    const preview = nodo("div", "horario-semana-card horario-preview");
    preview.dataset.horarioSemana = barbero.id;
    preview.setAttribute("aria-hidden", "true");
    card.appendChild(preview);
    SEMANA.forEach((item) => card.appendChild(filaDia(barbero, item)));
    host.appendChild(card);
    pintarSemanaVisual(preview, estado.horarioModelo[barbero.id], indice);
  });
  aplicarHoja();
  const todos = document.querySelector("[data-horario-todos-abrir]");
  if (todos && dueno()) todos.hidden = lista.length < 2;
  if (estado.horarioTomarFoto) {
    estado.horarioFoto = fotoHorario();
    estado.horarioTomarFoto = false;
  }
  marcarHorario();
}

async function guardarHorarios() {
  if (estado.horarioGuardando) return;
  const mensaje = validarModelo();
  const caja = document.querySelector("[data-horario-error]");
  const guardar = document.querySelector("[data-horario-guardar]");
  if (mensaje) {
    estado.horarioFallo = false;
    if (caja) {
      caja.hidden = false;
      caja.textContent = mensaje;
    }
    if (guardar) guardar.disabled = true;
    return;
  }
  const lista = barberosDelHorario();
  if (!lista.length) return;
  estado.horarioGuardando = true;
  estado.horarioFallo = false;
  if (guardar) {
    guardar.disabled = true;
    guardar.textContent = "Guardando…";
  }
  const reintentar = document.querySelector("[data-horario-reintentar]");
  if (reintentar) reintentar.hidden = true;
  if (caja) caja.hidden = true;
  const deseado = JSON.parse(JSON.stringify(estado.horarioModelo));
  try {
    for (let i = 0; i < lista.length; i += 1) {
      const barbero = lista[i];
      const resultado = await reemplazarHorario(barbero.id, filasDe(barbero.id));
      if (!resultado.ok) {
        const lectura = await estado.supabase.from("horarios").select("*");
        if (!lectura.error) estado.horarios = lectura.data || [];
        avisarFalloHorario(resultado.parcial
          ? "Se guardó el horario, pero no se pudieron quitar las horas anteriores."
          : "No se pudo guardar el horario.");
        return;
      }
    }
    const recarga = await estado.supabase.from("horarios").select("*");
    if (recarga.error) {
      reportarHorario(recarga.error);
      avisarFalloHorario("No se pudo guardar el horario.");
      return;
    }
    estado.horarios = recarga.data || [];
    if (!horarioCoincide(deseado)) {
      console.error("No se pudo guardar el horario:", "Los datos releídos no coinciden.");
      estado.horarioModelo = deseado;
      estado.horarioTomarFoto = false;
      avisarFalloHorario("No se pudo guardar el horario.");
      return;
    }
    cargarModelo();
    pintarEditor();
    if (dueno()) pintarBarberos();
    avisarHorario("Horario guardado");
    fail("");
  } finally {
    estado.horarioGuardando = false;
    if (guardar) guardar.textContent = "Guardar horario";
    marcarHorario();
  }
}
function avisarDeshacer(texto, accion) {
  const aviso = document.querySelector("[data-deshacer]");
  if (!aviso) return;
  aviso.replaceChildren();
  aviso.hidden = false;
  aviso.appendChild(document.createTextNode(texto + " "));
  const boton = nodo("button", "btn btn-sec", "Deshacer");
  boton.type = "button";
  aviso.appendChild(boton);
  let vivo = true;
  const timer = window.setTimeout(() => {
    vivo = false;
    aviso.hidden = true;
  }, 6000);
  boton.addEventListener("click", async () => {
    if (!vivo) return;
    vivo = false;
    window.clearTimeout(timer);
    aviso.hidden = true;
    await accion();
  });
}

function pintarBloqueos() {
  const host = document.querySelector("[data-bloqueos]");
  if (!host) return;
  host.replaceChildren();
  const lista = estado.bloqueos.filter((item) => dueno() || item.barbero_id === estado.barberoId || !item.barbero_id);
  if (!lista.length) {
    host.appendChild(nodo("p", "vacio", "Todavía no hay cierres. Puedes cerrar el local o dar un día libre."));
    return;
  }
  lista.forEach((bloqueo) => {
    const fila = nodo("article", "pa-cita");
    const quien = bloqueo.barbero_id ? "Día libre de " + nombreBarbero(bloqueo.barbero_id) : "Cerrar el local";
    const franja = bloqueo.todo_dia ? "Todo el día" : horaLegible(bloqueo.desde || "") + " – " + horaLegible(bloqueo.hasta || "");
    fila.append(nodo("h3", null, fechaLegible(bloqueo.fecha)), nodo("p", null, quien + " · " + franja), nodo("p", null, bloqueo.motivo || ""));
    if (dueno() || bloqueo.barbero_id === estado.barberoId) {
      const borrar = nodo("button", "btn btn-peligro", "Quitar");
      borrar.type = "button";
      borrar.addEventListener("click", async () => {
        const ok = await preguntar("¿Quitar este cierre?", "Quitar", "Cancelar");
        if (!ok) return;
        const { error } = await estado.supabase.from("bloqueos").delete().eq("id", bloqueo.id);
        if (error) return fail("No se pudo quitar el cierre.");
        estado.bloqueos = estado.bloqueos.filter((item) => item.id !== bloqueo.id);
        pintarBloqueos();
        avisarDeshacer("Cierre quitado.", async () => {
          const copia = {
            sede_id: bloqueo.sede_id,
            barbero_id: bloqueo.barbero_id,
            fecha: bloqueo.fecha,
            todo_dia: bloqueo.todo_dia,
            desde: bloqueo.desde,
            hasta: bloqueo.hasta,
            motivo: bloqueo.motivo
          };
          const alta = await estado.supabase.from("bloqueos").insert(copia).select();
          if (alta.error || !alta.data || !alta.data[0]) return fail("No se pudo deshacer.");
          estado.bloqueos.push(alta.data[0]);
          pintarBloqueos();
        });
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
  const activos = estado.serviciosTab !== "inactivos";
  const ordenados = estado.servicios.filter((item) => (item.activo !== false) === activos).sort((a, b) => (a.orden || 0) - (b.orden || 0));
  if (!ordenados.length) {
    const vacio = nodo("div", "vacio");
    vacio.appendChild(nodo("p", null, activos ? "Aún no hay servicios activos. Completa el formulario y guárdalo." : "No hay servicios inactivos. Los que desactives aparecen aquí para volver a activarlos."));
    if (activos) {
      const ir = nodo("button", "btn", "Crear servicio");
      ir.type = "button";
      ir.addEventListener("click", () => {
        const campo = document.querySelector("[data-servicio-form] [name=nombre]");
        if (campo) campo.focus();
      });
      vacio.appendChild(ir);
    }
    host.appendChild(vacio);
    return;
  }
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

function textoMinutos(valor, lista) {
  const numero = Number(valor);
  if (lista === ANTES || lista === CANCELAR) {
    if (!numero) return lista === CANCELAR ? "En cualquier momento" : "Sin mínimo";
    if (numero === 30) return lista === CANCELAR ? "30 minutos antes" : "30 minutos";
    if (numero % 60 === 0) {
      const horas = numero / 60;
      const base = horas === 1 ? "1 hora" : horas + " horas";
      return lista === CANCELAR ? base + " antes" : base;
    }
    return numero + (lista === CANCELAR ? " minutos antes" : " minutos");
  }
  if (lista === DIAS_MAX) return numero + " días";
  return numero + " minutos";
}

function asegurarOpcion(select, valor, texto) {
  const clave = String(valor);
  if (![...select.options].some((opcion) => opcion.value === clave)) {
    const opcion = document.createElement("option");
    opcion.value = clave;
    opcion.textContent = texto;
    select.appendChild(opcion);
  }
  select.value = clave;
}

function ponerSwitch(nombre, activo) {
  fijarSegmento(document.querySelector("[data-ajuste='" + nombre + "']"), activo);
}

function leerAjustes() {
  const tomar = (nombre) => document.querySelector("[data-ajuste='" + nombre + "']");
  const interruptor = (nombre) => {
    const marcado = tomar(nombre).querySelector("[aria-checked='true']");
    return Boolean(marcado && marcado.dataset.valor === "1");
  };
  const meta = tomar("fidelidad_meta").querySelector("[data-valor]");
  return {
    reservas_activas: interruptor("reservas_activas"),
    paso_min: Number(tomar("paso_min").value),
    anticipacion_min: Number(tomar("anticipacion_min").value),
    dias_max: Number(tomar("dias_max").value),
    cancelar_min: Number(tomar("cancelar_min").value),
    fidelidad_activa: interruptor("fidelidad_activa"),
    fidelidad_meta: Number(meta.textContent),
    politica_version: tomar("politica_version").value.trim()
  };
}

function fraseCancelar(minutos) {
  if (!minutos) return "Se puede cancelar en cualquier momento";
  if (minutos < 60) return "Se puede cancelar hasta " + minutos + " min antes";
  const horas = minutos / 60;
  if (Number.isInteger(horas)) return "Se puede cancelar hasta " + horas + " h antes";
  return "Se puede cancelar hasta " + minutos + " min antes";
}

function pintarSellos(meta) {
  const host = document.querySelector("[data-sellos]");
  if (!host) return;
  host.replaceChildren();
  const total = Math.max(0, Math.min(50, Number(meta) || 0));
  for (let i = 0; i < total; i += 1) host.appendChild(nodo("span", "sello-previa", ""));
}

function marcarAjustes() {
  const aviso = document.querySelector("[data-ajustes-aviso]");
  const guardar = document.querySelector("[data-ajustes-guardar]");
  const ok = document.querySelector("[data-ajustes-ok]");
  const fila = leerAjustes();
  const sucio = JSON.stringify(fila) !== estado.ajustesFoto;
  if (aviso) aviso.hidden = !sucio;
  if (guardar) guardar.disabled = !sucio;
  if (ok && sucio) ok.hidden = true;
  const estadoTexto = document.querySelector("[data-ajuste-estado]");
  if (estadoTexto) {
    estadoTexto.textContent = fila.reservas_activas
      ? "Activadas: tus clientes pueden reservar"
      : "Pausadas: el botón Reservar dirá que la agenda no está disponible";
  }
  const frase = document.querySelector("[data-ajuste-frase]");
  if (frase) frase.textContent = "Horas cada " + fila.paso_min + " min · Reservas hasta " + fila.dias_max + " días adelante · " + fraseCancelar(fila.cancelar_min);
  pintarSellos(fila.fidelidad_meta);
}

function moverMeta(delta) {
  const caja = document.querySelector("[data-ajuste='fidelidad_meta'] [data-valor]");
  if (!caja) return;
  const siguiente = Math.min(50, Math.max(2, Number(caja.textContent) + delta));
  caja.textContent = String(siguiente);
  marcarAjustes();
}

function pintarAjustes() {
  pintarLocal();
  const config = estado.config;
  if (!config || !document.querySelector("[data-ajustes]")) return;
  ponerSwitch("reservas_activas", config.reservas_activas !== false);
  asegurarOpcion(document.querySelector("[data-ajuste='paso_min']"), config.paso_min ?? 30, textoMinutos(config.paso_min ?? 30, PASOS));
  asegurarOpcion(document.querySelector("[data-ajuste='anticipacion_min']"), config.anticipacion_min ?? 0, textoMinutos(config.anticipacion_min ?? 0, ANTES));
  asegurarOpcion(document.querySelector("[data-ajuste='dias_max']"), config.dias_max ?? 14, textoMinutos(config.dias_max ?? 14, DIAS_MAX));
  asegurarOpcion(document.querySelector("[data-ajuste='cancelar_min']"), config.cancelar_min ?? 0, textoMinutos(config.cancelar_min ?? 0, CANCELAR));
  ponerSwitch("fidelidad_activa", Boolean(config.fidelidad_activa));
  const meta = document.querySelector("[data-ajuste='fidelidad_meta'] [data-valor]");
  if (meta) meta.textContent = String(Math.min(50, Math.max(2, Number(config.fidelidad_meta) || 8)));
  const version = document.querySelector("[data-ajuste='politica_version']");
  if (version) version.value = config.politica_version || "1";
  const error = document.querySelector("[data-ajustes-error]");
  const reintentar = document.querySelector("[data-ajustes-reintentar]");
  if (error) error.hidden = true;
  if (reintentar) reintentar.hidden = true;
  estado.ajustesFoto = JSON.stringify(leerAjustes());
  marcarAjustes();
}

function prepararNueva() {
  const form = document.querySelector("[data-nueva-form]");
  if (!form) return;
  const sedes = dueno() ? estado.sedes : estado.sedes.filter((item) => estado.barberos.some((barbero) => barbero.id === estado.barberoId && barbero.sede_id === item.id));
  llenarSelect(form.elements.sede, sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  const servicios = estado.servicios.filter((item) => item.activo !== false);
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
  const ayuda = document.querySelector("[data-ayuda]");
  const ayudaModal = document.querySelector("[data-ayuda-modal]");
  if (ayuda && ayudaModal) ayuda.addEventListener("click", () => { ayudaModal.hidden = false; });
  const ayudaCerrar = document.querySelector("[data-ayuda-cerrar]");
  if (ayudaCerrar && ayudaModal) ayudaCerrar.addEventListener("click", () => { ayudaModal.hidden = true; });
  document.querySelectorAll("[data-ayuda-btn]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const panel = document.getElementById(boton.getAttribute("aria-controls"));
      if (!panel) return;
      panel.hidden = !panel.hidden;
      boton.setAttribute("aria-expanded", panel.hidden ? "false" : "true");
    });
  });
  document.querySelectorAll("[data-servicios-tab]").forEach((boton) => {
    boton.addEventListener("click", () => {
      estado.serviciosTab = boton.dataset.serviciosTab;
      document.querySelectorAll("[data-servicios-tab]").forEach((item) => {
        item.setAttribute("aria-pressed", item === boton ? "true" : "false");
      });
      pintarServicios();
    });
  });
  const agendaSede = document.querySelector("[data-agenda-sede]");
  if (agendaSede) agendaSede.addEventListener("change", (evento) => {
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
  if (nueva.elements.sede) nueva.elements.sede.addEventListener("change", () => refrescarNueva(true));
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
  const localForm = document.querySelector("[data-local-form]");
  if (localForm) localForm.addEventListener("submit", guardarLocal);
  document.querySelector("[data-barbero-form]").addEventListener("submit", guardarBarbero);
  document.querySelector("[data-servicio-form]").addEventListener("submit", guardarServicio);
  document.querySelector("[data-horario-guardar]").addEventListener("click", guardarHorarios);
  const descartarHorario = document.querySelector("[data-horario-descartar]");
  if (descartarHorario) descartarHorario.addEventListener("click", async () => {
    if (fotoHorario() === estado.horarioFoto) return;
    const ok = await preguntar("¿Descartar los cambios del horario?", "Descartar", "Cancelar");
    if (!ok) return;
    cargarModelo();
    pintarEditor();
  });
  const reintentarHorario = document.querySelector("[data-horario-reintentar]");
  if (reintentarHorario) reintentarHorario.addEventListener("click", guardarHorarios);
  const abrirTodos = document.querySelector("[data-horario-todos-abrir]");
  if (abrirTodos) abrirTodos.addEventListener("click", aplicarHorarioTodos);
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
  const ajustes = document.querySelector("[data-ajustes]");
  if (ajustes) {
    ajustes.addEventListener("submit", (evento) => evento.preventDefault());
    ajustes.addEventListener("change", marcarAjustes);
    ajustes.addEventListener("input", marcarAjustes);
  }
  document.querySelectorAll("[data-ajuste][role='radiogroup']").forEach((grupo) => {
    cablearSegmento(grupo, () => marcarAjustes());
  });
  window.addEventListener("resize", () => {
    const panel = document.querySelector("[data-panel='equipo']");
    if (!panel || panel.hidden) return;
    refrescarGraficos();
  });
  const meta = document.querySelector("[data-ajuste='fidelidad_meta']");
  if (meta) {
    meta.querySelector("[data-menos]").addEventListener("click", () => moverMeta(-1));
    meta.querySelector("[data-mas]").addEventListener("click", () => moverMeta(1));
  }
  document.querySelector("[data-ajustes-guardar]").addEventListener("click", guardarAjustes);
  document.querySelector("[data-ajustes-reintentar]").addEventListener("click", guardarAjustes);
  document.querySelector("[data-ajustes-descartar]").addEventListener("click", () => pintarAjustes());
  window.addEventListener("beforeunload", (evento) => {
    if (!hayCambios()) return;
    evento.preventDefault();
    evento.returnValue = "";
  });
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

function pintarLocal() {
  const form = document.querySelector("[data-local-form]");
  const sede = sedeActual();
  if (!form || !sede) return;
  form.elements.nombre.value = sede.nombre || "";
  form.elements.direccion.value = sede.direccion || "";
  form.elements.telefono.value = sede.telefono || "";
}

async function guardarLocal(evento) {
  evento.preventDefault();
  const form = evento.target;
  const sede = sedeActual();
  const error = document.querySelector("[data-local-error]");
  if (error) error.hidden = true;
  if (!sede) {
    if (error) {
      error.hidden = false;
      error.textContent = "No pudimos guardar los datos del local.";
    }
    return;
  }
  const fila = {
    nombre: form.elements.nombre.value.trim(),
    direccion: form.elements.direccion.value.trim(),
    telefono: form.elements.telefono.value.trim()
  };
  const { error: fallo } = await estado.supabase.from("sedes").update(fila).eq("id", sede.id);
  if (fallo) {
    if (error) {
      error.hidden = false;
      error.textContent = "No pudimos guardar los datos del local.";
    }
    return;
  }
  Object.assign(sede, fila);
  pintarPuesta();
}

async function guardarBarbero(evento) {
  evento.preventDefault();
  const form = evento.target;
  const todos = form.querySelector("[data-servicios-todos]");
  const marcados = [...form.querySelectorAll("[data-servicio-id]:checked")].map((input) => input.value);
  if (!marcados.length) {
    const aviso = form.querySelector("[data-servicios-aviso]");
    if (aviso) aviso.hidden = false;
    return;
  }
  const servicios = todos && todos.checked && !todos.indeterminate ? null : marcados;
  const fila = {
    nombre: form.elements.nombre.value.trim(),
    especialidad: form.elements.especialidad.value.trim(),
    sede_id: (form.elements.sede_id && form.elements.sede_id.value) || (sedeActual() || {}).id || "",
    foto: form.elements.foto.value,
    servicios,
    activo: form.elements.activo.checked
  };
  if (!form.elements.id.value) {
    fila.orden = estado.barberos.reduce((maximo, item) => Math.max(maximo, Number(item.orden) || 0), 0) + 1;
  }
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
  form.elements.id.value = "";
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
    sede_id: (form.elements.sede_id && form.elements.sede_id.value) || (sedeActual() || {}).id || "",
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
    error.textContent = "No se pudo guardar el cierre.";
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
  const payload = {
    p_barbero: form.elements.barbero.value,
    p_servicio: form.elements.servicio.value,
    p_fecha: form.elements.fecha.value,
    p_hora: form.elements.hora.value,
    p_nombre: nombre,
    p_telefono: cel.digitos,
    p_notas: "Autorización verbal",
    p_autoriza: true,
    p_trampa: ""
  };
  let respuesta = await estado.supabase.rpc("crear_reserva", payload);
  const avisoRpc = String((respuesta.error && (respuesta.error.message || respuesta.error.details)) || "");
  if (respuesta.error && /p_trampa|p_autoriza|schema cache/i.test(avisoRpc)) {
    delete payload.p_trampa;
    delete payload.p_autoriza;
    respuesta = await estado.supabase.rpc("crear_reserva", payload);
  }
  const fallo = respuesta.error;
  if (fallo) {
    error.hidden = false;
    error.textContent = traducir(fallo);
    return;
  }
  document.querySelector("[data-nueva-modal]").hidden = true;
  form.reset();
  await cargarReservas(false);
}

async function guardarAjustes() {
  const error = document.querySelector("[data-ajustes-error]");
  const reintentar = document.querySelector("[data-ajustes-reintentar]");
  const ok = document.querySelector("[data-ajustes-ok]");
  if (error) error.hidden = true;
  if (reintentar) reintentar.hidden = true;
  if (ok) ok.hidden = true;
  const fila = leerAjustes();
  if (fila.paso_min < 10 || fila.paso_min > 120) {
    if (error) {
      error.hidden = false;
      error.textContent = "El intervalo debe estar entre 10 y 120 minutos.";
    }
    return;
  }
  if (fila.anticipacion_min < 0 || fila.anticipacion_min > 1440) {
    if (error) {
      error.hidden = false;
      error.textContent = "El tiempo mínimo debe estar entre 0 y 1440 minutos.";
    }
    return;
  }
  if (fila.dias_max < 1 || fila.dias_max > 90) {
    if (error) {
      error.hidden = false;
      error.textContent = "Los días adelante deben estar entre 1 y 90.";
    }
    return;
  }
  if (fila.cancelar_min < 0 || fila.cancelar_min > 2880) {
    if (error) {
      error.hidden = false;
      error.textContent = "El plazo para cancelar debe estar entre 0 y 2880 minutos.";
    }
    return;
  }
  if (fila.fidelidad_meta < 2 || fila.fidelidad_meta > 50) {
    if (error) {
      error.hidden = false;
      error.textContent = "La meta debe estar entre 2 y 50 cortes.";
    }
    return;
  }
  if (!fila.politica_version) {
    if (error) {
      error.hidden = false;
      error.textContent = "Escribe la versión de los textos legales.";
    }
    return;
  }
  const { error: fallo } = await estado.supabase.from("config").update(fila).eq("id", 1);
  if (fallo) {
    if (error) {
      error.hidden = false;
      error.textContent = traducir(fallo) || "No se pudieron guardar los cambios.";
    }
    if (reintentar) reintentar.hidden = false;
    return;
  }
  Object.assign(estado.config, fila);
  estado.ajustesFoto = JSON.stringify(fila);
  marcarAjustes();
  if (ok) {
    ok.hidden = false;
    ok.textContent = "Cambios guardados";
  }
  pintarPuesta();
}

const PUESTA = "lamansion-puesta-ok";
let puestaMarca = 0;
let puestaAbierta = false;

async function huecoSemana() {
  const servicio = estado.servicios.find((item) => item.activo !== false);
  const barberos = estado.barberos.filter((item) => item.activo !== false);
  if (!servicio || !barberos.length || !estado.supabase) return false;
  const hoy = hoyISO();
  for (let i = 0; i < 7; i += 1) {
    const fecha = sumarDias(hoy, i);
    for (const barbero of barberos) {
      const { data, error } = await estado.supabase.rpc("horas_disponibles", {
        p_barbero: barbero.id,
        p_fecha: fecha,
        p_duracion: Number(servicio.duracion_min) || 30
      });
      if (!error && Array.isArray(data) && data.length) return true;
    }
  }
  return false;
}

async function pintarPuesta() {
  const host = document.querySelector("[data-puesta]");
  if (!host || !dueno()) return;
  const token = ++puestaMarca;
  const sede = sedeActual();
  const activos = estado.servicios.filter((item) => item.activo !== false);
  const conPrecio = activos.some((item) => item.precio != null && item.precio !== "");
  const sinPrecio = activos.some((item) => item.precio == null || item.precio === "");
  const barberos = estado.barberos.filter((item) => item.activo !== false);
  const sinHorario = barberos.filter((item) => !estado.horarios.some((horario) => horario.barbero_id === item.id));
  const reservas = Boolean(estado.config && estado.config.reservas_activas !== false);
  const hueco = await huecoSemana();
  if (token !== puestaMarca) return;
  const items = [
    { ok: Boolean(sede && String(sede.direccion || "").trim()), texto: "Local con dirección cargada", destino: "ajustes", accion: "Corregir" },
    { ok: activos.length > 0, texto: "Al menos un servicio activo", destino: "servicios", accion: "Corregir" },
    { ok: conPrecio, texto: "Al menos un servicio con precio", destino: "servicios", accion: "Corregir", extra: sinPrecio ? "Los servicios sin precio no muestran el valor en la página pública." : "" },
    { ok: barberos.length > 0, texto: "Al menos un barbero activo", destino: "equipo", accion: "Corregir" },
    { ok: barberos.length > 0 && sinHorario.length === 0, texto: "Cada barbero activo tiene horarios", destino: "equipo", accion: "Editar", extra: sinHorario.length ? sinHorario.map((item) => item.nombre).join(", ") + ". No aparecerá disponible para reservar" : "" },
    { ok: reservas, texto: "Reservas activas en Ajustes", destino: "ajustes", accion: "Corregir" },
    { ok: hueco, texto: "Al menos una hora libre en los próximos 7 días", destino: "equipo", accion: "Corregir" }
  ];
  const listo = items.every((item) => item.ok);
  let desde = 0;
  try {
    if (listo) {
      desde = Number(localStorage.getItem(PUESTA) || 0);
      if (!desde) {
        desde = Date.now();
        localStorage.setItem(PUESTA, String(desde));
      }
    } else localStorage.removeItem(PUESTA);
  } catch (error) {}
  const colapsada = listo && desde && Date.now() - desde >= 7 * 86400000 && !puestaAbierta;
  host.replaceChildren();
  host.appendChild(nodo("h2", null, "Puesta en marcha"));
  if (colapsada) {
    const boton = nodo("button", "btn btn-sec", "Listo para recibir reservas");
    boton.type = "button";
    boton.addEventListener("click", () => {
      puestaAbierta = true;
      pintarPuesta();
    });
    host.appendChild(boton);
    return;
  }
  if (listo) host.appendChild(nodo("p", "puesta-ok", "Listo para recibir reservas"));
  const lista = nodo("ul", "puesta-lista");
  items.forEach((item) => {
    const fila = nodo("li", item.ok ? "puesta-ok" : "puesta-aviso");
    fila.appendChild(nodo("span", null, (item.ok ? "✓ " : "⚠ ") + item.texto));
    if (item.extra) fila.appendChild(nodo("p", null, item.extra));
    if (!item.ok) {
      const boton = nodo("button", "btn btn-sec", item.accion);
      boton.type = "button";
      boton.addEventListener("click", () => abrir(item.destino));
      fila.appendChild(boton);
    }
    lista.appendChild(fila);
  });
  host.appendChild(lista);
  if (listo) {
    const probar = nodo("a", "btn", "Probar la reserva");
    probar.href = "index.html#reservar";
    probar.target = "_blank";
    probar.rel = "noopener";
    host.appendChild(probar);
  }
}

async function salir() {
  try {
    await estado.supabase.auth.signOut();
  } catch (error) {}
  window.location.replace("admin-login.html");
}

async function boot() {
  await prepararMensajes();
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
  const user = sesion.data.session.user;
  const admins = await supabase.from("admins").select("id, rol, barbero_id, nombre").eq("id", user.id).maybeSingle();
  if (admins.error) {
    const codigo = admins.error.code || admins.error.status || "";
    window.location.replace("admin-login.html?error=permisos&codigo=" + encodeURIComponent(String(codigo)));
    return;
  }
  const fila = Array.isArray(admins.data) ? admins.data[0] : admins.data;
  if (!fila || (fila.rol !== "dueno" && fila.rol !== "barbero")) {
    await supabase.auth.signOut();
    window.location.replace("admin-login.html");
    return;
  }
  estado.rol = fila.rol;
  estado.barberoId = fila.barbero_id || "";
  estado.correo = sesion.data.session.user.email || "";
  const nombre = document.querySelector("[data-nombre]");
  if (nombre) nombre.textContent = fila.nombre || "";
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
