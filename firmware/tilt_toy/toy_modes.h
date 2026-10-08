#pragma once
#include "motion_state.h"

// Keep the six original NVS indices stable. New water modes are appended.
enum ToyMode { Water = 0, Maze, Snow, Pong, Pet, Dice, WaterInertia, WaterSwirl, ModeCount };
static const char *const modeIds[ModeCount] = {"water", "maze", "snow", "pong", "pet", "dice", "water-inertia", "water-swirl"};
inline bool isWaterMode(int mode) { return mode == Water || mode == WaterInertia || mode == WaterSwirl; }
inline int nextToyMode(int current) {
  constexpr int order[ModeCount] = {Water, WaterInertia, WaterSwirl, Maze, Snow, Pong, Pet, Dice};
  for (int i=0;i<ModeCount;i++) if (order[i]==current) return order[(i+1)%ModeCount];
  return Water;
}
struct WaterForces { float ax, ay, omega = 0, omegaDot = 0, wallDrag = 0; };
inline WaterForces waterForces(int mode, MotionVector gravity, MotionVector linear, float omega, float omegaDot, float sensitivity = 1) {
  WaterForces forces{4*sensitivity*gravity.x,4*sensitivity*gravity.y};
  if (mode == WaterInertia) {
    forces.ax -= 4*sensitivity*(fabsf(linear.x)<.4f?0:linear.x)/MotionState::G;
    forces.ay -= 4*sensitivity*(fabsf(linear.y)<.4f?0:linear.y)/MotionState::G;
  } else if (mode == WaterSwirl) {
    forces.omega = omega; forces.omegaDot = omegaDot; forces.wallDrag = .15f;
  }
  return forces;
}
