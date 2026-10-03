// Generates the Study Hub app icon (an open-book glyph on a brand-colored
// background) as plain PNGs using Node's built-in zlib — no image-library
// dependency needed. Replaces the earlier plain-square placeholder.
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

// Even-odd ray-casting point-in-polygon test.
function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function setPixel(raw, rowSize, x, y, [r, g, b]) {
  const offset = y * rowSize + 1 + x * 3;
  raw[offset] = r;
  raw[offset + 1] = g;
  raw[offset + 2] = b;
}

function fillPolygon(raw, rowSize, size, polyFrac, color) {
  const poly = polyFrac.map(([fx, fy]) => [fx * size, fy * size]);
  const xs = poly.map((p) => p[0]);
  const ys = poly.map((p) => p[1]);
  const minX = Math.max(0, Math.floor(Math.min(...xs)));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(...xs)));
  const minY = Math.max(0, Math.floor(Math.min(...ys)));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(...ys)));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (pointInPolygon(x + 0.5, y + 0.5, poly)) {
        setPixel(raw, rowSize, x, y, color);
      }
    }
  }
}

function makeIconPng(size) {
  const BG = [14, 165, 233]; // sky-500 — matches the app's primary accent color
  const FG = [255, 255, 255];

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const rowSize = size * 3 + 1;
  const raw = Buffer.alloc(rowSize * size);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter type: none
    for (let x = 0; x < size; x++) setPixel(raw, rowSize, x, y, BG);
  }

  // Open-book glyph: two angled "pages" meeting at a center spine — stays
  // well within the ~80% safe zone so it isn't clipped by maskable-icon
  // circular cropping on Android.
  fillPolygon(raw, rowSize, size, [
    [0.5, 0.37],
    [0.24, 0.33],
    [0.22, 0.66],
    [0.5, 0.71],
  ], FG);
  fillPolygon(raw, rowSize, size, [
    [0.5, 0.37],
    [0.76, 0.33],
    [0.78, 0.66],
    [0.5, 0.71],
  ], FG);
  // Spine shadow line down the middle for definition.
  fillPolygon(raw, rowSize, size, [
    [0.487, 0.37],
    [0.513, 0.37],
    [0.513, 0.71],
    [0.487, 0.71],
  ], BG);

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = path.join(__dirname, '..', 'public', 'icons');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIconPng(192));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIconPng(512));
console.log('Generated branded icons in public/icons/');
