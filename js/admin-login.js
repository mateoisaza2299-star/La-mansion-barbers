import { reservasEnLinea } from "./config.js";
import { obtenerAdmin } from "./admin-cliente.js";

const form = document.querySelector("[data-login]");
const errorBox = document.querySelector("[data-login-error]");
const submit = document.querySelector("[data-login-submit]");

const fail = (mensaje) => {
  if (!errorBox) return;
  errorBox.hidden = !mensaje;
  errorBox.textContent = mensaje || "";
};

const listo = async (supabase) => {
  const { data, error } = await supabase.from("admins").select("rol").limit(1);
  return !error && Array.isArray(data) && data.length > 0;
};

const gate = async (supabase) => {
  const { data } = await supabase.auth.getSession();
  const session = data && data.session;
  if (session && await listo(supabase)) {
    window.location.replace("admin.html");
    return;
  }
  document.documentElement.dataset.panelReady = "1";
  document.documentElement.classList.remove("is-preparacion");
};

if (form) {
  form.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    fail("");
    const datos = new FormData(form);
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Entrando…";
    }
    const supabase = await obtenerAdmin();
    if (!supabase) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Entrar";
      }
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: String(datos.get("email") || "").trim(),
      password: String(datos.get("password") || "")
    });
    if (error) {
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Entrar";
      }
      fail("Correo o contraseña incorrectos.");
      return;
    }
    if (!(await listo(supabase))) {
      await supabase.auth.signOut();
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Entrar";
      }
      fail("Esta cuenta no tiene acceso al panel.");
      return;
    }
    window.location.replace("admin.html");
  });
}

const boot = async () => {
  if (!reservasEnLinea()) {
    document.documentElement.classList.add("is-preparacion");
    return;
  }
  const supabase = await obtenerAdmin();
  if (!supabase) {
    document.documentElement.classList.add("is-preparacion");
    return;
  }
  gate(supabase);
};

boot();
