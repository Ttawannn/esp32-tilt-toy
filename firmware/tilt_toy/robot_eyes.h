#pragma once
#include <math.h>
#include <stdint.h>
#include <Adafruit_GFX.h>

// Robot eyes: two rounded panels whose lids and shapes follow a mood.
// web/robot-eyes.js mirrors the moods, shapes and timing for the web preview.
enum RobotMood { MoodAuto = 0, MoodNormal, MoodHappy, MoodAngry, MoodSad, MoodTired, MoodSurprised, MoodSuspicious, MoodLove, MoodCount };
static const char *const moodIds[MoodCount] = {"auto", "normal", "happy", "angry", "sad", "tired", "surprised", "suspicious", "love"};
// A shake makes the eyes dizzy for a moment. It is a reaction, not a mood to pick.
static constexpr int FaceDizzy = MoodCount;

// Fractions of the base eye: size, a flat top lid, lids slanting down toward the nose (inner)
// or the cheek (outer), and a smile that arches the bottom edge.
struct EyeShape { float width, height, lid, inner, outer, smile; };

class RobotEyes {
 public:
  static constexpr uint32_t AutoMs = 3500, DizzyMs = 2200, BlinkMs = 180;
  int mood = MoodAuto;  // chosen on the phone; MoodAuto plays every mood in turn
  bool sleepy = false;  // just before the toy rests: tired eyes whatever the mood

  void reset(uint32_t now, uint32_t seed) {
    state = seed ? seed : 1;
    for (EyeShape &eye : current) eye = {1, 1, 0, 0, 0, 0};
    gazeX = gazeY = glanceX = glanceY = 0;
    autoMood = MoodNormal; nextAuto = now + AutoMs; dizzyStart = dizzyUntil = now;
    nextBlink = now + 1500; blinkStart = 0; nextGlance = now + 1000;
  }
  // Shake reaction: spinning dizzy eyes, then back to the mood. Shaking again keeps them dizzy.
  void react(uint32_t now) {
    if ((int32_t)(dizzyUntil - now) <= 0) dizzyStart = now;
    dizzyUntil = now + DizzyMs;
  }
  int shown(uint32_t now) const {
    if ((int32_t)(dizzyUntil - now) > 0) return FaceDizzy;
    if (sleepy) return MoodTired;
    return mood == MoodAuto ? autoMood : mood;
  }
  // lookX/lookY in -1..1 move the gaze toward the tilt.
  void draw(Adafruit_GFX &g, uint32_t now, float dt, float lookX, float lookY, uint16_t eyeColor, uint16_t heartColor) {
    if (mood == MoodAuto && (int32_t)(now - nextAuto) >= 0) { autoMood = autoMood % (MoodCount-1) + 1; nextAuto = now + AutoMs; }
    if ((int32_t)(now - nextBlink) >= 0) { blinkStart = now; nextBlink = now + 2200 + next() % 3300; }
    if ((int32_t)(now - nextGlance) >= 0) {
      glanceX = (int32_t)(next() % 121 - 60) / 100.f; glanceY = (int32_t)(next() % 73 - 36) / 100.f;
      nextGlance = now + 1200 + next() % 2800;
    }
    const int face = shown(now);
    const float follow = 1 - expf(-dt * 12), glide = 1 - expf(-dt * 10);
    for (int side = 0; side < 2; side++) {
      const EyeShape target = shape(face, side);
      EyeShape &eye = current[side];
      eye.width += (target.width - eye.width) * follow; eye.height += (target.height - eye.height) * follow;
      eye.lid += (target.lid - eye.lid) * follow; eye.inner += (target.inner - eye.inner) * follow;
      eye.outer += (target.outer - eye.outer) * follow; eye.smile += (target.smile - eye.smile) * follow;
    }
    gazeX += (clampf(lookX + glanceX, -1, 1) - gazeX) * glide;
    gazeY += (clampf(lookY + glanceY, -1, 1) - gazeY) * glide;
    // Blink: close to a slit and open again over BlinkMs.
    const uint32_t since = now - blinkStart;
    const float blink = since < BlinkMs ? fmaxf(.08f, fabsf(since - BlinkMs * .5f) / (BlinkMs * .5f)) : 1;

    const int w = g.width(), h = g.height();
    const float size = fminf(w, h), baseW = size * .34f, baseH = size * .42f;
    if (face == FaceDizzy) {
      // The spirals grow in, spin the two eyes opposite ways while the head wobbles, and shrink away.
      const float amount = clampf(fminf((now - dizzyStart) / 150.f, (dizzyUntil - now) / 300.f), .3f, 1);
      const float spin = now * .009f, wobbleX = cosf(now * .008f) * size * .03f, wobbleY = sinf(now * .008f) * size * .03f;
      for (int side = 0; side < 2; side++) {
        const float sign = side ? 1 : -1, cx = w * .5f + sign * size * .25f + wobbleX, cy = h * .5f + wobbleY;
        spiral(g, cx, cy, fminf(baseW, baseH) * .5f * amount, side ? -spin : spin, side ? -1 : 1, eyeColor);
      }
      return;
    }
    for (int side = 0; side < 2; side++) {
      const EyeShape &eye = current[side];
      const float sign = side ? 1 : -1;
      const float cx = w * .5f + sign * size * .25f + gazeX * size * .08f, cy = h * .5f + gazeY * size * .08f;
      const float ew = baseW * eye.width, eh = baseH * eye.height * blink;
      const int left = (int)(cx - ew * .5f), top = (int)(cy - eh * .5f), iw = (int)ew, ih = (int)fmaxf(2, eh);
      if (face == MoodLove && blink == 1) { heart(g, cx, cy, ew, heartColor); continue; }
      g.fillRoundRect(left, top, iw, ih, (int)(fminf(iw, ih) * .3f), eyeColor);
      // Lids are drawn in black over the panel.
      if (eye.lid > .01f) g.fillRect(left - 1, top - 1, iw + 2, (int)(eye.lid * ih) + 1, 0);
      const int inner = side ? left : left + iw, outer = side ? left + iw : left;
      if (eye.inner > .01f) g.fillTriangle(inner, top - 1, outer, top - 1, inner, top + (int)(eye.inner * ih), 0);
      if (eye.outer > .01f) g.fillTriangle(outer, top - 1, inner, top - 1, outer, top + (int)(eye.outer * ih), 0);
      if (eye.smile > .01f) g.fillRoundRect(left - 2, top + ih - (int)(eye.smile * ih), iw + 4, ih, (iw + 4) / 2, 0);
    }
  }
  static EyeShape shape(int face, int side) {
    switch (face) {
      case MoodHappy: return {1, 1, 0, 0, 0, .55f};
      case MoodAngry: return {1, .85f, 0, .5f, 0, 0};
      case MoodSad: return {1, .85f, 0, 0, .5f, 0};
      case MoodTired: return {1, 1, .55f, 0, .15f, 0};
      case MoodSurprised: return {.8f, 1.2f, 0, 0, 0, 0};
      case MoodSuspicious: return side ? EyeShape{1, 1, .5f, 0, 0, 0} : EyeShape{1, .9f, 0, .15f, 0, 0};
      default: return {1, 1, 0, 0, 0, 0};
    }
  }

 private:
  EyeShape current[2]{};
  float gazeX = 0, gazeY = 0, glanceX = 0, glanceY = 0;
  int autoMood = MoodNormal;
  uint32_t state = 1, nextAuto = 0, dizzyStart = 0, dizzyUntil = 0, nextBlink = 0, blinkStart = 0, nextGlance = 0;

  static float clampf(float v, float low, float high) { return fmaxf(low, fminf(high, v)); }
  uint32_t next() { state ^= state << 13; state ^= state >> 17; state ^= state << 5; return state; }
  // A thick spiral of about two and a half turns from the centre out; direction -1 mirrors it.
  static void spiral(Adafruit_GFX &g, float cx, float cy, float radius, float turn, float direction, uint16_t color) {
    const float end = 2.6f * 6.2831853f, dot = fmaxf(1, radius * .11f);
    for (float a = 0; a < end; a += fmaxf(.12f, dot * .9f / fmaxf(radius * a / end, dot))) {
      const float r = radius * a / end, angle = direction * a + turn;
      g.fillCircle((int)(cx + cosf(angle) * r), (int)(cy + sinf(angle) * r), (int)dot, color);
    }
  }
  // Two lobes and a point, as wide as the eye.
  static void heart(Adafruit_GFX &g, float cx, float cy, float width, uint16_t color) {
    const float r = width * .27f;
    g.fillCircle(cx - r, cy - r * .55f, r, color); g.fillCircle(cx + r, cy - r * .55f, r, color);
    g.fillTriangle(cx - 2 * r, cy - r * .2f, cx + 2 * r, cy - r * .2f, cx, cy + width * .5f, color);
  }
};
