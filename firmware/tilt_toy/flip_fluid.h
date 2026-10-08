#pragma once
#include <cmath>
#include <cstdint>
#include <cstring>

// Compact adaptation of Ten Minute Physics example 18, by Matthias Müller.
// Fixed storage, tilt gravity, circular walls and a linked-cell neighbour search.
// The same equations and budgets are used in web/fluid.js.
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
  enum { Fluid = 0, Air = 1, Solid = 2 };
  int nx = 20, ny = 20, count = 0;
  bool round = true;
  float h = 1.0f / 18, radius = 0, cx = 0, cy = 0, vesselRadius = 0;
  float restDensity = 0, accumulator = 0;
  float x[MaxParticles]{}, y[MaxParticles]{}, vx[MaxParticles]{}, vy[MaxParticles]{};
  float u[MaxCells]{}, v[MaxCells]{}, oldU[MaxCells]{}, oldV[MaxCells]{};
  float weightU[MaxCells]{}, weightV[MaxCells]{}, density[MaxCells]{};
  uint8_t kind[MaxCells]{};
  int16_t head[MaxCells]{}, next[MaxParticles]{};
  // Square-pixel view for drawing, mirrored by pixelWater() in web/fluid.js.
  // 0 empty, 1 water, 2 surface (open toward -gravity), 3 outside the vessel.
  static constexpr int MaxPixelSide = 64;
  uint8_t pixels[MaxPixelSide * MaxPixelSide]{};

  static float clamp(float value, float low, float high) { return fmaxf(low, fminf(high, value)); }
  static int small(int a, int b) { return a < b ? a : b; }
  static int large(int a, int b) { return a > b ? a : b; }
  bool configure(int width, int height, bool circular, float fill = 50) {
    if (width < 4 || height < 4 || width * height > MaxCells) return false;
    nx = width; ny = height; round = circular; h = 1.0f / (small(nx, ny) - 2);
    radius = .32f * h; cx = nx * h * .5f; cy = ny * h * .5f; vesselRadius = (small(nx, ny) - 2) * h * .5f;
    for (int i = 0; i < nx; i++) for (int j = 0; j < ny; j++) {
      float dx = (i + .5f) * h - cx, dy = (j + .5f) * h - cy;
      kind[i * ny + j] = (i == 0 || j == 0 || i == nx-1 || j == ny-1 ||
          (round && dx*dx + dy*dy > vesselRadius*vesselRadius)) ? Solid : Air;
    }
    reset(fill); return true;
  }
  void reset(float fill = 50) {
    count = 0; accumulator = 0; restDensity = 0;
    memset(u, 0, sizeof(u)); memset(v, 0, sizeof(v));
    memset(oldU, 0, sizeof(oldU)); memset(oldV, 0, sizeof(oldV));
    memset(vx, 0, sizeof(vx)); memset(vy, 0, sizeof(vy));
    const float spacing = 2.12f * radius, dy = spacing * .8660254f;
    const float edge = h + radius, maxX = (nx - 1) * h - radius, maxY = (ny - 1) * h - radius;
    int total = 0, target = 0;
    for (int pass = 0; pass < 2; pass++) {
      int row = 0;
      for (float py = maxY; py >= edge; py -= dy, row++) for (float px = edge + (row % 2) * spacing * .5f; px <= maxX; px += spacing) {
        if (round && hypotf(px-cx, py-cy) > vesselRadius - .8f*h) continue;
        if (!pass) total++;
        else if (count < target) { x[count] = px; y[count++] = py; }
      }
      target = small(MaxParticles, (int)roundf(total * clamp(fill, 10, 90) / 100));
    }
    toGrid(); updateDensity();
  }
  int cell(float px, float py) const {
    return (int)clamp(floorf(px / h), 0, nx-1) * ny + (int)clamp(floorf(py / h), 0, ny-1);
  }
  void keepInside() {
    const float min = h + radius, maxX = (nx-1)*h-radius, maxY = (ny-1)*h-radius, r = vesselRadius - .8f*h;
    for (int p = 0; p < count; p++) {
      if (round) {
        float dx = x[p]-cx, dy = y[p]-cy, d2 = dx*dx+dy*dy;
        if (d2 > r*r) {
          float d = sqrtf(d2), normalX = dx/d, normalY = dy/d;
          x[p] = cx + normalX*r; y[p] = cy + normalY*r;
          float outward = vx[p]*normalX + vy[p]*normalY;
          if (outward > 0) { vx[p] -= outward*normalX; vy[p] -= outward*normalY; }
        }
      } else {
        if (x[p] < min) { x[p] = min; vx[p] = fmaxf(0, vx[p]); }
        if (x[p] > maxX) { x[p] = maxX; vx[p] = fminf(0, vx[p]); }
        if (y[p] < min) { y[p] = min; vy[p] = fmaxf(0, vy[p]); }
        if (y[p] > maxY) { y[p] = maxY; vy[p] = fminf(0, vy[p]); }
      }
    }
  }
  void separate() {
    const float distance = 2 * radius;
    for (int pass = 0; pass < 2; pass++) {
      for (int c = 0; c < nx*ny; c++) head[c] = -1;
      for (int p = 0; p < count; p++) { int c = cell(x[p],y[p]); next[p] = head[c]; head[c] = p; }
      for (int p = 0; p < count; p++) {
        int xi = (int)floorf(x[p]/h), yi = (int)floorf(y[p]/h);
        for (int i = large(0,xi-1); i <= small(nx-1,xi+1); i++) for (int j = large(0,yi-1); j <= small(ny-1,yi+1); j++) {
          for (int q = head[i*ny+j]; q >= 0; q = next[q]) {
            if (q <= p) continue;
            float dx = x[q]-x[p], dy = y[q]-y[p], d2 = dx*dx+dy*dy;
            if (d2 >= distance*distance) continue;
            if (d2 < 1e-12f) { dx = h*.0001f; dy = h*.00007f; d2 = dx*dx+dy*dy; }
            float d = sqrtf(d2), scale = .5f*(distance-d)/d; dx *= scale; dy *= scale;
            x[p] -= dx; y[p] -= dy; x[q] += dx; y[q] += dy;
          }
        }
      }
      keepInside();
    }
  }
  struct Stencil { int cell[4]; float weight[4]; };
  Stencil stencil(float px, float py, float offsetX, float offsetY) const {
    float sx = clamp(px/h-offsetX,0,nx-1.001f), sy = clamp(py/h-offsetY,0,ny-1.001f);
    int i = (int)floorf(sx), j = (int)floorf(sy), c = i*ny+j;
    float tx = sx-i, ty = sy-j;
    return {{c,c+ny,c+ny+1,c+1}, {(1-tx)*(1-ty),tx*(1-ty),tx*ty,(1-tx)*ty}};
  }
  void toGrid() {
    memset(u,0,sizeof(u)); memset(v,0,sizeof(v)); memset(weightU,0,sizeof(weightU)); memset(weightV,0,sizeof(weightV));
    for (int c = 0; c < nx*ny; c++) if (kind[c] != Solid) kind[c] = Air;
    for (int p = 0; p < count; p++) {
      int c = cell(x[p],y[p]); if (kind[c] != Solid) kind[c] = Fluid;
      Stencil su = stencil(x[p],y[p],0,.5f), sv = stencil(x[p],y[p],.5f,0);
      for (int k = 0; k < 4; k++) {
        u[su.cell[k]] += vx[p]*su.weight[k]; weightU[su.cell[k]] += su.weight[k];
        v[sv.cell[k]] += vy[p]*sv.weight[k]; weightV[sv.cell[k]] += sv.weight[k];
      }
    }
    for (int i = 0; i < nx; i++) for (int j = 0; j < ny; j++) {
      int c = i*ny+j;
      if (weightU[c] > 0) u[c] /= weightU[c]; if (weightV[c] > 0) v[c] /= weightV[c];
      if (kind[c] == Solid || i == 0 || kind[c-ny] == Solid) u[c] = 0;
      if (kind[c] == Solid || j == 0 || kind[c-1] == Solid) v[c] = 0;
    }
    memcpy(oldU,u,sizeof(u)); memcpy(oldV,v,sizeof(v));
  }
  void updateDensity() {
    memset(density,0,sizeof(density));
    for (int p = 0; p < count; p++) { Stencil s = stencil(x[p],y[p],.5f,.5f); for (int k = 0; k < 4; k++) density[s.cell[k]] += s.weight[k]; }
    if (restDensity == 0) {
      float sum = 0; int cells = 0;
      for (int c = 0; c < nx*ny; c++) if (kind[c] == Fluid) { sum += density[c]; cells++; }
      restDensity = cells ? sum/cells : 0;
    }
  }
  void project(int iterations = 12, bool compensate = true) {
    for (int pass = 0; pass < iterations; pass++) for (int i = 1; i < nx-1; i++) for (int j = 1; j < ny-1; j++) {
      int c = i*ny+j; if (kind[c] != Fluid) continue;
      int left = kind[c-ny] != Solid, right = kind[c+ny] != Solid, up = kind[c-1] != Solid, down = kind[c+1] != Solid;
      int open = left+right+up+down; if (!open) continue;
      float divergence = u[c+ny]-u[c]+v[c+1]-v[c];
      if (compensate) divergence -= .03f*fmaxf(0,density[c]-restDensity);
      float pressure = -1.6f*divergence/open;
      u[c] -= left*pressure; u[c+ny] += right*pressure; v[c] -= up*pressure; v[c+1] += down*pressure;
    }
  }
  void toParticles(float flip = .9f) {
    flip = clamp(flip,0,1);
    for (int component = 0; component < 2; component++) {
      float *field = component ? v : u, *old = component ? oldV : oldU, *velocity = component ? vy : vx;
      int offset = component ? 1 : ny;
      for (int p = 0; p < count; p++) {
        float weight = 0, pic = 0, change = 0;
        Stencil s = stencil(x[p],y[p],component ? .5f : 0, component ? 0 : .5f);
        for (int k = 0; k < 4; k++) {
          int c = s.cell[k]; float w = s.weight[k];
          if (kind[c] == Fluid || (c >= offset && kind[c-offset] == Fluid)) { weight += w; pic += w*field[c]; change += w*(field[c]-old[c]); }
        }
        if (weight > 0) velocity[p] = (1-flip)*pic/weight + flip*(velocity[p]+change/weight);
      }
    }
    limitSpeed();
  }
  void limitSpeed() {
    const float max = .65f*h/Step;
    for (int p = 0; p < count; p++) { float d2 = vx[p]*vx[p]+vy[p]*vy[p]; if (d2 > max*max) { float factor = max/sqrtf(d2); vx[p] *= factor; vy[p] *= factor; } }
  }
  void impulse(float gx = 0, float gy = 1) {
    float length = hypotf(gx,gy); if (length == 0) length = 1; gx /= length; gy /= length;
    for (int p = 0; p < count; p++) { float swirl = (p%7-3)*.12f; vx[p] += -gx*1.5f+gy*.6f+(y[p]-cy)*swirl; vy[p] += -gy*1.5f-gx*.6f-(x[p]-cx)*swirl; }
    limitSpeed();
  }
  void advance(float dt, float gx = 0, float gy = 4, float omega = 0, float omegaDot = 0, float flip = .9f, float wallDrag = 0) {
    omega = clamp(omega,-12,12); omegaDot = clamp(omegaDot,-40,40);
    wallDrag = clamp(wallDrag,0,.5f);
    accumulator = fminf(.075f,accumulator+clamp(dt,0,.1f));
    while (accumulator >= Step-1e-8f) {
      for (int p = 0; p < count; p++) {
        const float rx = x[p]-cx, ry = y[p]-cy, oldX = vx[p], oldY = vy[p];
        // Euler, Coriolis and centrifugal forces in the rotating container frame.
        vx[p] = (oldX+(gx+omegaDot*ry+2*omega*oldY+omega*omega*rx)*Step)*.996f;
        vy[p] = (oldY+(gy-omegaDot*rx-2*omega*oldX+omega*omega*ry)*Step)*.996f;
        // The wall is stationary in this frame. Drag damps relative velocity near it.
        if (wallDrag > 0) {
          const bool nearWall = round ? hypotf(rx,ry) > vesselRadius-1.8f*h :
            x[p] < 2*h+radius || x[p] > (nx-2)*h-radius || y[p] < 2*h+radius || y[p] > (ny-2)*h-radius;
          if (nearWall) { vx[p] *= 1-wallDrag; vy[p] *= 1-wallDrag; }
        }
      }
      limitSpeed();
      for (int p = 0; p < count; p++) { x[p] += vx[p]*Step; y[p] += vy[p]*Step; }
      keepInside(); separate(); toGrid(); updateDensity(); project(); toParticles(flip); keepInside(); accumulator -= Step;
    }
  }
  // Density inside the particle domain, so water reaches the walls particles cannot touch.
  float densityAt(float px, float py) const {
    if (round) {
      const float dx = px-cx, dy = py-cy, d = sqrtf(dx*dx+dy*dy), rim = vesselRadius - .8f*h;
      if (d > rim) { px = cx + dx/d*rim; py = cy + dy/d*rim; }
    } else {
      px = clamp(px, h+radius, (nx-1)*h-radius); py = clamp(py, h+radius, (ny-1)*h-radius);
    }
    const float sx = clamp(px/h-.5f, 0, nx-1.001f), sy = clamp(py/h-.5f, 0, ny-1.001f);
    const int i = (int)sx, j = (int)sy, c = i*ny+j;
    const float tx = sx-i, ty = sy-j;
    return (1-tx)*(1-ty)*density[c] + tx*(1-ty)*density[c+ny] + (1-tx)*ty*density[c+1] + tx*ty*density[c+ny+1];
  }
  // Pixel (i, j) covers simulation x = originX + i*cellX, y = originY + j*cellY. Returns false if the grid is too large.
  bool rasterize(int cols, int rows, float originX, float originY, float cellX, float cellY, float gx, float gy) {
    if (cols < 1 || rows < 1 || cols > MaxPixelSide || rows > MaxPixelSide) return false;
    const float threshold = restDensity*.4f;
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      const float px = originX+(i+.5f)*cellX, py = originY+(j+.5f)*cellY;
      pixels[j*cols+i] = round && hypotf(px-cx, py-cy) > vesselRadius ? 3 : densityAt(px, py) > threshold ? 1 : 0;
    }
    for (int p = 0; p < count; p++) {
      const int i = (int)floorf((x[p]-originX)/cellX), j = (int)floorf((y[p]-originY)/cellY);
      if (i >= 0 && i < cols && j >= 0 && j < rows && pixels[j*cols+i] == 0) pixels[j*cols+i] = 1;
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
};
