#include <iostream>
#include <iomanip>
#include <cassert>
#include "../../firmware/tilt_toy/motion_state.h"
#include "../../firmware/tilt_toy/flip_fluid.h"
#include "../../firmware/tilt_toy/toy_modes.h"
#include "../../firmware/tilt_toy/puddle.h"
#include "../../firmware/tilt_toy/message.h"

int main() {
  assert(WaterSlosh==0 && PixelFlow==1 && Robot==2 && Heart==3 && Message==4 && ModeCount==5);
  assert(nextToyMode(WaterSlosh)==PixelFlow && nextToyMode(PixelFlow)==Robot && nextToyMode(Robot)==Heart && nextToyMode(Heart)==Message && nextToyMode(Message)==WaterSlosh && nextToyMode(-1)==WaterSlosh);
  assert(!isLiquidMode(Heart) && !isLiquidMode(Message) && !isFlipMode(Heart));
  assert(isFlipMode(WaterSlosh) && !isFlipMode(PixelFlow) && !isFlipMode(Robot));
  assert(isLiquidMode(WaterSlosh) && isLiquidMode(PixelFlow) && !isLiquidMode(Robot));
  // Five-mode "toyMode": water and slosh become slosh water, the pocket eyes become robot eyes.
  assert(modeFromToyMode(0)==WaterSlosh && modeFromToyMode(1)==PixelFlow && modeFromToyMode(2)==Robot && modeFromToyMode(3)==Robot && modeFromToyMode(4)==WaterSlosh && modeFromToyMode(-1)==WaterSlosh);
  // Ten-mode "mode": pocket eyes 4, pixel-flow 9; every other mode starts as slosh water.
  assert(modeFromLegacy(4)==Robot && modeFromLegacy(9)==PixelFlow);
  for (int removed : {0,1,2,3,5,6,7,8,10,-1}) assert(modeFromLegacy(removed)==WaterSlosh);
  {
    // Sensor X down the screen, Y to the right, so Z points out of the screen.
    // Flat, screen up: up is +Z. Upright on the bottom edge: up is -X.
    int axes[3];
    assert(MotionState::axesFromPoses({0,0,9.81f},{-9.81f,0,0},0,axes) && axes[0]==2 && axes[1]==1 && axes[2]==-3);
    // Aligned sensor (X right, Y down, Z into the screen) keeps the identity map.
    assert(MotionState::axesFromPoses({0,0,-9.81f},{0,-9.81f,0},0,axes) && axes[0]==1 && axes[1]==2 && axes[2]==3);
    // A slightly tilted pose still snaps to the nearest axis.
    assert(MotionState::axesFromPoses({.8f,-.6f,-9.7f},{.9f,-9.6f,1.1f},0,axes) && axes[0]==1 && axes[1]==2 && axes[2]==3);
    // The display rotated 90°: the measured on-screen axes are turned back before storing.
    assert(MotionState::axesFromPoses({0,0,-9.81f},{0,-9.81f,0},1,axes) && axes[0]==2 && axes[1]==-1 && axes[2]==3);
    MotionState turned; assert(turned.setAxes(axes[0],axes[1],axes[2],1));
    const MotionVector right = turned.map(1,0,0); assert(right.x==1 && right.y==0);  // sensor X is still the on-screen right
    // The same pose twice cannot tell the screen's y from its z.
    assert(!MotionState::axesFromPoses({0,0,9.81f},{0,.5f,9.8f},0,axes));
    // With the map applied, gravity points down the screen when upright.
    MotionState upright; assert(upright.setAxes(2,1,-3));
    for (int i=0;i<200;i++) { MotionSample s; s.ax=-9.81f; upright.update(s); }
    assert(upright.gravity.y > .99f && fabsf(upright.roll) < 1);
  }
  std::cout << std::setprecision(9);
  MotionState motion;
  FlipFluid fluid; fluid.configure(8,8,true,50);
  char kind;
  while (std::cin >> kind) {
    if (kind == 'W') {
      int mode; MotionVector gravity, linear; float omega, dot;
      std::cin >> mode >> gravity.x >> gravity.y >> gravity.z >> linear.x >> linear.y >> linear.z >> omega >> dot;
      WaterForces f = waterForces(mode,gravity,linear,omega,dot);
      std::cout << f.ax << ' ' << f.ay << ' ' << f.omega << ' ' << f.omegaDot << '\n';
    }
    else if (kind == 'U') {
      float dt; MotionVector gravity;
      std::cin >> dt >> gravity.x >> gravity.y >> gravity.z;
      const WaterForces f = waterForces(WaterSlosh,gravity,MotionVector{});
      fluid.advance(dt,f.ax,f.ay);
      assert(fluid.rasterize(10,10,fluid.h,fluid.h,6*fluid.h/10,6*fluid.h/10,gravity.x,gravity.y));
      std::cout << fluid.count;
      for (int p=0;p<fluid.count;p++) std::cout << ' ' << fluid.posX(p) << ' ' << fluid.posY(p) << ' ' << fluid.velX(p) << ' ' << fluid.velY(p);
      for (int p=0;p<100;p++) std::cout << ' ' << (int)fluid.pixels[p];
      std::cout << '\n';
    }
    else if (kind == 'B') {
      // Long-run bounds under strong, changing forces.
      FlipFluid stress;
      for (bool round : {false,true}) for (int fill : {10,50,90}) {
        stress.configure(20,20,round,fill); const int count=stress.count;
        for (int i=0;i<1000;i++) {
          const MotionVector gravity{ sinf(i*.07f),cosf(i*.07f),0 };
          const MotionVector linear{ sinf(i*.13f)*18,cosf(i*.11f)*12,0 };
          const WaterForces f=waterForces(WaterSlosh,gravity,linear,sinf(i*.09f)*18,cosf(i*.09f)*60,2);
          if (i%97==0) stress.impulse(f.ax,f.ay);
          stress.advance(.025f,f.ax,f.ay,f.omega,f.omegaDot);
          assert(stress.count==count);
          for (int p=0;p<count;p++) {
            assert(std::isfinite(stress.posX(p)) && std::isfinite(stress.posY(p)) && std::isfinite(stress.velX(p)) && std::isfinite(stress.velY(p)));
            if (round) assert(hypotf(stress.posX(p)-stress.cx,stress.posY(p)-stress.cy)<=stress.vesselRadius-.8f*stress.h+1e-6f);
            else {
              assert(stress.posX(p)>=stress.h+stress.radius-1e-6f && stress.posX(p)<=(stress.nx-1)*stress.h-stress.radius+1e-6f);
              assert(stress.posY(p)>=stress.h+stress.radius-1e-6f && stress.posY(p)<=(stress.ny-1)*stress.h-stress.radius+1e-6f);
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
      float dt, ax, ay; std::cin >> dt >> ax >> ay;
      fluid.advance(dt,ax,ay);
      std::cout << fluid.count;
      for (int p=0;p<fluid.count;p++) std::cout << ' ' << fluid.posX(p) << ' ' << fluid.posY(p) << ' ' << fluid.velX(p) << ' ' << fluid.velY(p);
      std::cout << '\n';
    } else if (kind == 'G') {
      // Dot grid for a panel size.
      int width, height; std::cin >> width >> height;
      const DotGrid grid = dotGrid(width, height);
      std::cout << grid.pitch << ' ' << grid.cols << ' ' << grid.rows << ' ' << grid.x << ' ' << grid.y << '\n';
    } else if (kind == 'D') {
      // A picture packed by web/message.js, read back dot by dot.
      int width, height; std::cin >> width >> height;
      const size_t bytes = DotBitmap::bytesFor(width, height);
      DotBitmap picture; uint8_t *bits = (uint8_t *)malloc(bytes);
      for (size_t k = 0; k < bytes; k++) { int value; std::cin >> value; bits[k] = (uint8_t)value; }
      picture.assign(bits, width, height);
      for (int y = 0; y < height; y++) for (int x = 0; x < width; x++) std::cout << (x || y ? " " : "") << (int)picture.dot(x, y);
      std::cout << '\n';
      picture.assign(nullptr, 0, 0);
    } else if (kind == 'P') {
      // Puddle: a still side-view raster (lower half water), then gravity steps; one line of cells per step.
      int cols, rows, circular, steps; float fill; std::cin >> cols >> rows >> circular >> fill >> steps;
      static uint8_t side[Puddle::MaxSide*Puddle::MaxSide]; static Puddle puddle; puddle.reset();
      for (int j=0;j<rows;j++) for (int i=0;i<cols;i++) {
        const int x=2*i+1-cols, y=2*j+1-rows;
        side[j*cols+i] = circular && x*x+y*y > cols*cols ? 3 : j > rows/2 ? 1 : j == rows/2 ? 2 : 0;
      }
      for (int s=0;s<steps;s++) {
        float dt, gx, gy, gz; int ripple, rx, ry; std::cin >> dt >> gx >> gy >> gz >> ripple >> rx >> ry;
        if (ripple) std::cout << (int)puddle.ripple(rx,ry) << ' ';
        std::cout << (int)puddle.update(dt,gx,gy,gz,side,cols,rows,fill);
        for (int c=0;c<cols*rows;c++) std::cout << ' ' << (int)puddle.look[c];
        std::cout << '\n';
      }
    } else if (kind == 'L') {
      // Long run on the raw Q16 state: the fixed-point solver must match web/fluid.js exactly.
      int width, height, circular, steps; float fill; std::cin >> width >> height >> circular >> fill >> steps;
      static FlipFluid run; assert(run.configure(width,height,circular!=0,fill));
      for (int s=0;s<steps;s++) {
        float dt, ax, ay, omega, dot; int shake;
        std::cin >> dt >> ax >> ay >> omega >> dot >> shake;
        if (shake) run.impulse(ax,ay);
        run.advance(dt,ax,ay,omega,dot);
      }
      int cols, rows; float ox, oy, cellX, cellY, gx, gy; std::cin >> cols >> rows >> ox >> oy >> cellX >> cellY >> gx >> gy;
      assert(run.rasterize(cols,rows,ox,oy,cellX,cellY,gx,gy));
      std::cout << run.count << ' ' << run.restDensity;
      for (int p=0;p<run.count;p++) std::cout << ' ' << run.qx[p] << ' ' << run.qy[p] << ' ' << run.qvx[p] << ' ' << run.qvy[p];
      for (int p=0;p<cols*rows;p++) std::cout << ' ' << (int)run.pixels[p];
      run.shade(cols,rows,gx,gy);
      for (int p=0;p<cols*rows;p++) std::cout << ' ' << (int)run.look[p];
      std::cout << '\n';
    }
  }
}
