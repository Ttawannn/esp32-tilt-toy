import { GRAVITY } from './motion.js';
export const isWaterMode = mode => ['water','water-inertia','water-swirl'].includes(mode);
// Mirror of toy_modes.h. Each water mode receives only its own additional force.
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
