#include <algorithm>
#include <cassert>
#include <vector>
#include "flip_fluid.h"
#include "toy_modes.h"
#include "themes.h"
#include "puddle.h"
using std::min;
using std::max;
constexpr float PI = 3.14159265358979323846f;
uint32_t micros() { return 0; }
struct FakePanel {
  int w = 240, h = 240, writes = 0, transferred = 0;
  bool transaction = false;
  std::vector<uint16_t> pixels;
  int width() const { return w; }
  int height() const { return h; }
  void startWrite() { assert(!transaction); transaction = true; }
  void endWrite() { assert(transaction); transaction = false; }
  void writeFillRect(int x, int y, int width, int height, uint16_t color) {
    assert(transaction);
    assert(x >= 0 && y >= 0 && x+width <= w && y+height <= h);
    writes++; transferred += width*height;
    for (int j=y; j<y+height; j++) for (int i=x; i<x+width; i++) pixels[j*w+i] = color;
  }
} panel;
FakePanel *scene = &panel;
FlipFluid fluid;
MotionState motion;
bool gradientWater = false, imuReady = true, apActive = false, screenOverlay = false, waterScreenValid = false, pixelScreenValid = true;
int activeMode = Water, theme = ThemeOcean;
Puddle puddle;
float sensitivity = 1, roll = 0, simulationMs = 0, fillPercent = 50;
uint8_t shownWater[FlipFluid::MaxPixels]{};
uint16_t ink(uint16_t color) { return DISPLAY_PROFILE == 4 ? !!color : color; }
uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return ink(((r&248)<<8)|((g&252)<<3)|(b>>3)); }
// Any distinct colour per shade: the test only needs the gradient raster to reach the panel.
uint16_t pixelColor(uint8_t shade) { return shade ? rgb(40*shade,255-30*shade,200) : 0; }
/* SKETCH_RENDERER */

void checkRaster() {
  const WaterView view = prepareWaterPixels(sinf(roll*PI/180),cosf(roll*PI/180));
  std::vector<uint16_t> expected(panel.w*panel.h,0);
  for (int j=0;j<view.rows;j++) for (int i=0;i<view.cols;i++) {
    uint16_t color = waterColor(waterLook(j*view.cols+i));
    const int x = (int)(view.x+i*view.cell), y = (int)(view.y+j*view.cell);
    for (int b=y;b<y+view.cell-1;b++) for (int a=x;a<x+view.cell-1;a++) expected[b*panel.w+a] = color;
  }
  assert(panel.pixels == expected);
}
int main() {
  if (DISPLAY_PROFILE == 4) {
    assert(!drawWaterDirect(.025f));
    assert(!panel.writes);
    return 0;
  }
  const bool mini = DISPLAY_PROFILE == 0 || DISPLAY_PROFILE == 5;
  panel.w = mini ? (DISPLAY_PROFILE == 5 ? 160 : 80) : 240;
  panel.h = mini ? (DISPLAY_PROFILE == 5 ? 80 : 160) : 240;
  panel.pixels.assign(panel.w*panel.h,0xFFFF); // Previous game/overlay must be cleared.
  fluid.configure(mini ? 10 : 18,mini ? 18 : 18,DISPLAY_PROFILE == 3,50);
  motion.ready = true;
  bool erased = false;
  // Two passes in each colour look: two-tone, then the depth gradient.
  for (int pass = 0; pass < 4; pass++) {
    gradientWater = pass >= 2; activeMode = Water; waterScreenValid = false;
    assert(drawWaterDirect(.025f));
    assert(!pixelScreenValid); checkRaster();
    panel.writes = panel.transferred = 0;
    assert(drawWaterDirect(0));
    assert(panel.writes == 0); // An unchanged raster needs no pixel transfer.
    for (int frame=0;frame<80;frame++) {
      const auto previous = panel.pixels;
      roll = frame < 40 ? 90.f : -90.f;
      motion.gravity = {sinf(roll*PI/180),cosf(roll*PI/180),0};
      panel.transferred = 0;
      assert(drawWaterDirect(.025f)); checkRaster();
      assert(panel.transferred < panel.w*panel.h); // No full-screen transfer after initialization.
      for (size_t p=0;p<previous.size();p++) if (previous[p] && !panel.pixels[p]) erased = true;
    }
    if (gradientWater) { // Shades run from just below the surface to deep water.
      bool shallow = false, deep = false;
      for (uint8_t v : fluid.look) { shallow |= v == 3; deep |= v >= 5; }
      assert(shallow && deep);
    }
    // Returning from a full canvas frame must discard the previous direct-render cache.
    apActive = true;
    const float accumulator = fluid.accumulator;
    assert(!drawWaterDirect(.025f)); assert(fluid.accumulator == accumulator);
    panel.pixels.assign(panel.w*panel.h,0xFFFF); waterScreenValid = false;
    apActive = false;
    assert(drawWaterDirect(0)); checkRaster();
  }
  assert(erased);
  // Lying flat: the puddle covers the floor and the panel still matches a complete raster.
  for (int look = 0; look < 2; look++) {
    gradientWater = look; waterScreenValid = false; roll = 0;
    motion.gravity = {0,1,0}; puddle.reset();
    for (int frame=0;frame<60;frame++) {
      if (frame == 10) motion.gravity = {0,0,1};
      assert(drawWaterDirect(.025f)); checkRaster();
    }
    assert(puddle.amount == 1);
    const WaterView view = prepareWaterPixels(0,1);
    for (int c=0;c<view.cols*view.rows;c++) if (fluid.pixels[c] != 3) assert(puddle.look[c] >= 3 && puddle.look[c] <= 6);
    motion.gravity = {0,1,0};
    for (int frame=0;frame<20;frame++) { assert(drawWaterDirect(.025f)); checkRaster(); }
    assert(puddle.amount == 0);
  }
  imuReady = false; assert(!drawWaterDirect(.025f));
  imuReady = true; activeMode = PixelFlow; assert(!drawWaterDirect(.025f));
  assert(!panel.transaction);
}
