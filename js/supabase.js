import { negocio, reservasEnLinea } from "./config.js";

let cliente = null;

export function supabaseListo() {
  return reservasEnLinea();
}

export async function obtenerSupabase() {
  if (!reservasEnLinea()) return null;
  if (!cliente) {
    const { createClient } = await import("./vendor/supabase.js");
    const caja = negocio.supabase;
    cliente = createClient(String(caja.url).trim(), String(caja.key).trim(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  }
  return cliente;
}
