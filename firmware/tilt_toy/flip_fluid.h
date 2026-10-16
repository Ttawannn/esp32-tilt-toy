#pragma once
#include <cmath>
#include <cstdint>
#include <cstring>

// Compact adaptation of Ten Minute Physics example 18, by Matthias Müller.
// Fixed storage, tilt gravity, circular walls and a linked-cell neighbour search.
// Fixed point: the C3/C6 have no FPU, so every per-particle and per-cell step is integer.
// web/fluid.js mirrors every integer operation, so both give bit-identical states.
static const char fluidLicense[] = R"MIT(Copyright 2022 Matthias Müller - Ten Minute Physics
www.youtube.com/c/TenMinutePhysics
www.matthiasMueller.info/tenMinutePhysics

MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.)MIT";

class FlipFluid {
 public:
  static constexpr int MaxCells = 400, MaxParticles = 900;
  static constexpr float Step = 0.025f;
  // Q16: positions are in grid cells and velocities in cells per step; One is one cell.
  static constexpr int32_t One = 65536, Half = 32768;
  enum { Fluid = 0, Air = 1, Solid = 2 };
  int nx = 20, ny = 20, count = 0;
  bool round = true;
  // Domain units (the vessel's short side is 1), for callers that place and draw the water.
  float h = 1.0f / 18, radius = 0, cx = 0, cy = 0, vesselRadius = 0;
  float accumulator = 0;
  int32_t restDensity = 0;
  int32_t qx[MaxParticles]{}, qy[MaxParticles]{}, qvx[MaxParticles]{}, qvy[MaxParticles]{};
  int32_t u[MaxCells]{}, v[MaxCells]{}, oldU[MaxCells]{}, oldV[MaxCells]{};
  int32_t weightU[MaxCells]{}, weightV[MaxCells]{}, density[MaxCells]{};
  uint8_t kind[MaxCells]{};
  int16_t head[MaxCells]{}, next[MaxParticles]{};
  // Square-pixel view for drawing, mirrored by pixelWater() in web/fluid.js.
  // 0 empty, 1 water, 2 surface (open toward -gravity), 3 outside the vessel.
  // At most 64 pixels a side and 1600 in all: the largest grid is 25 × 52 and the classic ESP32 is short of static RAM.
  static constexpr int MaxPixelSide = 64, MaxPixels = 1600;
  uint8_t pixels[MaxPixels]{};
  // Gradient look, mirrored by shade() in web/fluid.js: the Pixel Flow palette indices
  // 0 none, 1 surface, 3-6 body from just below the surface to deep.
  uint8_t look[MaxPixels]{};

  float posX(int p) const { return qx[p] * (h / One); }
  float posY(int p) const { return qy[p] * (h / One); }
  float velX(int p) const { return qvx[p] * (h / (One * Step)); }
  float velY(int p) const { return qvy[p] * (h / (One * Step)); }

  static float clamp(float value, float low, float high) { return fmaxf(low, fminf(high, value)); }
  static int32_t clampi(int32_t value, int32_t low, int32_t high) { return value < low ? low : value > high ? high : value; }
  static int small(int a, int b) { return a < b ? a : b; }
  static int large(int a, int b) { return a > b ? a : b; }
  // Q16 product, rounded down.
  static int32_t mul(int32_t a, int32_t b) { return (int32_t)(((int64_t)a * b) >> 16); }
  // Q16 from a float, rounding half away from zero.
  static int32_t toQ(float value) { return (int32_t)lroundf(value * One); }
  static uint32_t isqrt(uint64_t n) {
    uint64_t root = 0, bit = (uint64_t)1 << 62;
    while (bit > n) bit >>= 2;
    while (bit) {
      if (n >= root + bit) { n -= root + bit; root = (root >> 1) + bit; } else root >>= 1;
      bit >>= 2;
    }
    return (uint32_t)root;
  }
  // The same root for the separation pass, where every input fits 32 bits.
  static uint32_t isqrt32(uint32_t n) {
    uint32_t root = 0, bit = (uint32_t)1 << 30;
    while (bit > n) bit >>= 2;
    while (bit) {
      if (n >= root + bit) { n -= root + bit; root = (root >> 1) + bit; } else root >>= 1;
      bit >>= 2;
    }
    return root;
  }

  bool configure(int width, int height, bool circular, float fill = 50) {
    if (width < 4 || height < 4 || width * height > MaxCells) return false;
    lookCols = lookRows = 0;
    nx = width; ny = height; round = circular; span = small(nx, ny) - 2;
    h = 1.0f / span; radius = .32f * h; cx = nx * h * .5f; cy = ny * h * .5f; vesselRadius = span * h * .5f;
    centerX = nx * Half; centerY = ny * Half; vessel = span * Half; rim = vessel - RimInset;
    compensation = toQ(.03f * Step * span);
    for (int i = 0; i < nx; i++) for (int j = 0; j < ny; j++) {
      const int64_t dx = (2*i + 1) * (int64_t)Half - centerX, dy = (2*j + 1) * (int64_t)Half - centerY;
      kind[i * ny + j] = (i == 0 || j == 0 || i == nx-1 || j == ny-1 ||
          (round && dx*dx + dy*dy > (int64_t)vessel * vessel)) ? Solid : Air;
    }
    reset(fill); return true;
  }
  void reset(float fill = 50) {
    count = 0; accumulator = 0; restDensity = 0;
    memset(u, 0, sizeof(u)); memset(v, 0, sizeof(v));
    memset(oldU, 0, sizeof(oldU)); memset(oldV, 0, sizeof(oldV));
    memset(qvx, 0, sizeof(qvx)); memset(qvy, 0, sizeof(qvy));
    const int32_t spacing = Radius * 212 / 100, rowStep = mul(spacing, 56756); // 2.12 radii, rows √3/2 apart
    const int32_t edge = One + Radius, maxX = (nx - 1) * One - Radius, maxY = (ny - 1) * One - Radius;
    const int64_t limit = (int64_t)rim * rim;
    const long percent = lroundf(fill);
    const int share = percent < 10 ? 10 : percent > 90 ? 90 : (int)percent;
    int total = 0, target = 0;
    for (int pass = 0; pass < 2; pass++) {
      int row = 0;
      for (int32_t y = maxY; y >= edge; y -= rowStep, row++) for (int32_t x = edge + (row % 2) * (spacing >> 1); x <= maxX; x += spacing) {
        const int64_t dx = x - centerX, dy = y - centerY;
        if (round && dx*dx + dy*dy > limit) continue;
        if (!pass) total++;
        else if (count < target) { qx[count] = x; qy[count++] = y; }
      }
      target = small(MaxParticles, (total * share + 50) / 100);
    }
    toGrid(); updateDensity();
  }
  int cell(int32_t x, int32_t y) const {
    return clampi(x >> 16, 0, nx-1) * ny + clampi(y >> 16, 0, ny-1);
  }
  void keepInside() {
    const int32_t low = One + Radius, highX = (nx-1) * One - Radius, highY = (ny-1) * One - Radius;
    const int64_t limit = (int64_t)rim * rim;
    for (int p = 0; p < count; p++) {
      if (round) {
        const int32_t dx = qx[p] - centerX, dy = qy[p] - centerY;
        const int64_t d2 = (int64_t)dx*dx + (int64_t)dy*dy;
        if (d2 > limit) {
          // Two units inside the rim: the truncated division can overshoot by one.
          const int32_t d = (int32_t)isqrt(d2), inside = rim - 2;
          const int32_t normalX = (int32_t)((int64_t)dx * One / d), normalY = (int32_t)((int64_t)dy * One / d);
          qx[p] = centerX + (int32_t)((int64_t)dx * inside / d); qy[p] = centerY + (int32_t)((int64_t)dy * inside / d);
          const int32_t outward = mul(qvx[p], normalX) + mul(qvy[p], normalY);
          if (outward > 0) { qvx[p] -= mul(outward, normalX); qvy[p] -= mul(outward, normalY); }
        }
      } else {
        if (qx[p] < low) { qx[p] = low; if (qvx[p] < 0) qvx[p] = 0; }
        if (qx[p] > highX) { qx[p] = highX; if (qvx[p] > 0) qvx[p] = 0; }
        if (qy[p] < low) { qy[p] = low; if (qvy[p] < 0) qvy[p] = 0; }
        if (qy[p] > highY) { qy[p] = highY; if (qvy[p] > 0) qvy[p] = 0; }
      }
    }
  }
  void separate() {
    const int64_t limit = (int64_t)Gap * Gap;
    for (int pass = 0; pass < 2; pass++) {
      for (int c = 0; c < nx*ny; c++) head[c] = -1;
      for (int p = 0; p < count; p++) { int c = cell(qx[p], qy[p]); next[p] = head[c]; head[c] = p; }
      for (int p = 0; p < count; p++) {
        const int xi = qx[p] >> 16, yi = qy[p] >> 16;
        for (int i = large(0,xi-1); i <= small(nx-1,xi+1); i++) for (int j = large(0,yi-1); j <= small(ny-1,yi+1); j++) {
          for (int q = head[i*ny+j]; q >= 0; q = next[q]) {
            if (q <= p) continue;
            int32_t dx = qx[q] - qx[p], dy = qy[q] - qy[p];
            int64_t d2 = (int64_t)dx*dx + (int64_t)dy*dy;
            if (d2 >= limit) continue;
            if (d2 == 0) { dx = 7; dy = 5; d2 = 74; }
            // Each particle moves half the overlap: (Gap - d) / 2d of the offset.
            const int32_t d = (int32_t)isqrt32((uint32_t)d2), share = ((Gap - d) << 15) / d;
            const int32_t mx = (int32_t)(((int64_t)dx * share) >> 16), my = (int32_t)(((int64_t)dy * share) >> 16);
            qx[p] -= mx; qy[p] -= my; qx[q] += mx; qy[q] += my;
          }
        }
      }
      keepInside();
    }
  }
  struct Stencil { int cell[4]; int32_t weight[4]; };
  Stencil stencil(int32_t x, int32_t y, int32_t offsetX, int32_t offsetY) const {
    const int32_t sx = clampi(x - offsetX, 0, (nx-1) * One - 66), sy = clampi(y - offsetY, 0, (ny-1) * One - 66);
    const int i = sx >> 16, j = sy >> 16, c = i*ny + j;
    const int32_t tx = sx & 0xFFFF, ty = sy & 0xFFFF, rx = One - tx, ry = One - ty;
    return {{c, c+ny, c+ny+1, c+1}, {mul(rx, ry), mul(tx, ry), mul(tx, ty), mul(rx, ty)}};
  }
  void toGrid() {
    memset(u,0,sizeof(u)); memset(v,0,sizeof(v)); memset(weightU,0,sizeof(weightU)); memset(weightV,0,sizeof(weightV));
    for (int c = 0; c < nx*ny; c++) if (kind[c] != Solid) kind[c] = Air;
    for (int p = 0; p < count; p++) {
      int c = cell(qx[p], qy[p]); if (kind[c] != Solid) kind[c] = Fluid;
      Stencil su = stencil(qx[p], qy[p], 0, Half), sv = stencil(qx[p], qy[p], Half, 0);
      for (int k = 0; k < 4; k++) {
        u[su.cell[k]] += mul(qvx[p], su.weight[k]); weightU[su.cell[k]] += su.weight[k];
        v[sv.cell[k]] += mul(qvy[p], sv.weight[k]); weightV[sv.cell[k]] += sv.weight[k];
      }
    }
    for (int i = 0; i < nx; i++) for (int j = 0; j < ny; j++) {
      int c = i*ny+j;
      if (weightU[c] > 0) u[c] = (int32_t)((int64_t)u[c] * One / weightU[c]);
      if (weightV[c] > 0) v[c] = (int32_t)((int64_t)v[c] * One / weightV[c]);
      if (kind[c] == Solid || i == 0 || kind[c-ny] == Solid) u[c] = 0;
      if (kind[c] == Solid || j == 0 || kind[c-1] == Solid) v[c] = 0;
    }
    memcpy(oldU,u,sizeof(u)); memcpy(oldV,v,sizeof(v));
  }
  void updateDensity() {
    memset(density,0,sizeof(density));
    for (int p = 0; p < count; p++) { Stencil s = stencil(qx[p], qy[p], Half, Half); for (int k = 0; k < 4; k++) density[s.cell[k]] += s.weight[k]; }
    if (restDensity == 0) {
      int64_t sum = 0; int cells = 0;
      for (int c = 0; c < nx*ny; c++) if (kind[c] == Fluid) { sum += density[c]; cells++; }
      restDensity = cells ? (int32_t)(sum / cells) : 0;
    }
  }
  void project(int iterations = 12, bool compensate = true) {
    // -1.6 / open sides: over-relaxed Gauss-Seidel without a division.
    static constexpr int32_t Relax[5] = {0, -104858, -52429, -34953, -26214};
    for (int pass = 0; pass < iterations; pass++) for (int i = 1; i < nx-1; i++) for (int j = 1; j < ny-1; j++) {
      int c = i*ny+j; if (kind[c] != Fluid) continue;
      int left = kind[c-ny] != Solid, right = kind[c+ny] != Solid, up = kind[c-1] != Solid, down = kind[c+1] != Solid;
      int open = left+right+up+down; if (!open) continue;
      int32_t divergence = u[c+ny]-u[c]+v[c+1]-v[c];
      if (compensate && density[c] > restDensity) divergence -= mul(compensation, density[c]-restDensity);
      const int32_t pressure = mul(divergence, Relax[open]);
      u[c] -= left*pressure; u[c+ny] += right*pressure; v[c] -= up*pressure; v[c+1] += down*pressure;
    }
  }
  // 90% FLIP, 10% PIC velocity transfer.
  void toParticles() {
    for (int component = 0; component < 2; component++) {
      int32_t *field = component ? v : u, *old = component ? oldV : oldU, *velocity = component ? qvy : qvx;
      int offset = component ? 1 : ny;
      for (int p = 0; p < count; p++) {
        int32_t weight = 0, pic = 0, change = 0;
        Stencil s = stencil(qx[p], qy[p], component ? Half : 0, component ? 0 : Half);
        for (int k = 0; k < 4; k++) {
          int c = s.cell[k]; int32_t w = s.weight[k];
          if (kind[c] == Fluid || (c >= offset && kind[c-offset] == Fluid)) { weight += w; pic += mul(w, field[c]); change += mul(w, field[c]-old[c]); }
        }
        if (weight > 0) {
          // One 32-bit division per sample instead of two 64-bit ones.
          const int32_t inverse = (1 << 30) / weight;
          const int32_t average = (int32_t)(((int64_t)pic * inverse) >> 14), delta = (int32_t)(((int64_t)change * inverse) >> 14);
          velocity[p] = (int32_t)(((int64_t)(One - Flip) * average + (int64_t)Flip * (velocity[p] + delta)) >> 16);
        }
      }
    }
    limitSpeed();
  }
  void limitSpeed() {
    const int64_t limit = (int64_t)MaxSpeed * MaxSpeed;
    for (int p = 0; p < count; p++) {
      const int64_t d2 = (int64_t)qvx[p]*qvx[p] + (int64_t)qvy[p]*qvy[p];
      if (d2 > limit) {
        const int64_t speed = isqrt(d2);
        qvx[p] = (int32_t)((int64_t)qvx[p] * MaxSpeed / speed); qvy[p] = (int32_t)((int64_t)qvy[p] * MaxSpeed / speed);
      }
    }
  }
  void impulse(float gx = 0, float gy = 1) {
    float length = sqrtf(gx*gx + gy*gy); if (length == 0) length = 1; gx /= length; gy /= length;
    const float cells = span * Step;
    const int32_t kickX = toQ((-gx*1.5f + gy*.6f) * cells), kickY = toQ((-gy*1.5f - gx*.6f) * cells);
    // Swirl (p%7 - 3) * .12 per second, as cells per step per cell: round((k-3) * .003 * One).
    static constexpr int32_t Swirl[7] = {-590, -393, -197, 0, 197, 393, 590};
    for (int p = 0; p < count; p++) {
      const int32_t swirl = Swirl[p % 7];
      qvx[p] += kickX + mul(qy[p] - centerY, swirl); qvy[p] += kickY - mul(qx[p] - centerX, swirl);
    }
    limitSpeed();
  }
  // omega (rad/s) and omegaDot (rad/s²) turn the vessel about the screen axis; 0 for tilt-only water.
  void advance(float dt, float gx = 0, float gy = 4, float omega = 0, float omegaDot = 0) {
    omega = clamp(omega,-12,12); omegaDot = clamp(omegaDot,-40,40);
    // At most two steps per call: a late frame slows the water briefly instead of stalling later frames.
    accumulator = fminf(2*Step, accumulator + clamp(dt,0,.1f));
    if (accumulator < Step-1e-8f) return;
    // Forces become cells per step² (Q16) once per call; the steps themselves are integer only.
    const float stepCells = span * Step * Step;
    const int32_t forceX = toQ(gx * stepCells), forceY = toQ(gy * stepCells);
    const int32_t euler = toQ(omegaDot * Step * Step), coriolis = toQ(2 * omega * Step);
    const float turn = omega * Step;
    const int32_t centrifugal = toQ(turn * turn);
    while (accumulator >= Step-1e-8f) {
      for (int p = 0; p < count; p++) {
        const int32_t rx = qx[p]-centerX, ry = qy[p]-centerY, oldX = qvx[p], oldY = qvy[p];
        // Euler, Coriolis and centrifugal forces in the rotating container frame.
        qvx[p] = mul(oldX + forceX + mul(euler, ry) + mul(coriolis, oldY) + mul(centrifugal, rx), Damping);
        qvy[p] = mul(oldY + forceY - mul(euler, rx) - mul(coriolis, oldX) + mul(centrifugal, ry), Damping);
      }
      limitSpeed();
      for (int p = 0; p < count; p++) { qx[p] += qvx[p]; qy[p] += qvy[p]; }
      keepInside(); separate(); toGrid(); updateDensity(); project(); toParticles(); keepInside(); accumulator -= Step;
    }
  }
  // Density inside the particle domain, so water reaches the walls particles cannot touch.
  int32_t densityAt(int32_t x, int32_t y) const {
    if (round) {
      const int32_t dx = x - centerX, dy = y - centerY;
      const int64_t d2 = (int64_t)dx*dx + (int64_t)dy*dy;
      if (d2 > (int64_t)rim * rim) {
        const int32_t d = (int32_t)isqrt(d2);
        x = centerX + (int32_t)((int64_t)dx * rim / d); y = centerY + (int32_t)((int64_t)dy * rim / d);
      }
    } else {
      x = clampi(x, One + Radius, (nx-1) * One - Radius); y = clampi(y, One + Radius, (ny-1) * One - Radius);
    }
    const Stencil s = stencil(x, y, Half, Half);
    return mul(s.weight[0], density[s.cell[0]]) + mul(s.weight[1], density[s.cell[1]]) +
           mul(s.weight[2], density[s.cell[2]]) + mul(s.weight[3], density[s.cell[3]]);
  }
  // Pixel (i, j) covers simulation x = originX + i*cellX, y = originY + j*cellY (domain units).
  // Returns false if the grid is too large.
  bool rasterize(int cols, int rows, float originX, float originY, float cellX, float cellY, float gx, float gy) {
    if (cols < 1 || rows < 1 || cols > MaxPixelSide || rows > MaxPixelSide || cols * rows > MaxPixels) return false;
    // Pixel geometry in cells; the per-pixel work below is integer only.
    const int32_t left = toQ(originX * span), top = toQ(originY * span), stepX = toQ(cellX * span), stepY = toQ(cellY * span);
    if (stepX < 1 || stepY < 1) return false;
    const int32_t threshold = mul(restDensity, 26214); // 0.4 of rest density
    const int64_t outside = (int64_t)vessel * vessel;
    for (int j = 0; j < rows; j++) {
      const int32_t y = top + (int32_t)(((int64_t)(2*j + 1) * stepY) >> 1);
      for (int i = 0; i < cols; i++) {
        const int32_t x = left + (int32_t)(((int64_t)(2*i + 1) * stepX) >> 1);
        if (round) {
          const int64_t dx = x - centerX, dy = y - centerY;
          if (dx*dx + dy*dy > outside) { pixels[j*cols+i] = 3; continue; }
        }
        pixels[j*cols+i] = densityAt(x, y) > threshold ? 1 : 0;
      }
    }
    for (int p = 0; p < count; p++) {
      if (qx[p] < left || qy[p] < top) continue;
      const int i = (qx[p] - left) / stepX, j = (qy[p] - top) / stepY;
      if (i < cols && j < rows && pixels[j*cols+i] == 0) pixels[j*cols+i] = 1;
    }
    // Surface: a water pixel with an empty pixel above it (the up neighbour and the diagonals beside it).
    const float length = sqrtf(gx*gx+gy*gy), ux = length > 1e-3f ? -gx/length : 0, uy = length > 1e-3f ? -gy/length : -1;
    static const int8_t around[8][2] = {{-1,-1},{0,-1},{1,-1},{-1,0},{1,0},{-1,1},{0,1},{1,1}};
    int up[8][2], ups = 0;
    for (auto &o : around) if ((o[0]*ux+o[1]*uy)/sqrtf((float)(o[0]*o[0]+o[1]*o[1])) > .38f) { up[ups][0] = o[0]; up[ups++][1] = o[1]; }
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      if (pixels[j*cols+i] != 1) continue;
      for (int k = 0; k < ups; k++) {
        const int a = i+up[k][0], b = j+up[k][1];
        if (a >= 0 && a < cols && b >= 0 && b < rows && pixels[b*cols+a] == 0) { pixels[j*cols+i] = 2; break; }
      }
    }
    return true;
  }
  // Shades the last rasterize() by depth: two pixels per shade, counted toward -gravity.
  // A body pixel keeps its shade until its depth moves a whole pixel past that shade's band,
  // so a surface rippling by one pixel leaves the colours below it still.
  const uint8_t *shade(int cols, int rows, float gx, float gy) {
    if (cols < 1 || rows < 1 || cols > MaxPixelSide || rows > MaxPixelSide || cols * rows > MaxPixels) return look;
    if (cols != lookCols || rows != lookRows) { memset(look, 0, sizeof(look)); lookCols = cols; lookRows = rows; }
    const float length = sqrtf(gx*gx+gy*gy), ux = length > 1e-3f ? -gx/length : 0, uy = length > 1e-3f ? -gy/length : -1;
    static const int8_t around[8][2] = {{-1,-1},{0,-1},{1,-1},{-1,0},{1,0},{-1,1},{0,1},{1,1}};
    int dx = 0, dy = -1; float best = -2;
    for (auto &o : around) {
      const float d = (o[0]*ux+o[1]*uy)/sqrtf((float)(o[0]*o[0]+o[1]*o[1]));
      if (d > best) { best = d; dx = o[0]; dy = o[1]; }
    }
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      const int c = j*cols+i, value = pixels[c];
      if (value != 1) { look[c] = value == 2 ? 1 : 0; continue; }
      int depth = 0;
      for (int a = i+dx, b = j+dy; depth < 8 && a >= 0 && a < cols && b >= 0 && b < rows; a += dx, b += dy) {
        const int above = pixels[b*cols+a];
        if (above != 1 && above != 2) break;
        depth++;
      }
      const int was = look[c] - 3;
      if (was >= 0 && was <= 3 && depth >= 2*was && (was == 3 || depth <= 2*was+3)) continue;
      look[c] = (uint8_t)(3 + small(3, (depth > 0 ? depth-1 : 0) / 2));
    }
    return look;
  }

 private:
  // Particle radius .32 cell; separation keeps centres two radii apart.
  static constexpr int32_t Radius = 20972, Gap = 2 * Radius;
  // Rim .8 cell inside the vessel, top speed .65 cell per step, damping .996, FLIP share .9.
  static constexpr int32_t RimInset = 52429, MaxSpeed = 42598, Damping = 65274, Flip = 58982;
  int span = 18, lookCols = 0, lookRows = 0;
  int32_t centerX = 0, centerY = 0, vessel = 0, rim = 0, compensation = 0;
};
