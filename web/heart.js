// A beating heart on the dot grid, mirrored by firmware/tilt_toy/heart.h.
// Shades: 0 off, 1 deep .. 4 highlight. Little hearts burst out on a shake and float up against gravity.
export const HEART_SHADES = ['', '#960e34', '#d62256', '#ff4f8b', '#ffb3cf'];
const BEAT_MS = 1100, IDLE_MS = 2400, MAX_SPARKS = 14;
// 0..1: a strong "lub" and a softer "dub" each BEAT_MS.
export function heartBeat(now) {
  const t = (now % BEAT_MS) / BEAT_MS;
  if (t < .12) return Math.sin(t / .12 * Math.PI);
  if (t > .2 && t < .32) return .6 * Math.sin((t - .2) / .12 * Math.PI);
  return 0;
}
// Shade of the dot at (x, y) for a heart centred on (cx, cy), `size` dots across each lobe, leaning `lean` radians.
export function heartShade(x, y, cx, cy, size, lean) {
  const c = Math.cos(lean), s = Math.sin(lean), dx = (x - cx) / size, dy = (y - cy) / size;
  const u = dx * c + dy * s, v = dx * s - dy * c + .15, a = u * u + v * v - 1, h = a * a * a - u * u * v * v * v;
  if (h > 0) return 0;
  const light = .5 - .35 * u + .45 * v; // lit from the upper left
  return light > .95 ? 4 : light > .62 ? 3 : light > .3 ? 2 : 1;
}
// The 5 × 4 little-heart pattern, row by row from the top.
const SPARK_ROWS = [0b01010, 0b11111, 0b01110, 0b00100];
export const sparkDot = (dx, dy) => dx >= 0 && dx < 5 && dy >= 0 && dy < 4 && ((SPARK_ROWS[dy] >> (4 - dx)) & 1) === 1;

export class HeartBeat {
  constructor() { this.reset(0, 1); }
  reset(now, seed) { this.sparks = Array.from({ length: MAX_SPARKS }, () => ({ x: 0, y: 0, vx: 0, vy: 0, life: 0 })); this.state = seed >>> 0 || 1; this.nextIdle = now + IDLE_MS; }
  random() { let s = this.state; s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; this.state = s >>> 0; return (this.state & 0xFFFFFF) / 16777216; }
  slot() { let best = 0; for (let k = 0; k < MAX_SPARKS; k++) { if (this.sparks[k].life <= 0) return k; if (this.sparks[k].life < this.sparks[best].life) best = k; } return best; }
  burst(x, y, count = 8) {
    for (let n = 0; n < count; n++) {
      const angle = this.random() * Math.PI * 2, speed = 6 + this.random() * 10;
      this.sparks[this.slot()] = { x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 1.4 + this.random() * .6 };
    }
  }
  // upX, upY: unit direction away from gravity on the screen.
  step(dt, upX, upY, now, cx, cy, size) {
    if (now >= this.nextIdle) {
      this.nextIdle = now + IDLE_MS + this.random() * 1200;
      const across = (this.random() - .5) * size * 1.6;
      this.sparks[this.slot()] = { x: cx - upX * size * 1.2 - upY * across, y: cy - upY * size * 1.2 + upX * across, vx: upX * 4, vy: upY * 4, life: 2.2 };
    }
    for (const s of this.sparks) {
      if (s.life <= 0) continue;
      s.vx += upX * 9 * dt; s.vy += upY * 9 * dt; s.vx *= 1 - dt * .8; s.vy *= 1 - dt * .8;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    }
  }
}
