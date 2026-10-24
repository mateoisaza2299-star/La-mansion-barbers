import { reservasEnLinea } from "./config.js";
import { obtenerAdmin } from "./admin-cliente.js";

const form = document.querySelector("[data-login]");
const errorBox = document.querySelector("[data-login-error]");
const codigoBox = document.querySelector("[data-login-codigo]");
const reintentar = document.querySelector("[data-login-reintentar]");
const submit = document.querySelector("[data-login-submit]");

let modo = "";

const fail = (mensaje, codigo) => {
  if (errorBox) {
    errorBox.hidden = !mensaje;
    errorBox.textContent = mensaje || "";
  }
  if (codigoBox) {
    codigoBox.hidden = !codigo;
    codigoBox.textContent = codigo || "";
  }
  if (reintentar) reintentar.hidden = modo !== "permisos" && modo !== "red";
};

const esRed = (error) => {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  const mensaje = String(error && error.message || "");
  const status = Number(error && error.status);
  return status === 0 || /failed to fetch|networkerror|fetcherror|load failed/i.test(mensaje);
};

const clasificarAuth = (error) => {
  if (esRed(error)) return "red";
  const mensaje = String(error && error.message || "");
  const codigo = String(error && (error.code || error.error_code) || "");
  if (/email not confirmed/i.test(mensaje) || codigo === "email_not_confirmed") return "confirmar";
  return "credenciales";
};

const mostrar = (tipo, codigo) => {
  modo = tipo;
  if (tipo === "credenciales") fail("Correo o contraseña incorrectos.");
  else if (tipo === "confirmar") fail("Debes confirmar tu correo.");
  else if (tipo === "sinfila") fail("Tu cuenta existe, pero todavía no tiene permisos para este panel. Pídele al dueño que te agregue.");
  else if (tipo === "permisos") fail("No pudimos verificar tus permisos.", codigo || "");
  else if (tipo === "red") fail("No pudimos conectar. Revisa tu internet e inténtalo de nuevo.");
  else fail("");
};

const restaurar = () => {
  if (!submit) return;
  submit.disabled = false;
  submit.textContent = "Entrar";
};

const filaDe = (data) => (Array.isArray(data) ? data[0] : data);

const verificar = async (supabase) => {
  const sesion = await supabase.auth.getSession();
  const user = sesion.data && sesion.data.session && sesion.data.session.user;
  if (!user) return { tipo: "credenciales" };
  const consulta = await supabase.from("admins").select("id, rol, barbero_id, nombre").eq("id", user.id).maybeSingle();
  if (consulta.error) {
    if (esRed(consulta.error)) return { tipo: "red" };
    return { tipo: "permisos", codigo: consulta.error.code || String(consulta.error.status || "") };
  }
  const fila = filaDe(consulta.data);
  if (!fila || (fila.rol !== "dueno" && fila.rol !== "barbero")) return { tipo: "sinfila" };
  return { tipo: "ok", fila };
};

const entrar = async (supabase) => {
  const resultado = await verificar(supabase);
  if (resultado.tipo === "ok") {
    window.location.replace("admin.html");
    return;
  }
  if (resultado.tipo === "sinfila") {
    await supabase.auth.signOut();
  }
  mostrar(resultado.tipo, resultado.codigo);
  restaurar();
};

const gate = async (supabase) => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("error") === "permisos") mostrar("permisos", params.get("codigo") || "");
  const { data } = await supabase.auth.getSession();
  if (!(data && data.session)) {
    document.documentElement.dataset.panelReady = "1";
    document.documentElement.classList.remove("is-preparacion");
    return;
  }
  if (params.get("error") === "permisos") {
    document.documentElement.dataset.panelReady = "1";
    document.documentElement.classList.remove("is-preparacion");
    return;
  }
  await entrar(supabase);
};

if (form) {
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    modo = "";
    fail("");
    const datos = new FormData(form);
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Entrando…";
    }
    let supabase = null;
    try {
      supabase = await obtenerAdmin();
    } catch (error) {
      mostrar("red");
      restaurar();
      return;
    }
    if (!supabase) {
      mostrar(navigator.onLine === false ? "red" : "credenciales");
      restaurar();
      return;
    }
    let acceso = null;
    try {
      acceso = await supabase.auth.signInWithPassword({
        email: String(datos.get("email") || "").trim(),
        password: String(datos.get("password") || "")
      });
    } catch (error) {
      mostrar("red");
      restaurar();
      return;
    }
    if (acceso.error) {
      mostrar(clasificarAuth(acceso.error));
      restaurar();
      return;
    }
    await entrar(supabase);
  });
}

if (reintentar) {
  reintentar.addEventListener("click", async () => {
    const supabase = await obtenerAdmin();
    if (!supabase) {
      mostrar("red");
      return;
    }
    if (modo === "red") {
      if (form) form.requestSubmit();
      return;
    }
    await entrar(supabase);
  });
}

const verClave = document.querySelector("[data-ver-clave]");
if (verClave && form) {
  verClave.addEventListener("click", () => {
    const campo = form.querySelector('input[name="password"]');
    if (!campo) return;
    const visible = campo.type === "password";
    campo.type = visible ? "text" : "password";
    verClave.setAttribute("aria-pressed", visible ? "true" : "false");
    verClave.setAttribute("aria-label", visible ? "Ocultar contraseña" : "Mostrar contraseña");
    verClave.textContent = visible ? "Ocultar" : "Mostrar";
  });
}

const boot = async () => {
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
  gate(supabase);
};

boot();
