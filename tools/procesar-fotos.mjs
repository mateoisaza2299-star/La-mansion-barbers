import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(root, "assets/originales");
const destino = path.join(root, "assets/img/fotos");
const manifiesto = path.join(destino, "fotos.json");
const anchosObjetivo = [480, 800, 1200, 1800];
const calidadBase = 76;
const categorias = ["fachada", "interior", "equipo", "corte", "producto", "ambiente", "nosotros"];

const catalogo = {
  "nosotros-1.png": {
    id: "nosotros-1",
    categoria: "nosotros",
    alt: "Un barbero le corta el cabello a un niño pequeño sentado en las piernas de su papá.",
    foco: { x: 0.46, y: 0.34 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 8, derecha: 8, arriba: 0, abajo: 82 }
  },
  "nosotros-2.png": {
    id: "nosotros-2",
    categoria: "nosotros",
    alt: "Un barbero con delantal de herramientas doradas peina con una brocha el cabello de un joven.",
    foco: { x: 0.5, y: 0.36 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 56, derecha: 56, arriba: 8, abajo: 78 }
  },
  "nosotros-3.png": {
    id: "nosotros-3",
    categoria: "nosotros",
    alt: "Un barbero corta con tijeras el cabello de un señor mayor mientras otro hombre observa.",
    foco: { x: 0.48, y: 0.4 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 48, derecha: 48, arriba: 0, abajo: 78 }
  },
  "ambiente-letrero.png": {
    id: "ambiente-letrero",
    categoria: "ambiente",
    alt: "Letrero de neón de La Mansión Barber Shop sobre una pared negra, entre globos rojos, plateados y negros.",
    foco: { x: 0.42, y: 0.62 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 52, derecha: 8, arriba: 0, abajo: 72 }
  },
  "corte-capa.png": {
    id: "corte-capa",
    categoria: "corte",
    alt: "Cliente con capa verde de La Mansión Barber Shop, barba recortada y cabello peinado hacia atrás.",
    foco: { x: 0.4, y: 0.28 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 8, derecha: 8, arriba: 0, abajo: 78 }
  },
  "corte-manchas.png": {
    id: "corte-manchas",
    categoria: "corte",
    alt: "Corte rapado con manchas rosadas y azules sobre cabello decolorado, y lentes oscuros.",
    foco: { x: 0.52, y: 0.38 },
    aptaFondo: false,
    destacada: false,
    margen: null
  },
  "equipo-barberos.png": {
    id: "equipo-barberos",
    categoria: "equipo",
    alt: "Equipo de barberos de La Mansión posando juntos en sillas talladas de la barbería.",
    foco: { x: 0.5, y: 0.4 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 8, derecha: 8, arriba: 0, abajo: 84 }
  }
};

const prefijoDe = (nombre) => {
  const base = nombre.replace(/\.[^.]+$/, "");
  const clave = categorias.find((item) => base === item || base.startsWith(item + "-"));
  return clave || "";
};

const hex = (valor) => Math.max(0, Math.min(255, Math.round(valor))).toString(16).padStart(2, "0");

const colorDe = async (entrada) => {
  const { data } = await sharp(entrada).resize(1, 1, { fit: "cover" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  return "#" + hex(data[0]) + hex(data[1]) + hex(data[2]);
};

const luminancia = (color) => {
  const n = parseInt(color.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
};

const huellaDe = (archivo, extra) => {
  const hash = crypto.createHash("sha256");
  hash.update(fs.readFileSync(archivo));
  hash.update(extra);
  return hash.digest("hex").slice(0, 16);
};

const entero = (valor) => Math.max(0, Math.round(valor));

const recorteDe = (meta, margen) => {
  if (!margen) return null;
  const left = entero(margen.izquierda || 0);
  const top = entero(margen.arriba || 0);
  const width = entero(meta.width - left - (margen.derecha || 0));
  const height = entero(meta.height - top - (margen.abajo || 0));
  if (width < 32 || height < 32 || left + width > meta.width || top + height > meta.height) return null;
  return { left, top, width, height };
};

const anchosPara = (ancho) => {
  const lista = anchosObjetivo.filter((item) => ancho >= item * 0.8);
  if (!lista.length) lista.push(ancho);
  return lista;
};

const escribirAncho = async (entrada, anchoReal, anchoSalida) => {
  let calidad = calidadBase;
  let buffer = null;
  while (calidad >= 40) {
    buffer = await sharp(entrada)
      .resize({ width: anchoSalida, withoutEnlargement: false })
      .webp({ quality: calidad, effort: 5, smartSubsample: true })
      .toBuffer();
    if (anchoSalida !== 800 || buffer.length < 120 * 1024) break;
    calidad -= 6;
  }
  return buffer;
};

const leerPrevio = () => {
  if (!fs.existsSync(manifiesto)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(manifiesto, "utf8"));
    return Array.isArray(data) ? data : [];
  } catch (error) {
    return [];
  }
};

const orientar = (ancho, alto) => {
  if (ancho > alto * 1.08) return "horizontal";
  if (alto > ancho * 1.08) return "vertical";
  return "cuadrada";
};

const procesarUna = async (nombre, previo) => {
  const archivo = path.join(origen, nombre);
  const ficha = catalogo[nombre] || {};
  const categoria = ficha.categoria || prefijoDe(nombre);
  const id = ficha.id || nombre.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const meta = await sharp(archivo).rotate().metadata();
  const recorte = recorteDe(meta, ficha.margen);
  const base = sharp(archivo, { failOn: "none" }).rotate();
  if (recorte) base.extract(recorte);
  const limpio = await base.toBuffer();
  const medida = await sharp(limpio).metadata();
  const extra = JSON.stringify({ recorte, calidadBase, anchosObjetivo });
  const huella = huellaDe(archivo, extra);
  const anchos = anchosPara(medida.width);
  const anterior = previo.find((item) => item.id === id);
  const listas = anchos.every((ancho) => fs.existsSync(path.join(destino, id + "-" + ancho + ".webp")));
  if (!(anterior && anterior.huella === huella && listas)) {
    for (const ancho of anchos) {
      const buffer = await escribirAncho(limpio, medida.width, ancho);
      fs.writeFileSync(path.join(destino, id + "-" + ancho + ".webp"), buffer);
    }
  }
  const variantes = anchos.map((ancho) => {
    const salida = path.join(destino, id + "-" + ancho + ".webp");
    return { ancho, peso: fs.statSync(salida).size };
  });
  const colorMedio = ficha.colorMedio || await colorDe(limpio);
  const horizontal = orientar(medida.width, medida.height) === "horizontal";
  const buena = medida.width >= 1400;
  const tono = ficha.tono || (luminancia(colorMedio) >= 0.45 ? "claro" : "oscuro");
  const apta = ficha.aptaFondo === true && horizontal && buena;
  return {
    id,
    archivo: nombre,
    categoria,
    orientacion: orientar(medida.width, medida.height),
    ancho: medida.width,
    alto: medida.height,
    foco: {
      x: Math.max(0, Math.min(1, Number(ficha.foco && ficha.foco.x) || 0.5)),
      y: Math.max(0, Math.min(1, Number(ficha.foco && ficha.foco.y) || 0.5))
    },
    tono,
    colorMedio,
    alt: ficha.alt || "",
    aptaFondo: apta,
    destacada: !!ficha.destacada,
    variantes,
    huella
  };
};

const oscurecerSocial = async () => {
  const fuente = path.join(origen, "ambiente-letrero.png");
  if (!fs.existsSync(fuente)) return;
  const ficha = catalogo["ambiente-letrero.png"];
  const meta = await sharp(fuente).rotate().metadata();
  const recorte = recorteDe(meta, ficha.margen);
  const logo = await sharp(path.join(root, "assets/logo/logo-512.png")).resize({ height: 70 }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  let calidad = 68;
  let salida = null;
  while (calidad >= 36) {
    let canal = sharp(fuente, { failOn: "none" }).rotate();
    if (recorte) canal = canal.extract(recorte);
    salida = await canal
      .resize(1200, 630, { fit: "cover", position: "attention" })
      .modulate({ brightness: 0.42, saturation: 0.8 })
      .composite([{ input: logo, left: 56, top: 630 - logoMeta.height - 46 }])
      .jpeg({ quality: calidad, mozjpeg: true })
      .toBuffer();
    if (salida.length < 120 * 1024) break;
    calidad -= 6;
  }
  fs.writeFileSync(path.join(root, "assets/og.jpg"), salida);
};

const main = async () => {
  fs.mkdirSync(destino, { recursive: true });
  const previo = leerPrevio();
  const nombres = fs.readdirSync(origen).filter((nombre) => /\.(png|jpe?g|webp|tiff?)$/i.test(nombre)).sort();
  const fotos = [];
  for (const nombre of nombres) fotos.push(await procesarUna(nombre, previo));
  const ids = new Set(fotos.map((item) => item.id));
  for (const archivo of fs.readdirSync(destino)) {
    if (!archivo.endsWith(".webp")) continue;
    const id = archivo.replace(/-\d+\.webp$/, "");
    if (!ids.has(id)) fs.unlinkSync(path.join(destino, archivo));
  }
  fs.writeFileSync(manifiesto, JSON.stringify(fotos, null, 2) + "\n");
  await oscurecerSocial();
  for (const foto of fotos) {
    const pesos = foto.variantes.map((item) => item.ancho + ":" + item.peso).join(" ");
    console.log(foto.id, foto.categoria, foto.orientacion, foto.ancho + "x" + foto.alto, foto.tono, foto.colorMedio, "apta=" + foto.aptaFondo, pesos);
  }
};

main();
