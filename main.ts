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

// --- Story 1 (lead, full width): Russia's mass attack on Kyiv ------------
// VERIFIED 20 NOV 2026: Reuters (KYIV, Nov 20) + AP. Ballistic missiles hit
// three Dnipro bridges; Zelenskyy: 400+ drones, 110+ missiles, 27 ballistic.
// 3 killed, 15 injured in Kyiv; at least 9 dead across Ukraine.
const L1 = 158;
rect(28, L1, 968, 216, WHITE);
rect(28, L1, 968, 6, RED);
drawText(48, L1 + 16, "WAR IN UKRAINE", 2, RED);
drawText(48, L1 + 38, "KYIV BRIDGES HIT", 4, INK);
drawText(48, L1 + 72, "IN MASS ATTACK", 4, INK);
drawText(48, L1 + 106, "400 DRONES, 110 MISSILES - 3 KILLED IN CAPITAL", 2, GREY);
drawPara(
  48, L1 + 128,
  "KYIV - RUSSIA LAUNCHED ONE OF THE LARGEST ATTACKS OF THE WAR OVERNIGHT, HITTING THREE BRIDGES OVER THE DNIPRO AND POUNDING POWER PLANTS. THREE PEOPLE WERE KILLED AND 15 INJURED IN KYIV.",
  2, 640, INK
);
// Bridge graphic, right side of lead panel.
const bx0 = 790;
const by0 = L1 + 30;
hline(bx0, bx0 + 170, by0 + 100, INK, 4); // deck
for (let a = 0; a < 3; a++) {
  const ax = bx0 + 5 + a * 56;
  line(ax, by0 + 100, ax + 28, by0 + 74, INK, 3);
  line(ax + 28, by0 + 74, ax + 56, by0 + 100, INK, 3);
}
hline(bx0, bx0 + 170, by0 + 112, SKY, 3); // river
hline(bx0, bx0 + 170, by0 + 120, SKY, 3);
line(bx0 + 140, by0 + 70, bx0 + 158, by0 + 88, RED, 3); // blast
line(bx0 + 158, by0 + 70, bx0 + 140, by0 + 88, RED, 3);
circle(bx0 + 149, by0 + 79, 6, GOLD);
drawText(bx0 + 10, by0 + 138, "THE DNIPRO", 2, GREY);

// --- Row 2: Poland incursion (left) / Markets (right) ----------------------
// VERIFIED 20 NOV 2026: The Independent live blog (20 Nov timestamps) +
// Helsinki Times. Two Russian missiles and a jet drone fell in Poland;
// Tusk called it an "intentional provocation"; NATO jets scrambled.
// Estonia's government announced Friday it will shut its Russia border
// crossings from 1 December for at least six months.
const R2 = 392;
const COLW = 474;
const COLH = 246;
// Poland
rect(28, R2, COLW, COLH, WHITE);
rect(28, R2, COLW, 6, INK);
drawText(48, R2 + 18, "NATO FLANK", 2, RED);
drawText(48, R2 + 42, "MISSILES LAND IN", 3, INK);
drawText(48, R2 + 70, "POLAND", 3, INK);
drawPara(48, R2 + 104, "RUSSIAN MISSILES AND A DRONE CAME DOWN IN POLAND IN THE OVERNIGHT ATTACK. NATO JETS SCRAMBLED. ESTONIA WILL SHUT ITS BORDER WITH RUSSIA FROM 1 DECEMBER.", 2, COLW - 40, INK);
// missile crossing a dashed border line, bottom strip
const px = 48;
const py = R2 + 202;
for (let d = 0; d < 12; d++) hline(px + d * 36, px + d * 36 + 22, py + 18, INK, 3);
line(px + 330, py - 6, px + 400, py + 26, RED, 4); // missile streak
triangle(px + 396, py + 18, px + 420, py + 26, px + 400, py + 34, RED); // warhead
circle(px + 330, py - 6, 5, GOLD);
drawText(px + 250, py + 30, "POLAND", 2, GREY);
// Markets - VERIFIED 20 NOV 2026: Reuters (NEW YORK, Nov 20) + Morningstar.
// Global sell-off on Friday: Nikkei -5.06%, S&P 500 -3.70%, Nasdaq -5.28%,
// Dow -1.93%. Anthropic fell 9.1% to $88.30 on its first full day of trading.
const MX = 522;
rect(MX, R2, COLW, COLH, WHITE);
rect(MX, R2, COLW, 6, RED);
drawText(MX + 20, R2 + 18, "MARKETS", 2, RED);
drawText(MX + 20, R2 + 42, "AI ROUT GOES", 3, INK);
drawText(MX + 20, R2 + 70, "GLOBAL", 3, INK);
drawPara(MX + 20, R2 + 108, "TECH SHARES LED A WORLD SELL-OFF. THE NIKKEI FELL 5 PCT, THE SP 500 3.7 PCT AND THE NASDAQ 5.3 PCT.", 2, COLW - 230, INK);
// falling chart graphic
const cx0 = MX + 300;
const cy0 = R2 + 104;
rect(cx0, cy0, 150, 128, LIGHT);
line(cx0 + 14, cy0 + 20, cx0 + 46, cy0 + 44, RED, 4);
line(cx0 + 46, cy0 + 44, cx0 + 78, cy0 + 40, RED, 4);
line(cx0 + 78, cy0 + 40, cx0 + 110, cy0 + 84, RED, 4);
line(cx0 + 110, cy0 + 84, cx0 + 136, cy0 + 112, RED, 4);
line(cx0 + 128, cy0 + 100, cx0 + 136, cy0 + 112, RED, 4);
line(cx0 + 136, cy0 + 104, cx0 + 136, cy0 + 112, RED, 4);
drawText(cx0 + 8, cy0 + 6, "-5 PCT", 2, RED);

// --- Row 3: EU-UK summit (left) / COP31 (right) ---------------------------
// EU-UK VERIFIED 20 NOV 2026: Consilium joint statement 20 Nov 2026 + NPR.
// Second EU-UK summit in Brussels; landmark deal on food trade, emissions
// trading and youth mobility for up to 100,000 young people; von der Leyen
// called it a "turning point". UK PM Andy Burnham.
const R3 = 656;
const COLH3 = 246;
// EU-UK
rect(28, R3, COLW, COLH3, WHITE);
rect(28, R3, COLW, 6, INK);
drawText(48, R3 + 18, "DIPLOMACY", 2, RED);
drawText(48, R3 + 42, "UK AND EU SIGN", 3, INK);
drawText(48, R3 + 70, "LANDMARK DEAL", 3, INK);
drawPara(48, R3 + 104, "BRUSSELS - BRITAIN AND THE EU AGREED DEALS ON FOOD TRADE, EMISSIONS AND YOUTH MOBILITY FOR UP TO 100,000 YOUNG PEOPLE. VON DER LEYEN CALLED IT A TURNING POINT.", 2, COLW - 40, INK);
// EU and UK flags, bottom strip
const fx = 48;
const fy = R3 + 200;
rect(fx, fy, 60, 34, [40, 60, 140]); // EU blue
for (let i = 0; i < 12; i++) {
  const a = (i / 12) * Math.PI * 2;
  circle(fx + 30 + Math.round(Math.cos(a) * 11), fy + 17 + Math.round(Math.sin(a) * 11), 2, GOLD);
}
rect(fx + 76, fy, 60, 34, [40, 60, 140]); // UK blue
line(fx + 76, fy, fx + 136, fy + 34, WHITE, 3);
line(fx + 136, fy, fx + 76, fy + 34, WHITE, 3);
line(fx + 76, fy, fx + 136, fy + 34, RED, 1);
line(fx + 136, fy, fx + 76, fy + 34, RED, 1);
rect(fx + 76 + 26, fy, 8, 34, WHITE);
rect(fx + 76, fy + 13, 60, 8, WHITE);
rect(fx + 76 + 28, fy, 4, 34, RED);
rect(fx + 76, fy + 15, 60, 4, RED);
// COP31 - VERIFIED 20 NOV 2026: phys.org (AFP, 20 Nov) + OSNA.
// Talks entered their endgame Friday with no deal in sight and ran past the
// scheduled Friday close into overtime. The draft dropped any mention of
// fossil fuels (the draft text itself was released Thursday 19 Nov).
const MX3 = 522;
rect(MX3, R3, COLW, COLH3, WHITE);
rect(MX3, R3, COLW, 6, RED);
drawText(MX3 + 20, R3 + 18, "CLIMATE", 2, RED);
drawText(MX3 + 20, R3 + 42, "COP31 TALKS RUN", 3, INK);
drawText(MX3 + 20, R3 + 70, "OVERTIME", 3, INK);
drawPara(MX3 + 20, R3 + 108, "ANTALYA - CLIMATE TALKS RAN PAST THE FRIDAY DEADLINE WITH NO DEAL IN SIGHT. THE DRAFT DROPS ANY MENTION OF FOSSIL FUELS.", 2, COLW - 230, INK);
// thermometer graphic
const tx = MX3 + 300;
const ty = R3 + 104;
rect(tx + 66, ty + 8, 18, 92, WHITE);
vline(tx + 66, ty + 8, ty + 100, INK, 2);
vline(tx + 84, ty + 8, ty + 100, INK, 2);
hline(tx + 66, tx + 84, ty + 8, INK, 2);
rect(tx + 69, ty + 44, 12, 53, RED); // mercury column
circle(tx + 75, ty + 108, 20, RED); // bulb
circle(tx + 75, ty + 108, 12, [220, 80, 80]);
for (let m = 0; m < 4; m++) hline(tx + 50, tx + 62, ty + 20 + m * 18, INK, 2); // ticks

// Footer -------------------------------------------------------------------
hline(28, 996, 924, INK, 3);
drawTextCentered(W / 2, 940, "THE DAY IN FIVE STORIES - KYIV - WARSAW - BRUSSELS - ANTALYA - TOKYO", 2, INK);
drawTextCentered(W / 2, 966, "SOURCES: REUTERS - AP - THE INDEPENDENT - CONSILIUM - NPR - AFP", 2, GREY);
drawTextCentered(W / 2, 992, "DRAWN WITH CODE - NO PHOTOGRAPHS", 2, GREY);

// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
fs.writeFileSync(outPath, encodePNG());
console.log(`wrote ${outPath} (${W}x${H})`);
