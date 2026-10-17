#pragma once
#include "motion_state.h"

// NVS "mode3" holds these indices, which are also the BOOT order.
enum ToyMode { WaterSlosh = 0, PixelFlow, Robot, Heart, Message, ModeCount };
static const char *const modeIds[ModeCount] = {"water-slosh", "pixel-flow", "robot", "heart", "message"};
// Five-mode firmware stored "toyMode": 0 water, 1 pixel-flow, 2 pocket eyes, 3 robot, 4 water-slosh.
// Plain water becomes slosh water and the pocket eyes become robot eyes.
inline int modeFromToyMode(int old) { return old == 1 ? PixelFlow : old == 2 || old == 3 ? Robot : WaterSlosh; }
// Ten-mode firmware stored "mode": 4 pocket eyes, 9 pixel-flow; every other mode starts as slosh water.
inline int modeFromLegacy(int legacy) { return legacy == 4 ? Robot : legacy == 9 ? PixelFlow : WaterSlosh; }
// The mode simulated by FlipFluid. Pixel Flow has its own solver.
inline bool isFlipMode(int mode) { return mode == WaterSlosh; }
// Modes that show liquid and use the fill level.
inline bool isLiquidMode(int mode) { return mode == WaterSlosh || mode == PixelFlow; }
inline int nextToyMode(int current) { return current >= 0 && current < ModeCount - 1 ? current + 1 : WaterSlosh; }
struct WaterForces { float ax, ay, omega = 0, omegaDot = 0; };
// Both liquids follow tilt and push against jolts: measured translation moves the water the other way.
// Slosh water adds turning about the screen axis, so moving or rocking the toy leaves the water behind.
inline WaterForces waterForces(int mode, MotionVector gravity, MotionVector linear, float omega = 0, float omegaDot = 0, float sensitivity = 1) {
  WaterForces forces{4*sensitivity*gravity.x,4*sensitivity*gravity.y};
  if (mode == PixelFlow || mode == WaterSlosh) {
    forces.ax -= 4*sensitivity*(fabsf(linear.x)<.4f?0:linear.x)/MotionState::G;
    forces.ay -= 4*sensitivity*(fabsf(linear.y)<.4f?0:linear.y)/MotionState::G;
  }
  if (mode == WaterSlosh) { forces.omega = omega; forces.omegaDot = omegaDot; }
  return forces;
}
