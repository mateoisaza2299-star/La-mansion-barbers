import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifiesto = path.join(root, "assets/img/fotos/fotos.json");
const destino = path.join(root, "assets/img/fotos");
const categorias = new Set(["fachada", "interior", "equipo", "corte", "producto", "ambiente", "nosotros"]);

const fotos = fs.existsSync(manifiesto) ? JSON.parse(fs.readFileSync(manifiesto, "utf8")) : [];
const avisos = [];
const ids = new Map();
const archivos = new Map();

if (!Array.isArray(fotos) || !fotos.length) avisos.push("No hay fotos en assets/img/fotos/fotos.json");

for (const foto of fotos) {
  if (!foto.alt || String(foto.alt).trim().length < 12) avisos.push(foto.id + ": sin alt");
  if (!categorias.has(foto.categoria)) avisos.push(foto.id + ": sin categoría");
  if (ids.has(foto.id)) avisos.push(foto.id + ": id duplicado");
  ids.set(foto.id, true);
  if (archivos.has(foto.archivo)) avisos.push(foto.archivo + ": archivo duplicado");
  archivos.set(foto.archivo, true);
  for (const variante of foto.variantes || []) {
    const ruta = path.join(destino, foto.id + "-" + variante.ancho + ".webp");
    if (!fs.existsSync(ruta)) {
      avisos.push(foto.id + ": falta " + path.basename(ruta));
      continue;
    }
    const peso = fs.statSync(ruta).size;
    if (variante.ancho === 800 && peso >= 120 * 1024) avisos.push(foto.id + ": la versión de 800 px pesa " + peso + " bytes");
    if (peso >= 450 * 1024) avisos.push(foto.id + ": " + variante.ancho + " px muy pesada (" + peso + " bytes)");
  }
}

if (!avisos.length) {
  console.log("Fotos en orden: " + fotos.length);
} else {
  avisos.forEach((aviso) => console.log(aviso));
  process.exitCode = 1;
}
