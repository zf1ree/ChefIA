// Gera os ícones do app (chapéu de chef + brilho) sem dependências externas.
// Uso: node scripts/generate-icons.js
/* global Buffer, __dirname */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const GREEN = [0x1e, 0x8e, 0x5a];
const DARK = [0x0f, 0x51, 0x36];
const WHITE = [0xff, 0xff, 0xff];
const TOMATO = [0xe8, 0x55, 0x3a];

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = table[(crc ^ b) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}

function writePng(file, size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const SS = 3; // supersampling
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++)
        for (let sx = 0; sx < SS; sx++) {
          const [pr, pg, pb, pa] = pixel((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += pr * pa; g += pg * pa; b += pb * pa; a += pa;
        }
      const o = y * (size * 4 + 1) + 1 + x * 4;
      const n = SS * SS;
      raw[o] = a ? Math.round(r / a) : 0;
      raw[o + 1] = a ? Math.round(g / a) : 0;
      raw[o + 2] = a ? Math.round(b / a) : 0;
      raw[o + 3] = Math.round((a / n) * 255);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
  fs.writeFileSync(file, png);
  console.log('ok', path.relative(process.cwd(), file), `${size}x${size}`);
}

const inCircle = (x, y, cx, cy, r) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/** Chapéu de chef em coordenadas normalizadas, escala s centrada em (0.5, 0.5). */
function hat(x, y, s = 1) {
  const u = (x - 0.5) / s + 0.5;
  const v = (y - 0.5) / s + 0.5;
  const puff =
    inCircle(u, v, 0.33, 0.42, 0.14) || inCircle(u, v, 0.5, 0.34, 0.17) || inCircle(u, v, 0.67, 0.42, 0.14) ||
    inRoundRect(u, v, 0.3, 0.42, 0.7, 0.62, 0.02);
  const band = inRoundRect(u, v, 0.3, 0.64, 0.7, 0.74, 0.03);
  return puff || band;
}
function spark(x, y, s = 1) {
  const u = (x - 0.5) / s + 0.5;
  const v = (y - 0.5) / s + 0.5;
  return inCircle(u, v, 0.72, 0.27, 0.075);
}

const out = path.join(__dirname, '..', 'assets', 'images');

// Ícone principal (iOS aplica a máscara de cantos).
writePng(path.join(out, 'icon.png'), 1024, (x, y) => {
  if (spark(x, y, 0.95)) return [...TOMATO, 1];
  if (hat(x, y, 0.95)) return [...WHITE, 1];
  return [...GREEN, 1];
});

// Android adaptativo: só o símbolo, dentro da zona segura (~66%).
writePng(path.join(out, 'android-icon-foreground.png'), 1024, (x, y) => {
  if (spark(x, y, 0.62)) return [...TOMATO, 1];
  if (hat(x, y, 0.62)) return [...WHITE, 1];
  return [0, 0, 0, 0];
});
writePng(path.join(out, 'android-icon-monochrome.png'), 1024, (x, y) =>
  hat(x, y, 0.62) || spark(x, y, 0.62) ? [...WHITE, 1] : [0, 0, 0, 0],
);
fs.rmSync(path.join(out, 'android-icon-background.png'), { force: true });

// Splash (fundo verde-escuro definido no app.json).
writePng(path.join(out, 'splash-icon.png'), 512, (x, y) => {
  if (spark(x, y)) return [...TOMATO, 1];
  if (hat(x, y)) return [...WHITE, 1];
  return [...DARK, 0];
});

// Favicon.
writePng(path.join(out, 'favicon.png'), 64, (x, y) => {
  if (!inRoundRect(x, y, 0, 0, 1, 1, 0.22)) return [0, 0, 0, 0];
  if (hat(x, y, 1.05)) return [...WHITE, 1];
  return [...GREEN, 1];
});
