import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(root, "assets/originales");
const destino = path.join(root, "assets/img/nosotros");
const anchos = [480, 800, 1200];
const calidad = 78;
const ratio = 4 / 5;

const fotos = [
  {
    archivo: "01-primera-vez.png",
    salida: "01",
    margen: { izquierda: 18, derecha: 8, arriba: 0, abajo: 52 },
    foco: "attention"
  },
  {
    archivo: "02-detalle.png",
    salida: "02",
    margen: { izquierda: 50, derecha: 50, arriba: 8, abajo: 40 },
    foco: { y: 0.28 }
  },
  {
    archivo: "03-oficio.png",
    salida: "03",
    margen: { izquierda: 8, derecha: 36, arriba: 0, abajo: 40 },
    foco: "attention"
  }
];

const limitar = (valor, min, max) => Math.max(min, Math.min(max, valor));

const rectangulo = (meta, foto) => {
  const margen = foto.margen;
  const left0 = margen.izquierda;
  const top0 = margen.arriba;
  const width0 = meta.width - margen.izquierda - margen.derecha;
  const height0 = meta.height - margen.arriba - margen.abajo;
  if (foto.foco === "attention") {
    return { left: left0, top: top0, width: width0, height: height0, attention: true };
  }
  const y = Number(foto.foco && foto.foco.y);
  const x = Number(foto.foco && foto.foco.x);
  let left = left0;
  let top = top0;
  let width = width0;
  let height = height0;
  if (width0 / height0 > ratio) {
    width = Math.round(height0 * ratio);
    const extra = width0 - width;
    const focoX = Number.isFinite(x) ? x : 0.5;
    left = left0 + Math.round(extra * focoX);
  } else {
    height = Math.round(width0 / ratio);
    const extra = height0 - height;
    const focoY = Number.isFinite(y) ? y : 0.5;
    top = top0 + Math.round(extra * focoY);
  }
  left = limitar(left, left0, left0 + width0 - width);
  top = limitar(top, top0, top0 + height0 - height);
  return { left, top, width, height, attention: false };
};

const escribir = async (archivo, foto) => {
  const meta = await sharp(archivo).metadata();
  const rect = rectangulo(meta, foto);
  for (const ancho of anchos) {
    const alto = Math.round(ancho / ratio);
    let pipeline = sharp(archivo, { failOn: "none" }).rotate().extract({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    });
    pipeline = pipeline.resize({
      width: ancho,
      height: alto,
      fit: "cover",
      position: rect.attention ? sharp.strategy.attention : "centre"
    });
    const salida = path.join(destino, foto.salida + "-" + ancho + ".webp");
    await pipeline.webp({ quality: calidad, effort: 6, smartSubsample: true }).toFile(salida);
    const info = await sharp(salida).metadata();
    const peso = fs.statSync(salida).size;
    if (info.exif || info.xmp || info.iptc || info.tifftagPhotoshop) {
      throw new Error(path.basename(salida) + " conserva metadatos");
    }
    if (info.width !== ancho || info.height !== alto) {
      throw new Error(path.basename(salida) + " mide " + info.width + "x" + info.height);
    }
    if (ancho === 800 && peso > 120 * 1024) {
      throw new Error(path.basename(salida) + " pesa " + peso + " bytes");
    }
    console.log(path.basename(salida), info.width + "x" + info.height, peso + " B");
  }
};

fs.mkdirSync(destino, { recursive: true });
for (const foto of fotos) {
  await escribir(path.join(origen, foto.archivo), foto);
}
