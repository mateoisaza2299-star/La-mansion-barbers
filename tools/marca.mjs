import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const fuente = path.join(root, "tools/logo-oficial.png");
const hueso = { r: 0xf5, g: 0xf1, b: 0xe8 };
const negro = { r: 0x0a, g: 0x0a, b: 0x0a, alpha: 1 };
const lo = 34;
const hi = 128;

const smooth = (value) => {
  const t = Math.min(1, Math.max(0, value));
  return t * t * (3 - 2 * t);
};

const hex = (r, g, b) => "#" + [r, g, b].map((n) => Math.round(n).toString(16).padStart(2, "0")).join("").toUpperCase();

const extraer = async () => {
  const { data, info } = await sharp(fuente).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const out = Buffer.alloc(width * height * 4);
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * channels;
      const o = (y * width + x) * 4;
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const alpha = Math.round(smooth((lum - lo) / (hi - lo)) * 255);
      out[o] = alpha ? hueso.r : 0;
      out[o + 1] = alpha ? hueso.g : 0;
      out[o + 2] = alpha ? hueso.b : 0;
      out[o + 3] = alpha;
      if (alpha > 18) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }
  const pad = 18;
  const left = Math.max(0, minX - pad);
  const top = Math.max(0, minY - pad);
  const cropW = Math.min(width - left, maxX - minX + 1 + pad * 2);
  const cropH = Math.min(height - top, maxY - minY + 1 + pad * 2);
  return sharp(out, { raw: { width, height, channels: 4 } })
    .extract({ left, top, width: cropW, height: cropH })
    .png()
    .toBuffer();
};

const medir = async (png) => {
  const { data, info } = await sharp(png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const bins = new Map();
  let ink = 0;
  let fringe = 0;
  let dark = 0;
  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 8) continue;
    ink += 1;
    if (a < 250) fringe += 1;
    const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
    if (lum < 80) dark += 1;
    const key = hex(data[i], data[i + 1], data[i + 2]);
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  const top = [...bins.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  return { ink, fringe, dark, width: info.width, height: info.height, top };
};

const aAncho = async (png, width) => {
  const resized = await sharp(png).resize({ width }).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data, info } = resized;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) {
      data[i] = 0;
      data[i + 1] = 0;
      data[i + 2] = 0;
    } else {
      data[i] = hueso.r;
      data[i + 1] = hueso.g;
      data[i + 2] = hueso.b;
    }
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
};

const icono = async (logo, size) => {
  const margen = Math.round(size * 0.14);
  const marca = await sharp(logo)
    .resize({ width: size - margen * 2, height: size - margen * 2, fit: "inside" })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: negro }
  }).composite([{ input: marca, gravity: "center" }]).png().toBuffer();
};

const ico = (images) => {
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);
  let offset = 6 + count * 16;
  const entries = images.map((image) => {
    const entry = Buffer.alloc(16);
    const dim = image.size >= 256 ? 0 : image.size;
    entry.writeUInt8(dim, 0);
    entry.writeUInt8(dim, 1);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(image.png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += image.png.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images.map((image) => image.png)]);
};

const run = async () => {
  const logo = await extraer();
  const meta = await sharp(logo).metadata();
  const dir = path.join(root, "assets/logo");
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, "assets/icons"), { recursive: true });
  const sizes = [256, 512, 1024];
  const hechos = {};
  for (const size of sizes) {
    const png = await aAncho(logo, size);
    const pngPath = path.join(dir, "logo-" + size + ".png");
    const webpPath = path.join(dir, "logo-" + size + ".webp");
    await sharp(png).png().toFile(pngPath);
    await sharp(png).webp({ lossless: true }).toFile(webpPath);
    hechos[size] = await sharp(pngPath).metadata();
  }
  const base1024 = await aAncho(logo, 1024);
  const png32 = await icono(base1024, 32);
  const png16 = await icono(base1024, 16);
  const png48 = await icono(base1024, 48);
  const png180 = await icono(base1024, 180);
  const png192 = await icono(base1024, 192);
  const png512 = await icono(base1024, 512);
  const maskable = await icono(base1024, 512);
  await sharp(png32).toFile(path.join(root, "assets/favicon-32.png"));
  await sharp(png180).toFile(path.join(root, "assets/icons/apple-touch-icon.png"));
  await sharp(png192).toFile(path.join(root, "assets/icons/icon-192.png"));
  await sharp(png512).toFile(path.join(root, "assets/icons/icon-512.png"));
  await sharp(maskable).toFile(path.join(root, "assets/icons/icon-maskable-512.png"));
  fs.writeFileSync(path.join(root, "assets/favicon.ico"), ico([
    { size: 16, png: png16 },
    { size: 32, png: png32 },
    { size: 48, png: png48 }
  ]));

  const marco = 860;
  const logoOg = await sharp(base1024).resize({ width: marco, height: 420, fit: "inside" }).png().toBuffer();
  const viñeta = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
    <defs>
      <radialGradient id="v" cx="50%" cy="48%" r="62%">
        <stop offset="0%" stop-color="#C9A24B" stop-opacity="0.20"/>
        <stop offset="42%" stop-color="#8A6A22" stop-opacity="0.10"/>
        <stop offset="100%" stop-color="#0A0A0A" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="1200" height="630" fill="#0A0A0A"/>
    <rect width="1200" height="630" fill="url(#v)"/>
  </svg>`);
  const jpg = path.join(root, "assets/og.jpg");
  await sharp(viñeta).composite([{ input: logoOg, gravity: "center" }]).jpeg({ quality: 72, mozjpeg: true }).toFile(jpg);
  if (fs.statSync(jpg).size > 120 * 1024) {
    await sharp(jpg).jpeg({ quality: 58, mozjpeg: true }).toFile(jpg + ".tmp");
    fs.renameSync(jpg + ".tmp", jpg);
  }

  const medida = await medir(base1024);
  console.log(JSON.stringify({
    recorte: { width: meta.width, height: meta.height },
    archivos: hechos,
    medida,
    og: fs.statSync(jpg).size
  }, null, 2));
};

run();
