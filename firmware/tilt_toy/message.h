#pragma once
#include <math.h>
#include <stdint.h>
#include <stdlib.h>

// LED-board grid for the heart and the message, mirrored by dotGrid() in web/message.js:
// square dots every `pitch` pixels, centred on the panel. 240 px panels get 60 × 60 dots.
struct DotGrid { int pitch, cols, rows, x, y; };
inline DotGrid dotGrid(int width, int height) {
  const int shortest = width < height ? width : height, pitch = shortest >= 120 ? (shortest + 30) / 60 : 2;
  const int cols = width / pitch, rows = height / pitch;
  return {pitch, cols, rows, (width - cols * pitch) / 2, (height - rows * pitch) / 2};
}

// A 1-bit picture packed column by column, bit x * height + y, as the phone page and web/message.js pack it.
// The buffer lives on the heap: the classic ESP32 has little static RAM to spare.
struct DotBitmap {
  static constexpr int BannerRows = 24, MaxBannerWidth = 1360, MaxSide = 80;
  uint8_t *bits = nullptr;
  int width = 0, height = 0;
  static size_t bytesFor(int w, int h) { return ((size_t)w * h + 7) / 8; }
  bool dot(int x, int y) const {
    if (!bits || x < 0 || y < 0 || x >= width || y >= height) return false;
    const int32_t n = (int32_t)x * height + y;
    return (bits[n >> 3] >> (n & 7)) & 1;
  }
  // Takes over a heap buffer of bytesFor(w, h) bytes; null clears the picture.
  void assign(uint8_t *data, int w, int h) { free(bits); bits = data; width = data ? w : 0; height = data ? h : 0; }
};

// Scrolling position in dots: the banner enters at the right edge and leaves at the left, then starts again.
struct BannerScroll {
  float position = 0;
  void restart() { position = 0; }
  void advance(float dt, float speed, int bannerWidth, int cols) {
    const float loop = (float)(bannerWidth + cols);
    position += dt * speed;
    if (loop > 0 && position >= loop) position = fmodf(position, loop);
  }
  // Banner column shown in screen column `column` of `cols`.
  int bannerColumn(int column, int cols) const { return column + (int)position - cols; }
};
