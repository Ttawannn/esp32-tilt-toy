#pragma once
#include <cstdint>
#include <cstring>

// Pixel Flow: every drop is one display cell with its own Q8 velocity (256 = one cell per step).
// Integer only and fixed storage. Mirrored line for line by web/pixel-flow.js; both give the same grid.
// Named PixelDrops because PixelFlow is already the ToyMode in toy_modes.h.
class PixelDrops {
 public:
  static constexpr int MaxCols = 64, MaxRows = 64, MaxCells = 2048, MaxDrops = 1900;
  enum Shape { Rect = 0, Rounded = 1, Circle = 2 };
  static constexpr uint32_t StepMs = 33;  // 30 steps per second
  // Solver force 4 (one g at sensitivity 1) becomes 64 Q8, about a quarter cell per step².
  static constexpr int ForceToQ8 = 16;
  static constexpr int16_t Wall = -2, Empty = -1;
  int cols = 0, rows = 0, shape = Rounded, usable = 0, count = 0;
  int16_t grid[MaxCells]{};
  uint8_t look[MaxCells]{};
  uint8_t col[MaxDrops]{}, row[MaxDrops]{}, fx[MaxDrops]{}, fy[MaxDrops]{}, stamp[MaxDrops]{};
  int16_t vx[MaxDrops]{}, vy[MaxDrops]{}, order[MaxDrops]{}, scratch[MaxDrops]{};

  // Convert a solver force (toy_modes.h units) to Q8 cells per step², rounding half away from zero.
  static int forceToQ8(float force) { const float q = force*ForceToQ8; return (int)(q < 0 ? q-.5f : q+.5f); }
  // Nearest of the eight directions to (x, y); down when both are zero.
  static int direction(int x, int y) {
    const int ax = absolute(x), ay = absolute(y);
    if (ax == 0 && ay == 0) return 2;
    if (ay*5 < ax*2) return x > 0 ? 0 : 4;
    if (ax*5 < ay*2) return y < 0 ? 6 : 2;
    return x > 0 ? (y > 0 ? 1 : 7) : (y > 0 ? 3 : 5);
  }
  // Pitch is the cell spacing on screen; each drop is drawn pitch-1 pixels wide, leaving a dark gap.
  struct Layout { int pitch, cols, rows, x, y, shape; };
  static Layout layout(int width, int height, bool round, bool mono) {
    const int shortest = width < height ? width : height, pitch = shortest >= 200 ? 6 : shortest >= 80 ? 4 : 2;
    const int c = smaller(MaxCols, width/pitch), r = smaller(MaxRows, height/pitch);
    return {pitch, c, r, (width-c*pitch) >> 1, (height-r*pitch) >> 1, round ? Circle : mono ? Rect : Rounded};
  }

  bool configure(int columns, int rowCount, int vessel) {
    if (columns < 4 || rowCount < 4 || columns > MaxCols || rowCount > MaxRows || columns*rowCount > MaxCells) return false;
    cols = columns; rows = rowCount; shape = vessel; usable = 0; count = 0;
    // Doubled coordinates keep cell centres on integers.
    const int side = smaller(cols, rows), corner = 2*larger(2, side/8);
    for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
      const int x = 2*i+1, y = 2*j+1; bool wall = false;
      if (shape == Circle) { const int dx = x-cols, dy = y-rows; wall = dx*dx+dy*dy > side*side; }
      else if (shape == Rounded) {
        const int ex = smaller(x, 2*cols-x), ey = smaller(y, 2*rows-y);
        if (ex < corner && ey < corner) { const int dx = corner-ex, dy = corner-ey; wall = dx*dx+dy*dy > corner*corner; }
      }
      grid[j*cols+i] = wall ? Wall : Empty; if (!wall) usable++;
    }
    return true;
  }
  // Fill the cells deepest along gravity first, so the water starts at rest.
  void reset(int fill = 50, int ax = 0, int ay = 64, uint32_t startSeed = 1) {
    const int cells = cols*rows;
    for (int c = 0; c < cells; c++) if (grid[c] != Wall) grid[c] = Empty;
    seed = startSeed ? startSeed : 1; steps = 0; count = 0;
    const int target = smaller(MaxDrops, usable*clamp(fill, 10, 90)/100);
    const int d = direction(ax, ay), span = cols+rows;
    for (int depth = span; depth >= -span && count < target; depth--)
      for (int j = 0; j < rows && count < target; j++) for (int i = 0; i < cols && count < target; i++) {
        const int c = j*cols+i;
        if (grid[c] != Empty || i*DX[d]+j*DY[d] != depth) continue;
        const int p = count++;
        col[p] = (uint8_t)i; row[p] = (uint8_t)j; fx[p] = 128; fy[p] = 128; vx[p] = 0; vy[p] = 0; grid[c] = (int16_t)p;
      }
  }
  void step(int ax, int ay) {
    ax = clamp(ax, -MaxForce, MaxForce); ay = clamp(ay, -MaxForce, MaxForce);
    const int g = direction(ax, ay); const bool pulled = absolute(ax)+absolute(ay) >= 4; const uint32_t odd = steps & 1;
    steps++;
    sortDrops(g, odd == 1);
    for (int k = 0; k < count; k++) moveDrop(order[k], ax, ay, g, pulled);
    if (odd) blend();
    if (pulled) level(ax, ay, g);
  }
  // Throw the drops near the surface up against gravity, with a random sideways part.
  void shake(int ax = 0, int ay = 64) {
    const int g = direction(ax, ay), up = (g+4)&7, across = (g+2)&7;
    for (int p = 0; p < count; p++) {
      if (!nearSurface(p, up)) continue;
      const int lift = 384+(int)(nextRandom()%385u), side = (int)(nextRandom()%513u)-256;
      vx[p] = (int16_t)clamp(vx[p]+DX[up]*lift+DX[across]*side, -MaxSpeed, MaxSpeed);
      vy[p] = (int16_t)clamp(vy[p]+DY[up]*lift+DY[across]*side, -MaxSpeed, MaxSpeed);
    }
  }
  // Add velocity to drops within radius cells of (i, j).
  void push(int i, int j, int addX, int addY, int radius = 3) {
    for (int p = 0; p < count; p++) {
      const int dx = col[p]-i, dy = row[p]-j;
      if (dx*dx+dy*dy > radius*radius) continue;
      vx[p] = (int16_t)clamp(vx[p]+addX, -MaxSpeed, MaxSpeed); vy[p] = (int16_t)clamp(vy[p]+addY, -MaxSpeed, MaxSpeed);
    }
  }
  // look: 0 empty or wall, 1 surface, 2 fast spray, 3-6 body from just below the surface to deep.
  // An empty cell with drops on three or four sides is drawn as body, so a moving mass stays solid.
  const uint8_t *shade(int ax, int ay, uint32_t frame = 0) {
    const int g = direction(ax, ay), up = (g+4)&7, upA = (up+1)&7, upB = (up+7)&7;
    const uint32_t tick = (frame >> 3) & 255;
    memset(look, 0, (size_t)(cols*rows));
    for (int p = 0; p < count; p++) {
      const int i = col[p], j = row[p]; int value;
      if (emptyToward(p, up) || emptyToward(p, upA) || emptyToward(p, upB)) value = 1;
      else if (absolute(vx[p])+absolute(vy[p]) > 384) value = 2;
      else {
        int n = 0;
        for (int k = 1; k <= 4; k++) { const int a = i+DX[up]*k, b = j+DY[up]*k; if (a < 0 || a >= cols || b < 0 || b >= rows || grid[b*cols+a] < 0) break; n++; }
        value = 2+larger(1, n);
        // A slow shimmer: about one body drop in four is a shade lighter or darker for eight frames.
        uint32_t h = (uint32_t)i | (uint32_t)j << 8 | tick << 16;
        h = (h ^ (h >> 15)) * 0x2c1b3c6du; h ^= h >> 12; h *= 0x297a2d39u; h = (h ^ (h >> 15)) & 7;
        if (h == 0 && value > 3) value--; else if (h == 1 && value < 6) value++;
      }
      look[j*cols+i] = (uint8_t)value;
    }
    for (int j = 1; j < rows-1; j++) for (int i = 1; i < cols-1; i++) {
      const int c = j*cols+i;
      if (grid[c] == Empty && (grid[c-1] >= 0)+(grid[c+1] >= 0)+(grid[c-cols] >= 0)+(grid[c+cols] >= 0) >= 3) look[c] = 3;
    }
    return look;
  }

 private:
  static constexpr int MaxSpeed = 768, MaxForce = 256, Fast = 512, Slide = 2, LevelMoves = 3, Buckets = 2*(MaxCols+MaxRows)+1;
  // Eight directions clockwise from +x, with y pointing down the screen.
  static constexpr int8_t DX[8] = {1, 1, 0, -1, -1, -1, 0, 1}, DY[8] = {0, 1, 1, 1, 0, -1, -1, -1};
  static constexpr int8_t StepDir[9] = {5, 6, 7, 4, -1, 0, 3, 2, 1};
  uint32_t seed = 1, steps = 0;
  uint16_t bucket[Buckets]{};

  static int absolute(int v) { return v < 0 ? -v : v; }
  static int smaller(int a, int b) { return a < b ? a : b; }
  static int larger(int a, int b) { return a > b ? a : b; }
  static int clamp(int v, int low, int high) { return v < low ? low : v > high ? high : v; }
  uint32_t nextRandom() { uint32_t x = seed; x ^= x << 13; x ^= x >> 17; x ^= x << 5; seed = x; return seed; }
  // Cell content: a drop index, Empty, or Wall (also outside the grid).
  int at(int i, int j) const { return i >= 0 && i < cols && j >= 0 && j < rows ? grid[j*cols+i] : Wall; }
  bool empty(int i, int j) const { return at(i, j) == Empty; }
  bool emptyToward(int p, int d) const { return empty(col[p]+DX[d], row[p]+DY[d]); }
  void moveTo(int p, int d) {
    grid[row[p]*cols+col[p]] = Empty;
    col[p] = (uint8_t)(col[p]+DX[d]); row[p] = (uint8_t)(row[p]+DY[d]); grid[row[p]*cols+col[p]] = (int16_t)p;
  }
  // Stable counting sort of drops from src to dst by col*dx+row*dy.
  void sortPass(const int16_t *src, int16_t *dst, int dx, int dy, bool descending, bool identity) {
    const int span = cols+rows, size = 2*span+1;
    memset(bucket, 0, sizeof(bucket[0])*size);
    for (int k = 0; k < count; k++) { const int p = identity ? k : src[k]; bucket[col[p]*dx+row[p]*dy+span]++; }
    int at = 0;
    for (int b = 0; b < size; b++) { const int key = descending ? size-1-b : b, n = bucket[key]; bucket[key] = (uint16_t)at; at += n; }
    for (int k = 0; k < count; k++) { const int p = identity ? k : src[k]; dst[bucket[col[p]*dx+row[p]*dy+span]++] = (int16_t)p; }
  }
  // Deepest drops move first, so the ones above can follow. Ties alternate sides every step.
  void sortDrops(int g, bool flip) {
    const int across = (g+2)&7;
    sortPass(scratch, scratch, DX[across], DY[across], flip, true);
    sortPass(scratch, order, DX[g], DY[g], true, false);
  }
  // One cell step. Blocked: slide 45° (downhill first), uphill only when moving fast.
  bool tryStep(int p, int mx, int my, int ax, int ay, bool fast) {
    const int d = StepDir[(my+1)*3+mx+1];
    if (emptyToward(p, d)) { moveTo(p, d); return true; }
    const int a = (d+1)&7, b = (d+7)&7, da = DX[a]*ax+DY[a]*ay, db = DX[b]*ax+DY[b]*ay;
    const int first = da > db ? a : db > da ? b : (nextRandom()&1 ? a : b), second = first == a ? b : a;
    for (int e : {first, second}) {
      if ((fast || DX[e]*ax+DY[e]*ay >= 0) && emptyToward(p, e)) { moveTo(p, e); return true; }
    }
    return false;
  }
  void moveDrop(int p, int ax, int ay, int g, bool pulled) {
    const uint8_t tick = (uint8_t)(steps & 255); stamp[p] = tick;
    int velX = vx[p]+ax, velY = vy[p]+ay;
    velX -= velX/64; velY -= velY/64;
    velX = clamp(velX, -MaxSpeed, MaxSpeed); velY = clamp(velY, -MaxSpeed, MaxSpeed);
    const int subX = fx[p]+velX, subY = fy[p]+velY;
    const int nx = subX >> 8, ny = subY >> 8, adx = absolute(nx), ady = absolute(ny), moves = larger(adx, ady);
    fx[p] = (uint8_t)(subX & 255); fy[p] = (uint8_t)(subY & 255);
    const int sx = nx > 0 ? 1 : nx < 0 ? -1 : 0, sy = ny > 0 ? 1 : ny < 0 ? -1 : 0;
    const bool fast = absolute(velX)+absolute(velY) >= Fast;
    int ex = 0, ey = 0;
    for (int k = 0; k < moves; k++) {
      ex += adx; ey += ady; int mx = 0, my = 0;
      if (2*ex >= moves) { mx = sx; ex -= moves; }
      if (2*ey >= moves) { my = sy; ey -= moves; }
      if (tryStep(p, mx, my, ax, ay, fast)) continue;
      // Blocked by a drop that has not moved yet this step: wait for it and keep the speed, so a body
      // moving together stays together. A drop that already moved or stopped caps the speed toward it.
      // A wall stops the motion into it and rubs off 1/8.
      const int i = col[p], j = row[p];
      int hitX = mx != 0 ? at(i+mx, j) : Empty, hitY = my != 0 ? at(i, j+my) : Empty;
      if (hitX == Empty && hitY == Empty) hitX = hitY = at(i+mx, j+my);
      if (hitX >= 0 && stamp[hitX] == tick && (velX-vx[hitX])*mx > 0) velX = vx[hitX];
      if (hitY >= 0 && stamp[hitY] == tick && (velY-vy[hitY])*my > 0) velY = vy[hitY];
      if (hitX == Wall || hitY == Wall) {
        // Stopped axes restart from the cell centre, so a resting body moves off in step.
        if (hitX == Wall) { velX = 0; fx[p] = 128; }
        if (hitY == Wall) { velY = 0; fy[p] = 128; }
        velX -= velX/8; velY -= velY/8;
      }
      break;
    }
    // A supported drop spreads sideways, which levels the surface. On a tilted surface it only goes downhill.
    if (pulled && !emptyToward(p, g) && !emptyToward(p, (g+1)&7) && !emptyToward(p, (g+7)&7)) {
      const int left = (g+2)&7, right = (g+6)&7, slope = DX[left]*ax+DY[left]*ay, along = velX*DX[left]+velY*DY[left];
      const bool tilted = 4*absolute(slope) > norm(ax, ay);
      int side = tilted ? (slope > 0 ? left : right) : along > 0 ? left : along < 0 ? right : (nextRandom()&1 ? left : right), slid = 0;
      if (!tilted && along == 0 && !emptyToward(p, side)) side = side == left ? right : left;
      while (slid < Slide && emptyToward(p, side)) {
        moveTo(p, side); slid++;
        if (emptyToward(p, g) || emptyToward(p, (g+1)&7) || emptyToward(p, (g+7)&7)) break;
      }
      velX -= velX/8; velY -= velY/8;
      if (!slid && !velX && !velY) { fx[p] = 128; fy[p] = 128; }
    }
    vx[p] = (int16_t)clamp(velX, -MaxSpeed, MaxSpeed); vy[p] = (int16_t)clamp(velY, -MaxSpeed, MaxSpeed);
  }
  // Integer length of (x, y), within about 12%.
  static int norm(int x, int y) { const int a = absolute(x), b = absolute(y); return a > b ? a+(b >> 1) : b+(a >> 1); }
  bool resting(int p, int g) const { return !emptyToward(p, g) && absolute(vx[p])+absolute(vy[p]) < 128; }
  // Stand-in for pressure: the grid moves only in eight directions, so a gently tilted pool cannot
  // level itself. Move a few resting drops from the highest point of the surface to the lowest
  // resting place, measured along the true gravity, until they differ by less than one cell.
  void level(int ax, int ay, int g) {
    const int up = (g+4)&7, upA = (up+1)&7, upB = (up+7)&7, cell = norm(ax, ay);
    for (int n = 0; n < LevelMoves; n++) {
      int source = -1, high = 0, target = -1, low = 0;
      for (int p = 0; p < count; p++) {
        if (!resting(p, g) || !(emptyToward(p, up) || emptyToward(p, upA) || emptyToward(p, upB))) continue;
        const int depth = col[p]*ax+row[p]*ay;
        if (source < 0 || depth < high) { source = p; high = depth; }
      }
      if (source < 0) return;
      for (int j = 0; j < rows; j++) for (int i = 0; i < cols; i++) {
        if (grid[j*cols+i] != Empty) continue;
        const int a = i+DX[g], b = j+DY[g];
        if (a >= 0 && a < cols && b >= 0 && b < rows && grid[b*cols+a] == Empty) continue;
        const int depth = i*ax+j*ay;
        if (target < 0 || depth > low) { target = j*cols+i; low = depth; }
      }
      if (target < 0 || low-high < cell) return;
      grid[row[source]*cols+col[source]] = Empty;
      col[source] = (uint8_t)(target%cols); row[source] = (uint8_t)(target/cols); grid[target] = (int16_t)source;
      vx[source] = 0; vy[source] = 0; fx[source] = 128; fy[source] = 128;
    }
  }
  // Pull each drop's velocity toward its touching neighbours, so water moves as a body, not as sand.
  void blend() {
    for (int k = 0; k < count; k++) {
      const int p = order[k], i = col[p], j = row[p]; int sx = 0, sy = 0, n = 0;
      for (int d = 0; d < 8; d += 2) {
        const int a = i+DX[d], b = j+DY[d];
        if (a < 0 || a >= cols || b < 0 || b >= rows) continue;
        const int q = grid[b*cols+a]; if (q < 0) continue;
        sx += vx[q]; sy += vy[q]; n++;
      }
      if (n) { vx[p] = (int16_t)(vx[p]+(sx/n-vx[p])/8); vy[p] = (int16_t)(vy[p]+(sy/n-vy[p])/8); }
    }
  }
  // Is there air within four cells above the drop (opposite to gravity)?
  bool nearSurface(int p, int up) const {
    for (int k = 1; k <= 4; k++) {
      const int a = col[p]+DX[up]*k, b = row[p]+DY[up]*k;
      if (a < 0 || a >= cols || b < 0 || b >= rows) return false;
      const int q = grid[b*cols+a];
      if (q == Empty) return true;
      if (q == Wall) return false;
    }
    return false;
  }
};
