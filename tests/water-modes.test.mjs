import test from 'node:test';
import assert from 'node:assert/strict';
import { waterForces, isWaterMode, isLiquidMode } from '../web/water-modes.js';
import { modes } from '../web/profiles.js';
import { ToyPreview } from '../web/preview.js';
import { FlipFluid } from '../web/fluid.js';

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
  // Placeholders: both new modes use tilt only until their own forces land.
  for(const mode of ['water-full','pixel-flow'])assert.deepEqual(waterForces(mode,gravity,linear,12,40),base);
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
