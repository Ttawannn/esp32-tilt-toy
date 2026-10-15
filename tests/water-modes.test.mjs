import test from 'node:test';
import assert from 'node:assert/strict';
import { waterForces, isFlipMode, isLiquidMode } from '../web/water-modes.js';
import { modes } from '../web/profiles.js';
import { ToyPreview } from '../web/preview.js';
import { FlipFluid } from '../web/fluid.js';
import { RobotEyes, MOODS, eyeShape } from '../web/robot-eyes.js';

const gravity={x:.3,y:.4,z:.5},linear={x:12,y:-8,z:3},zero={x:0,y:0,z:0};
test('five modes: two FLIP waters and pixel-flow are liquids; pet and robot are eyes',()=>{
  assert.deepEqual(modes.map(m=>m.id),['water','water-slosh','pixel-flow','pet','robot']);
  assert.deepEqual(modes.filter(m=>isFlipMode(m.id)).map(m=>m.id),['water','water-slosh']);
  assert.deepEqual(modes.filter(m=>isLiquidMode(m.id)).map(m=>m.id),['water','water-slosh','pixel-flow']);
});

test('water follows tilt only; pixel-flow also pushes against jolts past a quiet deadband',()=>{
  const base=waterForces('water',gravity,zero);
  assert.deepEqual(base,{ax:4*gravity.x,ay:4*gravity.y,omega:0,omegaDot:0});
  assert.deepEqual(waterForces('water',gravity,linear,2,10),base);
  const pixel=waterForces('pixel-flow',gravity,linear);
  assert.ok(pixel.ax<base.ax&&pixel.ay>base.ay,'a jolt pushes the drops the opposite way');
  assert.deepEqual(waterForces('pixel-flow',gravity,{x:.39,y:-.39,z:9}),base);
  const sensitive=waterForces('pixel-flow',gravity,linear,0,0,2);
  assert.ok(Math.abs(sensitive.ax-2*pixel.ax)<1e-12&&Math.abs(sensitive.ay-2*pixel.ay)<1e-12);
});

test('slosh water feels real translation and rotation, and ignores hand tremor',()=>{
  const base=waterForces('water',gravity,zero),slosh=waterForces('water-slosh',gravity,linear,2,10),pixel=waterForces('pixel-flow',gravity,linear,2,10);
  assert.ok(slosh.ax<base.ax&&slosh.ay>base.ay,'moving the toy sends the water the other way');
  assert.equal(slosh.ax,pixel.ax);assert.equal(slosh.ay,pixel.ay);
  assert.equal(slosh.omega,2);assert.equal(slosh.omegaDot,10);assert.equal(pixel.omega,0,'pixel-flow does not turn');
  assert.deepEqual(waterForces('water-slosh',gravity,{x:.39,y:-.39,z:9},0,0),base);
  const sensitive=waterForces('water-slosh',gravity,linear,2,10,2);
  assert.ok(Math.abs(sensitive.ax-2*slosh.ax)<1e-12);assert.equal(sensitive.omega,slosh.omega);
});

test('slosh preview turns the vessel at a real rate, moves water downhill at once, sloshes on jolts and settles',()=>{
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{};
  try{
    const ctx=new Proxy({},{get:()=>()=>{}}),canvas={width:240,height:240,getContext:()=>ctx,addEventListener:()=>{}};
    const p=new ToyPreview(canvas);p.setMode('water-slosh');
    const meanX=()=>{const x=p.fluid.x;let s=0;for(let i=0;i<p.fluid.count;i++)s+=x[i];return s/p.fluid.count;};
    let t=0;const run=n=>{for(let i=0;i<n;i++,t+=.025)p.draw(t,.025);};
    run(40);const rest=meanX();
    p.setTilt(30,0);run(4);
    assert.ok(p.motion.omega.z>.5,'tilting the slider turns the toy instead of jumping');assert.ok(p.motion.roll<30);
    run(8);assert.ok(meanX()>rest+.02,'tilting right sends the water right straight away, never left first');
    run(70);assert.ok(Math.abs(p.motion.roll-30)<.5);
    p.setTilt(0,0);run(160);
    assert.ok(Math.abs(meanX()-rest)<.03,'water settles back after tilting');
    p.jolt(12,0);let lowest=Infinity,highest=-Infinity;
    for(let i=0;i<16;i++){run(1);lowest=Math.min(lowest,meanX());}
    for(let i=0;i<40;i++){run(1);highest=Math.max(highest,meanX());}
    assert.ok(lowest<rest-.02,`a jolt to the right leaves the water behind on the left: ${lowest} vs ${rest}`);
    assert.ok(highest>lowest+.05,'then it sloshes back');
    p.setMode('water');assert.equal(p.tilt,null,'normal water keeps its tilt-only input');
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('preview water runs the tilt-only solver; switching modes resets the liquid',()=>{
  // Call the real renderer with a no-op canvas; compare numerical state, not drawing internals.
  const previous=globalThis.requestAnimationFrame;globalThis.requestAnimationFrame=()=>{};
  try{
    const ctx=new Proxy({},{get:()=>()=>{}}),canvas={width:240,height:240,getContext:()=>ctx,addEventListener:()=>{}};
    const p=new ToyPreview(canvas);p.setTilt(30,20);p.jolt(12,-12);
    const expected=new FlipFluid(p.layout.nx,p.layout.ny,false,50),r=Math.PI/180;
    for(let i=0;i<20;i++){p.draw(i*.025,.025);expected.advance(.025,4*Math.sin(30*r)*Math.cos(20*r),4*Math.cos(30*r)*Math.cos(20*r));}
    assert.deepEqual(p.fluid.x,expected.x);assert.deepEqual(p.fluid.vy,expected.vy);
    p.setMode('pixel-flow');assert.deepEqual(p.kick,{x:0,y:0});p.draw(0,.025);p.jolt(12,0);p.draw(.025,.025);
    assert.ok(p.motion.linear.x>8,'pixel-flow feels the jolt');
    p.setMode('pet');p.draw(.05,.025);
    p.setMode('water');assert.deepEqual(p.kick,{x:0,y:0});assert.ok(p.fluid.vx.every(v=>v===0),'water restarts at rest');
  }finally{globalThis.requestAnimationFrame=previous;}
});

test('robot eyes: auto plays every mood in turn, a shake makes them dizzy for a moment, a chosen mood holds',()=>{
  const ctx=new Proxy({},{get:()=>()=>{}}),eyes=new RobotEyes();
  assert.deepEqual(MOODS,['auto','normal','happy','angry','sad','tired','surprised','suspicious','love']);
  eyes.reset(0);const seen=new Set();
  for(let now=0;now<3500*9;now+=50){eyes.draw(ctx,240,240,now,.05,0,0,'#fff','#f00');seen.add(eyes.shown(now));}
  assert.deepEqual([...seen].sort(),MOODS.slice(1).sort(),'auto shows all eight moods');
  eyes.mood='angry';eyes.react(50000);assert.equal(eyes.shown(50500),'dizzy');eyes.draw(ctx,240,240,50500,.05,0,0,'#fff','#f00');
  eyes.react(51500);assert.equal(eyes.shown(53000),'dizzy','shaking again keeps them dizzy');assert.equal(eyes.dizzyStart,50000);
  assert.equal(eyes.shown(53800),'angry');
  for(let now=53800;now<60000;now+=50)eyes.draw(ctx,240,240,now,.05,1,-1,'#fff','#f00');
  assert.equal(eyes.shown(60000),'angry');
  for(const key of ['width','height','lid','inner','outer','smile'])assert.ok(Math.abs(eyes.current[0][key]-eyeShape('angry',0)[key])<1e-3,`settles on angry ${key}`);
  assert.notDeepEqual(eyeShape('suspicious',0),eyeShape('suspicious',1),'suspicious squints one eye');
});
