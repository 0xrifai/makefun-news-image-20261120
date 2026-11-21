// news-image-20261120 — "The World in One Image"
// A front page summing up Friday 20 November 2026 in five stories.
// Node 22+ stdlib only. Offline, deterministic, byte-identical output.
// Draws a 1024x1024 PNG with a hand-coded 5x7 pixel font and a
// hand-rolled PNG encoder (zlib deflate, CRC32, filter 0).

import * as fs from "node:fs";
import * as path from "node:path";
import * as zlib from "node:zlib";

// ---------------------------------------------------------------------------
// 5x7 pixel font. Each glyph is 7 rows of 5 bits, '#' = on, '.' = off.
// Only the characters this page needs: A-Z, 0-9, space, '-', '.', ','.
// ---------------------------------------------------------------------------
const FONT: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  F: ["11111", "10000", "10000", "11110", "10000", "10000", "10000"],
  G: ["01110", "10001", "10000", "10111", "10001", "10001", "01111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  I: ["01110", "00100", "00100", "00100", "00100", "00100", "01110"],
  J: ["00111", "00010", "00010", "00010", "00010", "10010", "01100"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  L: ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
  M: ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
  N: ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  P: ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  V: ["10001", "10001", "10001", "10001", "10001", "01010", "00100"],
  W: ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
  X: ["10001", "10001", "01010", "00100", "01010", "10001", "10001"],
  Y: ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
  Z: ["11111", "00001", "00010", "00100", "01000", "10000", "11111"],
  "0": ["01110", "10001", "10011", "10101", "11001", "10001", "01110"],
  "1": ["00100", "01100", "00100", "00100", "00100", "00100", "01110"],
  "2": ["01110", "10001", "00001", "00110", "01000", "10000", "11111"],
  "3": ["11111", "00010", "00100", "00010", "00001", "10001", "01110"],
  "4": ["00010", "00110", "01010", "10010", "11111", "00010", "00010"],
  "5": ["11111", "10000", "11110", "00001", "00001", "10001", "01110"],
  "6": ["00110", "01000", "10000", "11110", "10001", "10001", "01110"],
  "7": ["11111", "00001", "00010", "00100", "01000", "01000", "01000"],
  "8": ["01110", "10001", "10001", "01110", "10001", "10001", "01110"],
  "9": ["01110", "10001", "10001", "01111", "00001", "00010", "01100"],
  " ": ["00000", "00000", "00000", "00000", "00000", "00000", "00000"],
  "-": ["00000", "00000", "00000", "01110", "00000", "00000", "00000"],
  ".": ["00000", "00000", "00000", "00000", "00000", "01100", "01100"],
  ",": ["00000", "00000", "00000", "00000", "01100", "00100", "01000"],
};

// ---------------------------------------------------------------------------
// Canvas: plain RGB buffer with tiny drawing helpers.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const buf = Buffer.alloc(W * H * 3);

type RGB = [number, number, number];
const PAPER: RGB = [247, 243, 234];
const INK: RGB = [20, 33, 61]; // deep navy
const RED: RGB = [178, 34, 34];
const GOLD: RGB = [176, 141, 60];
const GREY: RGB = [90, 90, 88];
const LIGHT: RGB = [232, 226, 214];
const WHITE: RGB = [255, 255, 255];
const TEAL: RGB = [31, 110, 110];
const SKY: RGB = [120, 165, 200];

function setPx(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}
function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++)
    for (let xx = x; xx < x + w; xx++) setPx(xx, yy, c);
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  for (let t2 = 0; t2 < t; t2++) for (let x = x0; x <= x1; x++) setPx(x, y + t2, c);
}
function vline(x: number, y0: number, y1: number, c: RGB, t = 1): void {
  for (let t2 = 0; t2 < t; t2++) for (let y = y0; y <= y1; y++) setPx(x + t2, y, c);
}
// Bresenham line, thickness t.
function line(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    for (let a = 0; a < t; a++)
      for (let b = 0; b < t; b++) setPx(x + a, y + b, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function circle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) setPx(cx + x, cy + y, c);
}
function triangle(x0: number, y0: number, x1: number, y1: number, x2: number, y2: number, c: RGB): void {
  const minX = Math.min(x0, x1, x2);
  const maxX = Math.max(x0, x1, x2);
  const minY = Math.min(y0, y1, y2);
  const maxY = Math.max(y0, y1, y2);
  const d = (x0 - x2) * (y1 - y2) - (y0 - y2) * (x1 - x2);
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const a = ((x - x2) * (y1 - y2) - (y - y2) * (x1 - x2)) / d;
      const b = ((x0 - x2) * (y - y2) - (y0 - y2) * (x - x2)) / d;
      if (a >= 0 && b >= 0 && a + b <= 1) setPx(x, y, c);
    }
}

// ---------------------------------------------------------------------------
// Text. scale s => glyph is 5s wide, 7s tall, 1s gap between glyphs.
// ---------------------------------------------------------------------------
function textWidth(s: string, scale: number): number {
  return s.length === 0 ? 0 : s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    const g = FONT[ch] ?? FONT[" "];
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r][col] === "1") rect(cx + col * scale, y + r * scale, scale, scale, c);
    cx += 6 * scale;
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
// Word-wrap a string to lines fitting maxW at the given scale.
function wrap(s: string, scale: number, maxW: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const cand = cur === "" ? w : cur + " " + w;
    if (textWidth(cand, scale) <= maxW) {
      cur = cand;
    } else {
      if (cur !== "") lines.push(cur);
      cur = w;
    }
  }
  if (cur !== "") lines.push(cur);
  return lines;
}
function drawPara(x: number, y: number, s: string, scale: number, maxW: number, c: RGB, lh?: number): number {
  const lines = wrap(s, scale, maxW);
  const step = lh ?? 9 * scale;
  lines.forEach((ln, i) => drawText(x, y + i * step, ln, scale, c));
  return y + lines.length * step;
}

// ---------------------------------------------------------------------------
// PNG encoder (color type 2, 8-bit, filter 0 per scanline).
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePNG(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    buf.copy(raw, y * (1 + W * 3) + 1, y * W * 3, (y + 1) * W * 3);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Page layout — a broadsheet front page for Friday 20 November 2026.
// ---------------------------------------------------------------------------
rect(0, 0, W, H, PAPER);

// Masthead -----------------------------------------------------------------
rect(0, 0, W, 118, INK);
drawTextCentered(W / 2, 16, "THE WORLD IN ONE IMAGE", 5, WHITE);
drawTextCentered(W / 2, 62, "FRIDAY  20 NOVEMBER 2026", 3, GOLD);
hline(0, W - 1, 118, RED, 6);
drawTextCentered(W / 2, 132, "FIVE STORIES THAT DEFINED THE DAY", 2, RED);

// --- Story 1 (lead, full width): ICJ genocide ruling ----------------------
const L1 = 158;
rect(28, L1, 968, 216, WHITE);
rect(28, L1, 968, 6, RED);
drawText(48, L1 + 20, "JUSTICE", 2, RED);
drawText(48, L1 + 46, "MYANMAR GUILTY OF GENOCIDE", 4, INK);
drawText(48, L1 + 92, "UN COURT RULES IN FIRST-EVER STATE VERDICT, 9-6", 2, GREY);
drawPara(
  48, L1 + 122,
  "THE HAGUE - THE INTERNATIONAL COURT OF JUSTICE RULED MYANMAR COMMITTED GENOCIDE AGAINST THE ROHINGYA IN ITS 2017 CRACKDOWN, ORDERING REPARATIONS AND THE SAFE RETURN OF THOSE WHO FLED. MYANMAR CALLED THE RULING UNFAIR.",
  2, 640, INK
);
// Scales of justice, right side of lead panel.
const sx = 800;
const sy = L1 + 30;
line(sx + 60, sy + 10, sx + 60, sy + 150, INK, 4); // post
line(sx + 4, sy + 18, sx + 116, sy + 18, INK, 4); // beam
circle(sx + 60, sy + 8, 7, GOLD); // finial
line(sx + 8, sy + 18, sx + 8, sy + 78, INK, 3);
line(sx + 112, sy + 18, sx + 112, sy + 78, INK, 3);
triangle(sx - 18, sy + 78, sx + 34, sy + 78, sx + 8, sy + 118, GOLD); // left pan
triangle(sx + 86, sy + 78, sx + 138, sy + 78, sx + 112, sy + 118, GOLD); // right pan
rect(sx + 38, sy + 150, 44, 8, INK); // base
drawText(sx - 8, sy + 168, "THE HAGUE", 2, GREY);

// --- Row 2: Shenzhen (left) / Riyadh (right) ------------------------------
const R2 = 392;
const COLW = 474;
const COLH = 246;
// Shenzhen
rect(28, R2, COLW, COLH, WHITE);
rect(28, R2, COLW, 6, INK);
drawText(48, R2 + 18, "DIPLOMACY", 2, RED);
drawText(48, R2 + 42, "THREE LEADERS,", 3, INK);
drawText(48, R2 + 70, "ONE DECLARATION", 3, INK);
drawPara(48, R2 + 108, "TRUMP, XI AND PUTIN MET IN SHENZHEN AND SIGNED A FOUR-POINT PEACE PLEDGE ON THE UN, ENERGY AND NUCLEAR RISK. NO WORD ON UKRAINE OR IRAN.", 2, COLW - 40, INK);
// three small flags
const fx = 48;
const fy = R2 + 196;
rect(fx, fy, 60, 34, [178, 34, 34]); // China red
for (let i = 0; i < 5; i++) circle(fx + 12 + (i % 3) * 8, fy + 8 + Math.floor(i / 3) * 8, 2, GOLD);
rect(fx + 76, fy, 60, 34, [178, 34, 34]); // US: red field, white stripes, blue canton
for (let s = 0; s < 3; s++) rect(fx + 76, fy + 5 + s * 10, 60, 4, WHITE);
rect(fx + 76, fy, 26, 18, [40, 60, 140]);
for (let i = 0; i < 6; i++) circle(fx + 82 + (i % 3) * 8, fy + 5 + Math.floor(i / 3) * 7, 1, WHITE);
rect(fx + 152, fy, 60, 34, WHITE);
rect(fx + 152, fy, 60, 11, WHITE);
rect(fx + 152, fy, 60, 11, [200, 40, 40]);
rect(fx + 152, fy + 23, 60, 11, [40, 60, 160]);
vline(fx + 60, fy, fy + 34, INK, 2);
vline(fx + 136, fy, fy + 34, INK, 2);
// Riyadh
const RX = 522;
rect(RX, R2, COLW, COLH, WHITE);
rect(RX, R2, COLW, 6, RED);
drawText(RX + 20, R2 + 18, "MIDDLE EAST", 2, RED);
drawText(RX + 20, R2 + 42, "MISSILE HITS", 3, INK);
drawText(RX + 20, R2 + 70, "RIYADH TOWER", 3, INK);
drawPara(RX + 20, R2 + 108, "A HOUTHI MISSILE DAMAGED THE PIF TOWER, THE TALLEST SKYSCRAPER IN RIYADH, BLOWING OUT WINDOWS ACROSS EIGHT FLOORS. NO INJURIES WERE REPORTED.", 2, COLW - 230, INK);
// skyscraper graphic, right side
const tx = RX + 300;
const ty = R2 + 104;
rect(tx, ty, 84, 128, INK);
for (let r = 0; r < 8; r++)
  for (let c2 = 0; c2 < 4; c2++) rect(tx + 8 + c2 * 19, ty + 10 + r * 14, 11, 8, SKY);
rect(tx + 30, ty + 44, 24, 4, RED); // damage band
line(tx + 6, ty + 40, tx + 78, ty + 56, RED, 3);
line(tx + 30, ty + 20, tx + 60, ty + 4, GREY, 3); // smoke
line(tx + 40, ty + 28, tx + 66, ty + 12, GREY, 3);
circle(tx + 84, ty + 2, 5, RED);

// --- Row 3: Kyiv (left) / Markets (right) ---------------------------------
const R3 = 656;
const COLH3 = 246;
// Kyiv
rect(28, R3, COLW, COLH3, WHITE);
rect(28, R3, COLW, 6, INK);
drawText(48, R3 + 18, "WAR IN UKRAINE", 2, RED);
drawText(48, R3 + 42, "KYIV BRIDGES HIT", 3, INK);
drawText(48, R3 + 70, "OVERNIGHT", 3, INK);
drawPara(48, R3 + 108, "RUSSIAN MISSILES AND DRONES STRUCK THREE BRIDGES IN KYIV OVERNIGHT, KILLING THREE PEOPLE AND KNOCKING OUT POWER.", 2, COLW - 40, INK);
// bridge graphic
const bx = 48;
const by = R3 + 186;
hline(bx, bx + 220, by + 34, INK, 4); // deck
for (let a = 0; a < 3; a++) {
  const ax = bx + 10 + a * 72;
  line(ax, by + 34, ax + 36, by + 8, INK, 3);
  line(ax + 36, by + 8, ax + 72, by + 34, INK, 3);
}
hline(bx, bx + 220, by + 44, SKY, 3); // river
hline(bx, bx + 220, by + 52, SKY, 3);
line(bx + 190, by + 4, bx + 208, by + 22, RED, 3); // blast
line(bx + 208, by + 4, bx + 190, by + 22, RED, 3);
circle(bx + 199, by + 13, 6, GOLD);
// Markets
const MX = 522;
rect(MX, R3, COLW, COLH3, WHITE);
rect(MX, R3, COLW, 6, RED);
drawText(MX + 20, R3 + 18, "MARKETS", 2, RED);
drawText(MX + 20, R3 + 42, "AI RALLY TURNS", 3, INK);
drawText(MX + 20, R3 + 70, "TO ROUT", 3, INK);
drawPara(MX + 20, R3 + 108, "ANTHROPIC MADE A RECORD 81 BILLION DOLLAR DEBUT, THEN SHARES SLID. THE NIKKEI FELL 4 PCT AND THE SP 500 DROPPED FOR A SIXTH DAY.", 2, COLW - 230, INK);
// falling chart graphic
const cx0 = MX + 300;
const cy0 = R3 + 104;
rect(cx0, cy0, 150, 128, LIGHT);
line(cx0 + 14, cy0 + 20, cx0 + 46, cy0 + 44, RED, 4);
line(cx0 + 46, cy0 + 44, cx0 + 78, cy0 + 40, RED, 4);
line(cx0 + 78, cy0 + 40, cx0 + 110, cy0 + 84, RED, 4);
line(cx0 + 110, cy0 + 84, cx0 + 136, cy0 + 112, RED, 4);
line(cx0 + 128, cy0 + 100, cx0 + 136, cy0 + 112, RED, 4);
line(cx0 + 136, cy0 + 104, cx0 + 136, cy0 + 112, RED, 4);
drawText(cx0 + 8, cy0 + 6, "-4 PCT", 2, RED);

// Footer -------------------------------------------------------------------
hline(28, 996, 924, INK, 3);
drawTextCentered(W / 2, 940, "THE DAY IN FIVE STORIES - SHENZHEN - THE HAGUE - RIYADH - KYIV - TOKYO", 2, INK);
drawTextCentered(W / 2, 966, "SOURCES: ICJ - WHITE HOUSE - REUTERS - AP - EURONEWS", 2, GREY);
drawTextCentered(W / 2, 992, "DRAWN WITH CODE - NO PHOTOGRAPHS", 2, GREY);

// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePNG());
console.log(`wrote ${outPath} (${W}x${H})`);
