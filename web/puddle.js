// Top view of the water while the toy lies flat. Mirrors Puddle in firmware/tilt_toy/puddle.h step for step;
// Math.fround keeps each float operation in single precision so both give the same cells.
// The side-view solver keeps running underneath. Lying flat for a moment spreads the water from where it
// was over the whole floor, shaded like a shallow dish seen from above; a small tilt drains the high side.
const f = Math.fround;
// Puddle cells use the Pixel Flow palette: 1 shore, 3-6 shallow to deep. DRY is bare floor; 0 shows the side view.
export const DRY = 7;
const ENTER = f(.16), EXIT = f(.30), DWELL = f(.4), SPREAD = f(.6), DRAIN = f(.35), SMOOTH = f(.25);
const nearest = v => Math.floor(f(v + .5));

// Same cell limit as the firmware: the largest water grid is 25 × 52.
export const MAX_CELLS = 1600;

export class Puddle {
  constructor() { this.look = new Uint8Array(MAX_CELLS); this.dist = new Uint8Array(MAX_CELLS); this.reset(); }
  reset() { this.amount = 0; this.flatFor = 0; this.flat = false; this.cols = this.rows = 0; this.look.fill(0); this.tx = 0; this.ty = 1; this.tz = 0; this.maxDist = 0; }
  // gx, gy, gz: gravity on the screen axes, unit length. side: the side-view raster (0 empty, 1-2 water,
  // 3 outside the vessel). fill: water level in percent. Returns true while any cell shows the puddle.
  update(dt, gx, gy, gz, side, width, height, fill) {
    if (width < 1 || height < 1 || width > 64 || height > 64 || width * height > MAX_CELLS) return false;
    if (width !== this.cols || height !== this.rows) this.layout(width, height);
    dt = f(dt); gx = f(gx); gy = f(gy); gz = f(gz); fill = f(fill);
    const { cols, rows, look } = this, planar = f(Math.sqrt(f(f(gx * gx) + f(gy * gy))));
    this.flatFor = planar < ENTER ? f(this.flatFor + dt) : 0;
    if (!this.flat && this.flatFor >= DWELL) { this.flat = true; this.spreadFrom(side); if (this.amount <= 0) { this.tx = gx; this.ty = gy; this.tz = gz; } }
    else if (this.flat && planar > EXIT) { this.flat = false; this.spreadFrom(side); }
    this.amount = this.flat ? Math.min(1, f(this.amount + f(dt / SPREAD))) : Math.max(0, f(this.amount - f(dt / DRAIN)));
    if (this.amount <= 0) { look.fill(0); return false; }
    const follow = Math.min(1, f(dt / SMOOTH));
    this.tx = f(this.tx + f(f(gx - this.tx) * follow)); this.ty = f(this.ty + f(f(gy - this.ty) * follow)); this.tz = f(this.tz + f(f(gz - this.tz) * follow));
    // Depth in Q16 of the vessel radius: the level plus the floor's drop along the downhill direction.
    // A full vessel holds a quarter of its radius in water.
    const tilt = f(Math.sqrt(f(f(this.tx * this.tx) + f(this.ty * this.ty)))), slope = f(tilt / Math.max(Math.abs(this.tz), f(.2)));
    const scale = tilt > f(1e-4) ? f(f(f(slope / tilt) * 65536) / this.radius) : 0;
    const kx = nearest(f(this.tx * scale)), ky = nearest(f(this.ty * scale)), level = nearest(f(f(fill * f(.0025)) * 65536));
    const reach = nearest(f(this.amount * this.maxDist));
    const unit = 2 * level, margin = Math.floor(unit * 6 / 100);
    const edges = [-Infinity, Math.floor(unit * 3 / 10), Math.floor(unit * 55 / 100), Math.floor(unit * 8 / 10), Infinity];
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const c = j * cols + i;
      if (side[c] === 3 || this.dist[c] > reach) { look[c] = 0; continue; }
      const depth = level + (2 * i + 1 - cols) * kx + (2 * j + 1 - rows) * ky;
      if (depth <= 0) { look[c] = DRY; continue; }
      // Lit deeper toward the middle, lighter toward the rim; a shade holds until the depth clears its band by the margin.
      const x = 2 * i + 1 - cols, y = 2 * j + 1 - rows, r2 = x * x + y * y;
      const q = Math.floor(depth * (1250 - Math.trunc(600 * Math.min(r2, this.rim) / this.rim)) / 1000), was = look[c] - 3;
      if (was >= 0 && was <= 3 && q >= edges[was] - margin && q < edges[was + 1] + margin) continue;
      let band = 0; while (band < 3 && q >= edges[band + 1]) band++;
      look[c] = 3 + band;
    }
    // Shore: water beside bare floor.
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const c = j * cols + i;
      if (look[c] < 3 || look[c] > 6) continue;
      if ((i > 0 && look[c - 1] === DRY) || (i + 1 < cols && look[c + 1] === DRY) || (j > 0 && look[c - cols] === DRY) || (j + 1 < rows && look[c + cols] === DRY)) look[c] = 1;
    }
    return true;
  }
  layout(width, height) {
    this.cols = width; this.rows = height; this.radius = Math.min(width, height); this.rim = this.radius * this.radius;
    this.look.fill(0); this.dist.fill(0); this.maxDist = 0;
  }
  // Steps from the nearest side-view water, so the puddle spreads out of the water and drains back into it.
  spreadFrom(side) {
    const { cols, rows, dist } = this, queue = [];
    for (let c = 0; c < cols * rows; c++) { dist[c] = 255; if (side[c] === 1 || side[c] === 2) { dist[c] = 0; queue.push(c); } }
    this.maxDist = 0;
    if (!queue.length) { dist.fill(0); return; }
    for (let head = 0; head < queue.length; head++) {
      const c = queue[head], i = c % cols, j = Math.floor(c / cols);
      for (let b = j - 1; b <= j + 1; b++) for (let a = i - 1; a <= i + 1; a++) {
        if (a < 0 || a >= cols || b < 0 || b >= rows) continue;
        const n = b * cols + a;
        if (dist[n] !== 255 || side[n] === 3) continue;
        dist[n] = dist[c] + 1; if (dist[n] > this.maxDist) this.maxDist = dist[n];
        queue.push(n);
      }
    }
  }
}
