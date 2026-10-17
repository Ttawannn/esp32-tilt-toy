#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_GC9A01A.h>
#include <Adafruit_SSD1306.h>
#include <esp_sleep.h>
#include <driver/gpio.h>
#include "config.h"
#include "motion_sensor.h"
#include "motion_state.h"
#include "flip_fluid.h"
#include "pixel_flow.h"
#include "toy_modes.h"
#include "robot_eyes.h"
#include "themes.h"
#include "puddle.h"
#include "rest.h"

// One shared renderer; each release selects a concrete panel initializer.
#if DISPLAY_PROFILE == 0 || DISPLAY_PROFILE == 5
Adafruit_ST7735 panel(&SPI, TOY_CS, TOY_DC, TOY_RST);
#if DISPLAY_PROFILE == 5
const char *profileName = "tft-80x160-landscape";
#else
const char *profileName = "tft-80x160";
#endif
#elif DISPLAY_PROFILE == 1
Adafruit_ST7789 panel(&SPI, -1, TOY_DC, TOY_RST);
const char *profileName = "gmt130-240x240";
#elif DISPLAY_PROFILE == 3
Adafruit_GC9A01A panel(&SPI, TOY_DC, TOY_CS, TOY_RST);
const char *profileName = "tft-240x240-gc9a01";
#elif DISPLAY_PROFILE == 4
Adafruit_SSD1306 panel(128, 64, &Wire, -1);
const char *profileName = "oled-128x64";
#else
#error Unknown DISPLAY_PROFILE
#endif

Preferences preferences;
WebServer server(80);
MotionSensor imu;
MotionState motion;
Adafruit_GFX *scene = nullptr;
GFXcanvas16 *colorCanvas = nullptr;
GFXcanvas1 *monoCanvas = nullptr;
bool imuReady = false, apActive = false, closeRequested = false;
uint32_t apStarted = 0, closeAt = 0, lastShake = 0;
String apSsid;
int activeMode = 0, rotation = 0, spiMode = 3;
bool inverted = true;
// Slosh water: true depth shades in the Pixel Flow palette (the default), false two-tone.
bool gradientWater = true;
// Colours of the water, Pixel Flow and the robot eyes.
int theme = ThemeOcean;
float fillPercent = 50, sensitivity = 1.0f;
float roll = 0, pitch = 0;
float gyroXBias = 0, gyroYBias = 0, gyroZBias = 0;
FlipFluid fluid;
PixelDrops drops;
RobotEyes robot;
// Top view of the water while the toy lies flat.
Puddle puddle;
PixelDrops::Layout pixelView{};
// Cells as last sent to the panel, so each frame only rewrites drops that changed.
uint8_t shownLook[PixelDrops::MaxCells];
bool pixelScreenValid = false;
uint8_t shownWater[FlipFluid::MaxPixels];
bool waterScreenValid = false;
uint32_t pixelClock = 0, pixelFrame = 0;
int pixelAx = 0, pixelAy = 64;
float simulationMs = 0;
// BOOT held: let go after 2 s toggles Wi-Fi, after 5 s starts axis setup. The screen shows which.
uint32_t buttonHeldMs = 0;
// Rest: after restMinutes lying still the screen sleeps and the CPU light-sleeps, checking the sensor every
// RestPollMs; picking the toy up, turning or shaking it, or BOOT wakes it. A BOOT press that wakes it does nothing else.
constexpr uint32_t RestPollMs = 200;
int restMinutes = 2;
RestTimer rest;
bool swallowPress = false;
// Text on screen (hold hints, axis setup) needs the full-frame canvas instead of the direct TFT paths.
bool screenOverlay = false;
// Axis setup: two still poses, measured in the sensor's own axes. Step 1 flat, 2 upright, 3 result.
// average: recent acceleration for the stillness test; spin/change/magnitude: last values, for the serial report.
struct AxisSetup { int step = 0, samples = 0, axes[3] = {0, 0, 0}; MotionVector sum{}, flat{}, average{}; float spin = 0, change = 0, magnitude = 0; uint32_t stillSince = 0, until = 0, report = 0; bool saved = false, primed = false; } axisSetup;
uint32_t lastFrame = 0, lastImu = 0, frameCount = 0, fpsAt = 0;
float fps = 0;

uint16_t ink(uint16_t value) {
#if DISPLAY_PROFILE == 4
  return value ? 1 : 0;
#else
  return value;
#endif
}
uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return ink(((r & 248) << 8) | ((g & 252) << 3) | (b >> 3)); }
float limit(float value, float low, float high) { return fmaxf(low, fminf(high, value)); }

void resetMode() {
  pixelScreenValid = waterScreenValid = false;
  puddle.reset();
  if (scene) {
    const float w = scene->width()-4, h = scene->height()-4;
    const float shortest = fminf(w,h);
    const int cells = shortest < 40 ? 6 : shortest < 100 ? 8 : 16;
    const int nx = 2 + fminf(30,roundf(cells*w/shortest)), ny = 2 + fminf(30,roundf(cells*h/shortest));
    fluid.configure(DISPLAY_PROFILE == 3 ? 20 : nx, DISPLAY_PROFILE == 3 ? 20 : ny, DISPLAY_PROFILE == 3, fillPercent);
    if (activeMode == PixelFlow) {
      pixelView = PixelDrops::layout(scene->width(), scene->height(), DISPLAY_PROFILE == 3, DISPLAY_PROFILE == 4);
      drops.configure(pixelView.cols, pixelView.rows, pixelView.shape);
      drops.reset((int)fillPercent, pixelAx, pixelAy, esp_random());
      pixelClock = 0; pixelScreenValid = false;
    }
  }
  if (activeMode == Robot) robot.reset(millis(), esp_random());
}
void saveSettings() {
  preferences.putInt("mode3", activeMode);
  preferences.putInt("robotMood", robot.mood);
  preferences.putBool("waterShade", gradientWater);
  preferences.putInt("theme", theme);
  preferences.putInt("restMin", restMinutes);
  preferences.putInt("rotation", rotation);
  preferences.putBool("tftInvert", inverted);
  preferences.putInt("spiMode", spiMode);
  preferences.putFloat("fill", fillPercent);
  preferences.putFloat("sensitivity", sensitivity);
  preferences.putInt("axisX", motion.axes[0]);
  preferences.putInt("axisY", motion.axes[1]);
  preferences.putInt("axisZ", motion.axes[2]);
}
bool allocateScene() {
  delete colorCanvas; colorCanvas = nullptr;
  delete monoCanvas; monoCanvas = nullptr;
#if DISPLAY_PROFILE == 4
  monoCanvas = new GFXcanvas1(panel.width(), panel.height()); scene = monoCanvas;
  return monoCanvas && monoCanvas->getBuffer();
#else
  colorCanvas = new GFXcanvas16(panel.width(), panel.height()); scene = colorCanvas;
  return colorCanvas && colorCanvas->getBuffer();
#endif
}
bool beginPanel() {
#if DISPLAY_PROFILE == 4
  uint8_t address = 0;
  for (uint8_t candidate : {0x3C, 0x3D}) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0) { address = candidate; break; }
  }
  // Wire is already configured with this board's shared sensor/display pins.
  if (!address || !panel.begin(SSD1306_SWITCHCAPVCC, address, true, false)) return false;
#elif DISPLAY_PROFILE == 0 || DISPLAY_PROFILE == 5
  SPI.begin(TOY_SCK, -1, TOY_MOSI, TOY_CS);
  panel.initR(INITR_MINI160x80); panel.setSPISpeed(20000000);
#elif DISPLAY_PROFILE == 1
  SPI.begin(TOY_SCK, -1, TOY_MOSI, -1);
  panel.init(240, 240, spiMode == 3 ? SPI_MODE3 : SPI_MODE0); panel.setSPISpeed(20000000);
#elif DISPLAY_PROFILE == 3
  SPI.begin(TOY_SCK, -1, TOY_MOSI, TOY_CS);
  panel.begin(20000000);
#endif
  panel.setRotation(rotation);
#if DISPLAY_PROFILE != 4
  panel.invertDisplay(inverted);
#else
  panel.invertDisplay(false);
#endif
  return allocateScene();
}
void present() {
#if DISPLAY_PROFILE == 4
  panel.clearDisplay();
  panel.drawBitmap(0, 0, monoCanvas->getBuffer(), scene->width(), scene->height(), SSD1306_WHITE);
  panel.display();
#else
  panel.drawRGBBitmap(0, 0, colorCanvas->getBuffer(), scene->width(), scene->height());
#endif
  pixelScreenValid = false;
  waterScreenValid = false;
}
struct WaterView {
  int cell, cols, rows;
  float x, y;
};
WaterView prepareWaterPixels(float gx, float gy);
// Both render paths use the same raster and palette; only the panel transfer differs.
WaterView prepareWaterPixels(float gx, float gy) {
  const float left = DISPLAY_PROFILE == 3 ? 4 : 2, top = left;
  const float viewW = scene->width()-left*2, viewH = scene->height()-top*2;
  const float scaleX = viewW/((fluid.nx-2)*fluid.h), scaleY = viewH/((fluid.ny-2)*fluid.h);
  const int cell = max(3,(int)lroundf(fminf(viewW,viewH)/34));
  const int cols = min((int)FlipFluid::MaxPixelSide,(int)(viewW/cell)), rows = min(min((int)FlipFluid::MaxPixelSide,(int)(viewH/cell)),FlipFluid::MaxPixels/max(cols,1));
  const float ox = left+(viewW-cols*cell)*.5f, oy = top+(viewH-rows*cell)*.5f;
  fluid.rasterize(cols,rows,fluid.h+(ox-left)/scaleX,fluid.h+(oy-top)/scaleY,cell/scaleX,cell/scaleY,gx,gy);
  if (gradientWater) fluid.shade(cols,rows,gx,gy);
  return {cell,cols,rows,ox,oy};
}
uint16_t pixelColor(uint8_t shade);
// Palette index of water pixel c: two-tone 1 body and 2 surface, or the gradient's Pixel Flow shades.
uint8_t waterLook(int c) {
  if (c < Puddle::MaxCells && puddle.look[c]) return puddle.look[c] == Puddle::Dry ? 0 : 16 + puddle.look[c];
  const uint8_t value = fluid.pixels[c];
  return value == 1 || value == 2 ? (gradientWater ? fluid.look[c] : value) : 0;
}
uint16_t waterColor(uint8_t value) {
  const ThemeColors &colors = themes[theme];
  if (value >= 16) {
    // Puddle: shore and ripple crest in the surface colours; depth shades in the gradient, one body colour in two-tone.
    if (gradientWater) return pixelColor(value - 16);
    return value == 17 || value == 18 ? rgb(colors.top[0],colors.top[1],colors.top[2]) : rgb(colors.body[0],colors.body[1],colors.body[2]);
  }
  if (gradientWater) return pixelColor(value);
  return value == 2 ? rgb(colors.top[0],colors.top[1],colors.top[2]) : value == 1 ? rgb(colors.body[0],colors.body[1],colors.body[2]) : 0;
}
// Lying flat shows the water from above; the side view keeps running underneath. Call after prepareWaterPixels().
void updatePuddle(float dt, int cols, int rows) {
  if (imuReady && motion.ready) puddle.update(dt,motion.gravity.x,motion.gravity.y,motion.gravity.z,fluid.pixels,cols,rows,fillPercent);
  else puddle.reset();
}
// Slosh water takes tilt, the frame's translation and turning about the screen axis.
void advanceWater(float dt, MotionVector linearFrame, float angularAcceleration) {
  const uint32_t started = micros();
  const bool tracked = imuReady && motion.ready;
  const WaterForces forces = waterForces(activeMode,tracked?motion.gravity:MotionVector{0,1,0},tracked?linearFrame:MotionVector{},tracked?motion.omega.z:0,tracked?angularAcceleration:0,sensitivity);
  fluid.advance(dt,forces.ax,forces.ay,forces.omega,forces.omegaDot);
  simulationMs = (micros()-started)*.001f;
}
// TFT water sends changed blocks instead of the entire RGB framebuffer each frame.
// Wi-Fi text, sensor errors and OLED still use the canvas renderer.
bool drawWaterDirect(float dt) {
#if DISPLAY_PROFILE == 4
  (void)dt;
  return false;
#else
  if (!isFlipMode(activeMode) || apActive || screenOverlay || !imuReady) return false;
  float angularAcceleration;
  const MotionVector linearFrame = motion.consumeFrame(angularAcceleration);
  advanceWater(dt,linearFrame,angularAcceleration);
  const float theta = roll*PI/180;
  const WaterView view = prepareWaterPixels(sinf(theta)*sensitivity,cosf(theta)*sensitivity);
  updatePuddle(dt,view.cols,view.rows);
  const int cells = view.cols*view.rows;
  panel.startWrite();
  if (!waterScreenValid) {
    panel.writeFillRect(0,0,panel.width(),panel.height(),0);
    memset(shownWater,0,cells);
    waterScreenValid = true;
    pixelScreenValid = false;
  }
  for (int c = 0; c < cells; c++) {
    const uint8_t value = waterLook(c);
    if (value == shownWater[c]) continue;
    shownWater[c] = value;
    const int i = c%view.cols, j = c/view.cols;
    panel.writeFillRect(view.x+i*view.cell,view.y+j*view.cell,view.cell-1,view.cell-1,waterColor(value));
  }
  panel.endWrite();
  return true;
#endif
}
// Pixel Flow shades: 0 empty, 1 surface, 2 spray, 3-6 body from just below the surface to deep, in the theme's colours.
uint16_t pixelColor(uint8_t shade) {
  const uint8_t (*colors)[3] = themes[theme].shades;
  return shade && shade < 7 ? rgb(colors[shade][0], colors[shade][1], colors[shade][2]) : 0;
}
// Gravity plus measured jolts in Q8 cells per step². Steps run at a fixed 30 Hz.
void advancePixelFlow(float dt, MotionVector linear) {
  uint32_t started = micros();
  const bool tracked = imuReady && motion.ready;
  WaterForces forces = waterForces(PixelFlow,tracked?motion.gravity:MotionVector{0,1,0},tracked?linear:MotionVector{},0,0,sensitivity);
  pixelAx = PixelDrops::forceToQ8(forces.ax); pixelAy = PixelDrops::forceToQ8(forces.ay);
  pixelClock = min(pixelClock+(uint32_t)(dt*1000), 2*PixelDrops::StepMs);
  while (pixelClock >= PixelDrops::StepMs) { drops.step(pixelAx, pixelAy); pixelClock -= PixelDrops::StepMs; }
  drops.shade(pixelAx, pixelAy, pixelFrame++);
  simulationMs = (micros()-started)*.001f;
}
// TFT fast path: skip the framebuffer and rewrite only the drops whose shade changed.
// Returns false when the frame needs the canvas (OLED, Wi-Fi details or a missing sensor on screen).
bool drawPixelFlowDirect(float dt) {
#if DISPLAY_PROFILE == 4
  (void)dt;
  return false;
#else
  if (activeMode != PixelFlow || apActive || screenOverlay || !imuReady) return false;
  float angularAcceleration;
  advancePixelFlow(dt, motion.consumeFrame(angularAcceleration));
  const int cells = pixelView.cols*pixelView.rows, size = pixelView.pitch-1;
  panel.startWrite();
  if (!pixelScreenValid) { panel.writeFillRect(0, 0, panel.width(), panel.height(), 0); memset(shownLook, 0, cells); pixelScreenValid = true; }
  for (int c = 0; c < cells; c++) {
    if (drops.look[c] == shownLook[c]) continue;
    shownLook[c] = drops.look[c];
    panel.writeFillRect(pixelView.x+(c%pixelView.cols)*pixelView.pitch, pixelView.y+(c/pixelView.cols)*pixelView.pitch, size, size, pixelColor(shownLook[c]));
  }
  panel.endWrite();
  return true;
#endif
}
void textCenter(const char *text, int y, uint16_t color, int size = 1) {
  scene->setTextSize(size); scene->setTextColor(ink(color));
  scene->setCursor((scene->width() - strlen(text) * 6 * size) / 2, y);
  scene->print(text);
}
void shake() {
  lastShake = millis();
  // Lying flat, a shake sends a ring across the puddle; the side view underneath still gets its wave.
  if (isFlipMode(activeMode)) { puddle.ripple(0,0); fluid.impulse(sinf(roll*PI/180),cosf(roll*PI/180)); }
  if (activeMode == PixelFlow) drops.shake(pixelAx, pixelAy);
  if (activeMode == Robot) robot.react(millis());
}
// Screen off and its controller asleep, or back on. The TFT backlight is wired to the supply and stays lit.
void panelSleep(bool sleep) {
#if DISPLAY_PROFILE == 4
  panel.ssd1306_command(sleep ? SSD1306_DISPLAYOFF : SSD1306_DISPLAYON);
#else
  if (sleep) { panel.sendCommand(0x28); panel.sendCommand(0x10); }  // display off, sleep in
  else { panel.sendCommand(0x11); delay(120); panel.sendCommand(0x29); }  // sleep out, display on
#endif
}
void enterRest() {
  Serial.printf("Resting after %d min still: pick the toy up, turn it, shake it or press BOOT to wake it\n", restMinutes);
  Serial.flush();
  panelSleep(true);
}
void wakeUp(uint32_t now, const char *why) {
  rest.resting = false; rest.touch(now, motion.gravity);
  panelSleep(false);
  waterScreenValid = pixelScreenValid = false; lastFrame = millis();
  Serial.printf("Awake: %s\n", why);
}
// One resting step: light sleep until the next sensor check or a BOOT press, then look for movement.
void restStep() {
  esp_sleep_enable_timer_wakeup(RestPollMs * 1000ULL);
  gpio_wakeup_enable((gpio_num_t)TOY_BUTTON, GPIO_INTR_LOW_LEVEL);
  esp_sleep_enable_gpio_wakeup();
  esp_light_sleep_start();
  const uint32_t now = millis();
  if (digitalRead(TOY_BUTTON) == LOW) { swallowPress = true; wakeUp(now, "BOOT"); return; }
  readImu();
  if (!imuReady) { wakeUp(now, "sensor lost"); return; }
  if (rest.update(now, motion.gravity, motion.omega, now - lastShake < RestPollMs) == RestTimer::Wake) wakeUp(now, "moved");
}
bool calibrateImu() {
  if (!imuReady || !imu.hasGyro()) return false;
  float x = 0, y = 0, z = 0, squares = 0;
  MotionSample sample;
  for (int i = 0; i < 40; i++) {
    if (!imu.read(sample)) return false;
    float magnitude = sqrtf(sample.ax*sample.ax+sample.ay*sample.ay+sample.az*sample.az);
    if (fabsf(magnitude-9.81f) > .5f || hypotf(hypotf(sample.gx,sample.gy),sample.gz) > .3f) return false;
    x += sample.gx; y += sample.gy; z += sample.gz;
    squares += sample.gx*sample.gx+sample.gy*sample.gy+sample.gz*sample.gz; delay(10);
  }
  if (squares/40-(x*x+y*y+z*z)/1600 > .0025f || !imu.resetFifo()) return false;
  gyroXBias = x / 40; gyroYBias = y / 40; gyroZBias = z / 40;
  motion.reset(); roll = pitch = 0;
  return true;
}
void startAxisSetup() {
  axisSetup = AxisSetup{}; axisSetup.step = 1; axisSetup.stillSince = millis(); axisSetup.until = millis() + 60000;
  Serial.println("Axis setup 1/2: lay the toy flat, screen up, and keep it still");
}
void feedAxisSetup(const MotionSample &sample, uint32_t now) {
  AxisSetup &setup = axisSetup;
  if (setup.step != 1 && setup.step != 2) return;
  const float magnitude = sqrtf(sample.ax*sample.ax + sample.ay*sample.ay + sample.az*sample.az);
  const float spin = sqrtf(sample.gx*sample.gx + sample.gy*sample.gy + sample.gz*sample.gz);
  // Still means the measured gravity stops changing direction: within about 3° of its recent average.
  // This does not depend on the accelerometer's scale or an uncalibrated gyro offset; the gyro only
  // rules out turning faster than about 30°/s.
  if (!setup.primed) { setup.average = {sample.ax, sample.ay, sample.az}; setup.primed = true; }
  setup.average.x += (sample.ax - setup.average.x) * .08f; setup.average.y += (sample.ay - setup.average.y) * .08f; setup.average.z += (sample.az - setup.average.z) * .08f;
  const float averageLength = MotionState::length(setup.average);
  const float change = magnitude > 1 && averageLength > 1 ? MotionState::length({sample.ax/magnitude - setup.average.x/averageLength, sample.ay/magnitude - setup.average.y/averageLength, sample.az/magnitude - setup.average.z/averageLength}) : 2;
  setup.spin = spin; setup.change = change; setup.magnitude = magnitude;
  if (now - setup.report >= 1000) {
    setup.report = now;
    Serial.printf("Axis setup %d/2: held %.1f s | change %.1f deg (still < 3) | spin %.2f rad/s (< 0.5) | |a| %.1f m/s2\n", setup.step, setup.samples ? (now - setup.stillSince) / 1000.f : 0.f, change * 57.3f, spin, magnitude);
  }
  bool still = spin < .5f && change < .05f && magnitude > 5 && magnitude < 15;
  // The second pose must differ from the first: wait until the toy has been stood up.
  if (still && setup.step == 2) still = (sample.ax*setup.flat.x + sample.ay*setup.flat.y + sample.az*setup.flat.z) < .5f * magnitude * MotionState::length(setup.flat);
  if (!still) { setup.sum = {}; setup.samples = 0; setup.stillSince = now; return; }
  setup.sum.x += sample.ax; setup.sum.y += sample.ay; setup.sum.z += sample.az; setup.samples++;
  if (now - setup.stillSince < 1200 || setup.samples < 80) return;
  const MotionVector mean{setup.sum.x/setup.samples, setup.sum.y/setup.samples, setup.sum.z/setup.samples};
  setup.sum = {}; setup.samples = 0; setup.stillSince = now;
  if (setup.step == 1) { setup.flat = mean; setup.step = 2; Serial.println("Axis setup 2/2: stand it on its bottom edge, screen facing you"); return; }
  setup.saved = MotionState::axesFromPoses(setup.flat, mean, rotation, setup.axes) && motion.setAxes(setup.axes[0], setup.axes[1], setup.axes[2], rotation);
  if (setup.saved) { saveSettings(); roll = pitch = 0; Serial.printf("Axis setup saved: screen X %+d, Y %+d, Z %+d (1 = sensor X, 2 = Y, 3 = Z)\n", setup.axes[0], setup.axes[1], setup.axes[2]); }
  else Serial.println("Axis setup failed: hold each pose still and square to the table, then try again");
  setup.step = 3; setup.until = now + 2500;
}
void readImu() {
  if (!imuReady) return;
  MotionSample samples[MotionSensor::MaxBatch];
  uint8_t count = 0;
  static uint8_t failedReads = 0;
  static uint32_t lastSample = millis();
  uint32_t resets = imu.fifoResets;
  if (!imu.readBatch(samples,count)) { if (resets != imu.fifoResets) motion.reset(); if (++failedReads >= 5) imuReady = false; return; }
  if (resets != imu.fifoResets) motion.reset();
  if (!count) { if (millis()-lastSample > 500 && ++failedReads >= 5) imuReady = false; return; }
  lastSample = millis();
  failedReads = 0;
  for (uint8_t i = 0; i < count; i++) {
    samples[i].gx -= gyroXBias; samples[i].gy -= gyroYBias; samples[i].gz -= gyroZBias;
    feedAxisSetup(samples[i], millis());
    motion.update(samples[i],.01f);
    if (motion.shake && millis()-lastShake > 800) shake();
  }
  roll = motion.roll; pitch = motion.pitch;
}

void drawAxisSetup() {
  const int w = scene->width(), h = scene->height(), big = w >= 200 ? 2 : 1, line = 9 * big + 4, top = h / 2 - line * 2;
  const AxisSetup &setup = axisSetup;
  scene->fillScreen(0);
  if (setup.step == 3) {
    textCenter(setup.saved ? "AXES SAVED" : "TRY AGAIN", top + line, setup.saved ? 0x07E0 : 0xF800, big);
    if (setup.saved) {
      char axes[24]; snprintf(axes, sizeof(axes), "X%+d Y%+d Z%+d", setup.axes[0], setup.axes[1], setup.axes[2]);
      textCenter(axes, top + line * 2 + 4, 0xFFFF);
    }
    return;
  }
  textCenter(setup.step == 1 ? "AXIS SETUP 1/2" : "AXIS SETUP 2/2", top, 0xFFFF);
  textCenter(setup.step == 1 ? "LAY FLAT" : "STAND ON", top + line, 0xFFFF, big);
  textCenter(setup.step == 1 ? "SCREEN UP" : "BOTTOM EDGE", top + line * 2, 0xFFFF, big);
  // Fills while the pose is held still.
  const float held = setup.samples ? fminf(1, (millis() - setup.stillSince) / 1200.f) : 0;
  const int barW = w / 2, barX = (w - barW) / 2, barY = top + line * 3 + 4;
  scene->drawRect(barX, barY, barW, 6, ink(0xFFFF));
  if (held > 0) scene->fillRect(barX + 1, barY + 1, (int)((barW - 2) * held), 4, rgb(60, 220, 255));
}
void renderGame(float dt) {
  if (axisSetup.step) { drawAxisSetup(); return; }
  const int w = scene->width(), h = scene->height();
  const float cy = h * 0.5f;
  // The whole panel is the play area: no frame, title or readouts on screen.
  scene->fillScreen(0);
  float theta = roll * PI / 180;
  float gx = sinf(theta) * sensitivity, gy = cosf(theta) * sensitivity;
  float angularAcceleration;
  MotionVector linearFrame = motion.consumeFrame(angularAcceleration);
  if (!imuReady) { gx = 0; gy = 1; }
  if (activeMode == PixelFlow) {
    advancePixelFlow(dt, linearFrame);
    for (int c = 0; c < pixelView.cols*pixelView.rows; c++) if (drops.look[c])
      scene->fillRect(pixelView.x+(c%pixelView.cols)*pixelView.pitch, pixelView.y+(c/pixelView.cols)*pixelView.pitch, pixelView.pitch-1, pixelView.pitch-1, pixelColor(drops.look[c]));
  } else if (isFlipMode(activeMode)) {
    advanceWater(dt,linearFrame,angularAcceleration);
    const WaterView view = prepareWaterPixels(gx,gy);
    updatePuddle(dt,view.cols,view.rows);
    for (int j=0;j<view.rows;j++) for (int i=0;i<view.cols;i++) {
      const uint8_t value = waterLook(j*view.cols+i);
      // OLED: a lying puddle is a dot pattern with a solid shore and ripple crest, not a white screen.
      if (DISPLAY_PROFILE == 4 && value > 18 && ((i+j)&1)) continue;
      if (value) scene->fillRect(view.x+i*view.cell,view.y+j*view.cell,view.cell-1,view.cell-1,waterColor(value));
    }
  } else {
    robot.draw(*scene, millis(), dt, limit(gx,-1,1), limit(-sinf(pitch*PI/180),-1,1), rgb(themes[theme].eye[0],themes[theme].eye[1],themes[theme].eye[2]), rgb(255,70,140));
  }
  // Live values are shown on the phone page; the panel only says how to reach it.
  const int titleY = DISPLAY_PROFILE == 3 ? 22 : 2;
  const int footerY = DISPLAY_PROFILE == 3 ? h-30 : h-10;
  if (apActive) { textCenter(apSsid.c_str(), titleY, 0xFFFF); textCenter("192.168.4.1", footerY, 0xFFFF); }
  else if (!imuReady) textCenter("IMU NOT FOUND", footerY, 0xFFFF);
  if (buttonHeldMs >= 800) {
    const char *hint = buttonHeldMs < 2000 ? "HOLD: WI-FI" : buttonHeldMs < 5000 ? "LET GO: WI-FI" : "LET GO: AXES";
    scene->fillRect(0, cy - 8, w, 16, 0);
    textCenter(hint, cy - 4, buttonHeldMs < 2000 ? 0xFFFF : 0xFFE0);
  }
}

// Device-local controls are served by the ESP32's AP, independent of the hosted installer.
const char devicePage[] PROGMEM = R"HTML(<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#0b0d12"><title>Tilt Toy</title><style>:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;font:15px/1.5 system-ui,-apple-system,'Segoe UI','Leelawadee UI','Noto Sans Thai',sans-serif;background:#0b0d12;color:#e9ecf3}main{max-width:560px;margin:auto;padding:18px 16px 32px}header{display:flex;align-items:center;gap:12px;margin:4px 0 14px}.mark{display:grid;place-items:center;flex-shrink:0;width:38px;height:38px;border-radius:11px;background:linear-gradient(135deg,#4f8cff,#7a5cff);color:#fff;font-size:24px;box-shadow:0 6px 18px #4f6eff52}h1{font-size:18px;margin:0;line-height:1.2}.card{background:#141822;border:1px solid #252c3b;border-radius:14px;padding:16px;margin:12px 0}h2{font-size:14px;margin:0 0 12px;font-weight:600;display:flex;justify-content:space-between;align-items:center}label{display:block;margin:0 0 14px;font-size:13px;color:#8b94a8}.row{display:flex;justify-content:space-between}output{color:#e9ecf3;font-variant-numeric:tabular-nums}select,button{font:inherit;width:100%;padding:12px;border:1px solid #323b4f;border-radius:10px;background:#1a1f2b;color:#e9ecf3}select{margin-top:6px}input[type=range]{width:100%;margin:10px 0 0;accent-color:#4f8cff}button{cursor:pointer;font-weight:500}button:active{background:#222838}.primary{margin-top:16px;border:0;background:linear-gradient(135deg,#4f8cff,#7a5cff);color:#fff;font-weight:600;box-shadow:0 6px 18px #4f6eff52}.actions{display:grid;grid-template-columns:1fr 1fr;gap:8px}.full{grid-column:1/-1}.danger{color:#f2626f}[hidden]{display:none!important}small{color:#8b94a8}p{margin:12px 0 0}#status{min-height:24px;color:#34d399}.live{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat{background:#1a1f2b;border:1px solid #252c3b;border-radius:10px;padding:10px 12px;min-width:0}.stat span{display:block;font-size:12px;color:#8b94a8}.stat b{display:block;font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wide{grid-column:1/-1}#motionLive b{font-size:16px}#link{font-size:12px;font-weight:400;color:#8b94a8}#link:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#5d6679;margin-right:6px}#link[data-on]:before{background:#34d399;box-shadow:0 0 8px #34d399}@media(max-width:360px){.live{grid-template-columns:repeat(2,1fr)}}</style><main><header><span class="mark">≈</span><div><h1>esp32-tilt-toy</h1><small id="hardware"></small></div></header><section class="card"><h2>ค่าบนเครื่อง <span id="link">กำลังเชื่อมต่อ…</span></h2><div class="live" aria-live="off"><div class="stat wide"><span>โหมด</span><b id="vMode">–</b></div><div class="stat"><span>Roll</span><b id="vRoll">–</b></div><div class="stat"><span>Pitch</span><b id="vPitch">–</b></div><div class="stat"><span>FPS</span><b id="vFps">–</b></div><div class="stat" id="sSim"><span>Solver</span><b id="vSim">–</b></div><div class="stat" id="sParticles"><span>อนุภาค</span><b id="vParticles">–</b></div><div class="stat"><span>Heap ว่าง</span><b id="vHeap">–</b></div></div></section><section class="card"><h2>ทดสอบแกน</h2><div class="live" id="motionLive"><div class="stat wide"><span>แรงโน้มถ่วง X / Y / Z</span><b id="vGravity">–</b></div><div class="stat wide"><span>ความเร็วหมุน X / Y / Z (rad/s)</span><b id="vOmega">–</b></div><div class="stat wide"><span>แรงขยับ X / Y / Z (m/s²)</span><b id="vLinear">–</b></div></div><p><small>วางราบแล้วหมุนตามเข็มนาฬิกา: Z ของความเร็วหมุนเป็นบวก · กระตุกไปทางขวา: X ของแรงขยับเป็นบวก · ถ้าไม่ตรง ให้สลับแกนด้านล่าง</small></p></section><section class="card"><h2>ตั้งค่า</h2><label>โหมด<select id="mode"><option value="water-slosh">น้ำกระฉอก</option><option value="pixel-flow">น้ำพิกเซล</option><option value="robot">ตาหุ่นยนต์</option></select></label><label id="moodWrap" hidden>อารมณ์ตาหุ่นยนต์<select id="mood"><option value="auto">เล่นวนทุกอารมณ์</option><option value="normal">ปกติ</option><option value="happy">ดีใจ</option><option value="angry">โกรธ</option><option value="sad">เศร้า</option><option value="tired">ง่วง</option><option value="surprised">ตกใจ</option><option value="suspicious">สงสัย</option><option value="love">หลงรัก</option></select></label><label id="waterColorWrap" hidden>สีน้ำ<select id="waterColor"><option value="gradient">ไล่เฉดตามความลึก</option><option value="classic">สองสี</option></select></label><label>พักเครื่องเมื่อวางนิ่ง<select id="rest"><option value="0">ไม่พัก</option><option value="1">1 นาที</option><option value="2">2 นาที</option><option value="5">5 นาที</option><option value="10">10 นาที</option></select></label><label id="themeWrap">ธีมสี<select id="theme"><option value="ocean">มหาสมุทร</option><option value="lava">ลาวา</option><option value="slime">สไลม์</option><option value="grape">องุ่น</option><option value="candy">ลูกกวาด</option><option value="aurora">ออโรรา</option></select></label><label><span class="row">ระดับน้ำ <output id="fillOut"></output></span><input id="fill" type="range" min="10" max="90"></label><label><span class="row">ความไว <output id="sensOut"></output></span><input id="sensitivity" type="range" min="0.4" max="2" step="0.1"></label><label>แนวจอ / หมุนภาพ<select id="rotation"><option value="0">0°</option><option value="1">90°</option><option value="2">180°</option><option value="3">270°</option></select></label><label id="invertWrap">สีจอ TFT<select id="invert"><option value="1">เปิด inversion</option><option value="0">ปิด inversion</option></select></label><label id="spiWrap">SPI ของ ST7789<select id="spiMode"><option value="3">Mode 3</option><option value="0">Mode 0</option></select></label><label>แกน X ของจอ<select id="axisX"><option value="1">+X</option><option value="2">+Y</option><option value="3">+Z</option><option value="-1">−X</option><option value="-2">−Y</option><option value="-3">−Z</option></select></label><label>แกน Y ของจอ<select id="axisY"><option value="1">+X</option><option value="2">+Y</option><option value="3">+Z</option><option value="-1">−X</option><option value="-2">−Y</option><option value="-3">−Z</option></select></label><label>แกน Z ของจอ<select id="axisZ"><option value="1">+X</option><option value="2">+Y</option><option value="3">+Z</option><option value="-1">−X</option><option value="-2">−Y</option><option value="-3">−Z</option></select></label><small>แกนจอ: X ไปขวา · Y ลงล่าง · Z เข้าไปในจอ เลือกแกนไม่ซ้ำกัน ถ้ากลับเครื่องหมายให้กลับสองแกนพร้อมกัน</small><button id="save" class="primary">บันทึกและใช้โหมดนี้</button></section><section class="card actions"><button id="shake">เขย่า</button><button id="calibrate">คาลิเบรต gyro (วางเครื่องนิ่ง)</button><button id="axisSetup" class="full">ตั้งแกนอัตโนมัติ (ทำตามจอเครื่อง)</button><button id="close" class="full danger">ปิด Wi-Fi แล้วเล่นต่อ</button></section><p id="status" role="status"></p><small>กดปุ่ม BOOT บนบอร์ดสั้น ๆ เพื่อเปลี่ยนโหมด กดค้าง 2 วินาทีเพื่อเปิด/ปิด Wi-Fi</small></main><script>
const $=id=>document.getElementById(id),ids=['mode','mood','waterColor','theme','rest','fill','sensitivity','rotation','invert','spiMode','axisX','axisY','axisZ'],status=$('status');const names={'water-slosh':'น้ำกระฉอก','pixel-flow':'น้ำพิกเซล',robot:'ตาหุ่นยนต์'},moods={auto:'เล่นวนทุกอารมณ์',normal:'ปกติ',happy:'ดีใจ',angry:'โกรธ',sad:'เศร้า',tired:'ง่วง',surprised:'ตกใจ',suspicious:'สงสัย',love:'หลงรัก'};let stopped=false,busy=false;const deg=v=>(v>0?'+':'')+v.toFixed(0)+'°';function showValues(){$('fillOut').value=$('fill').value+'%';$('sensOut').value=Number($('sensitivity').value).toFixed(1)+'×';}$('fill').oninput=$('sensitivity').oninput=showValues;async function post(path,data={}){const response=await fetch(path,{method:'POST',body:new URLSearchParams(data)});if(!response.ok)throw Error(await response.text());return response;}async function read(){const r=await fetch('/api/status',{cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(2500):undefined});if(!r.ok)throw Error('อ่านข้อมูลเครื่องไม่ได้');return r.json();}function live(s){$('hardware').textContent=s.boardName+' · '+s.profile+' · v'+s.version+(s.imu?' · '+s.sensor+' · 0x'+s.sensorAddress.toString(16).toUpperCase():' · ไม่พบเซนเซอร์');$('calibrate').hidden=!s.imu||!s.gyro;$('motionLive').hidden=!s.imu;for(const [id,values]of[['vGravity',s.gravity],['vOmega',s.omega],['vLinear',s.linear]])$(id).textContent=s.imu?values.map(v=>v.toFixed(2)).join(' / '):'–';$('vMode').textContent=(names[s.mode]||s.mode)+(s.mode==='robot'?' · '+(moods[s.mood]||s.mood):'');$('vRoll').textContent=s.imu?deg(s.roll):'–';$('vPitch').textContent=s.imu?deg(s.pitch):'–';$('vFps').textContent=s.fps.toFixed(1);$('vSim').textContent=s.simMs.toFixed(1)+' ms';$('vParticles').textContent=s.particles;$('vHeap').textContent=Math.round(s.freeHeap/1024)+' KB';$('sSim').hidden=$('sParticles').hidden=s.mode==='robot';$('moodWrap').hidden=s.mode!=='robot';$('waterColorWrap').hidden=s.mode!=='water-slosh';$('link').dataset.on='';$('link').textContent='อัปเดตสด';}function offline(text){delete $('link').dataset.on;$('link').textContent=text;}async function load(){const s=await read();ids.forEach(id=>$(id).value=String(id==='invert'?Number(s[id]):s[id]));$('mode').onchange=()=>{const m=$('mode').value;$('moodWrap').hidden=m!=='robot';$('waterColorWrap').hidden=m!=='water-slosh';};$('invertWrap').hidden=s.profile==='oled-128x64';$('spiWrap').hidden=!s.profile.includes('gmt130');showValues();live(s);if(s.profile.startsWith('tft-80x160')){const labels=['แนวตั้ง 80×160 (0°)','แนวนอน 160×80 (90°)','แนวตั้งกลับด้าน (180°)','แนวนอนกลับด้าน (270°)'];Array.from($('rotation').options).forEach((option,i)=>option.textContent=labels[i]);}}setInterval(async()=>{if(stopped||busy||document.hidden)return;busy=true;try{live(await read());}catch{offline('ขาดการเชื่อมต่อ');}busy=false;},1000);$('save').onclick=async()=>{try{const data={};ids.forEach(id=>data[id]=$(id).value);await post('/api/config',data);status.textContent='บันทึกแล้ว';}catch(e){status.textContent=e.message;}};for(const [id,path,message]of[['shake','/api/shake','ทำแอ็กชันแล้ว'],['calibrate','/api/calibrate','คาลิเบรตแล้ว'],['axisSetup','/api/axis-setup','ทำตามจอเครื่อง: วางราบหน้าจอขึ้น แล้วตั้งให้ขอบล่างลง'],['close','/api/close','ปิด Wi-Fi แล้ว กลับไปเล่นบนเครื่องได้เลย']])$(id).onclick=async()=>{try{await post(path);status.textContent=message;if(id==='close'){stopped=true;offline('ปิด Wi-Fi แล้ว');}}catch(e){status.textContent=e.message;}};load().catch(e=>{status.textContent=e.message;offline('ขาดการเชื่อมต่อ');});
</script></html>)HTML";

void setupRoutes() {
  server.on("/license",HTTP_GET,[](){server.send(200,"text/plain; charset=utf-8",fluidLicense);});
  server.on("/", HTTP_GET, [](){server.send_P(200,"text/html; charset=utf-8",devicePage);});
  server.on("/api/status", HTTP_GET, [](){
    char json[1536]; int length = snprintf(json,sizeof(json),"{\"version\":\"%s\",\"board\":\"%s\",\"boardName\":\"%s\",\"chipFamily\":\"%s\",\"profile\":\"%s\",\"mode\":\"%s\",\"mood\":\"%s\",\"waterColor\":\"%s\",\"theme\":\"%s\",\"rest\":%d,\"rotation\":%d,\"invert\":%s,\"spiMode\":%d,\"fill\":%.1f,\"sensitivity\":%.2f,\"imu\":%s,\"sensor\":\"%s\",\"sensorAddress\":%u,\"gyro\":%s,\"roll\":%.1f,\"pitch\":%.1f,\"fps\":%.1f,\"simMs\":%.2f,\"particles\":%d,\"freeHeap\":%u,\"axisX\":%d,\"axisY\":%d,\"axisZ\":%d,\"gravity\":[%.3f,%.3f,%.3f],\"omega\":[%.3f,%.3f,%.3f],\"linear\":[%.3f,%.3f,%.3f],\"yaw\":%.1f,\"stillMs\":%.0f,\"fifoResets\":%u}",TOY_VERSION,TOY_BOARD_ID,TOY_BOARD_NAME,TOY_CHIP_FAMILY,profileName,modeIds[activeMode],moodIds[robot.mood],gradientWater?"gradient":"classic",themeIds[theme],restMinutes,rotation,inverted?"true":"false",spiMode,fillPercent,sensitivity,imuReady?"true":"false",imu.name(),imu.i2cAddress(),imu.hasGyro()?"true":"false",roll,pitch,fps,simulationMs,activeMode==PixelFlow?drops.count:fluid.count,ESP.getFreeHeap(),motion.axes[0],motion.axes[1],motion.axes[2],motion.gravity.x,motion.gravity.y,motion.gravity.z,motion.omega.x,motion.omega.y,motion.omega.z,motion.linear.x,motion.linear.y,motion.linear.z,motion.yaw,motion.stillMs,imu.fifoResets);
    if (length < 0 || length >= (int)sizeof(json)) { server.send(500,"text/plain","Status overflow"); return; }
    server.send(200,"application/json",json);
  });
  server.on("/api/config", HTTP_POST, [](){
    int nextMode=activeMode;
    if(server.hasArg("mode")){ nextMode=-1; for(int i=0;i<ModeCount;i++)if(server.arg("mode")==modeIds[i])nextMode=i; if(nextMode<0){server.send(400,"text/plain","Unknown mode");return;} }
    int nextMood=robot.mood;
    if(server.hasArg("mood")){ nextMood=-1; for(int i=0;i<MoodCount;i++)if(server.arg("mood")==moodIds[i])nextMood=i; if(nextMood<0){server.send(400,"text/plain","Unknown mood");return;} }
    int nextRest=restMinutes;
    if(server.hasArg("rest")){nextRest=server.arg("rest").toInt();if(nextRest<0||nextRest>60){server.send(400,"text/plain","Invalid rest minutes");return;}}
    int nextTheme=theme;
    if(server.hasArg("theme")){ nextTheme=-1; for(int i=0;i<ThemeCount;i++)if(server.arg("theme")==themeIds[i])nextTheme=i; if(nextTheme<0){server.send(400,"text/plain","Unknown theme");return;} }
    bool nextGradient=gradientWater;
    if(server.hasArg("waterColor")){const String look=server.arg("waterColor");if(look!="classic"&&look!="gradient"){server.send(400,"text/plain","Unknown water color");return;}nextGradient=look=="gradient";}
    int nextRotation=rotation,nextSpi=spiMode;
    if(server.hasArg("rotation")){nextRotation=server.arg("rotation").toInt();if(nextRotation<0||nextRotation>3){server.send(400,"text/plain","Invalid rotation");return;}}
    if(server.hasArg("spiMode")){nextSpi=server.arg("spiMode").toInt();if(nextSpi!=0&&nextSpi!=3){server.send(400,"text/plain","Invalid SPI mode");return;}}
    int nextAxes[3] = {motion.axes[0],motion.axes[1],motion.axes[2]};
    const char *axisKeys[] = {"axisX","axisY","axisZ"};
    for (int i=0;i<3;i++) if (server.hasArg(axisKeys[i])) {
      String value=server.arg(axisKeys[i]); nextAxes[i]=value.toInt();
      if (value != String(nextAxes[i])) { server.send(400,"text/plain; charset=utf-8","ค่าแกนไม่ถูกต้อง"); return; }
    }
    if (!MotionState::validAxes(nextAxes[0],nextAxes[1],nextAxes[2])) { server.send(400,"text/plain; charset=utf-8","แกนต้องไม่ซ้ำกัน ถ้ากลับเครื่องหมายให้กลับสองแกนพร้อมกัน"); return; }
    bool remap = nextRotation!=rotation || nextAxes[0]!=motion.axes[0] || nextAxes[1]!=motion.axes[1] || nextAxes[2]!=motion.axes[2];
    bool nextInvert=server.hasArg("invert")?server.arg("invert")=="1":inverted;
    fillPercent=server.hasArg("fill")?limit(server.arg("fill").toFloat(),10,90):fillPercent;
    sensitivity=server.hasArg("sensitivity")?limit(server.arg("sensitivity").toFloat(),0.4f,2):sensitivity;
    bool rebuild=nextRotation!=rotation||nextSpi!=spiMode;
    activeMode=nextMode; robot.mood=nextMood; gradientWater=nextGradient; theme=nextTheme; restMinutes=nextRest; rest.afterMs=restMinutes*60000UL; rest.touch(millis(),motion.gravity); rotation=nextRotation; spiMode=nextSpi; inverted=nextInvert;
    if(remap){motion.setAxes(nextAxes[0],nextAxes[1],nextAxes[2],rotation);imu.resetFifo();roll=pitch=0;}
    if(rebuild&&!beginPanel()){server.send(500,"text/plain","Display allocation failed");return;}
#if DISPLAY_PROFILE != 4
    panel.invertDisplay(inverted);
#endif
    resetMode();saveSettings();server.send(200,"application/json","{\"ok\":true}");
  });
  server.on("/api/shake",HTTP_POST,[](){rest.touch(millis(),motion.gravity);shake();server.send(200,"application/json","{\"ok\":true}");});
  server.on("/api/calibrate",HTTP_POST,[](){
    if(!imuReady){server.send(409,"text/plain; charset=utf-8","ไม่พบเซนเซอร์");return;}
    if(!calibrateImu()){server.send(503,"text/plain; charset=utf-8","วางเครื่องนิ่งแล้วลองคาลิเบรตใหม่");return;}
    server.send(200,"application/json","{\"ok\":true}");
  });
  server.on("/api/axis-setup",HTTP_POST,[](){
    if(!imuReady){server.send(409,"text/plain; charset=utf-8","ไม่พบเซนเซอร์");return;}
    startAxisSetup();server.send(200,"application/json","{\"ok\":true}");
  });
  server.on("/api/close",HTTP_POST,[](){closeRequested=true;closeAt=millis()+300;server.send(200,"application/json","{\"ok\":true}");});
  server.onNotFound([](){server.send(404,"text/plain","Not found");});
}
void closeAp(){server.stop();WiFi.softAPdisconnect(true);WiFi.mode(WIFI_OFF);apActive=false;closeRequested=false;Serial.println("Wi-Fi off");}
void openAp(){
  Serial.println("Wi-Fi: starting access point");
  if(!WiFi.mode(WIFI_AP)){Serial.println("Wi-Fi: radio did not start");return;}
#if BOARD_PROFILE != 0
  // C3/C6 SuperMini: at full transmit power the access point can fail to start, or the supply sags and resets the board.
  WiFi.setTxPower(WIFI_POWER_8_5dBm);
#endif
  if(!WiFi.softAP(apSsid.c_str(),"tilttoy32")){Serial.println("Wi-Fi: access point failed to start");WiFi.mode(WIFI_OFF);return;}
  apActive=true;apStarted=millis();server.begin();
  Serial.printf("Wi-Fi on: %s  password tilttoy32  http://%s\n",apSsid.c_str(),WiFi.softAPIP().toString().c_str());
}
// Shown once at boot: a brownout here usually means the supply sags when Wi-Fi or the backlight draws current.
const char *resetReason(){
  switch(esp_reset_reason()){
    case ESP_RST_POWERON: return "power on";
    case ESP_RST_SW: return "software restart";
    case ESP_RST_PANIC: return "crash";
    case ESP_RST_INT_WDT: case ESP_RST_TASK_WDT: case ESP_RST_WDT: return "watchdog";
    case ESP_RST_BROWNOUT: return "brownout (supply voltage dropped)";
    case ESP_RST_USB: return "USB";
    default: return "other";
  }
}

void setup(){
  Serial.begin(115200); // Never wait for USB: the toy must boot without a computer.
  pinMode(TOY_BUTTON,INPUT_PULLUP);
  Wire.begin(TOY_SDA,TOY_SCL);Wire.setClock(400000);Wire.setTimeOut(40);
  preferences.begin("tilt-toy",false);
  Serial.printf("Reset reason: %s\n",resetReason());
  // Ten-mode firmware saved "mode"; its removed modes start as water.
  // Older firmware stored five modes under "toyMode" or ten under "mode"; removed modes map to the nearest one left.
  activeMode=preferences.isKey("mode3")?constrain(preferences.getInt("mode3",WaterSlosh),0,ModeCount-1):preferences.isKey("toyMode")?modeFromToyMode(preferences.getInt("toyMode",0)):modeFromLegacy(preferences.getInt("mode",0));
  robot.mood=constrain(preferences.getInt("robotMood",MoodAuto),0,MoodCount-1);
  gradientWater=preferences.getBool("waterShade",true);
  theme=constrain(preferences.getInt("theme",ThemeOcean),0,ThemeCount-1);
  restMinutes=constrain(preferences.getInt("restMin",2),0,60); rest.afterMs=restMinutes*60000UL;
  const int savedDisplayProfile=preferences.getInt("displayProfile",-1);
  // Selecting a different Mini TFT installer preset applies its orientation.
  // Later boots keep any rotation chosen from the phone.
  const bool selectedOrientation=(DISPLAY_PROFILE==0||DISPLAY_PROFILE==5)&&savedDisplayProfile!=DISPLAY_PROFILE;
  rotation=selectedOrientation?TOY_DEFAULT_ROTATION:constrain(preferences.getInt("rotation",TOY_DEFAULT_ROTATION),0,3);
  if(savedDisplayProfile!=DISPLAY_PROFILE){preferences.putInt("displayProfile",DISPLAY_PROFILE);if(selectedOrientation)preferences.putInt("rotation",rotation);}
  // The TFT drivers' init turns inversion on, which is right for these modules. Older firmware
  // defaulted the GC9A01 to off and saved that with every mode change, so it starts on again.
  inverted=preferences.isKey("tftInvert")?preferences.getBool("tftInvert",true):DISPLAY_PROFILE==3?true:preferences.getBool("invert",true);
  spiMode=preferences.getInt("spiMode",DISPLAY_PROFILE==1?3:0);
  fillPercent=limit(preferences.getFloat("fill",50),10,90);
  sensitivity=limit(preferences.getFloat("sensitivity",1),0.4f,2);
  if (!motion.setAxes(preferences.getInt("axisX",1),preferences.getInt("axisY",2),preferences.getInt("axisZ",3),rotation)) motion.setAxes(1,2,3,rotation);
  if(!beginPanel()){Serial.println("Display init / framebuffer failed");while(true)delay(1000);}
  imuReady=imu.begin(Wire);
  if(imuReady&&imu.hasGyro())calibrateImu();
  resetMode();setupRoutes();
  char name[32];snprintf(name,sizeof(name),"TiltToy-%04X",(unsigned)(ESP.getEfuseMac()&0xFFFF));apSsid=name;
  WiFi.mode(WIFI_OFF); // AP starts only after holding the onboard BOOT button.
  Serial.printf("ESP32 Tilt Toy %s | %s | %s | IMU %s @ 0x%02X\n",TOY_VERSION,TOY_BOARD_NAME,profileName,imuReady?imu.name():"missing",imu.i2cAddress());
}
void loop(){
  if(rest.resting){restStep();return;}
  uint32_t now=millis();
  static bool pressed=false;
  static uint32_t pressedAt=0,lastRelease=0;
  bool down=digitalRead(TOY_BUTTON)==LOW;
  if(down&&!pressed&&now-lastRelease>40){pressed=true;pressedAt=now;Serial.println("BOOT pressed (let go after 2 s: Wi-Fi, after 5 s: axis setup)");}
  buttonHeldMs=pressed&&down?now-pressedAt:0;
  if(!down&&pressed){
    const uint32_t held=now-pressedAt;pressed=false;lastRelease=now;rest.touch(now,motion.gravity);
    if(swallowPress){swallowPress=false;}
    else if(axisSetup.step==1||axisSetup.step==2){axisSetup.step=0;Serial.println("Axis setup cancelled");}
    else if(held>=5000){if(imuReady)startAxisSetup();else Serial.println("Axis setup needs the sensor");}
    else if(held>=2000){Serial.printf("BOOT held %.1f s\n",held/1000.f);if(apActive)closeAp();else openAp();}
    else if(held>=40){activeMode=nextToyMode(activeMode);resetMode();saveSettings();Serial.printf("Mode: %s\n",modeIds[activeMode]);}
  }
  if(axisSetup.step&&(int32_t)(now-axisSetup.until)>=0){if(axisSetup.step!=3)Serial.println("Axis setup timed out");axisSetup.step=0;}
  screenOverlay=buttonHeldMs>=800||axisSetup.step!=0;
  if(apActive){server.handleClient();if((closeRequested&&(int32_t)(now-closeAt)>=0)||now-apStarted>180000)closeAp();}
  if(now-lastImu>=10){
    lastImu=now;readImu();
    if(imuReady&&motion.ready&&rest.update(now,motion.gravity,motion.omega,now-lastShake<50)==RestTimer::Rest){
      // Wi-Fi, axis setup and a held button keep the toy awake.
      if(apActive||axisSetup.step||pressed){rest.resting=false;rest.touch(now,motion.gravity);}
      else{enterRest();return;}
    }
    // The robot gets sleepy for the last 4 seconds before resting.
    robot.sleepy=rest.afterMs&&!apActive&&!axisSetup.step&&rest.stillFor(now)+4000>=rest.afterMs;
  }
  // TFT liquid modes draw at their solver step rate and send only changed blocks.
  // The OLED keeps 50 ms: it shares I²C with the sensor and a full transfer takes about 25 ms.
  const uint32_t frameMs=DISPLAY_PROFILE==4?50:activeMode==PixelFlow?PixelDrops::StepMs:isFlipMode(activeMode)?25:50;
  if(now-lastFrame>=frameMs){float dt=limit((now-lastFrame)*0.001f,0.01f,0.1f);lastFrame=now;if(!drawPixelFlowDirect(dt)&&!drawWaterDirect(dt)){renderGame(dt);present();}frameCount++;}
  if(now-fpsAt>=1000){
    fps=frameCount*1000.0f/(now-fpsAt);frameCount=0;fpsAt=now;
    // Solver time applies to the liquid modes only.
    if(isLiquidMode(activeMode))Serial.printf("FPS %.1f | Solver %.2f ms | %s | Wi-Fi %s | heap %u\n",fps,simulationMs,modeIds[activeMode],apActive?"on":"off",ESP.getFreeHeap());
    else Serial.printf("FPS %.1f | %s | Wi-Fi %s | heap %u\n",fps,modeIds[activeMode],apActive?"on":"off",ESP.getFreeHeap());
  }
  delay(1);
}
