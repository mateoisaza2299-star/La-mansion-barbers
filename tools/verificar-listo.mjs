import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { negocio } from "../js/config.js";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const faltas = [];
const url = String(negocio.supabase && negocio.supabase.url || "").trim();
const key = String(negocio.supabase && negocio.supabase.key || "").trim();

if (!String(negocio.whatsapp || "").trim()) faltas.push("Falta negocio.whatsapp.");
if (!url) faltas.push("Falta negocio.supabase.url.");
if (!key) faltas.push("Falta negocio.supabase.key.");
else if (!key.startsWith("sb_publishable_")) faltas.push("La clave no comienza por sb_publishable_.");
if (negocio.enPreparacion !== false) faltas.push("enPreparacion sigue en true.");

const saltar = new Set(["node_modules", ".git"]);
const extensiones = new Set([".js", ".mjs", ".html", ".css", ".json", ".md", ".webmanifest"]);

function recorrer(directorio) {
  fs.readdirSync(directorio, { withFileTypes: true }).forEach((entrada) => {
    if (saltar.has(entrada.name)) return;
    if (entrada.name === "verificar-listo.mjs") return;
    const ruta = path.join(directorio, entrada.name);
    if (entrada.isDirectory()) {
      recorrer(ruta);
      return;
    }
    if (!extensiones.has(path.extname(entrada.name))) return;
    const texto = fs.readFileSync(ruta, "utf8");
    const relativo = path.relative(raiz, ruta);
    if (texto.includes("service_role")) faltas.push("Aparece service_role en " + relativo + ".");
    const jwt = texto.match(/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/);
    if (jwt) faltas.push("Aparece una clave eyJ en " + relativo + ".");
  });
}

recorrer(raiz);

if (!faltas.length) {
  console.log("Listo para reservas en línea.");
} else {
  faltas.forEach((linea) => console.log(linea));
  process.exitCode = 1;
}
