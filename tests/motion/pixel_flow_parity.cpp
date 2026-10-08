#include <iostream>
#include <cstdint>
#include "../../firmware/tilt_toy/pixel_flow.h"
// The sketch includes both; this catches name clashes with the ToyMode enum.
#include "../../firmware/tilt_toy/toy_modes.h"

// Reads commands from tests/pixel-flow.test.mjs and prints FNV-1a hashes of the same state the JS engine hashes.
static uint32_t fnvAdd(uint32_t h, int value) { h ^= (uint32_t)value & 0xffffu; return h * 16777619u; }
static uint32_t stateHash(const PixelDrops &f) {
  uint32_t h = 2166136261u;
  for (int c = 0; c < f.cols*f.rows; c++) h = fnvAdd(h, f.grid[c]);
  for (int p = 0; p < f.count; p++) h = fnvAdd(h, f.vx[p]);
  for (int p = 0; p < f.count; p++) h = fnvAdd(h, f.vy[p]);
  for (int p = 0; p < f.count; p++) h = fnvAdd(h, f.fx[p]);
  for (int p = 0; p < f.count; p++) h = fnvAdd(h, f.fy[p]);
  return h;
}

int main() {
  static PixelDrops f;
  char kind;
  while (std::cin >> kind) {
    if (kind == 'C') {
      int cols, rows, shape, fill; uint32_t seed;
      std::cin >> cols >> rows >> shape >> fill >> seed;
      if (!f.configure(cols, rows, shape)) return 2;
      f.reset(fill, 0, 64, seed);
      std::cout << f.count << ' ' << stateHash(f) << '\n';
    } else if (kind == 'S') {
      int ax, ay; std::cin >> ax >> ay;
      f.step(ax, ay);
      std::cout << stateHash(f) << '\n';
    } else if (kind == 'K') {
      int ax, ay; std::cin >> ax >> ay;
      f.shake(ax, ay);
    } else if (kind == 'P') {
      int i, j, vx, vy, r; std::cin >> i >> j >> vx >> vy >> r;
      f.push(i, j, vx, vy, r);
    } else if (kind == 'L') {
      int ax, ay; uint32_t frame; std::cin >> ax >> ay >> frame;
      const uint8_t *look = f.shade(ax, ay, frame);
      uint32_t h = 2166136261u;
      for (int c = 0; c < f.cols*f.rows; c++) h = fnvAdd(h, look[c]);
      std::cout << h << '\n';
    }
  }
}
