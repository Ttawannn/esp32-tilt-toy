#pragma once
#include <math.h>
#include <stdint.h>

// A beating heart on the dot grid, mirrored by web/heart.js.
// Shades: 0 off, 1 deep .. 4 highlight. Little hearts burst out on a shake and float up against gravity.
struct HeartBeat {
  struct Spark { float x = 0, y = 0, vx = 0, vy = 0, life = 0; };
  static constexpr int MaxSparks = 14;
  static constexpr uint32_t BeatMs = 1100, IdleMs = 2400;
  Spark sparks[MaxSparks]{};

  void reset(uint32_t now, uint32_t seed) { for (Spark &s : sparks) s.life = 0; state = seed ? seed : 1; nextIdle = now + IdleMs; }
  // 0..1: a strong "lub" and a softer "dub" each BeatMs.
  static float beat(uint32_t now) {
    const float t = (now % BeatMs) / (float)BeatMs, pi = 3.14159265f;
    if (t < .12f) return sinf(t / .12f * pi);
    if (t > .2f && t < .32f) return .6f * sinf((t - .2f) / .12f * pi);
    return 0;
  }
  // Shade of the dot at (x, y) for a heart centred on (cx, cy), `size` dots across each lobe, leaning `lean` radians.
  static int shade(float x, float y, float cx, float cy, float size, float lean) {
    const float c = cosf(lean), s = sinf(lean), dx = (x - cx) / size, dy = (y - cy) / size;
    const float u = dx * c + dy * s, v = dx * s - dy * c + .15f;
    const float a = u*u + v*v - 1, h = a*a*a - u*u*v*v*v;
    if (h > 0) return 0;
    const float light = .5f - .35f * u + .45f * v;  // lit from the upper left
    return light > .95f ? 4 : light > .62f ? 3 : light > .3f ? 2 : 1;
  }
  // Little hearts flying out from (x, y), in dots.
  void burst(float x, float y, int count = 8) {
    for (int n = 0; n < count; n++) {
      Spark &s = sparks[slot()];
      const float angle = random01() * 6.2831853f, speed = 6 + random01() * 10;
      s = {x, y, cosf(angle) * speed, sinf(angle) * speed, 1.4f + random01() * .6f};
    }
  }
  // upX, upY: unit direction away from gravity on the screen. Sparks drift that way and fade; now and then
  // one rises from below the heart on its own.
  void step(float dt, float upX, float upY, uint32_t now, float cx, float cy, float size) {
    if ((int32_t)(now - nextIdle) >= 0) {
      nextIdle = now + IdleMs + (uint32_t)(random01() * 1200);
      // Starts below the heart (away from up), spread sideways.
      const float across = (random01() - .5f) * size * 1.6f;
      Spark &s = sparks[slot()];
      s = {cx - upX * size * 1.2f - upY * across, cy - upY * size * 1.2f + upX * across, upX * 4, upY * 4, 2.2f};
    }
    for (Spark &s : sparks) {
      if (s.life <= 0) continue;
      s.vx += upX * 9 * dt; s.vy += upY * 9 * dt;
      s.vx *= 1 - dt * .8f; s.vy *= 1 - dt * .8f;
      s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    }
  }
  // The 5 × 4 little-heart pattern, row by row from the top.
  static bool sparkDot(int dx, int dy) {
    static const uint8_t rows[4] = {0b01010, 0b11111, 0b01110, 0b00100};
    return dx >= 0 && dx < 5 && dy >= 0 && dy < 4 && ((rows[dy] >> (4 - dx)) & 1);
  }

 private:
  uint32_t state = 1, nextIdle = 0;
  float random01() { state ^= state << 13; state ^= state >> 17; state ^= state << 5; return (state & 0xFFFFFF) / 16777216.f; }
  int slot() const { int best = 0; for (int k = 0; k < MaxSparks; k++) { if (sparks[k].life <= 0) return k; if (sparks[k].life < sparks[best].life) best = k; } return best; }
};
