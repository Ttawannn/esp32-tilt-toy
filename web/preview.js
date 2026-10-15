// Browser simulation of the toy modes. Hardware uses BMI160 or MPU6050.
import { FlipFluid, fluidLayout, pixelWater } from './fluid.js';
import { MotionState, GRAVITY } from './motion.js';
import { isFlipMode, isLiquidMode, waterForces } from './water-modes.js';
import { PixelFlow, pixelLayout, forceToQ8, STEP as PIXEL_STEP } from './pixel-flow.js';
import { RobotEyes } from './robot-eyes.js';
// Pixel Flow shades: 0 empty, 1 surface, 2 spray, 3-6 body from just below the surface to deep.
const PIXEL_COLORS=['','#8ee8ff','#c8f4ff','#2bb8f0','#1a9fe0','#1288cc','#0c70b4'];

// Slosh water only: the tilt sliders turn a simulated toy at a real rate, with a matching 100 Hz gyro.
// A hand speeds up and slows down smoothly: a critically damped spring with limited angular acceleration
// keeps the gyro's angular acceleration inside MotionState's ±40 rad/s², so spin-up and spin-down
// forces on the water cancel and a tilt does not push the water the wrong way first.
const radians=Math.PI/180;
const follow=(angle,rate,target,dt,maxRate)=>{
  rate+=Math.max(-35,Math.min(35,100*(target-angle)-20*rate))*dt;
  rate=Math.max(-maxRate,Math.min(maxRate,rate));
  return [angle+rate*dt,rate];
};
const orientation=(roll,pitch)=>{
  const x=(Math.PI/2-pitch)/2,z=roll/2;
  return [Math.cos(x)*Math.cos(z),Math.sin(x)*Math.cos(z),-Math.sin(x)*Math.sin(z),Math.cos(x)*Math.sin(z)];
};
const multiply=([a,b,c,d],[e,f,g,h])=>[a*e-b*f-c*g-d*h,a*f+b*e+c*h-d*g,a*g-b*h+c*e+d*f,a*h+b*g-c*f+d*e];
export class TiltInput {
  constructor(roll=0,pitch=0){this.roll=this.targetRoll=roll*radians;this.pitch=this.targetPitch=pitch*radians;this.rollRate=this.pitchRate=0;this.q=orientation(this.roll,this.pitch);}
  setTilt(roll,pitch){
    // The short way round, so 170° to -170° turns 20° rather than 340°.
    this.targetRoll=this.roll+Math.atan2(Math.sin(roll*radians-this.roll),Math.cos(roll*radians-this.roll));
    this.targetPitch=Math.max(-Math.PI/2,Math.min(Math.PI/2,pitch*radians));
  }
  // One 100 Hz IMU sample: specific force (gravity's opposite plus the jolt) and the gyro rate.
  sample(dt=.01,kick={x:0,y:0}){
    if(dt>0){
      [this.roll,this.rollRate]=follow(this.roll,this.rollRate,this.targetRoll,dt,16);
      [this.pitch,this.pitchRate]=follow(this.pitch,this.pitchRate,this.targetPitch,dt,12);
      if(Math.abs(this.pitch)>Math.PI/2){this.pitch=Math.sign(this.pitch)*Math.PI/2;this.pitchRate=0;}
    }
    const next=orientation(this.roll,this.pitch),[w,x,y,z]=next;
    let delta=multiply([this.q[0],-this.q[1],-this.q[2],-this.q[3]],next);
    if(delta[0]<0)delta=delta.map(value=>-value);
    const sine=Math.hypot(...delta.slice(1)),scale=dt>0?(sine>1e-9?2*Math.atan2(sine,delta[0])/sine/dt:2/dt):0;
    this.q=next;
    return {ax:-GRAVITY*2*(x*z-w*y)+kick.x,ay:-GRAVITY*2*(w*x+y*z)+kick.y,az:-GRAVITY*(1-2*(x*x+y*y)),gx:delta[1]*scale,gy:delta[2]*scale,gz:delta[3]*scale};
  }
  get rollDegrees(){return this.roll/radians;}
}

export class ToyPreview {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.roll=0;this.pitch=0;this.fill=50;this.showGrid=false;this.mode='water';this.mono=false;this.motion=new MotionState();this.robot=new RobotEyes();this.reset();this.last=performance.now();this.running=true;this.bindStir();requestAnimationFrame(t=>this.frame(t));}
  reset(){this.motion.reset();this.motionTime=0;this.kick={x:0,y:0};this.tilt=this.mode==='water-slosh'?new TiltInput(this.roll,this.pitch):null;if(this.tilt){this.motion.update(this.tilt.sample(0));this.motion.consumeFrame();}this.robot.reset(performance.now());this.layout=fluidLayout(this.canvas.width,this.canvas.height,!!this.round);this.fluid=new FlipFluid(this.layout.nx,this.layout.ny,!!this.round,this.fill);
    const v=this.pixelView=pixelLayout(this.canvas.width,this.canvas.height,!!this.round,this.mono);this.pixelForce=[0,64];this.pixelClock=0;this.pixelFrame=0;this.drops=new PixelFlow(v.cols,v.rows,v.shape,this.fill,1+Math.floor(Math.random()*0x7ffffffe));
  }
  setTilt(roll,pitch){this.roll=roll;this.pitch=pitch;if(this.tilt)this.tilt.setTilt(roll,pitch);else this.motion.reset();}
  jolt(x,y){this.kick={x,y};}
  // Simulated 100 Hz IMU samples from the tilt sliders, plus a decaying jolt for Pixel Flow.
  // Like a real accelerometer it reports specific force: gravity's opposite plus the jolt.
  updateMotion(dt){
    this.motionTime=Math.min(.075,this.motionTime+dt);
    if(this.tilt){
      while(this.motionTime>=.01-1e-8){this.motion.update(this.tilt.sample(.01,this.kick));this.kick.x*=Math.exp(-.01/.08);this.kick.y*=Math.exp(-.01/.08);this.motionTime-=.01;}
      return this.motion.consumeFrame();
    }
    const planar=Math.cos(this.pitch*Math.PI/180),angle=this.roll*Math.PI/180;
    while(this.motionTime>=.01-1e-8){
      this.motion.update({ax:-GRAVITY*Math.sin(angle)*planar+this.kick.x,ay:-GRAVITY*Math.cos(angle)*planar+this.kick.y,az:-GRAVITY*Math.sin(this.pitch*Math.PI/180),gx:0,gy:0,gz:0});
      this.kick.x*=Math.exp(-.01/.08);this.kick.y*=Math.exp(-.01/.08);this.motionTime-=.01;
    }
    return this.motion.consumeFrame();
  }
  setProfile(p){this.canvas.width=p.width;this.canvas.height=p.height;this.mono=!!p.mono;this.round=p.shape==='round';this.reset();}
  setMode(mode){this.mode=mode;this.reset();}
  setFill(value){this.fill=value;this.fluid.reset(value);this.drops.reset(value,...this.pixelForce,1+Math.floor(Math.random()*0x7ffffffe));}
  setMood(mood){this.robot.mood=mood;}
  // Water and slosh water: 'classic' two-tone or 'gradient' depth shades in the Pixel Flow palette.
  setWaterColor(look){this.waterColor=look==='gradient'?'gradient':'classic';}
  shake(){this.robot.react(performance.now());this.fluid.impulse(Math.sin(this.roll*Math.PI/180),Math.cos(this.roll*Math.PI/180));this.drops.shake(...this.pixelForce);}
  bindStir(){const canvas=this.canvas;let previous=null;
    const point=e=>{const box=canvas.getBoundingClientRect(),l=this.layout,f=this.fluid,px=(e.clientX-box.left)*canvas.width/box.width,py=(e.clientY-box.top)*canvas.height/box.height;return {px,py,x:f.h+(px-l.x)/l.width*(f.nx-2)*f.h,y:f.h+(py-l.y)/l.height*(f.ny-2)*f.h,time:e.timeStamp};};
    canvas.addEventListener('pointerdown',e=>{if(isLiquidMode(this.mode)){previous=point(e);canvas.setPointerCapture(e.pointerId);}});
    canvas.addEventListener('pointermove',e=>{if(!previous||!isLiquidMode(this.mode))return;const p=point(e),dt=Math.max(.01,(p.time-previous.time)/1000);
      if(this.mode==='pixel-flow'){const v=this.pixelView,toQ8=256*PIXEL_STEP/v.pitch;this.drops.push(Math.floor((p.px-v.x)/v.pitch),Math.floor((p.py-v.y)/v.pitch),Math.trunc((p.px-previous.px)/dt*toQ8),Math.trunc((p.py-previous.py)/dt*toQ8),3);}
      else this.fluid.stir(p.x,p.y,(p.x-previous.x)/dt,(p.y-previous.y)/dt);
      previous=p;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>previous=null);}
  frame(now){if(!this.running)return;const dt=Math.min(.05,(now-this.last)/1000);this.last=now;if(!document.hidden)this.draw(now/1000,dt);requestAnimationFrame(t=>this.frame(t));}
  draw(t,dt){const c=this.ctx,w=this.canvas.width,h=this.canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-2,theta=this.roll*Math.PI/180,gx=Math.sin(theta),gy=Math.cos(theta),white=this.mono?'#edf5ec':'#e3eee9';c.fillStyle=this.mono?'#060b08':'#041419';c.fillRect(0,0,w,h);c.save();c.translate(cx,cy);c.lineWidth=1;c.strokeStyle=white;c.fillStyle=white;
    const circle=(x,y,radius,fill=true)=>{c.beginPath();c.arc(x,y,Math.max(1,radius),0,Math.PI*2);fill?c.fill():c.stroke();};
    if(this.mode==='pixel-flow'){
      // Tilt plus jolts, stepped at the firmware's fixed 30 Hz.
      const v=this.pixelView,f=this.drops,input=this.updateMotion(dt),forces=waterForces('pixel-flow',this.motion.gravity,input.linear);
      const ax=forceToQ8(forces.ax),ay=forceToQ8(forces.ay);this.pixelForce=[ax,ay];
      this.pixelClock=Math.min(2*PIXEL_STEP,this.pixelClock+dt);
      while(this.pixelClock>=PIXEL_STEP-1e-9){f.step(ax,ay);this.pixelClock-=PIXEL_STEP;}
      const look=f.shade(ax,ay,this.pixelFrame++),left=v.x-cx,top=v.y-cy,size=v.pitch-1;
      for(let k=0;k<v.cols*v.rows;k++)if(look[k]){c.fillStyle=this.mono?white:PIXEL_COLORS[look[k]];c.fillRect(left+(k%v.cols)*v.pitch,top+Math.floor(k/v.cols)*v.pitch,size,size);}
    } else if(isFlipMode(this.mode)){
      // Water takes the sliders directly; slosh water reads the simulated IMU like the firmware does.
      const f=this.fluid,l=this.layout,planar=Math.cos(this.pitch*Math.PI/180),slosh=this.mode==='water-slosh',input=slosh?this.updateMotion(dt):null;
      const g=slosh?this.motion.gravity:{x:gx*planar,y:gy*planar,z:Math.sin(this.pitch*Math.PI/180)};
      const forces=slosh?waterForces('water-slosh',g,input.linear,this.motion.omega.z,input.omegaDot):waterForces('water',g);
      f.advance(dt,forces.ax,forces.ay,forces.omega,forces.omegaDot);
      const sx=l.width/((f.nx-2)*f.h),sy=l.height/((f.ny-2)*f.h),left=l.x-cx,top=l.y-cy;
      const cell=Math.max(3,Math.round(Math.min(l.width,l.height)/34)),cols=Math.min(64,Math.floor(l.width/cell)),rows=Math.min(64,Math.floor(l.height/cell)),ox=(l.width-cols*cell)/2,oy=(l.height-rows*cell)/2;
      c.save();c.beginPath();if(this.round)c.arc(0,0,l.width/2,0,Math.PI*2);else c.rect(left,top,l.width,l.height);c.clip();
      if(this.showGrid){c.strokeStyle=this.mono?'#365343':'#184051';c.lineWidth=1;for(let i=0;i<=f.nx-2;i++){const x=left+i*f.h*sx;c.beginPath();c.moveTo(x,top);c.lineTo(x,top+l.height);c.stroke();}for(let j=0;j<=f.ny-2;j++){const y=top+j*f.h*sy;c.beginPath();c.moveTo(left,y);c.lineTo(left+l.width,y);c.stroke();}}
      if(this.pixels?.length!==cols*rows)this.pixels=new Uint8Array(cols*rows);
      pixelWater(f,cols,rows,f.h+ox/sx,f.h+oy/sy,cell/sx,cell/sy,g.x,g.y,this.pixels);
      const shades=this.waterColor==='gradient'?f.shade(cols,rows,g.x,g.y,this.pixels):null;
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const k=j*cols+i,v=this.pixels[k];if(v===1||v===2){c.fillStyle=this.mono?white:shades?PIXEL_COLORS[shades[k]]:v===2?'#9ee6fb':'#1fa2e0';c.fillRect(left+ox+i*cell,top+oy+j*cell,cell-1,cell-1);}}
      c.restore();
    } else if(this.mode==='robot'){
      const clamp=v=>Math.max(-1,Math.min(1,v));
      this.robot.draw(c,w,h,t*1000,dt,clamp(gx),clamp(-Math.sin(this.pitch*Math.PI/180)),this.mono?white:'#3cdcff',this.mono?white:'#ff468c',this.mono?'#060b08':'#041419');
    } else {
      const blink=t%4.5>4.32;c.fillStyle=white;for(const side of[-1,1]){const x=side*r*.43;if(blink)c.fillRect(x-r*.26,-1,r*.52,2);else{c.beginPath();c.roundRect(x-r*.28,-r*.4,r*.56,r*.8,Math.max(2,r*.22));c.fill();c.fillStyle='#041419';circle(x+gx*r*.09,-Math.sin(this.pitch*Math.PI/180)*r*.12,r*.14);c.fillStyle=white;}}
    }
    c.restore();
  }
}
