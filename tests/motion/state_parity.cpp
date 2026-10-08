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
    else if (kind == 'S') {
      std::cout << FullWaterStyle::Flip << ' ' << FullWaterStyle::color(false,0,0) << ' '
                << FullWaterStyle::color(false,1,0) << ' ' << FullWaterStyle::color(true,0,0) << '\n';
    }
    else if (kind == 'U') {
      float dt, omega, dot; MotionVector gravity, linear;
      std::cin >> dt >> gravity.x >> gravity.y >> gravity.z >> linear.x >> linear.y >> linear.z >> omega >> dot;
      const WaterForces f = waterForces(WaterFull,gravity,linear,omega,dot);
      fluid.advance(dt,f.ax,f.ay,f.omega,f.omegaDot,FullWaterStyle::Flip,f.wallDrag);
      assert(fluid.rasterize(10,10,fluid.h,fluid.h,6*fluid.h/10,6*fluid.h/10,gravity.x,gravity.y,true));
      std::cout << fluid.count;
      for (int p=0;p<fluid.count;p++) std::cout << ' ' << fluid.x[p] << ' ' << fluid.y[p] << ' ' << fluid.vx[p] << ' ' << fluid.vy[p];
      for (int p=0;p<100;p++) std::cout << ' ' << (int)fluid.pixels[p];
      std::cout << '\n';
    }
    else if (kind == 'B') {
      // Long-run bounds are independent of single-step float/double parity.
      FlipFluid stress;
      for (bool round : {false,true}) for (int fill : {10,50,90}) {
        stress.configure(20,20,round,fill); const int count=stress.count;
        for (int i=0;i<1000;i++) {
          const MotionVector gravity{ sinf(i*.07f),cosf(i*.07f),0 };
          const MotionVector linear{ sinf(i*.13f)*18,cosf(i*.11f)*12,0 };
          const WaterForces f=waterForces(WaterFull,gravity,linear,sinf(i*.09f)*18,cosf(i*.09f)*60);
          stress.advance(.025f,f.ax,f.ay,f.omega,f.omegaDot,FullWaterStyle::Flip,f.wallDrag);
          assert(stress.count==count);
          for (int p=0;p<count;p++) {
            assert(std::isfinite(stress.x[p]) && std::isfinite(stress.y[p]) && std::isfinite(stress.vx[p]) && std::isfinite(stress.vy[p]));
            if (round) assert(hypotf(stress.x[p]-stress.cx,stress.y[p]-stress.cy)<=stress.vesselRadius-.8f*stress.h+1e-6f);
            else {
              assert(stress.x[p]>=stress.h+stress.radius-1e-6f && stress.x[p]<=(stress.nx-1)*stress.h-stress.radius+1e-6f);
              assert(stress.y[p]>=stress.h+stress.radius-1e-6f && stress.y[p]<=(stress.ny-1)*stress.h-stress.radius+1e-6f);
            }
          }
        }
      }
      std::cout << 1 << '\n';
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
