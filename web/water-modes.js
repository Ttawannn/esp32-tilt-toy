import { GRAVITY } from './motion.js';
// Mirror of toy_modes.h. pixel-flow has its own solver, so it is a liquid mode but not a FLIP water mode.
export const isWaterMode = mode => ['water','water-inertia','water-swirl','water-full'].includes(mode);
export const isLiquidMode = mode => isWaterMode(mode) || mode === 'pixel-flow';
// Each water mode receives its own forces. pixel-flow keeps its tilt-only placeholder.
export function waterForces(mode,gravity,linear,omega,omegaDot,sensitivity=1) {
  const forces={ax:4*sensitivity*gravity.x,ay:4*sensitivity*gravity.y,omega:0,omegaDot:0,wallDrag:0};
  if(mode==='water-inertia'){
    forces.ax-=4*sensitivity*(Math.abs(linear.x)<.4?0:linear.x)/GRAVITY;
    forces.ay-=4*sensitivity*(Math.abs(linear.y)<.4?0:linear.y)/GRAVITY;
  }else if(mode==='water-swirl'){
    forces.omega=omega;forces.omegaDot=omegaDot;forces.wallDrag=.15;
  }else if(mode==='water-full'){
    const linearGain=1.35,deadband=.4;
    forces.ax-=4*sensitivity*linearGain*(Math.abs(linear.x)<deadband?0:linear.x)/GRAVITY;
    forces.ay-=4*sensitivity*linearGain*(Math.abs(linear.y)<deadband?0:linear.y)/GRAVITY;
    forces.omega=omega;forces.omegaDot=omegaDot;forces.wallDrag=.10;
  }
  return forces;
}
