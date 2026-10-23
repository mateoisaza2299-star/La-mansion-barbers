import { negocio } from "./config.js";

const credenciales = () => {
  const caja = negocio.supabase || {};
  const url = String(caja.url || "").trim();
  const key = String(caja.key || "").trim();
  return url && key ? { url, key } : null;
};

let cliente = null;

export function supabaseListo() {
  return Boolean(credenciales());
}

export async function obtenerSupabase() {
  const datos = credenciales();
  if (!datos) return null;
  if (!cliente) {
    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
    cliente = createClient(datos.url, datos.key);
  }
  return cliente;
}
