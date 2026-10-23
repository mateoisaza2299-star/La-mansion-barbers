import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const origen = path.join(root, "assets/originales");
const destino = path.join(root, "assets/img/fotos");
const manifiesto = path.join(destino, "fotos.json");
const anchosObjetivo = [480, 800, 1200, 1800, 2400];
const calidadBase = 76;
const categorias = ["fachada", "interior", "equipo", "corte", "producto", "ambiente", "nosotros"];

const catalogo = {
  "nosotros-1": {
    id: "nosotros-1",
    categoria: "nosotros",
    alt: "Un barbero le corta el cabello a un niño pequeño sentado en las piernas de su papá.",
    foco: { x: 0.46, y: 0.34 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 8, derecha: 8, arriba: 0, abajo: 82 }
  },
  "nosotros-2": {
    id: "nosotros-2",
    categoria: "nosotros",
    alt: "Un barbero con delantal de herramientas doradas peina con una brocha el cabello de un niño.",
    foco: { x: 0.5, y: 0.36 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 56, derecha: 56, arriba: 8, abajo: 78 }
  },
  "nosotros-3": {
    id: "nosotros-3",
    categoria: "nosotros",
    alt: "Un barbero corta con tijeras el cabello de un señor mayor mientras otro hombre observa.",
    foco: { x: 0.48, y: 0.4 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 48, derecha: 48, arriba: 0, abajo: 78 }
  },
  "ambiente-letrero": {
    id: "ambiente-letrero",
    categoria: "ambiente",
    alt: "Letrero de neón de La Mansión Barber Shop sobre una pared negra, entre globos rojos, plateados y negros.",
    foco: { x: 0.42, y: 0.62 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 52, derecha: 8, arriba: 0, abajo: 72 }
  },
  "corte-capa": {
    id: "corte-capa",
    categoria: "corte",
    alt: "Cliente con capa verde de La Mansión Barber Shop, barba recortada y cabello peinado hacia atrás.",
    foco: { x: 0.4, y: 0.28 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 8, derecha: 8, arriba: 0, abajo: 78 }
  },
  "corte-manchas": {
    id: "corte-manchas",
    categoria: "corte",
    alt: "Corte rapado con manchas rosadas y azules sobre cabello decolorado, y lentes oscuros.",
    foco: { x: 0.52, y: 0.38 },
    aptaFondo: false,
    destacada: false,
    borrosa: true,
    margen: null
  },
  "corte-facial": {
    id: "corte-facial",
    categoria: "corte",
    alt: "Un barbero con guantes azules sostiene el rostro de un cliente durante un cuidado de barba.",
    foco: { x: 0.46, y: 0.46 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 0, derecha: 36, arriba: 0, abajo: 0 }
  },
  "corte-spray": {
    id: "corte-spray",
    categoria: "corte",
    alt: "Un barbero aplica un producto en aerosol sobre la barba de un cliente recostado.",
    foco: { x: 0.5, y: 0.46 },
    aptaFondo: false,
    destacada: false,
    margen: { izquierda: 40, derecha: 0, arriba: 0, abajo: 48 }
  },
  "corte-barba": {
    id: "corte-barba",
    categoria: "corte",
    alt: "Detalle de un arreglo de barba con peine negro de La Mansión y máquina de corte.",
    foco: { x: 0.58, y: 0.08 },
    aptaFondo: false,
    destacada: true,
    margen: { izquierda: 0, derecha: 36, arriba: 0, abajo: 0 }
  },
  "interior-sala": {
    id: "interior-sala",
    categoria: "interior",
    alt: "Interior de La Mansión Barber Shop, con espejos de madera, sillas y un barbero atendiendo a un cliente.",
    foco: { x: 0.5, y: 0.46 },
    aptaFondo: false,
    destacada: true,
    borrosa: true,
    margen: null
  },
  "equipo-barberos": {
    id: "equipo-barberos",
    categoria: "equipo",
    alt: "Equipo de barberos de La Mansión posando juntos en sillas talladas de la barbería.",
    foco: { x: 0.5, y: 0.42 },
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

const fichaDe = (nombre) => {
  const id = nombre.replace(/\.[^.]+$/, "");
  if (catalogo[id]) return catalogo[id];
  if (catalogo[nombre]) return catalogo[nombre];
  return {};
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

const huellaDe = (buffer, extra) => {
  const hash = crypto.createHash("sha256");
  hash.update(buffer);
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
  const lista = anchosObjetivo.filter((item) => ancho >= item);
  if (!lista.length) lista.push(ancho);
  return lista;
};

const topeDe = (anchoSalida) => {
  if (anchoSalida === 800) return 120 * 1024;
  if (anchoSalida === 1800) return 350 * 1024;
  return Infinity;
};

const escribirAncho = async (entrada, anchoSalida) => {
  let calidad = calidadBase;
  let buffer = null;
  const tope = topeDe(anchoSalida);
  while (calidad >= 40) {
    buffer = await sharp(entrada)
      .resize({ width: anchoSalida, withoutEnlargement: true })
      .webp({ quality: calidad, effort: 5, smartSubsample: true })
      .toBuffer();
    if (buffer.length < tope) break;
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
  if (ancho >= alto * 1.3) return "horizontal";
  if (alto >= ancho * 1.3) return "vertical";
  return "cuadrada";
};

const calidadDe = (ancho, alto, ficha) => {
  if (ficha.borrosa) return "baja";
  const lado = Math.max(ancho, alto);
  if (lado >= 1600) return "alta";
  if (lado >= 1000) return "media";
  return "baja";
};

const leerEntrada = async (archivo) => {
  const ext = path.extname(archivo).toLowerCase();
  const buffer = fs.readFileSync(archivo);
  if (ext !== ".heic" && ext !== ".heif") return buffer;
  try {
    const mod = await import("heic-convert");
    const convertir = mod.default || mod;
    const salida = await convertir({ buffer, format: "JPEG", quality: 1 });
    return Buffer.from(salida);
  } catch (error) {
    return buffer;
  }
};

const yaLimpio = async (archivo) => {
  if (path.extname(archivo).toLowerCase() !== ".jpg") return false;
  const meta = await sharp(archivo, { failOn: "none" }).metadata();
  if (meta.exif || meta.icc || meta.xmp || meta.iptc) return false;
  if ((meta.width || 0) > 2400 || (meta.height || 0) > 2400) return false;
  if (meta.orientation && meta.orientation !== 1) return false;
  return true;
};

const normalizar = async (archivo, ficha) => {
  const id = ficha.id || path.basename(archivo).replace(/\.[^.]+$/, "");
  const destinoJpg = path.join(origen, id + ".jpg");
  if (await yaLimpio(archivo)) {
    return { buffer: fs.readFileSync(archivo), nombre: path.basename(archivo) };
  }
  const entrada = await leerEntrada(archivo);
  const medida = await sharp(entrada, { failOn: "none" }).rotate().metadata();
  const recorte = recorteDe(medida, ficha.margen);
  let canal = sharp(entrada, { failOn: "none" }).rotate();
  if (recorte) canal = canal.extract(recorte);
  const buffer = await canal
    .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
  const comprobacion = await sharp(buffer).metadata();
  if (comprobacion.exif || comprobacion.icc || comprobacion.xmp) throw new Error("Metadatos sin eliminar en " + id);
  fs.writeFileSync(destinoJpg, buffer);
  if (path.resolve(archivo) !== path.resolve(destinoJpg) && fs.existsSync(archivo)) fs.unlinkSync(archivo);
  return { buffer, nombre: id + ".jpg" };
};

const procesarUna = async (nombre, previo) => {
  const archivo = path.join(origen, nombre);
  const ficha = fichaDe(nombre);
  const categoria = ficha.categoria || prefijoDe(nombre);
  const id = ficha.id || nombre.replace(/\.[^.]+$/, "").toLowerCase().replace(/[^a-z0-9-]+/g, "-");
  const normal = await normalizar(archivo, { ...ficha, id });
  const medida = await sharp(normal.buffer).metadata();
  const extra = JSON.stringify({ calidadBase, anchosObjetivo, v: 3 });
  const huella = huellaDe(normal.buffer, extra);
  const anchos = anchosPara(medida.width);
  const anterior = previo.find((item) => item.id === id);
  const listas = anchos.every((ancho) => fs.existsSync(path.join(destino, id + "-" + ancho + ".webp")));
  if (!(anterior && anterior.huella === huella && listas)) {
    for (const ancho of anchos) {
      const buffer = await escribirAncho(normal.buffer, ancho);
      fs.writeFileSync(path.join(destino, id + "-" + ancho + ".webp"), buffer);
    }
  }
  const esperados = new Set(anchos.map((ancho) => id + "-" + ancho + ".webp"));
  for (const archivoWebp of fs.readdirSync(destino)) {
    if (!archivoWebp.startsWith(id + "-") || !archivoWebp.endsWith(".webp")) continue;
    if (!esperados.has(archivoWebp)) fs.unlinkSync(path.join(destino, archivoWebp));
  }
  const variantes = anchos.map((ancho) => {
    const salida = path.join(destino, id + "-" + ancho + ".webp");
    return { ancho, peso: fs.statSync(salida).size };
  });
  const colorMedio = ficha.colorMedio || await colorDe(normal.buffer);
  const calidad = calidadDe(medida.width, medida.height, ficha);
  const proporcion = medida.height ? medida.width / medida.height : 0;
  const horizontal = proporcion >= 1.3;
  const verticalClara = medida.height > medida.width && calidad === "alta";
  const apta = ficha.aptaFondo === true && (calidad === "alta" || calidad === "media") && (horizontal || verticalClara);
  const tono = ficha.tono || (luminancia(colorMedio) >= 0.45 ? "claro" : "oscuro");
  return {
    id,
    archivo: normal.nombre,
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
    calidad,
    alt: ficha.alt || "",
    aptaFondo: apta,
    destacada: !!ficha.destacada,
    variantes,
    huella
  };
};

const oscurecerSocial = async () => {
  const fuenteNombre = fs.readdirSync(origen).find((nombre) => /^ambiente-letrero\./i.test(nombre));
  if (!fuenteNombre) return;
  const fuente = path.join(origen, fuenteNombre);
  const logo = await sharp(path.join(root, "assets/logo/logo-512.png")).resize({ height: 70 }).png().toBuffer();
  const logoMeta = await sharp(logo).metadata();
  let calidad = 68;
  let salida = null;
  while (calidad >= 36) {
    salida = await sharp(fuente, { failOn: "none" })
      .rotate()
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
  fs.mkdirSync(origen, { recursive: true });
  fs.mkdirSync(destino, { recursive: true });
  const previo = leerPrevio();
  const nombres = fs.readdirSync(origen).filter((nombre) => /\.(png|jpe?g|webp|tiff?|heic|heif)$/i.test(nombre)).sort();
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
    console.log(foto.id, foto.categoria, foto.orientacion, foto.calidad, foto.ancho + "x" + foto.alto, foto.tono, foto.colorMedio, "apta=" + foto.aptaFondo, pesos);
  }
};

main();
