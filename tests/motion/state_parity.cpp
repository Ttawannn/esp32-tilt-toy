#include <iostream>
#include <iomanip>
#include <cassert>
#include "../../firmware/tilt_toy/motion_state.h"
#include "../../firmware/tilt_toy/flip_fluid.h"
#include "../../firmware/tilt_toy/toy_modes.h"

int main() {
  assert(Water==0 && Maze==1 && Snow==2 && Pong==3 && Pet==4 && Dice==5 && WaterInertia==6 && WaterSwirl==7 && WaterFull==8 && PixelFlow==9 && ModeCount==10);
  assert(nextToyMode(Water)==WaterInertia && nextToyMode(WaterInertia)==WaterSwirl && nextToyMode(WaterSwirl)==WaterFull && nextToyMode(WaterFull)==PixelFlow && nextToyMode(PixelFlow)==Maze && nextToyMode(Dice)==Water);
  assert(isWaterMode(WaterInertia) && isWaterMode(WaterSwirl) && isWaterMode(WaterFull) && !isWaterMode(PixelFlow) && !isWaterMode(Dice));
  assert(isLiquidMode(WaterFull) && isLiquidMode(PixelFlow) && !isLiquidMode(Maze));
  std::cout << std::setprecision(9);
  MotionState motion;
  FlipFluid fluid; fluid.configure(8,8,true,50);
  char kind;
  while (std::cin >> kind) {
    if (kind == 'W') {
      int mode; MotionVector gravity, linear; float omega, dot;
      std::cin >> mode >> gravity.x >> gravity.y >> gravity.z >> linear.x >> linear.y >> linear.z >> omega >> dot;
      WaterForces f = waterForces(mode,gravity,linear,omega,dot);
      std::cout << f.ax << ' ' << f.ay << ' ' << f.omega << ' ' << f.omegaDot << ' ' << f.wallDrag << '\n';
    }
    else if (kind == 'R') { fluid.reset(50); }
    else if (kind == 'M') {
      MotionSample s; float dt;
      std::cin >> s.ax >> s.ay >> s.az >> s.gx >> s.gy >> s.gz >> dt;
      motion.update(s,dt);
      for (float value : motion.q) std::cout << value << ' ';
      std::cout << motion.gravity.x << ' ' << motion.gravity.y << ' ' << motion.gravity.z << ' '
                << motion.linear.x << ' ' << motion.linear.y << ' ' << motion.linear.z << ' '
                << motion.omega.x << ' ' << motion.omega.y << ' ' << motion.omega.z << ' '
                << motion.omegaDot << ' ' << motion.roll << ' ' << motion.pitch << ' ' << motion.yaw << '\n';
    } else if (kind == 'F') {
      float dt, ax, ay, omega, dot, drag; std::cin >> dt >> ax >> ay >> omega >> dot >> drag;
      fluid.advance(dt,ax,ay,omega,dot,.9f,drag);
      std::cout << fluid.count;
      for (int p=0;p<fluid.count;p++) std::cout << ' ' << fluid.x[p] << ' ' << fluid.y[p] << ' ' << fluid.vx[p] << ' ' << fluid.vy[p];
      std::cout << '\n';
    }
  }
}
