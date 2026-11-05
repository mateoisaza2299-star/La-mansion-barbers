import { reservasEnLinea, formatPrecio, formatDuracion, esServicioVip, ordenarServicios } from "./config.js";
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
  { id: "agenda", texto: "Agenda", roles: ["dueno"] },
  { id: "reservas", texto: "Reservas", roles: ["dueno"] },
  { id: "horario", texto: "Horario y capacidad", roles: ["dueno"] },
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
  correo: "",
  config: null,
  sedes: [],
  servicios: [],
  horarioLocal: [],
  colVip: "",
  reservas: [],
  nav: "agenda",
  agendaFecha: "",
  agendaSede: "",
  agendaModo: "dia",
  periodo: "hoy",
  conocidas: null,
  fichas: new Map(),
  recien: new Map(),
  nuevas: 0,
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
  return nav;
}

function hayCambios() {
  return Boolean(document.querySelector("[data-ajustes-aviso]:not([hidden])"));
}

async function abrir(nav) {
  if (nav !== estado.nav && hayCambios()) {
    const ok = await preguntar("Tienes cambios sin guardar. ¿Salir de esta pantalla?", "Salir", "Quedarme");
    if (!ok) return;
    if (document.querySelector("[data-ajustes-aviso]:not([hidden])")) pintarAjustes();
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
  if (vista === "horario") pintarHorarioLocal();
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
  const [config, sedes, servicios, horarioLocal] = await Promise.all([
    supabase.from("config").select("*").eq("id", 1).limit(1),
    supabase.from("sedes").select("*").order("orden"),
    supabase.from("servicios").select("*").order("orden"),
    supabase.from("horario_local").select("*").order("dia")
  ]);
  if (config.error || sedes.error || servicios.error || horarioLocal.error) {
    throw config.error || sedes.error || servicios.error || horarioLocal.error;
  }
  estado.config = (config.data && config.data[0]) || null;
  estado.sedes = sedes.data || [];
  estado.servicios = servicios.data || [];
  estado.horarioLocal = horarioLocal.data || [];
  const sonda = await supabase.from("servicios").select("destacado").limit(1);
  estado.colVip = sonda.error ? "" : "destacado";
  if (!estado.colVip) {
    const otra = await supabase.from("servicios").select("es_vip").limit(1);
    if (!otra.error) estado.colVip = "es_vip";
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

function reservasEn(fecha) {
  return estado.reservas
    .filter((item) => item.fecha === fecha)
    .sort((a, b) => String(a.hora || "").localeCompare(String(b.hora || "")));
}

function precioDeReserva(reserva) {
  if (reserva && reserva.precio != null && reserva.precio !== "") return formatPrecio(reserva.precio);
  const servicio = estado.servicios.find((item) => item.id === reserva.servicio_id);
  return servicio ? formatPrecio(servicio.precio) : "";
}

function tarjetaCita(reserva) {
  const boton = nodo("button", "bloque estado-" + reserva.estado, "");
  boton.type = "button";
  const precio = precioDeReserva(reserva);
  boton.append(
    nodo("strong", null, horaLegible(reserva.hora) + " · " + reserva.nombre),
    nodo("span", null, nombreServicio(reserva.servicio_id) + (precio ? " · " + precio : ""))
  );
  boton.addEventListener("click", () => abrirCita(reserva));
  return boton;
}

function pintarAgenda() {
  const host = document.querySelector("[data-agenda]");
  if (!host) return;
  const fechaInput = document.querySelector("[data-agenda-fecha]");
  if (!estado.agendaFecha) estado.agendaFecha = hoyISO();
  pintarPuesta();
  if (fechaInput && fechaInput.value !== estado.agendaFecha) fechaInput.value = estado.agendaFecha;
  host.removeAttribute("aria-busy");
  host.replaceChildren();
  host.appendChild(nodo("h2", "solo-impresion", "Agenda del " + fechaLegible(estado.agendaFecha)));
  if (estado.agendaModo === "semana") pintarSemana(host);
  else pintarDia(host);
}

function pintarDia(host) {
  const citas = reservasEn(estado.agendaFecha);
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
    return;
  }
  const lista = nodo("div", "agenda-lista");
  citas.forEach((reserva) => lista.appendChild(tarjetaCita(reserva)));
  host.appendChild(lista);
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
    nodo("p", null, [nombreServicio(reserva.servicio_id), precioDeReserva(reserva)].filter(Boolean).join(" · ")),
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
  const situacion = (document.querySelector("[data-filtro-estado]") || {}).value || "";
  const servicio = (document.querySelector("[data-filtro-servicio]") || {}).value || "";
  return estado.reservas.filter((item) => {
    if (desde && item.fecha < desde) return false;
    if (hasta && item.fecha > hasta) return false;
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
  const servicio = document.querySelector("[data-filtro-servicio]");
  const situacion = document.querySelector("[data-filtro-estado]");
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
      nodo("p", null, [nombreServicio(reserva.servicio_id), precioDeReserva(reserva), formatDuracion(reserva.duracion_min)].filter(Boolean).join(" · ")),
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
  const encabezado = ["numero", "fecha", "hora", "nombre", "celular", "servicio", "precio", "estado"];
  const lineas = [encabezado.join(",")];
  filas.forEach((reserva) => {
    const valores = [reserva.numero, reserva.fecha, reserva.hora, reserva.nombre, digitos(reserva.telefono), nombreServicio(reserva.servicio_id), precioDeReserva(reserva), reserva.estado];
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

function hhmmCorto(valor) {
  const coincidencia = /^(\d{1,2}):(\d{2})/.exec(String(valor || ""));
  if (!coincidencia) return "";
  return String(coincidencia[1]).padStart(2, "0") + ":" + coincidencia[2];
}

function minutosDeHora(valor) {
  const coincidencia = /^(\d{1,2}):(\d{2})/.exec(String(valor || ""));
  if (!coincidencia) return null;
  return Number(coincidencia[1]) * 60 + Number(coincidencia[2]);
}

function toast(texto, bien) {
  const caja = document.querySelector("[data-toast]");
  if (!caja) return;
  caja.hidden = !texto;
  caja.textContent = texto || "";
  caja.classList.toggle("form-error", bien === false);
  caja.classList.toggle("horario-ok", bien !== false);
  window.clearTimeout(toast.timer);
  if (!texto) return;
  toast.timer = window.setTimeout(() => { caja.hidden = true; }, 4200);
}

function fotosGaleria() {
  const lista = ["img/galeria/fachada.webp"];
  for (let i = 1; i <= 20; i += 1) {
    if (i === 15) continue;
    lista.push("img/galeria/foto-" + String(i).padStart(2, "0") + ".webp");
  }
  return lista;
}

function pintarHorarioLocal() {
  const valor = document.querySelector("[data-cap-valor]");
  if (valor) {
    const n = Math.min(50, Math.max(1, Number(estado.config && estado.config.capacidad) || 1));
    valor.textContent = String(n);
  }
  const host = document.querySelector("[data-horario-dias]");
  if (!host) return;
  host.replaceChildren();
  SEMANA.forEach((item) => {
    const fila = (estado.horarioLocal || []).find((dia) => Number(dia.dia) === item.dia) || {
      dia: item.dia,
      abre: "",
      cierra: "",
      descanso_inicio: "",
      descanso_fin: "",
      activo: false
    };
    const card = nodo("article", "horario-dia" + (fila.activo === false ? " is-off" : ""));
    card.dataset.dia = String(item.dia);
    const cabeza = nodo("div", "horario-dia-top");
    cabeza.appendChild(nodo("h3", null, item.nombre));
    const abierto = document.createElement("input");
    abierto.type = "checkbox";
    abierto.checked = fila.activo !== false;
    abierto.setAttribute("aria-label", item.nombre + " abierto");
    const label = nodo("label", "reserva-check casilla");
    label.append(abierto, marcaCasilla(), nodo("span", null, "Abierto"));
    cabeza.appendChild(label);
    const horas = nodo("div", "horario-horas");
    const campo = (nombre, etiqueta, valorHora) => {
      const input = document.createElement("input");
      input.type = "time";
      input.name = nombre;
      input.step = "60";
      input.value = hhmmCorto(valorHora);
      const lab = nodo("label", "campo");
      lab.append(nodo("span", null, etiqueta), input);
      return lab;
    };
    horas.append(
      campo("abre", "Apertura", fila.abre),
      campo("cierra", "Cierre", fila.cierra),
      campo("descanso_inicio", "Descanso desde", fila.descanso_inicio),
      campo("descanso_fin", "Descanso hasta", fila.descanso_fin)
    );
    const quitar = nodo("button", "btn btn-sec", "Quitar descanso");
    quitar.type = "button";
    quitar.addEventListener("click", () => {
      card.querySelector("[name=descanso_inicio]").value = "";
      card.querySelector("[name=descanso_fin]").value = "";
    });
    abierto.addEventListener("change", () => card.classList.toggle("is-off", !abierto.checked));
    card.append(cabeza, horas, quitar);
    host.appendChild(card);
  });
}

function leerDiaLocal(card) {
  const toma = (nombre) => {
    const input = card.querySelector("[name=" + nombre + "]");
    return input && input.value ? input.value : "";
  };
  return {
    dia: Number(card.dataset.dia),
    activo: Boolean(card.querySelector("input[type=checkbox]") && card.querySelector("input[type=checkbox]").checked),
    abre: toma("abre"),
    cierra: toma("cierra"),
    descanso_inicio: toma("descanso_inicio"),
    descanso_fin: toma("descanso_fin")
  };
}

function validarDiaLocal(fila, nombre) {
  const abre = minutosDeHora(fila.abre);
  const cierra = minutosDeHora(fila.cierra);
  if (fila.activo && (abre == null || cierra == null)) return nombre + ": completa apertura y cierre.";
  if (abre != null && cierra != null && cierra <= abre) return nombre + ": el cierre tiene que ser después de la apertura.";
  const tieneInicio = Boolean(fila.descanso_inicio);
  const tieneFin = Boolean(fila.descanso_fin);
  if (tieneInicio !== tieneFin) return nombre + ": el descanso necesita inicio y fin, o ninguno.";
  if (!tieneInicio) return "";
  const ini = minutosDeHora(fila.descanso_inicio);
  const fin = minutosDeHora(fila.descanso_fin);
  if (ini == null || fin == null || fin <= ini) return nombre + ": el descanso termina después de empezar.";
  if (abre != null && cierra != null && (ini < abre || fin > cierra)) return nombre + ": el descanso tiene que quedar dentro del horario.";
  return "";
}

async function guardarCapacidad(delta) {
  const caja = document.querySelector("[data-cap-valor]");
  const actual = Math.min(50, Math.max(1, Number(caja && caja.textContent) || Number(estado.config && estado.config.capacidad) || 1));
  const siguiente = Math.min(50, Math.max(1, actual + delta));
  if (caja) caja.textContent = String(siguiente);
  const { error } = await estado.supabase.from("config").update({ capacidad: siguiente }).eq("id", 1);
  if (error) {
    if (caja) caja.textContent = String(actual);
    toast("No se pudo guardar la capacidad.", false);
    return;
  }
  if (estado.config) estado.config.capacidad = siguiente;
  toast("Capacidad guardada.", true);
}

async function guardarHorarioLocal() {
  const cards = [...document.querySelectorAll("[data-horario-dias] [data-dia]")];
  const filas = cards.map(leerDiaLocal);
  for (const fila of filas) {
    const nombre = (SEMANA.find((item) => item.dia === fila.dia) || {}).nombre || "Día";
    const aviso = validarDiaLocal(fila, nombre);
    if (aviso) {
      toast(aviso, false);
      return;
    }
  }
  for (const fila of filas) {
    const payload = {
      abre: fila.abre || null,
      cierra: fila.cierra || null,
      descanso_inicio: fila.descanso_inicio || null,
      descanso_fin: fila.descanso_fin || null,
      activo: fila.activo
    };
    const { error } = await estado.supabase.from("horario_local").update(payload).eq("dia", fila.dia);
    if (error) {
      toast("No se pudo guardar el horario.", false);
      return;
    }
    const actual = (estado.horarioLocal || []).find((item) => Number(item.dia) === fila.dia);
    if (actual) Object.assign(actual, payload);
    else estado.horarioLocal.push({ dia: fila.dia, ...payload });
  }
  toast("Horario guardado.", true);
}

function formularioServicio() {
  return document.querySelector("[data-servicio-form]");
}

function mostrarFormularioServicio(visible) {
  const modal = document.querySelector("[data-servicio-modal]");
  if (modal) modal.hidden = !visible;
}

function llenarFotosServicio(valor) {
  const select = document.querySelector("[data-servicio-foto]");
  const opciones = [{ valor: "", texto: "Sin foto" }].concat(fotosGaleria().map((ruta) => ({ valor: ruta, texto: ruta.replace("img/galeria/", "") })));
  if (valor && !opciones.some((item) => item.valor === valor)) opciones.push({ valor: valor, texto: valor });
  llenarSelect(select, opciones, valor || "");
  pintarPreviaServicio();
}

function pintarPreviaServicio() {
  const caja = document.querySelector("[data-servicio-previa]");
  const select = document.querySelector("[data-servicio-foto]");
  if (!caja || !select) return;
  const ruta = select.value;
  caja.replaceChildren();
  if (!ruta) {
    caja.hidden = true;
    return;
  }
  const img = document.createElement("img");
  img.src = ruta;
  img.alt = "";
  img.decoding = "async";
  caja.hidden = false;
  caja.appendChild(img);
}

function abrirServicio(servicio) {
  const form = formularioServicio();
  if (!form) return;
  fail("");
  form.reset();
  form.elements.id.value = servicio ? servicio.id : "";
  form.elements.nombre.value = servicio ? servicio.nombre || "" : "";
  form.elements.descripcion.value = servicio ? servicio.descripcion || "" : "";
  form.elements.precio.value = servicio && servicio.precio != null ? servicio.precio : "";
  form.elements.duracion_min.value = servicio ? servicio.duracion_min || 30 : 30;
  if (form.elements.vip) form.elements.vip.checked = esServicioVip(servicio);
  llenarFotosServicio(servicio ? servicio.foto || "" : "");
  const titulo = document.querySelector("[data-servicio-titulo]");
  if (titulo) titulo.textContent = servicio ? "Editar servicio" : "Añadir servicio";
  const borrar = document.querySelector("[data-servicio-eliminar]");
  if (borrar) borrar.hidden = !servicio;
  mostrarFormularioServicio(true);
  if (form.elements.nombre) form.elements.nombre.focus();
}

function cerrarServicio() {
  const form = formularioServicio();
  if (!form) return;
  form.reset();
  form.elements.id.value = "";
  mostrarFormularioServicio(false);
  fail("");
}

async function cambiarActivo(servicio) {
  if (!servicio || servicio.guardando) return;
  const anterior = servicio.activo !== false;
  servicio.guardando = true;
  servicio.activo = !anterior;
  pintarServicios();
  const { error } = await estado.supabase.from("servicios").update({ activo: servicio.activo }).eq("id", servicio.id);
  servicio.guardando = false;
  if (error) {
    servicio.activo = anterior;
    pintarServicios();
    fail("No se pudo actualizar el servicio.");
    const caja = document.querySelector("[data-pa-error]");
    if (caja) caja.scrollIntoView({ block: "nearest" });
    return;
  }
  fail("");
  avisoServicios();
  pintarServicios();
}

function notaServicio(texto) {
  const caja = document.querySelector("[data-servicio-nota]");
  if (!caja) return;
  caja.hidden = !texto;
  caja.textContent = texto || "";
  window.clearTimeout(notaServicio.timer);
  if (!texto) return;
  notaServicio.timer = window.setTimeout(() => {
    caja.hidden = true;
  }, 4000);
}

function gruposServicio() {
  const ordenados = estado.servicios.slice().sort((a, b) => (Number(a.orden) || 0) - (Number(b.orden) || 0));
  const grupos = [];
  ordenados.forEach((servicio) => {
    const nombre = servicio.categoria || "";
    let grupo = grupos.find((item) => item.nombre === nombre);
    if (!grupo) {
      grupo = { nombre, items: [] };
      grupos.push(grupo);
    }
    grupo.items.push(servicio);
  });
  return grupos;
}

async function eliminarServicio(servicio) {
  if (!servicio || servicio.guardando) return;
  const ok = await preguntar("¿Eliminar " + servicio.nombre + "? Esta acción no se puede deshacer", "Eliminar", "Cancelar");
  if (!ok) return;
  const copia = estado.servicios.slice();
  estado.servicios = estado.servicios.filter((item) => item.id !== servicio.id);
  const form = formularioServicio();
  if (form && form.elements.id.value === servicio.id) cerrarServicio();
  pintarServicios();
  notaServicio("Servicio eliminado.");
  const { error } = await estado.supabase.from("servicios").delete().eq("id", servicio.id);
  if (error) {
    estado.servicios = copia;
    pintarServicios();
    notaServicio("");
    const codigo = String(error.code || "");
    const detalle = String(error.message || "") + " " + String(error.details || "");
    if (codigo === "23503" || detalle.includes("23503") || /foreign key/i.test(detalle)) {
      fail("Este servicio tiene reservas. Puedes deshabilitarlo para que no aparezca en la web.");
    } else fail("No se pudo eliminar el servicio.");
    return;
  }
  fail("");
  avisoServicios();
}

function filaServicio(servicio) {
  const activo = servicio.activo !== false;
  const fila = nodo("article", activo ? "servicio-fila" : "servicio-fila is-off");
  if (servicio.foto) {
    const img = document.createElement("img");
    img.className = "servicio-mini";
    img.src = servicio.foto;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.width = 64;
    img.height = 64;
    fila.appendChild(img);
  } else {
    fila.appendChild(nodo("span", "servicio-mini servicio-foto-vacia", ""));
  }
  const cuerpo = nodo("div", "servicio-fila-texto");
  const partes = [formatPrecio(servicio.precio), formatDuracion(servicio.duracion_min)].filter(Boolean);
  if (esServicioVip(servicio)) partes.unshift("VIP");
  cuerpo.append(nodo("p", "servicio-nombre", servicio.nombre), nodo("p", "pa-meta", partes.join(" · ")));
  const acciones = nodo("div", "servicio-acciones");
  const editar = nodo("button", "btn btn-sec", "Editar");
  editar.type = "button";
  editar.disabled = Boolean(servicio.guardando);
  editar.addEventListener("click", () => abrirServicio(servicio));
  const alternar = nodo("button", "btn btn-sec", activo ? "Deshabilitar" : "Habilitar");
  alternar.type = "button";
  alternar.disabled = Boolean(servicio.guardando);
  alternar.addEventListener("click", () => cambiarActivo(servicio));
  acciones.append(editar, alternar);
  fila.append(cuerpo, acciones);
  return fila;
}

function pintarServicios() {
  const host = document.querySelector("[data-servicios]");
  if (!host) return;
  host.replaceChildren();
  const lista = ordenarServicios(estado.servicios);
  if (!lista.length) {
    host.appendChild(nodo("p", "vacio", "Aún no hay servicios."));
    return;
  }
  lista.forEach((servicio) => host.appendChild(filaServicio(servicio)));
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
    ["Ingresos estimados", formatPrecio(resumen.ingresos || 0)],
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
  llenarSelect(form.elements.sede, estado.sedes.map((item) => ({ valor: item.id, texto: item.nombre })));
  const servicios = estado.servicios.filter((item) => item.activo !== false);
  llenarSelect(form.elements.servicio, servicios.map((item) => ({ valor: item.id, texto: item.nombre })));
  form.elements.fecha.value = hoyISO();
  refrescarNueva();
}

async function refrescarNueva() {
  const form = document.querySelector("[data-nueva-form]");
  if (!form) return;
  const servicio = estado.servicios.find((item) => item.id === form.elements.servicio.value);
  const { data } = await estado.supabase.rpc("horas_disponibles", {
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
  document.querySelectorAll("[data-servicio-nuevo]").forEach((boton) => {
    boton.addEventListener("click", () => abrirServicio(null));
  });
  const cancelarServicio = document.querySelector("[data-servicio-cancelar]");
  if (cancelarServicio) cancelarServicio.addEventListener("click", cerrarServicio);
  const agendaSede = document.querySelector("[data-agenda-sede]");
  if (agendaSede) agendaSede.addEventListener("change", (evento) => {
    estado.agendaSede = evento.target.value;
    pintarAgenda();
  });
  document.querySelector("[data-agenda-fecha]").addEventListener("change", (evento) => {
    estado.agendaFecha = evento.target.value;
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
  if (nueva.elements.sede) nueva.elements.sede.addEventListener("change", () => refrescarNueva());
  nueva.elements.servicio.addEventListener("change", () => refrescarNueva());
  nueva.elements.fecha.addEventListener("change", () => refrescarNueva());
  nueva.addEventListener("submit", crearCita);
  ["[data-buscar]", "[data-filtro-desde]", "[data-filtro-hasta]", "[data-filtro-estado]", "[data-filtro-servicio]"].forEach((selector) => {
    const el = document.querySelector(selector);
    if (el) el.addEventListener("input", pintarReservas);
    if (el) el.addEventListener("change", pintarReservas);
  });
  document.querySelector("[data-csv]").addEventListener("click", exportarCsv);
  const localForm = document.querySelector("[data-local-form]");
  if (localForm) localForm.addEventListener("submit", guardarLocal);
  const formServicio = document.querySelector("[data-servicio-form]");
  if (formServicio) formServicio.addEventListener("submit", guardarServicio);
  const guardarHorario = document.querySelector("[data-horario-local-guardar]");
  if (guardarHorario) guardarHorario.addEventListener("click", guardarHorarioLocal);
  const menosCupos = document.querySelector("[data-cap-menos]");
  const masCupos = document.querySelector("[data-cap-mas]");
  if (menosCupos) menosCupos.addEventListener("click", () => guardarCapacidad(-1));
  if (masCupos) masCupos.addEventListener("click", () => guardarCapacidad(1));
  const eliminarServicioBtn = document.querySelector("[data-servicio-eliminar]");
  if (eliminarServicioBtn) eliminarServicioBtn.addEventListener("click", () => {
    const id = (formServicio && formServicio.elements.id.value) || "";
    const servicio = estado.servicios.find((item) => item.id === id);
    if (servicio) eliminarServicio(servicio);
  });
  const fotoServicio = document.querySelector("[data-servicio-foto]");
  if (fotoServicio) fotoServicio.addEventListener("change", pintarPreviaServicio);
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

async function guardarServicio(evento) {
  evento.preventDefault();
  const form = evento.target;
  const precioTexto = String(form.elements.precio.value || "").trim();
  const id = form.elements.id.value;
  const actual = id ? estado.servicios.find((item) => item.id === id) : null;
  const fila = {
    nombre: form.elements.nombre.value.trim(),
    descripcion: form.elements.descripcion.value.trim(),
    precio: Number(precioTexto),
    duracion_min: Number(form.elements.duracion_min.value),
    foto: form.elements.foto.value || null,
    categoria: actual ? actual.categoria : "Cortes",
    cuenta_fidelidad: actual ? actual.cuenta_fidelidad !== false : true,
    orden: actual ? Number(actual.orden) || 0 : estado.servicios.reduce((maximo, item) => Math.max(maximo, Number(item.orden) || 0), 0) + 1,
    activo: actual ? actual.activo !== false : true
  };
  if (estado.colVip) fila[estado.colVip] = Boolean(form.elements.vip && form.elements.vip.checked);
  const errorModal = document.querySelector("[data-servicio-error]");
  const avisar = (mensaje) => {
    if (errorModal) {
      errorModal.hidden = !mensaje;
      errorModal.textContent = mensaje || "";
    }
    return fail(mensaje);
  };
  if (!fila.nombre || !fila.duracion_min) return avisar("Completa nombre y duración.");
  if (!Number.isFinite(fila.precio) || fila.precio < 0) return avisar("El precio no es válido.");
  const consulta = id
    ? estado.supabase.from("servicios").update(fila).eq("id", id).select()
    : estado.supabase.from("servicios").insert(fila).select();
  const { data, error } = await consulta;
  if (error) return avisar("No se pudo guardar el servicio.");
  const avisoVip = !estado.colVip && form.elements.vip && form.elements.vip.checked && !esServicioVip(fila);
  toast(avisoVip ? "Servicio guardado. El destacado usa el nombre SERVICIO VIP." : "Servicio guardado.", true);
  if (id) {
    const actual = estado.servicios.find((item) => item.id === id);
    if (actual) Object.assign(actual, fila);
  } else if (data && data[0]) estado.servicios.push(data[0]);
  avisar("");
  avisoServicios();
  cerrarServicio();
  pintarServicios();
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
    p_servicio: form.elements.servicio.value,
    p_fecha: form.elements.fecha.value,
    p_hora: form.elements.hora.value,
    p_nombre: nombre,
    p_telefono: cel.digitos,
    p_notas: "Autorización verbal",
    p_autoriza: true
  };
  const respuesta = await estado.supabase.rpc("crear_reserva", payload);
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

function pintarPuesta() {
  const host = document.querySelector("[data-puesta]");
  if (!host || !dueno()) return;
  host.replaceChildren();
  host.appendChild(nodo("h2", null, "Puesta en marcha"));
  const probar = nodo("a", "btn", "Probar la reserva");
  probar.href = "index.html#reservar";
  probar.target = "_blank";
  probar.rel = "noopener";
  host.appendChild(probar);
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
  const admins = await supabase.from("admins").select("id, rol, nombre").eq("id", user.id).maybeSingle();
  if (admins.error) {
    const codigo = admins.error.code || admins.error.status || "";
    window.location.replace("admin-login.html?error=permisos&codigo=" + encodeURIComponent(String(codigo)));
    return;
  }
  const fila = Array.isArray(admins.data) ? admins.data[0] : admins.data;
  if (!fila || fila.rol !== "dueno") {
    await supabase.auth.signOut();
    window.location.replace("admin-login.html");
    return;
  }
  estado.rol = fila.rol;
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
