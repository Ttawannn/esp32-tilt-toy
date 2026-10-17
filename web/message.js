// The message on an LED board, mirrored by firmware/tilt_toy/message.h. The phone page packs its pictures the same way.
export const BANNER_ROWS = 24, MAX_BANNER_WIDTH = 1360;

// Square dots every `pitch` pixels, centred on the panel. 240 px panels get 60 × 60 dots.
export function dotGrid(width, height) {
  const shortest = Math.min(width, height), pitch = shortest >= 120 ? Math.trunc((shortest + 30) / 60) : 2;
  const cols = Math.trunc(width / pitch), rows = Math.trunc(height / pitch);
  return { pitch, cols, rows, x: Math.trunc((width - cols * pitch) / 2), y: Math.trunc((height - rows * pitch) / 2) };
}
// 1-bit picture packed column by column, bit x * height + y, from RGBA pixels: a dot is lit where red > 110.
export function packBits(rgba, width, height) {
  const bits = new Uint8Array(Math.ceil(width * height / 8));
  for (let x = 0; x < width; x++) for (let y = 0; y < height; y++) {
    if (rgba[(y * width + x) * 4] > 110) { const n = x * height + y; bits[n >> 3] |= 1 << (n & 7); }
  }
  return bits;
}
export function dotAt(picture, x, y) {
  if (!picture?.bits || x < 0 || y < 0 || x >= picture.width || y >= picture.height) return false;
  const n = x * picture.height + y;
  return (picture.bits[n >> 3] >> (n & 7) & 1) === 1;
}
// Scrolling position in dots: the banner enters at the right edge and leaves at the left, then starts again.
export class BannerScroll {
  constructor() { this.position = 0; }
  restart() { this.position = 0; }
  advance(dt, speed, bannerWidth, cols) {
    const loop = bannerWidth + cols;
    this.position += dt * speed;
    if (loop > 0 && this.position >= loop) this.position %= loop;
  }
  bannerColumn(column, cols) { return column + Math.trunc(this.position) - cols; }
}

// Browser only: the text is drawn with the system font, so Thai and emoji work, as on the phone page.
const font = size => `bold ${size}px system-ui,sans-serif`;
const characters = text => typeof Intl !== 'undefined' && Intl.Segmenter ? [...new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(text)].map(s => s.segment) : [...text];
function picture(doc, width, height, draw) {
  const canvas = doc.createElement('canvas'); canvas.width = width; canvas.height = height;
  const g = canvas.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, width, height); g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  draw(g);
  return { bits: packBits(g.getImageData(0, 0, width, height).data, width, height), width, height };
}
// Lines that fit `width` pixels, breaking at spaces where a line has one and between characters otherwise.
export function wrapLines(measure, text, width) {
  const out = [];
  for (const part of text.split('\n')) {
    let line = '';
    for (const ch of characters(part)) {
      if (line && measure(line + ch) > width) {
        const cut = line.lastIndexOf(' ');
        if (cut > 0 && ch !== ' ') { out.push(line.slice(0, cut)); line = line.slice(cut + 1) + ch; }
        else { out.push(line); line = ch === ' ' ? '' : ch; }
      } else line += ch;
    }
    out.push(line);
  }
  return out;
}
export function renderBanner(text, doc = document) {
  const measure = doc.createElement('canvas').getContext('2d');
  measure.font = font(19);
  const width = Math.max(1, Math.min(MAX_BANNER_WIDTH, Math.ceil(measure.measureText(text).width) + 4));
  return picture(doc, width, BANNER_ROWS, g => { g.font = font(19); g.fillText(text, width / 2, 13); });
}
// The largest text that fits the grid, inside the circle on a round display.
export function renderStill(text, cols, rows, round, doc = document) {
  const area = round ? .72 : .94, measure = doc.createElement('canvas').getContext('2d');
  let size = Math.floor(rows * .6), lines = [text];
  for (; size > 6; size--) {
    measure.font = font(size);
    lines = wrapLines(t => measure.measureText(t).width, text, cols * area);
    if (lines.length * size * 1.2 <= rows * area && lines.every(l => measure.measureText(l).width <= cols * area)) break;
  }
  return picture(doc, cols, rows, g => { g.font = font(size); lines.forEach((l, k) => g.fillText(l, cols / 2, rows / 2 + 1 + (k - (lines.length - 1) / 2) * size * 1.2)); });
}
