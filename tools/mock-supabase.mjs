import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { hoyISO, sumarDias, diaSemanaISO, aMinutos, aHora, minutosAhora, instanteBogota, fechaEvento } from "../js/tiempo.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const clavePublica = "sb_publishable_mock_local_test";

const id = {
  sede1: "11111111-1111-4111-8111-111111111111",
  ana: "33333333-3333-4333-8333-333333333333",
  luis: "44444444-4444-4444-8444-444444444444",
  corte: "66666666-6666-4666-8666-666666666666",
  barba: "77777777-7777-4777-8777-777777777777",
  nino: "88888888-8888-4888-8888-888888888888",
  degradado: "12121212-1212-4121-8121-121212121212",
  combo: "13131313-1313-4131-8131-131313131313",
  completa: "14141414-1414-4141-8141-141414141414",
  mujer: "15151515-1515-4151-8151-151515151515",
  dueno: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  barbero: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  sinpermiso: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  sinconfirma: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  fallopermiso: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  tablano: "f1f1f1f1-f1f1-41f1-81f1-f1f1f1f1f1f1"
};

const usuarios = {
  "dueno@lamansion.test": { id: id.dueno, password: "ClaveDueno123", rol: "dueno", barberoId: null },
  "barbero@lamansion.test": { id: id.barbero, password: "ClaveBarbero123", rol: "barbero", barberoId: id.ana },
  "sinpermiso@lamansion.test": { id: id.sinpermiso, password: "ClaveSin123", rol: "dueno", barberoId: null },
  "sinconfirma@lamansion.test": { id: id.sinconfirma, password: "ClaveNo123", rol: "dueno", barberoId: null, confirmado: false },
  "fallopermiso@lamansion.test": { id: id.fallopermiso, password: "ClaveFallo123", rol: "dueno", barberoId: null, falloAdmins: "42501" },
  "tablano@lamansion.test": { id: id.tablano, password: "ClaveTabla123", rol: "dueno", barberoId: null, falloAdmins: "42P01" }
};

function crearEstado() {
  const hoy = hoyISO();
  const config = {
    id: 1,
    reservas_activas: true,
    paso_min: 30,
    anticipacion_min: 60,
    dias_max: 21,
    cancelar_min: 120,
    fidelidad_activa: true,
    fidelidad_meta: 8,
    politica_version: "1"
  };
  const sedes = [
    { id: id.sede1, nombre: "La Mansión", direccion: "Vía Funza - Siberia, Km 3.8, La Isla, Ceuta", telefono: "3118162854", orden: 1, activa: true }
  ];
  const baseServicio = (extra) => ({ descripcion: "", precio: null, duracion_min: 30, cuenta_fidelidad: false, activo: true, ...extra });
  const servicios = [
    baseServicio({ id: id.corte, categoria: "Cortes", nombre: "Corte clásico", descripcion: "Tijera o máquina, con el acabado que pidas.", duracion_min: 45, cuenta_fidelidad: true, orden: 1 }),
    baseServicio({ id: id.degradado, categoria: "Cortes", nombre: "Degradado", descripcion: "Transición limpia.", orden: 2 }),
    baseServicio({ id: id.combo, categoria: "Cortes", nombre: "Corte y barba", descripcion: "Corte y arreglo en la misma visita.", duracion_min: 60, orden: 3 }),
    baseServicio({ id: id.barba, categoria: "Barba", nombre: "Arreglo de barba", descripcion: "Perfil, forma y definición.", orden: 4 }),
    baseServicio({ id: id.completa, categoria: "Barba", nombre: "Barba completa", descripcion: "Diseño de toda la barba.", orden: 5 }),
    baseServicio({ id: id.nino, categoria: "FreeStyle y diseños", nombre: "Diseños", descripcion: "Líneas, figuras y freestyle sobre el corte.", orden: 6 }),
    baseServicio({ id: id.mujer, categoria: "Cuidado facial", nombre: "Cuidado facial", descripcion: "Limpieza y cuidado de la piel del rostro.", orden: 7 })
  ];
  const barberos = [
    { id: id.ana, nombre: "Ana Rojas", especialidad: "Cortes y barba", sede_id: id.sede1, foto: "", servicios: null, orden: 1, activo: true },
    { id: id.luis, nombre: "Luis Gómez", especialidad: "Degradados", sede_id: id.sede1, foto: "", servicios: [id.corte], orden: 2, activo: true }
  ];
  const horarios = [];
  barberos.forEach((barbero) => {
    for (let dia = 1; dia <= 6; dia += 1) {
      const martesAna = dia === 2 && barbero.id === id.ana;
      horarios.push({ id: crypto.randomUUID(), barbero_id: barbero.id, dia, abre: martesAna ? "9:00:00" : "09:00", cierra: martesAna ? "13:00:00" : "13:00" });
      horarios.push({ id: crypto.randomUUID(), barbero_id: barbero.id, dia, abre: martesAna ? "14:00:00" : "14:00", cierra: "19:00" });
    }
  });
  const reservas = [];
  const manana = sumarDias(hoy, 1);
  const base = (extra) => ({
    token: crypto.randomUUID(),
    sede_id: id.sede1,
    servicio_id: id.corte,
    precio: 25000,
    duracion_min: 45,
    notas: "",
    avisado: false,
    gratis: false,
    creado: new Date().toISOString(),
    ...extra
  });
  reservas.push(base({ id: crypto.randomUUID(), numero: "LM-1001", barbero_id: id.ana, fecha: hoy, hora: "10:00", nombre: "Cliente Ana Uno", telefono: "3101111111", estado: "pendiente" }));
  reservas.push(base({ id: crypto.randomUUID(), numero: "LM-1002", barbero_id: id.ana, fecha: hoy, hora: "11:00", nombre: "Cliente Ana Dos", telefono: "3101111112", estado: "confirmada", avisado: true }));
  reservas.push(base({ id: crypto.randomUUID(), numero: "LM-1003", barbero_id: id.luis, sede_id: id.sede1, fecha: manana, hora: "10:00", nombre: "Cliente Luis", telefono: "3101111113", estado: "confirmada" }));
  reservas.push(base({ id: crypto.randomUUID(), numero: "LM-1004", barbero_id: id.ana, fecha: hoy, hora: "15:00", nombre: "Cliente Ana Aviso", telefono: "3101111114", estado: "pendiente" }));
  reservas.push(base({ id: crypto.randomUUID(), numero: "LM-1005", barbero_id: id.ana, fecha: hoy, hora: "16:00", nombre: "Cliente Fiel", telefono: "3001234567", estado: "pendiente" }));
  for (let i = 0; i < 8; i += 1) {
    reservas.push(base({
      id: crypto.randomUUID(),
      numero: "LM-90" + String(i).padStart(2, "0"),
      barbero_id: id.ana,
      fecha: sumarDias(hoy, -(i + 3)),
      hora: "10:00",
      nombre: "Cliente Fiel",
      telefono: "3001234567",
      estado: "completada"
    }));
  }
  return {
    config,
    sedes,
    servicios,
    barberos,
    horarios,
    reservas,
    bloqueos: [],
    eventos: [],
    admins: [
      { id: id.dueno, rol: "dueno", barbero_id: null, nombre: "Dueño" },
      { id: id.barbero, rol: "barbero", barbero_id: id.ana, nombre: "Ana Rojas" }
    ],
    secuencia: 1100
  };
}

function tablasDe(estado) {
  return {
    config: [estado.config],
    sedes: estado.sedes,
    servicios: estado.servicios,
    barberos: estado.barberos,
    horarios: estado.horarios,
    reservas: estado.reservas,
    bloqueos: estado.bloqueos,
    eventos: estado.eventos,
    admins: estado.admins
  };
}

function sesionDe(token) {
  if (!token) return { rol: "anon" };
  const prefijos = ["mock.user.", "mock.dueno.", "mock.barbero."];
  const prefijo = prefijos.find((item) => token.startsWith(item));
  if (!prefijo) return { rol: "anon" };
  const userId = token.slice(prefijo.length);
  const usuario = Object.values(usuarios).find((item) => item.id === userId);
  if (!usuario) return { rol: "anon" };
  return { rol: usuario.rol || "auth", userId, barberoId: usuario.barberoId || null, falloAdmins: usuario.falloAdmins || "" };
}

function tokenDe(req) {
  const auth = String(req.headers.authorization || "");
  const bearer = auth.replace(/^Bearer\s+/i, "").trim();
  if (!bearer || bearer === clavePublica) return "";
  return bearer;
}

function leerCuerpo(req) {
  return new Promise((resolve, reject) => {
    const trozos = [];
    req.on("data", (parte) => trozos.push(parte));
    req.on("end", () => {
      const texto = Buffer.concat(trozos).toString("utf8");
      if (!texto) return resolve(null);
      try {
        resolve(JSON.parse(texto));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function enviar(res, codigo, data) {
  const cuerpo = data == null ? "" : JSON.stringify(data);
  res.writeHead(codigo, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "access-control-allow-origin": "*"
  });
  res.end(cuerpo);
}

function fallo(res, codigo, message) {
  enviar(res, codigo, { message, code: codigo >= 400 ? "P0001" : "ok" });
}

function authError(res, codigo, mensaje, codigoError) {
  enviar(res, codigo, {
    error: codigoError,
    error_code: codigoError,
    code: codigoError,
    msg: mensaje,
    message: mensaje,
    error_description: mensaje
  });
}

function usuarioJson(usuario) {
  const ahora = new Date().toISOString();
  return {
    id: usuario.id,
    aud: "authenticated",
    role: "authenticated",
    email: Object.keys(usuarios).find((correo) => usuarios[correo].id === usuario.id) || "",
    email_confirmed_at: ahora,
    phone: "",
    confirmed_at: ahora,
    last_sign_in_at: ahora,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    identities: [],
    created_at: ahora,
    updated_at: ahora,
    is_anonymous: false
  };
}

function emitirSesion(usuario) {
  return {
    access_token: "mock.user." + usuario.id,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    refresh_token: "mock.refresh." + usuario.id,
    user: usuarioJson(usuario)
  };
}

function coincide(fila, clave, expr) {
  const valor = fila[clave];
  const corte = expr.indexOf(".");
  if (corte < 1) return true;
  const op = expr.slice(0, corte);
  let esperado = expr.slice(corte + 1);
  if (op === "is") {
    if (esperado === "null") return valor == null;
    if (esperado === "true") return valor === true;
    if (esperado === "false") return valor === false;
    return false;
  }
  if (op === "in") {
    const lista = esperado.replace(/^\(/, "").replace(/\)$/, "").split(",").filter(Boolean);
    return lista.includes(String(valor));
  }
  if (esperado === "true") esperado = true;
  else if (esperado === "false") esperado = false;
  else if (esperado === "null") esperado = null;
  const izquierda = valor == null ? "" : String(valor);
  const derecha = esperado == null ? "" : String(esperado);
  const numerico = izquierda !== "" && derecha !== "" && !Number.isNaN(Number(izquierda)) && !Number.isNaN(Number(derecha)) && !/^\d{4}-\d{2}-\d{2}/.test(izquierda);
  const a = numerico ? Number(izquierda) : izquierda;
  const b = numerico ? Number(derecha) : derecha;
  if (op === "eq") return izquierda === derecha || (numerico && a === b);
  if (op === "neq") return izquierda !== derecha;
  if (op === "gt") return a > b;
  if (op === "gte") return a >= b;
  if (op === "lt") return a < b;
  if (op === "lte") return a <= b;
  return true;
}

function filtrar(filas, url, sesion, tabla) {
  let lista = filas.slice();
  if (tabla === "admins" && sesion.rol !== "anon" && !url.searchParams.has("id")) {
    lista = lista.filter((fila) => fila.id === sesion.userId);
  }
  if (sesion.rol === "barbero" && tabla === "reservas") lista = lista.filter((fila) => fila.barbero_id === sesion.barberoId);
  if (sesion.rol === "barbero" && tabla === "horarios") lista = lista.filter((fila) => fila.barbero_id === sesion.barberoId);
  if (sesion.rol === "barbero" && tabla === "bloqueos") {
    lista = lista.filter((fila) => fila.barbero_id === sesion.barberoId || !fila.barbero_id);
  }
  for (const [clave, valor] of url.searchParams.entries()) {
    if (["select", "order", "limit", "offset", "on_conflict"].includes(clave)) continue;
    lista = lista.filter((fila) => coincide(fila, clave, valor));
  }
  const orden = url.searchParams.get("order");
  if (orden) {
    const reglas = orden.split(",").map((parte) => {
      const [columna, direccion] = parte.split(".");
      return { columna, direccion: direccion === "desc" ? -1 : 1 };
    });
    lista.sort((a, b) => {
      for (const regla of reglas) {
        const va = a[regla.columna];
        const vb = b[regla.columna];
        if (va === vb) continue;
        if (va == null) return 1;
        if (vb == null) return -1;
        if (va > vb) return regla.direccion;
        if (va < vb) return -regla.direccion;
      }
      return 0;
    });
  }
  const limite = Number(url.searchParams.get("limit"));
  if (limite > 0) lista = lista.slice(0, limite);
  return lista;
}

function ofrece(barbero, servicioId) {
  if (!barbero || barbero.activo === false) return false;
  if (barbero.servicios == null) return true;
  return Array.isArray(barbero.servicios) && barbero.servicios.includes(servicioId);
}

function solapa(inicio, duracion, otroInicio, otraDuracion) {
  const a = aMinutos(inicio);
  const b = a + duracion;
  const c = aMinutos(otroInicio);
  const d = c + otraDuracion;
  return a < d && c < b;
}

function bloqueado(estado, barbero, fecha, hora, duracion) {
  return estado.bloqueos.some((bloqueo) => {
    if (bloqueo.fecha !== fecha) return false;
    const deBarbero = bloqueo.barbero_id && bloqueo.barbero_id === barbero.id;
    const deSede = !bloqueo.barbero_id && bloqueo.sede_id === barbero.sede_id;
    if (!deBarbero && !deSede) return false;
    if (bloqueo.todo_dia) return true;
    return solapa(hora, duracion, bloqueo.desde || "00:00", Math.max(1, aMinutos(bloqueo.hasta || "00:00") - aMinutos(bloqueo.desde || "00:00")));
  });
}

function ocupado(estado, barberoId, fecha, hora, duracion, ignorarId) {
  return estado.reservas.some((reserva) => {
    if (reserva.id === ignorarId) return false;
    if (reserva.barbero_id !== barberoId || reserva.fecha !== fecha) return false;
    if (reserva.estado !== "pendiente" && reserva.estado !== "confirmada") return false;
    return solapa(hora, duracion, reserva.hora, Number(reserva.duracion_min) || duracion);
  });
}

function horasDe(estado, barberoId, fecha, duracion) {
  const barbero = estado.barberos.find((item) => item.id === barberoId);
  if (!barbero || barbero.activo === false) return [];
  const crudo = diaSemanaISO(fecha);
  const dia = crudo === 0 ? 7 : crudo;
  const rangos = estado.horarios.filter((item) => {
    const guardado = Number(item.dia);
    return item.barbero_id === barberoId && (guardado === dia || (dia === 7 && guardado === 0));
  });
  const paso = Number(estado.config.paso_min) || 30;
  const minutos = Number(duracion) || 30;
  const hoy = hoyISO();
  const ahora = minutosAhora() + (Number(estado.config.anticipacion_min) || 0);
  const slots = [];
  rangos.forEach((rango) => {
    let cursor = aMinutos(rango.abre);
    const fin = aMinutos(rango.cierra);
    while (cursor + minutos <= fin) {
      const hora = aHora(cursor);
      const pasado = fecha < hoy || (fecha === hoy && cursor < ahora);
      if (!pasado && !ocupado(estado, barberoId, fecha, hora, minutos) && !bloqueado(estado, barbero, fecha, hora, minutos)) {
        slots.push(hora);
      }
      cursor += paso;
    }
  });
  return slots;
}

function puedeCancelar(estado, reserva) {
  if (!reserva) return false;
  if (reserva.estado !== "pendiente" && reserva.estado !== "confirmada") return false;
  const cuando = instanteBogota(reserva.fecha, reserva.hora);
  const plazo = Number(estado.config.cancelar_min) || 0;
  return cuando - Date.now() >= plazo * 60000;
}

function filaPublica(estado, reserva) {
  const servicio = estado.servicios.find((item) => item.id === reserva.servicio_id);
  const barbero = estado.barberos.find((item) => item.id === reserva.barbero_id);
  const sede = estado.sedes.find((item) => item.id === (barbero && barbero.sede_id));
  return {
    numero: reserva.numero,
    estado: reserva.estado,
    fecha: reserva.fecha,
    hora: String(reserva.hora).slice(0, 5),
    servicio: servicio ? servicio.nombre : "",
    precio: reserva.precio,
    duracion_min: reserva.duracion_min,
    gratis: Boolean(reserva.gratis),
    barbero: barbero ? barbero.nombre : "",
    sede: sede ? sede.nombre : "",
    direccion: sede ? sede.direccion : "",
    nombre: reserva.nombre,
    puede_cancelar: puedeCancelar(estado, reserva)
  };
}

function fidelidadDe(estado, telefono) {
  const meta = Number(estado.config.fidelidad_meta) || 8;
  if (!estado.config.fidelidad_activa) return { activa: false, meta, progreso: 0, gratis_disponible: false };
  const cuentan = new Set(estado.servicios.filter((item) => item.cuenta_fidelidad).map((item) => item.id));
  const mismos = estado.reservas.filter((item) => item.telefono === telefono);
  const sellos = mismos.filter((item) => item.estado === "completada" && cuentan.has(item.servicio_id) && !item.gratis).length;
  const usados = mismos.filter((item) => item.gratis && item.estado !== "cancelada").length;
  const ganados = Math.floor(sellos / meta);
  const disponible = ganados > usados;
  return { activa: true, meta, progreso: disponible ? meta : sellos % meta, gratis_disponible: disponible };
}

function resumenDe(estado, desde, hasta, sesion) {
  const dentro = (fecha) => fecha >= desde && fecha <= hasta;
  let reservas = estado.reservas.filter((item) => dentro(item.fecha));
  if (sesion.rol === "barbero") reservas = reservas.filter((item) => item.barbero_id === sesion.barberoId);
  const contar = (estadoReserva) => reservas.filter((item) => item.estado === estadoReserva).length;
  const ingresos = reservas.filter((item) => item.estado === "completada" && !item.gratis).reduce((suma, item) => suma + (Number(item.precio) || 0), 0);
  const porClave = (lista, clave, nombreDe) => {
    const mapa = new Map();
    lista.forEach((item) => {
      if (item.estado === "cancelada") return;
      const idClave = item[clave];
      const actual = mapa.get(idClave) || { nombre: nombreDe(idClave), total: 0 };
      actual.total += 1;
      mapa.set(idClave, actual);
    });
    return [...mapa.values()];
  };
  const porDiaMapa = new Map();
  const porHoraMapa = new Map();
  reservas.forEach((item) => {
    if (item.estado === "cancelada") return;
    porDiaMapa.set(item.fecha, (porDiaMapa.get(item.fecha) || 0) + 1);
    const hora = String(item.hora).slice(0, 2);
    porHoraMapa.set(hora, (porHoraMapa.get(hora) || 0) + 1);
  });
  const eventos = estado.eventos.filter((item) => dentro(fechaEvento(item.creado)));
  return {
    reservas: reservas.length,
    canceladas: contar("cancelada"),
    no_asistio: contar("no_asistio"),
    completadas: contar("completada"),
    ingresos,
    por_barbero: porClave(reservas, "barbero_id", (valor) => {
      const barbero = estado.barberos.find((item) => item.id === valor);
      return barbero ? barbero.nombre : "";
    }),
    por_servicio: porClave(reservas, "servicio_id", (valor) => {
      const servicio = estado.servicios.find((item) => item.id === valor);
      return servicio ? servicio.nombre : "";
    }),
    por_dia: [...porDiaMapa.entries()].map(([fecha, total]) => ({ fecha, total })).sort((a, b) => a.fecha.localeCompare(b.fecha)),
    por_hora: [...porHoraMapa.entries()].map(([hora, total]) => ({ hora, total })).sort((a, b) => a.hora.localeCompare(b.hora)),
    visitas: eventos.filter((item) => item.tipo === "visita").length,
    clics_whatsapp: eventos.filter((item) => item.tipo === "clic_whatsapp").length
  };
}

function crearReserva(estado, body) {
  if (!estado.config.reservas_activas) return { error: "reservas cerradas" };
  const nombre = String(body.p_nombre || "").replace(/\s+/g, " ").trim();
  if (nombre.length < 2) return { error: "nombre invalido" };
  let telefono = String(body.p_telefono || "").replace(/\D/g, "");
  if (telefono.startsWith("57") && telefono.length === 12) telefono = telefono.slice(2);
  if (!(telefono.length === 10 && telefono.startsWith("3"))) return { error: "celular invalido" };
  if (body.p_autoriza !== true) return { error: "falta autorizacion" };
  const servicio = estado.servicios.find((item) => item.id === body.p_servicio && item.activo);
  if (!servicio) return { error: "servicio no disponible" };
  const barbero = estado.barberos.find((item) => item.id === body.p_barbero && item.activo);
  if (!barbero || !ofrece(barbero, servicio.id)) return { error: "barbero no disponible" };
  const fecha = String(body.p_fecha || "");
  const hora = String(body.p_hora || "").slice(0, 5);
  const activas = estado.reservas.filter((item) => item.telefono === telefono && (item.estado === "pendiente" || item.estado === "confirmada") && item.fecha >= hoyISO());
  if (activas.length >= 3) return { error: "limite de citas" };
  const libres = horasDe(estado, barbero.id, fecha, servicio.duracion_min);
  if (!libres.includes(hora)) return { error: "horario no disponible" };
  const notas = String(body.p_notas || "").slice(0, 200);
  const reserva = {
    id: crypto.randomUUID(),
    token: crypto.randomUUID(),
    numero: "LM-" + estado.secuencia,
    barbero_id: barbero.id,
    servicio_id: servicio.id,
    sede_id: barbero.sede_id,
    fecha,
    hora,
    nombre,
    telefono,
    notas,
    estado: "pendiente",
    avisado: false,
    gratis: false,
    precio: servicio.precio,
    duracion_min: servicio.duracion_min,
    creado: new Date().toISOString()
  };
  estado.secuencia += 1;
  estado.reservas.push(reserva);
  return { data: { token: reserva.token, numero: reserva.numero } };
}

function rpc(estado, nombre, body, sesion) {
  if (nombre === "horas_disponibles") {
    return { data: horasDe(estado, body.p_barbero, body.p_fecha, body.p_duracion).map((slot) => ({ slot })) };
  }
  if (nombre === "crear_reserva") return crearReserva(estado, body || {});
  if (nombre === "estado_reserva") {
    const reserva = estado.reservas.find((item) => item.token === body.p_token);
    if (!reserva) return { error: "cita no encontrada" };
    return { data: filaPublica(estado, reserva) };
  }
  if (nombre === "cancelar_reserva" || nombre === "reagendar_reserva") {
    const reserva = estado.reservas.find((item) => item.token === body.p_token);
    if (!reserva) return { error: "cita no encontrada" };
    if (reserva.estado !== "pendiente" && reserva.estado !== "confirmada") return { error: "cita no cancelable" };
    if (!puedeCancelar(estado, reserva)) return { error: "fuera de plazo" };
    if (nombre === "cancelar_reserva") {
      reserva.estado = "cancelada";
      return { data: true };
    }
    const fecha = String(body.p_fecha || "");
    const hora = String(body.p_hora || "").slice(0, 5);
    const libres = horasDe(estado, reserva.barbero_id, fecha, reserva.duracion_min).concat(
      reserva.fecha === fecha && String(reserva.hora).slice(0, 5) === hora ? [hora] : []
    );
    const sigueLibre = horasDe(estado, reserva.barbero_id, fecha, reserva.duracion_min).includes(hora) || (reserva.fecha === fecha && String(reserva.hora).slice(0, 5) === hora);
    if (!sigueLibre && !libres.includes(hora)) return { error: "horario no disponible" };
    if (!horasDe(estado, reserva.barbero_id, fecha, reserva.duracion_min).includes(hora) && !(reserva.fecha === fecha && String(reserva.hora).slice(0, 5) === hora)) {
      return { error: "horario no disponible" };
    }
    reserva.fecha = fecha;
    reserva.hora = hora;
    return { data: true };
  }
  if (nombre === "mi_fidelidad") {
    let telefono = String(body.p_telefono || "").replace(/\D/g, "");
    if (telefono.startsWith("57") && telefono.length === 12) telefono = telefono.slice(2);
    return { data: fidelidadDe(estado, telefono) };
  }
  if (nombre === "registrar_evento") {
    const permitidos = ["visita", "clic_whatsapp", "clic_llamar", "clic_mapa", "reserva_iniciada"];
    if (!permitidos.includes(body.p_tipo)) return { error: "evento invalido" };
    estado.eventos.push({ id: crypto.randomUUID(), tipo: body.p_tipo, creado: new Date().toISOString() });
    return { data: true };
  }
  if (nombre === "panel_resumen") {
    if (sesion.rol === "anon") return { error: "no autorizado", codigo: 401 };
    return { data: resumenDe(estado, String(body.p_desde || ""), String(body.p_hasta || ""), sesion) };
  }
  if (nombre === "aplicar_gratis") {
    if (sesion.rol === "anon") return { error: "no autorizado", codigo: 401 };
    const reserva = estado.reservas.find((item) => item.id === body.p_reserva);
    if (!reserva) return { error: "cita no encontrada" };
    if (sesion.rol === "barbero" && reserva.barbero_id !== sesion.barberoId) return { error: "no autorizado", codigo: 401 };
    const ficha = fidelidadDe(estado, reserva.telefono);
    if (!ficha.gratis_disponible) return { error: "sin corte gratis" };
    reserva.gratis = true;
    return { data: true };
  }
  return { error: "rpc desconocida", codigo: 404 };
}

function puedeEscribir(sesion, tabla, fila) {
  if (sesion.rol === "anon") return false;
  if (sesion.rol === "dueno") return true;
  if (tabla === "horarios" || tabla === "bloqueos" || tabla === "reservas") return Boolean(fila && fila.barbero_id === sesion.barberoId);
  return false;
}

async function api(req, res, estado, url) {
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS"
    });
    res.end();
    return;
  }
  const sesion = sesionDe(tokenDe(req));
  if (url.pathname === "/auth/v1/token") {
    const body = await leerCuerpo(req);
    const tipo = url.searchParams.get("grant_type");
    if (tipo === "refresh_token") {
      const usuario = Object.values(usuarios).find((item) => "mock.refresh." + item.id === (body && body.refresh_token));
      if (!usuario) return fallo(res, 401, "invalid_grant");
      return enviar(res, 200, emitirSesion(usuario));
    }
    const usuario = usuarios[String(body && body.email || "").trim().toLowerCase()];
    if (!usuario || !body || body.password !== usuario.password) return authError(res, 400, "Invalid login credentials", "invalid_credentials");
    if (usuario.confirmado === false) return authError(res, 400, "Email not confirmed", "email_not_confirmed");
    return enviar(res, 200, emitirSesion(usuario));
  }
  if (url.pathname === "/auth/v1/user") {
    const usuario = Object.values(usuarios).find((item) => item.id === sesion.userId);
    if (!usuario) return fallo(res, 401, "no autorizado");
    return enviar(res, 200, usuarioJson(usuario));
  }
  if (url.pathname === "/auth/v1/logout") return enviar(res, 204, null);
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const nombre = decodeURIComponent(url.pathname.slice("/rest/v1/rpc/".length));
    const body = await leerCuerpo(req);
    const resultado = rpc(estado, nombre, body || {}, sesion);
    if (resultado.error) return fallo(res, resultado.codigo || 400, resultado.error);
    return enviar(res, 200, resultado.data);
  }
  if (url.pathname.startsWith("/rest/v1/")) {
    const tabla = decodeURIComponent(url.pathname.slice("/rest/v1/".length));
    const mapa = tablasDe(estado);
    if (!mapa[tabla]) return fallo(res, 404, "tabla desconocida");
    const publicas = new Set(["config", "sedes", "barberos", "servicios", "horarios"]);
    if (sesion.rol === "anon" && !publicas.has(tabla)) return fallo(res, 401, "no autorizado");
    if (req.method === "GET" && tabla === "admins" && sesion.falloAdmins) {
      const codigo = sesion.falloAdmins;
      return enviar(res, codigo === "42P01" ? 404 : 401, { code: codigo, message: codigo === "42P01" ? "relation does not exist" : "permission denied" });
    }
    if (req.method === "GET") return enviar(res, 200, filtrar(mapa[tabla], url, sesion, tabla));
    const body = await leerCuerpo(req);
    if (req.method === "POST") {
      const entradas = Array.isArray(body) ? body : [body];
      if (entradas.some((item) => !puedeEscribir(sesion, tabla, item))) return fallo(res, 401, "no autorizado");
      const creadas = entradas.map((item) => {
        const fila = { ...item, id: item.id || crypto.randomUUID() };
        mapa[tabla].push(fila);
        return fila;
      });
      return enviar(res, 201, creadas);
    }
    if (req.method === "PATCH") {
      const actuales = filtrar(mapa[tabla], url, sesion, tabla);
      if (sesion.rol !== "dueno" && !actuales.every((fila) => puedeEscribir(sesion, tabla, fila))) return fallo(res, 401, "no autorizado");
      if (sesion.rol === "barbero" && (tabla === "sedes" || tabla === "servicios" || tabla === "barberos" || tabla === "config")) {
        return fallo(res, 401, "no autorizado");
      }
      actuales.forEach((fila) => Object.assign(fila, body || {}));
      return enviar(res, 200, actuales);
    }
    if (req.method === "DELETE") {
      const actuales = filtrar(mapa[tabla], url, sesion, tabla);
      if (!actuales.every((fila) => puedeEscribir(sesion, tabla, fila))) return fallo(res, 401, "no autorizado");
      const ids = new Set(actuales.map((fila) => fila.id));
      const lista = mapa[tabla];
      for (let i = lista.length - 1; i >= 0; i -= 1) {
        if (ids.has(lista[i].id)) lista.splice(i, 1);
      }
      return enviar(res, 200, actuales);
    }
  }
  return fallo(res, 404, "no encontrado");
}

const tipos = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".svg": "image/svg+xml"
};

function servirArchivo(req, res) {
  const url = new URL(req.url, "http://127.0.0.1");
  let relativo = decodeURIComponent(url.pathname);
  if (relativo === "/") relativo = "/index.html";
  const destino = path.resolve(raiz, "." + relativo);
  if (!destino.startsWith(raiz + path.sep) && destino !== raiz) {
    res.writeHead(403);
    res.end();
    return;
  }
  if (!fs.existsSync(destino) || fs.statSync(destino).isDirectory()) {
    res.writeHead(404);
    res.end();
    return;
  }
  if (destino.endsWith(path.join("js", "config.js"))) {
    const cookie = String(req.headers.cookie || "");
    const tiene = (nombre) => cookie.split(";").some((parte) => parte.trim() === nombre);
    if (tiene("lm_activo=1") || tiene("lm_preparacion=1")) {
      const origen = "http://127.0.0.1:" + req.socket.localPort;
      let texto = fs.readFileSync(destino, "utf8");
      if (tiene("lm_preparacion=1")) {
        texto = texto.replace(/enPreparacion:\s*(true|false)/, "enPreparacion: true");
        texto = texto.replace(/supabase:\s*\{[^}]*\}/, 'supabase: { url: "", key: "" }');
      } else {
        texto = texto.replace(/enPreparacion:\s*(true|false)/, "enPreparacion: false");
        texto = texto.replace(/supabase:\s*\{[^}]*\}/, "supabase: { url: " + JSON.stringify(origen) + ", key: " + JSON.stringify(clavePublica) + " }");
      }
      res.writeHead(200, { "content-type": tipos[".js"], "cache-control": "no-store" });
      res.end(texto);
      return;
    }
  }
  res.writeHead(200, { "content-type": tipos[path.extname(destino)] || "application/octet-stream", "cache-control": "no-store" });
  fs.createReadStream(destino).pipe(res);
}

export function iniciar(puerto = 0) {
  let estado = crearEstado();
  const servidor = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname === "/__reset" && req.method === "POST") {
        estado = crearEstado();
        enviar(res, 200, { ok: true });
        return;
      }
      if (url.pathname.startsWith("/rest/v1") || url.pathname.startsWith("/auth/v1")) {
        await api(req, res, estado, url);
        return;
      }
      servirArchivo(req, res);
    } catch (error) {
      fallo(res, 500, "error interno");
    }
  });
  return new Promise((resolve) => {
    servidor.listen(puerto, "127.0.0.1", () => resolve({ servidor, estado }));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const puerto = Number(process.env.PORT || 4173);
  iniciar(puerto).then(({ servidor }) => {
    process.stdout.write("mock " + servidor.address().port + "\n");
  });
}
