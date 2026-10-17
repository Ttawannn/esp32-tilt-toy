import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { MotionState, validAxes, GRAVITY } from '../web/motion.js';
import { Puddle } from '../web/puddle.js';
import { FlipFluid, pixelWater } from '../web/fluid.js';
import { waterForces } from '../web/water-modes.js';

// Samples are specific force, as a real accelerometer reports: +1 g pointing up at rest.
const sample = (ax=0,ay=0,az=GRAVITY,gx=0,gy=0,gz=0) => ({ax,ay,az,gx,gy,gz});
const close = (a,b,tolerance=1e-4) => assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
test('fusion initializes every gravity direction and separates translation from gravity',()=>{
  for(const [x,y,z] of [[0,0,1],[0,0,-1],[1,0,0],[0,1,0],[0,-1,0],[.3,.4,Math.sqrt(.75)]]){
    // Gravity points opposite the specific force.
    const m=new MotionState();for(let i=0;i<200;i++)m.update(sample(-x*GRAVITY,-y*GRAVITY,-z*GRAVITY));
    close(m.gravity.x,x);close(m.gravity.y,y);close(m.gravity.z,z);close(Math.hypot(...Object.values(m.linear)),0);
    close(Math.hypot(...m.q),1);assert.ok(m.stillMs>=1900);
  }
  const m=new MotionState();m.update(sample());m.update(sample(12));
  close(m.linear.x,12);close(m.gravity.x,0);const f=m.consumeFrame();close(f.linear.x,6);
  close(m.consumeFrame().omegaDot,0);
});
test('constant gyro integrates yaw and rotating gravity without treating it as a shake',()=>{
  const m=new MotionState();for(let i=0;i<100;i++)m.update(sample(0,0,-GRAVITY,0,0,1));
  close(m.yaw,180/Math.PI,.01);close(m.gravity.z,1);assert.equal(m.shake,false);
  const tilt=new MotionState();tilt.update(sample(0,-GRAVITY,0));
  for(let i=1;i<=200;i++){const t=i*.01;tilt.update(sample(-GRAVITY*Math.sin(t),-GRAVITY*Math.cos(t),0,0,0,1));}
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
test('liquid follows the applied force and stays in the vessel under strong, changing forces',()=>{
  const left=new FlipFluid(20,20,true,50),right=new FlipFluid(20,20,true,50);
  left.advance(.025,-5,0);right.advance(.025,5,0);
  const average=f=>Array.from(f.vx.subarray(0,f.count)).reduce((a,b)=>a+b,0)/f.count;
  assert.ok(average(left)<0);assert.ok(average(right)>0);
  // Slosh water (frictionless walls): starting to turn leaves the water behind, so it turns the other way
  // in the toy's frame; stopping the turn takes most of that back, and the water keeps moving afterwards.
  const f=new FlipFluid(20,20,true,50),momentum=()=>{
    let value=0;for(let p=0;p<f.count;p++)value+=(f.x[p]-f.cx)*f.vy[p]-(f.y[p]-f.cy)*f.vx[p];return value/f.count;
  };
  f.advance(.025,0,0,3,40);assert.ok(momentum()<-.01);
  for(let i=0;i<80;i++)f.advance(.025,0,0,3,0);
  const turning=momentum();assert.ok(turning<-.05);
  f.advance(.025,0,0,0,-40);assert.ok(Math.abs(momentum())<Math.abs(turning)/2);
  for(let i=0;i<40;i++)f.advance(.025,0,0,0,0);
  assert.ok(Math.abs(momentum())>.001);
  for(const round of [false,true])for(const fill of [10,50,90]){
    const stress=new FlipFluid(20,20,round,fill);
    for(let i=0;i<100;i++){if(i%17===0)stress.impulse(Math.sin(i),Math.cos(i));stress.advance(.05,Math.sin(i)*25,Math.cos(i)*25,i%2?100:-100,i%2?1000:-1000);}
    for(let p=0;p<stress.count;p++){
      assert.ok([stress.x[p],stress.y[p],stress.vx[p],stress.vy[p]].every(Number.isFinite));
      if(round)assert.ok(Math.hypot(stress.x[p]-stress.cx,stress.y[p]-stress.cy)<=stress.vesselRadius-.8*stress.h+1e-6);
      else{assert.ok(stress.x[p]>=stress.h+stress.radius-1e-6&&stress.x[p]<=(stress.nx-1)*stress.h-stress.radius+1e-6);assert.ok(stress.y[p]>=stress.h+stress.radius-1e-6&&stress.y[p]<=(stress.ny-1)*stress.h-stress.radius+1e-6);}
    }
  }
});
const compiler=process.env.CXX||'g++',msvc=/(?:^|[/\\])cl(?:\.exe)?$/i.test(compiler);
const probe=spawnSync(compiler,msvc?[]:['--version'],{windowsHide:true});
test('C++/JS fusion, forces and fixed-point water agree; C++ survives 1000 mixed-force steps',{skip:probe.error?'Set CXX to g++ / clang++ / cl':false},async()=>{
  const dir=resolve('work','state-parity');await mkdir(dir,{recursive:true});const exe=resolve(dir,process.platform==='win32'?'parity.exe':'parity');
  const src=resolve('tests/motion/state_parity.cpp'),includes=resolve('tests/motion');
  const args=msvc?['/nologo','/std:c++17','/EHsc','/W4',`/I${includes}`,src,`/Fe:${exe}`,`/Fo:${resolve(dir,'parity.obj')}`]:['-std=c++17','-Wall','-Wextra','-Werror',`-I${includes}`,src,'-o',exe];
  const build=spawnSync(compiler,args,{cwd:dir,windowsHide:true,encoding:'utf8'});assert.equal(build.status,0,build.stdout+build.stderr);
  const input=[],expected=[],motion=new MotionState(),fluid=new FlipFluid(8,8,true,50);
  for(const [id,mode]of [[0,'water-slosh'],[1,'pixel-flow'],[2,'robot']]){
    input.push(`W ${id} .3 .4 .5 12 -8 3 2 10`);
    expected.push(Object.values(waterForces(mode,{x:.3,y:.4,z:.5},{x:12,y:-8,z:3},2,10)));
  }
  const fusionEnd=expected.length+150;
  for(let i=0;i<150;i++){
    const s=sample(i>100?3:0,0,GRAVITY,0,0,.7);input.push(`M ${Object.values(s).join(' ')} .01`);motion.update(s);
    expected.push([...motion.q,...Object.values(motion.gravity),...Object.values(motion.linear),...Object.values(motion.omega),motion.omegaDot,motion.roll,motion.pitch,motion.yaw]);
  }
  for(let i=0;i<50;i++){
    // Contact/grid decisions can diverge over long trajectories with float vs double math.
    // Check the new forces from the same initial state; stress tests cover long-run bounds.
    input.push('R');fluid.reset(50);
    const ax=Math.sin(i*.1)*2,ay=1;
    input.push(`F .025 ${ax} ${ay}`);fluid.advance(.025,ax,ay);
    const values=[fluid.count];for(let p=0;p<fluid.count;p++)values.push(fluid.x[p],fluid.y[p],fluid.vx[p],fluid.vy[p]);expected.push(values);
  }
  for(let i=0;i<20;i++){
    input.push('R');fluid.reset(50);
    const gravity={x:Math.sin(i*.2),y:Math.cos(i*.2),z:0};
    input.push(`U .025 ${Object.values(gravity).join(' ')}`);
    const f=waterForces('water-slosh',gravity,{x:0,y:0,z:0});
    fluid.advance(.025,f.ax,f.ay);
    const values=[fluid.count];for(let p=0;p<fluid.count;p++)values.push(fluid.x[p],fluid.y[p],fluid.vx[p],fluid.vy[p]);
    values.push(...pixelWater(fluid,10,10,fluid.h,fluid.h,6*fluid.h/10,6*fluid.h/10,gravity.x,gravity.y));
    expected.push(values);
  }
  // Fixed point: 300 consecutive steps (varied dt, forces and turning, shakes), the raster and its depth shades match bit for bit.
  const f32=Math.fround,exact=(width,height,round,fill,cols,rows)=>{
    const run=new FlipFluid(width,height,round,fill),dts=[.025,.03,.05,.012];
    input.push(`L ${width} ${height} ${round?1:0} ${fill} 300`);
    for(let s=0;s<300;s++){
      const v=[dts[s%4],Math.sin(s*.05)*4,Math.cos(s*.05)*4,Math.sin(s*.021)*6,Math.cos(s*.033)*30].map(f32),shake=s%50===25?1:0;
      input.push([...v,shake].join(' '));
      if(shake)run.impulse(v[1],v[2]);
      run.advance(...v);
    }
    const view=[run.h,run.h,run.h*(run.nx-2)/cols,run.h*(run.ny-2)/rows,.6,.8].map(f32),cells=new Uint8Array(cols*rows);
    input.push(`${cols} ${rows} ${view.join(' ')}`);
    assert.ok(run.rasterize(cols,rows,...view,cells));
    expected.push([run.count,run.restDensity,...Array.from({length:run.count},(_,p)=>[run.qx[p],run.qy[p],run.qvx[p],run.qvy[p]]).flat(),...cells,...run.shade(cols,rows,view[4],view[5],cells).subarray(0,cols*rows)]);
  };
  exact(20,20,true,60,33,33);exact(18,18,false,40,33,33);exact(10,18,false,75,19,39);exact(19,10,false,50,40,20);
  // Puddle: standing, lying flat with sensor noise and ripples (four, so the oldest makes way), a small tilt,
  // then standing up again, step for step. A ripple while standing is refused.
  const rings={5:[0,0],52:[0,0],55:[8,-6],57:[-10,4],58:[3,3]};
  for(const [cols,rows,round,fill] of [[33,33,true,50],[25,52,false,20],[52,25,false,90]]){
    const side=new Uint8Array(cols*rows),puddle=new Puddle(),f32=Math.fround;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=2*i+1-cols,y=2*j+1-rows;side[j*cols+i]=round&&x*x+y*y>cols*cols?3:j>Math.floor(rows/2)?1:j===Math.floor(rows/2)?2:0;}
    input.push(`P ${cols} ${rows} ${round?1:0} ${fill} 120`);
    for(let s=0;s<120;s++){
      const tilt=s<10?1:s<60?.02*Math.sin(s*1.7):s<90?.13:.6;
      const g=[.025,Math.sin(s*.9)*tilt,Math.cos(s*.9)*tilt,Math.sqrt(1-tilt*tilt)].map(f32);
      const ring=rings[s];input.push([...g,ring?1:0,...(ring||[0,0])].join(' '));
      const accepted=ring?[puddle.ripple(...ring)?1:0]:[];
      expected.push([...accepted,puddle.update(...g,side,cols,rows,fill)?1:0,...puddle.look.subarray(0,cols*rows)]);
    }
  }
  input.push('B');expected.push([1]);
  const run=spawnSync(exe,[],{input:input.join('\n')+'\n',windowsHide:true,encoding:'utf8'});assert.equal(run.status,0,run.stderr);
  const lines=run.stdout.trim().split(/\r?\n/);assert.equal(lines.length,expected.length);
  lines.forEach((line,i)=>{const actual=line.split(' ').map(Number);assert.equal(actual.length,expected[i].length);actual.forEach((v,j)=>assert.ok(Math.abs(v-expected[i][j])<(i<fusionEnd?2e-4:1e-4),`line ${i}, value ${j}: ${v} != ${expected[i][j]}`));});
});
