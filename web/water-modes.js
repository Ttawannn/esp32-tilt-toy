import { GRAVITY } from './motion.js';
// Mirror of toy_modes.h. pixel-flow has its own solver, so it is a liquid mode but not a FLIP water mode.
export const isWaterMode = mode => ['water','water-inertia','water-swirl','water-full'].includes(mode);
export const isLiquidMode = mode => isWaterMode(mode) || mode === 'pixel-flow';
// Each water mode receives only its own additional force. water-full and pixel-flow use tilt only for now.
export function waterForces(mode,gravity,linear,omega,omegaDot,sensitivity=1) {
  const forces={ax:4*sensitivity*gravity.x,ay:4*sensitivity*gravity.y,omega:0,omegaDot:0,wallDrag:0};
  if(mode==='water-inertia'){
    forces.ax-=4*sensitivity*(Math.abs(linear.x)<.4?0:linear.x)/GRAVITY;
    forces.ay-=4*sensitivity*(Math.abs(linear.y)<.4?0:linear.y)/GRAVITY;
  }else if(mode==='water-swirl'){
    forces.omega=omega;forces.omegaDot=omegaDot;forces.wallDrag=.15;
  }
  return forces;
}
