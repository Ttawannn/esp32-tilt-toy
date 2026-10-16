#pragma once
#include <math.h>
#include <stdint.h>
#include <string.h>

// Top view of the water while the toy lies flat, mirrored by web/puddle.js.
// The side-view solver keeps running underneath. Lying flat for a moment spreads the water from where
// it was over the whole floor, shaded like a shallow dish seen from above; a small tilt drains the high
// side. Standing the toy up draws the puddle back into the side view. Per-cell work is integer.
class Puddle {
 public:
  // Largest water grid is 25 × 52 (Mini TFT); the classic ESP32 has little static RAM to spare.
  static constexpr int MaxSide = 64, MaxCells = 1600;
  // Puddle cells use the Pixel Flow palette: 1 shore, 3-6 shallow to deep. Dry is bare floor; 0 shows the side view.
  static constexpr uint8_t Dry = 7;
  // In-plane gravity below Enter (about 9°) for DwellS lays the puddle; above Exit (about 17°) it drains.
  static constexpr float Enter = .16f, Exit = .30f, DwellS = .4f, SpreadS = .6f, DrainS = .35f, SmoothS = .25f;
  uint8_t look[MaxCells]{};
  float amount = 0;  // 0 side view .. 1 the whole floor
  bool flat = false;

  void reset() { amount = flatFor = 0; flat = false; cols = rows = 0; tx = 0; ty = 1; tz = 0; memset(look, 0, sizeof(look)); }
  // gx, gy, gz: gravity on the screen axes, unit length. side: the side-view raster (0 empty, 1-2 water,
  // 3 outside the vessel). fill: water level in percent. Returns true while any cell shows the puddle.
  bool update(float dt, float gx, float gy, float gz, const uint8_t *side, int width, int height, float fill) {
    if (width < 1 || height < 1 || width > MaxSide || height > MaxSide || width * height > MaxCells) return false;
    if (width != cols || height != rows) layout(width, height);
    const float planar = sqrtf(gx*gx + gy*gy);
    flatFor = planar < Enter ? flatFor + dt : 0;
    if (!flat && flatFor >= DwellS) { flat = true; spreadFrom(side); if (amount <= 0) { tx = gx; ty = gy; tz = gz; } }
    else if (flat && planar > Exit) { flat = false; spreadFrom(side); }
    amount = flat ? fminf(1, amount + dt / SpreadS) : fmaxf(0, amount - dt / DrainS);
    if (amount <= 0) { memset(look, 0, sizeof(look)); return false; }
    const float follow = fminf(1, dt / SmoothS);
    tx = tx + (gx - tx) * follow; ty = ty + (gy - ty) * follow; tz = tz + (gz - tz) * follow;
    // Depth in Q16 of the vessel radius: the level plus the floor's drop along the downhill direction.
    // A full vessel holds a quarter of its radius in water.
    const float tilt = sqrtf(tx*tx + ty*ty), slope = tilt / fmaxf(fabsf(tz), .2f);
    const float scale = tilt > 1e-4f ? slope / tilt * 65536 / radius : 0;
    const int32_t kx = nearest(tx * scale), ky = nearest(ty * scale), level = nearest(fill * .0025f * 65536);
    const int32_t reach = nearest(amount * maxDist);
    const int64_t unit = 2 * (int64_t)level, margin = unit * 6 / 100;
    const int64_t edges[5] = {INT64_MIN / 2, unit * 3 / 10, unit * 55 / 100, unit * 8 / 10, INT64_MAX / 2};
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      const int c = j*cols + i;
      if (side[c] == 3 || dist[c] > reach) { look[c] = 0; continue; }
      const int64_t depth = level + (int64_t)(2*i + 1 - cols) * kx + (int64_t)(2*j + 1 - rows) * ky;
      if (depth <= 0) { look[c] = Dry; continue; }
      // Lit deeper toward the middle, lighter toward the rim; a shade holds until the depth clears its band by the margin.
      const int32_t x = 2*i + 1 - cols, y = 2*j + 1 - rows, r2 = x*x + y*y;
      const int64_t q = depth * (1250 - 600 * (r2 < rim ? r2 : rim) / rim) / 1000;
      const int was = look[c] - 3;
      if (was >= 0 && was <= 3 && q >= edges[was] - margin && q < edges[was + 1] + margin) continue;
      int band = 0; while (band < 3 && q >= edges[band + 1]) band++;
      look[c] = (uint8_t)(3 + band);
    }
    // Shore: water beside bare floor.
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      const int c = j*cols + i;
      if (look[c] < 3 || look[c] > 6) continue;
      if ((i > 0 && look[c-1] == Dry) || (i+1 < cols && look[c+1] == Dry) || (j > 0 && look[c-cols] == Dry) || (j+1 < rows && look[c+cols] == Dry)) look[c] = 1;
    }
    return true;
  }

 private:
  uint8_t dist[MaxCells]{};
  int16_t queue[MaxCells]{};
  int cols = 0, rows = 0, radius = 1, rim = 1, maxDist = 0;
  float flatFor = 0, tx = 0, ty = 1, tz = 0;

  static int32_t nearest(float v) { return (int32_t)floorf(v + .5f); }
  void layout(int width, int height) {
    cols = width; rows = height; radius = width < height ? width : height; rim = radius * radius;
    memset(look, 0, sizeof(look)); memset(dist, 0, sizeof(dist)); maxDist = 0;
  }
  // Steps from the nearest side-view water, so the puddle spreads out of the water and drains back into it.
  void spreadFrom(const uint8_t *side) {
    int head = 0, tail = 0;
    for (int c = 0; c < cols*rows; c++) {
      dist[c] = 255;
      if (side[c] == 1 || side[c] == 2) { dist[c] = 0; queue[tail++] = (int16_t)c; }
    }
    if (!tail) { memset(dist, 0, sizeof(dist)); maxDist = 0; return; }
    maxDist = 0;
    while (head < tail) {
      const int c = queue[head++], i = c % cols, j = c / cols;
      for (int b = j - 1; b <= j + 1; b++) for (int a = i - 1; a <= i + 1; a++) {
        if (a < 0 || a >= cols || b < 0 || b >= rows) continue;
        const int n = b*cols + a;
        if (dist[n] != 255 || side[n] == 3) continue;
        dist[n] = (uint8_t)(dist[c] + 1); if (dist[n] > maxDist) maxDist = dist[n];
        queue[tail++] = (int16_t)n;
      }
    }
  }
};
