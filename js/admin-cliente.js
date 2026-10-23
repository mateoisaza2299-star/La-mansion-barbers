import { negocio, reservasEnLinea } from "./config.js";

let cliente = null;

const almacenamiento = () => {
  const memoria = window.sessionStorage;
  return {
    getItem: (clave) => memoria.getItem(clave),
    setItem: (clave, valor) => memoria.setItem(clave, valor),
    removeItem: (clave) => memoria.removeItem(clave)
  };
};

export async function obtenerAdmin() {
  if (!reservasEnLinea()) return null;
  if (!cliente) {
    const { createClient } = await import("./vendor/supabase.js");
    const caja = negocio.supabase;
    cliente = createClient(String(caja.url).trim(), String(caja.key).trim(), {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        storage: almacenamiento(),
        storageKey: "lamansion-admin-auth"
      }
    });
  }
  return cliente;
}
