#pragma once
#include "motion_state.h"

// NVS "toyMode" holds these indices; new modes are appended. Ten-mode firmware stored its own index under "mode".
enum ToyMode { Water = 0, PixelFlow, Pet, Robot, WaterSlosh, ModeCount };
static const char *const modeIds[ModeCount] = {"water", "pixel-flow", "pet", "robot", "water-slosh"};
// Ten-mode indices: 0 water, 4 pet, 9 pixel-flow. Every removed mode starts as water.
inline int modeFromLegacy(int legacy) { return legacy == 4 ? Pet : legacy == 9 ? PixelFlow : Water; }
// Modes simulated by FlipFluid. Pixel Flow has its own solver.
inline bool isFlipMode(int mode) { return mode == Water || mode == WaterSlosh; }
// Modes that show liquid and use the fill level.
inline bool isLiquidMode(int mode) { return isFlipMode(mode) || mode == PixelFlow; }
// BOOT order: the two FLIP waters, Pixel Flow, then the eyes.
inline int nextToyMode(int current) {
  constexpr int order[ModeCount] = {Water, WaterSlosh, PixelFlow, Pet, Robot};
  for (int i = 0; i < ModeCount; i++) if (order[i] == current) return order[(i+1) % ModeCount];
  return Water;
}
struct WaterForces { float ax, ay, omega = 0, omegaDot = 0; };
// Water follows tilt only. Pixel Flow also reacts to jolts: measured translation pushes the drops the other way.
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
