import { negocio, reservasEnLinea } from "./config.js?v=27";

let promesa = null;

export function supabaseListo() {
  return reservasEnLinea();
}

export async function obtenerSupabase() {
  if (!reservasEnLinea()) return null;
  if (!promesa) {
    const caja = negocio.supabase;
    promesa = import("./vendor/supabase.js").then(({ createClient }) => createClient(String(caja.url).trim(), String(caja.key).trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }));
  }
  return promesa;
}
