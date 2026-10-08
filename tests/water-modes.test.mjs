import test from 'node:test';
import assert from 'node:assert/strict';
import { waterForces, isWaterMode, isLiquidMode } from '../web/water-modes.js';
import { modes } from '../web/profiles.js';
import { ToyPreview, WaterFullInput } from '../web/preview.js';
import { FlipFluid, FULL_WATER_FLIP } from '../web/fluid.js';
import { MotionState } from '../web/motion.js';

const gravity={x:.3,y:.4,z:.5},linear={x:12,y:-8,z:3},zero={x:0,y:0,z:0};
test('normal water ignores translation and spin; each new mode uses only its own force',()=>{
  const base=waterForces('water',gravity,zero,0,0);
  assert.deepEqual(waterForces('water',gravity,linear,12,40),base);
  const inertia=waterForces('water-inertia',gravity,linear,12,40);
  assert.ok(inertia.ax<base.ax&&inertia.ay>base.ay);
  assert.equal(inertia.omega,0);assert.equal(inertia.omegaDot,0);assert.equal(inertia.wallDrag,0);
  assert.deepEqual(inertia,waterForces('water-inertia',gravity,linear,-12,-40));
  const swirl=waterForces('water-swirl',gravity,linear,2,10);
  assert.equal(swirl.ax,base.ax);assert.equal(swirl.ay,base.ay);assert.equal(swirl.omega,2);assert.equal(swirl.omegaDot,10);
  assert.deepEqual(swirl,waterForces('water-swirl',gravity,zero,2,10));
  assert.deepEqual(waterForces('water-inertia',gravity,{x:.39,y:-.39,z:9},0,0),base);
  assert.equal(modes.length,10);assert.deepEqual(modes.filter(m=>isWaterMode(m.id)).map(m=>m.id),['water','water-inertia','water-swirl','water-full']);
  assert.deepEqual(modes.filter(m=>isLiquidMode(m.id)).map(m=>m.id),['water','water-inertia','water-swirl','water-full','pixel-flow']);
  // pixel-flow asks for water-inertia forces (see pixel-flow.js); its own id adds nothing to tilt.
  assert.deepEqual(waterForces('pixel-flow',gravity,linear,12,40),base);
});

test('full water combines measured translation and rotation, scales sensitivity and keeps a quiet deadband',()=>{
  const base=waterForces('water',gravity,zero,0,0),full=waterForces('water-full',gravity,linear,2,10);
  assert.ok(full.ax<waterForces('water-inertia',gravity,linear,0,0).ax);
  assert.ok(full.ay>base.ay);assert.equal(full.omega,2);assert.equal(full.omegaDot,10);assert.equal(full.wallDrag,.10);
  const quiet=waterForces('water-full',gravity,{x:.39,y:-.39,z:8},0,0);
  assert.equal(quiet.ax,base.ax);assert.equal(quiet.ay,base.ay);
  const sensitive=waterForces('water-full',gravity,linear,2,10,2);
  assert.equal(sensitive.ax,2*full.ax);assert.equal(sensitive.ay,2*full.ay);
  assert.equal(sensitive.omega,full.omega);
});

test('full-water orientation stays continuous across ±180°, with matching gyro and no translation after settling',()=>{
  const input=new WaterFullInput(170,0),motion=new MotionState();motion.update(input.sample(0));
  const before=[...motion.q];input.setTilt(-170,0);assert.deepEqual(motion.q,before);
  assert.ok(input.targetRoll>Math.PI,'the short path crosses +180 instead of turning backwards 340 degrees');
  let maxSpin=0;
  for(let i=0;i<120;i++){const sample=input.sample();maxSpin=Math.max(maxSpin,sample.gz);motion.update(sample);}
  assert.ok(maxSpin>0);assert.ok(Math.abs(input.state().roll+170)<.01);
  input.setTilt(-170,90);
  let pitchGyro=0;
  for(let i=0;i<150;i++){const sample=input.sample();pitchGyro=Math.max(pitchGyro,Math.hypot(sample.gx,sample.gy));motion.update(sample);}
  assert.ok(pitchGyro>1);assert.ok(motion.gravity.z>.999);
  assert.ok(Math.hypot(...Object.values(motion.linear))<.1);
  input.setTilt(-170,0);for(let i=0;i<150;i++)motion.update(input.sample());
  input.setTilt(-170,90);motion.update(input.sample());input.setSpin(360);
  assert.equal(input.state().targetPitch,90,'starting spin preserves an unfinished lay-flat gesture');
  for(let i=0;i<200;i++)motion.update(input.sample());
  assert.ok(Math.abs(motion.omega.z-2*Math.PI)<.01);assert.ok(Math.abs(motion.linear.x)<.05);
  input.setSpin(0);for(let i=0;i<100;i++)motion.update(input.sample());
  assert.ok(Math.abs(motion.omega.z)<.01);assert.ok(Math.hypot(...Object.values(motion.linear))<.1);
  assert.ok(Math.abs(Math.hypot(...input.q)-1)<1e-9);
});

test('full-water demo is deterministic; manual input stops it from the current orientation',()=>{
  const a=new WaterFullInput(30,20),b=new WaterFullInput(30,20);a.startDemo();b.startDemo();
  const motion=new MotionState();let largest=0,joltSeen=false;
  for(let i=0;i<1300;i++){
    const one=a.sample(),two=b.sample();assert.deepEqual(one,two);
    motion.update(one);
    largest=Math.max(largest,Math.abs(one.gz));
    if(motion.linear.x>8)joltSeen=true;
  }
  assert.ok(largest>3);assert.ok(joltSeen);assert.equal(a.demo,false);
  a.startDemo();for(let i=0;i<450;i++)a.sample();const q=[...a.q],roll=a.state().roll;
  a.setTilt(roll,45);assert.equal(a.demo,false);assert.deepEqual(a.q,q,'manual input keeps the current pose');
});

test('full-water preview retains liquid momentum after stopping and clears only simulation inputs when leaving',()=>{
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{};
  try{
    const ctx=new Proxy({},{get:()=>()=>{}}),canvas={width:240,height:240,getContext:()=>ctx,addEventListener:()=>{}};
    const p=new ToyPreview(canvas);p.setProfile({width:240,height:240,shape:'round'});p.setMode('water-full');p.setTilt(0,90);
    let controlState;p.onFullMotion=state=>controlState=state;
    for(let i=0;i<80;i++)p.draw(i*.025,.025);
    p.setFullSpin(360);for(let i=0;i<80;i++)p.draw(2+i*.025,.025);
    const positions=[...p.fluid.x];p.setFullSpin(0);assert.deepEqual([...p.fluid.x],positions,'stop does not reset the liquid');
    for(let i=0;i<10;i++)p.draw(4+i*.025,.025);
    assert.ok(p.fluid.vx.subarray(0,p.fluid.count).some(v=>Math.abs(v)>.01));
    const ready=p.motion.ready;p.jolt(12,0);assert.equal(p.motion.ready,ready);
    p.draw(5,.025);assert.ok(p.motion.linear.x>5);
    p.startFullDemo();assert.equal(controlState.demo,true,'demo controls update without waiting for a render frame');
    p.jolt(0,12);assert.equal(controlState.demo,false);
    p.startFullDemo();for(let i=0;i<50;i++)p.updateMotion(.01);
    const elapsed=p.fullMotion.elapsed,quaternion=[...p.motion.q];p.pauseFullMotion();
    assert.equal(p.motionTime,0);assert.equal(p.fullMotion.elapsed,elapsed);assert.deepEqual(p.motion.q,quaternion);
    p.setMode('water');assert.equal(p.fullMotion,null);assert.equal(p.spin,0);assert.deepEqual(p.kick,{x:0,y:0});
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('full-water preset keeps particle mass and vessel bounds during 1000 mixed-force steps',()=>{
  for(const round of [false,true])for(const fill of [10,50,90]){
    const f=new FlipFluid(20,20,round,fill),count=f.count;
    for(let i=0;i<1000;i++){
      const theta=i*.07,g={x:Math.sin(theta),y:Math.cos(theta),z:0},linear={x:Math.sin(i*.13)*18,y:Math.cos(i*.11)*12,z:0};
      const force=waterForces('water-full',g,linear,Math.sin(i*.09)*18,Math.cos(i*.09)*60);
      f.advance(.025,force.ax,force.ay,force.omega,force.omegaDot,FULL_WATER_FLIP,force.wallDrag);
      assert.equal(f.count,count);
    }
    for(let p=0;p<count;p++){
      assert.ok([f.x[p],f.y[p],f.vx[p],f.vy[p]].every(Number.isFinite));
      if(round)assert.ok(Math.hypot(f.x[p]-f.cx,f.y[p]-f.cy)<=f.vesselRadius-.8*f.h+1e-6);
      else{assert.ok(f.x[p]>=f.h+f.radius-1e-6&&f.x[p]<=(f.nx-1)*f.h-f.radius+1e-6);assert.ok(f.y[p]>=f.h+f.radius-1e-6&&f.y[p]<=(f.ny-1)*f.h-f.radius+1e-6);}
    }
  }
});
test('normal preview keeps the original tilt-only solver; switching modes resets water and hidden spin',()=>{
  // Call the real renderer with a no-op canvas; compare numerical state, not drawing internals.
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{};
  try{
    const ctx=new Proxy({},{get:()=>()=>{}}),canvas={width:240,height:240,getContext:()=>ctx,addEventListener:()=>{}};
    const p=new ToyPreview(canvas);p.setTilt(30,20);p.spin=360;p.jolt(12,-12);
    const expected=new FlipFluid(p.layout.nx,p.layout.ny,false,50),r=Math.PI/180;
    for(let i=0;i<20;i++){p.draw(i*.025,.025);expected.advance(.025,4*Math.sin(30*r)*Math.cos(20*r),4*Math.cos(30*r)*Math.cos(20*r));}
    assert.deepEqual(p.fluid.x,expected.x);assert.deepEqual(p.fluid.vy,expected.vy);
    p.setMode('water-inertia');assert.equal(p.spin,0);p.draw(0,.025);p.jolt(12,0);p.draw(.025,.025);
    assert.ok(p.motion.linear.x>8);assert.equal(p.motion.omega.z,0);
    p.setMode('water-swirl');assert.deepEqual(p.kick,{x:0,y:0});p.setTilt(0,90);p.spin=180;p.jolt(12,0);p.draw(0,.025);
    assert.ok(Math.abs(p.motion.linear.x)<1e-5);assert.ok(p.motion.omega.z>1);
  }finally{globalThis.requestAnimationFrame=previous;}
});
