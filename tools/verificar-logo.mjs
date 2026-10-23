import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const paginas = fs.readdirSync(root).filter((nombre) => nombre.endsWith(".html"));
const css = fs.readdirSync(path.join(root, "css")).filter((nombre) => nombre.endsWith(".css"));
const fondos = [];

for (const nombre of css) {
  const texto = fs.readFileSync(path.join(root, "css", nombre), "utf8");
  const reglas = texto.match(/url\(([^)]+)\)/gi) || [];
  reglas.forEach((regla) => {
    if (/logo/i.test(regla)) fondos.push(nombre + " " + regla);
  });
}

let fallo = false;
for (const nombre of paginas) {
  const html = fs.readFileSync(path.join(root, nombre), "utf8");
  const imagenes = [...html.matchAll(/<img\b[^>]*>/gi)].filter((item) => /logo/i.test(item[0]));
  const cajas = [...html.matchAll(/style=(["'])([\s\S]*?)\1/gi)].filter((item) => /url\([^)]*logo/i.test(item[2]));
  const total = imagenes.length + cajas.length + fondos.length;
  console.log(nombre + ": " + total + " (img " + imagenes.length + ", fondos " + (cajas.length + fondos.length) + ")");
  if (total > 2) fallo = true;
}

if (fallo) process.exitCode = 1;
