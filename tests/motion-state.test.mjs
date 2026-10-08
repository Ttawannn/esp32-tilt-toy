import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MotionState, validAxes, GRAVITY } from '../web/motion.js';
import { FlipFluid } from '../web/fluid.js';
import { waterForces } from '../web/water-modes.js';

const sample = (ax=0,ay=0,az=GRAVITY,gx=0,gy=0,gz=0) => ({ax,ay,az,gx,gy,gz});
const close = (a,b,tolerance=1e-4) => assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('fusion initializes every gravity direction and separates translation from gravity',()=>{
  for(const [x,y,z] of [[0,0,1],[0,0,-1],[1,0,0],[0,1,0],[0,-1,0],[.3,.4,Math.sqrt(.75)]]){
    const m=new MotionState();for(let i=0;i<200;i++)m.update(sample(x*GRAVITY,y*GRAVITY,z*GRAVITY));
    close(m.gravity.x,x);close(m.gravity.y,y);close(m.gravity.z,z);close(Math.hypot(...Object.values(m.linear)),0);
    close(Math.hypot(...m.q),1);assert.ok(m.stillMs>=1900);
  }
  const m=new MotionState();m.update(sample());m.update(sample(12));
  close(m.linear.x,12);close(m.gravity.x,0);const f=m.consumeFrame();close(f.linear.x,6);
  close(m.consumeFrame().omegaDot,0);
});
test('constant gyro integrates yaw and rotating gravity without treating it as a shake',()=>{
  const m=new MotionState();for(let i=0;i<100;i++)m.update(sample(0,0,GRAVITY,0,0,1));
  close(m.yaw,180/Math.PI,.01);close(m.gravity.z,1);assert.equal(m.shake,false);
  const tilt=new MotionState();tilt.update(sample(0,GRAVITY,0));
  for(let i=1;i<=200;i++){const t=i*.01;tilt.update(sample(GRAVITY*Math.sin(t),GRAVITY*Math.cos(t),0,0,0,1));}
  close(tilt.roll,2*180/Math.PI,.5);
  assert.ok(Math.abs(tilt.omegaDot)<=40);
});
test('axis maps permit all 24 proper rotations, reject reflections and map gyro with acceleration',()=>{
  let valid=0;
  for(const x of [-3,-2,-1,1,2,3])for(const y of [-3,-2,-1,1,2,3])for(const z of [-3,-2,-1,1,2,3])if(validAxes(x,y,z))valid++;
  assert.equal(valid,24);for(const axes of [[1,1,3],[1,2,-3],[0,2,3],[1.1,2,3]])assert.equal(validAxes(...axes),false);
  const m=new MotionState();assert.equal(m.setAxes(-2,1,3,1),true);assert.deepEqual(m.map(1,2,3),{x:-1,y:-2,z:3});
  assert.equal(m.setAxes(1,2,-3),false);assert.deepEqual(m.axes,[-2,1,3]);
});
test('noise, freefall and invalid input stay finite; stationary bias converges',()=>{
  const m=new MotionState();for(let i=0;i<2000;i++)m.update(sample(0,0,GRAVITY,0,0,.02));
  assert.ok(m.bias.z>.019);const before=[...m.q];m.update(sample(NaN));m.update(sample(),Infinity);assert.deepEqual(m.q,before);
  for(let i=0;i<100;i++)m.update(sample(0,0,0));assert.ok(m.q.every(Number.isFinite));
});
test('liquid reacts opposite a jolt and spins opposite starting rotation, retaining motion after stopping',()=>{
  const left=new FlipFluid(20,20,true,50),right=new FlipFluid(20,20,true,50);
  left.advance(.025,-5,0);right.advance(.025,5,0);
  const average=f=>Array.from(f.vx.subarray(0,f.count)).reduce((a,b)=>a+b,0)/f.count;
  assert.ok(average(left)<0);assert.ok(average(right)>0);
  const f=new FlipFluid(20,20,true,50),momentum=()=>{
    let value=0;for(let p=0;p<f.count;p++)value+=(f.x[p]-f.cx)*f.vy[p]-(f.y[p]-f.cy)*f.vx[p];return value/f.count;
  };
  f.advance(.025,0,0,3,40,.9,.15);assert.ok(momentum()<-.01);
  for(let i=0;i<80;i++)f.advance(.025,0,0,3,0,.9,.15);
  f.advance(.025,0,0,0,-40,.9,.15);assert.ok(momentum()>.01);
  for(let i=0;i<40;i++)f.advance(.025,0,0,0,0,.9,.15);
  assert.ok(Math.abs(momentum())>.001);
  for(const round of [false,true])for(const fill of [10,50,90]){
    const stress=new FlipFluid(20,20,round,fill);
    for(let i=0;i<100;i++)stress.advance(.05,Math.sin(i)*25,Math.cos(i)*25,i%2?100:-100,i%2?1000:-1000,.9,.15);
    for(let p=0;p<stress.count;p++){
      assert.ok([stress.x[p],stress.y[p],stress.vx[p],stress.vy[p]].every(Number.isFinite));
      if(round)assert.ok(Math.hypot(stress.x[p]-stress.cx,stress.y[p]-stress.cy)<=stress.vesselRadius-.8*stress.h+1e-6);
      else{assert.ok(stress.x[p]>=stress.h+stress.radius-1e-6&&stress.x[p]<=(stress.nx-1)*stress.h-stress.radius+1e-6);assert.ok(stress.y[p]>=stress.h+stress.radius-1e-6&&stress.y[p]<=(stress.ny-1)*stress.h-stress.radius+1e-6);}
    }
  }
});
const compiler=process.env.CXX||'g++',msvc=/(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe=spawnSync(compiler,msvc?[]:['--version'],{windowsHide:true});
test('C++ and JS agree over 150 fusion samples and 50 independent liquid force steps',{skip:probe.error?'Set CXX to g++ / clang++ / cl':false},async()=>{
  const dir=resolve('work','state-parity');await mkdir(dir,{recursive:true});const exe=resolve(dir,process.platform==='win32'?'parity.exe':'parity');
  const src=resolve('tests/motion/state_parity.cpp'),includes=resolve('tests/motion');
  const args=msvc?['/nologo','/std:c++17','/EHsc','/W4',`/I${includes}`,src,`/Fe:${exe}`,`/Fo:${resolve(dir,'parity.obj')}`]:['-std=c++17','-Wall','-Wextra','-Werror',`-I${includes}`,src,'-o',exe];
  const build=spawnSync(compiler,args,{cwd:dir,windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
  const input=[],expected=[],motion=new MotionState(),fluid=new FlipFluid(8,8,true,50);
  for(const [id,mode]of [[0,'water'],[6,'water-inertia'],[7,'water-swirl'],[8,'water-full'],[9,'pixel-flow']]){
    input.push(`W ${id} .3 .4 .5 12 -8 3 2 10`);
    expected.push(Object.values(waterForces(mode,{x:.3,y:.4,z:.5},{x:12,y:-8,z:3},2,10)));
  }
  for(let i=0;i<150;i++){
    const s=sample(i>100?3:0,0,GRAVITY,0,0,.7);input.push(`M ${Object.values(s).join(' ')} .01`);motion.update(s);
    expected.push([...motion.q,...Object.values(motion.gravity),...Object.values(motion.linear),...Object.values(motion.omega),motion.omegaDot,motion.roll,motion.pitch,motion.yaw]);
  }
  for(let i=0;i<50;i++){
    // Contact/grid decisions can diverge over long trajectories with float vs double math.
    // Check the new forces from the same initial state; stress tests cover long-run bounds.
    input.push('R');fluid.reset(50);
    const ax=Math.sin(i*.1)*2,ay=1,omega=i<25?1.5:0,dot=i===0?25:i===25?-25:0;
    input.push(`F .025 ${ax} ${ay} ${omega} ${dot} .15`);fluid.advance(.025,ax,ay,omega,dot,.9,.15);
    const values=[fluid.count];for(let p=0;p<fluid.count;p++)values.push(fluid.x[p],fluid.y[p],fluid.vx[p],fluid.vy[p]);expected.push(values);
  }
  const run=spawnSync(exe,[],{input:input.join('\n')+'\n',windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const lines=run.stdout.trim().split(/\r?\n/);assert.equal(lines.length,expected.length);
  lines.forEach((line,i)=>{const actual=line.split(' ').map(Number);assert.equal(actual.length,expected[i].length);actual.forEach((v,j)=>assert.ok(Math.abs(v-expected[i][j])<(i<153?2e-4:1e-4),`line ${i}, value ${j}: ${v} != ${expected[i][j]}`));});
});
