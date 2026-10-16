import { GRAVITY } from './motion.js';
// Mirror of toy_modes.h. water-slosh uses the FLIP solver; pixel-flow has its own.
export const isFlipMode = mode => mode === 'water-slosh';
export const isLiquidMode = mode => mode === 'water-slosh' || mode === 'pixel-flow';
// Both liquids follow tilt and push against jolts: measured translation moves the water the other way.
// Slosh water adds turning about the screen axis, so moving or rocking the toy leaves the water behind.
export function waterForces(mode,gravity,linear,omega=0,omegaDot=0,sensitivity=1) {
  const forces={ax:4*sensitivity*gravity.x,ay:4*sensitivity*gravity.y,omega:0,omegaDot:0};
  if(mode==='pixel-flow'||mode==='water-slosh'){
    forces.ax-=4*sensitivity*(Math.abs(linear.x)<.4?0:linear.x)/GRAVITY;
    forces.ay-=4*sensitivity*(Math.abs(linear.y)<.4?0:linear.y)/GRAVITY;
  }
  if(mode==='water-slosh'){forces.omega=omega;forces.omegaDot=omegaDot;}
  return forces;
}
