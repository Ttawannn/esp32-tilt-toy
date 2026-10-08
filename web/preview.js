// Browser simulation of the toy modes. Hardware uses BMI160 or MPU6050.
import { FlipFluid, fluidLayout, pixelWater } from './fluid.js';
import { MotionState, GRAVITY } from './motion.js';
import { isLiquidMode, isWaterMode, waterForces } from './water-modes.js';
import { PixelFlow, pixelLayout, forceToQ8, STEP as PIXEL_STEP } from './pixel-flow.js';
// Pixel Flow shades: 0 empty, 1 surface, 2 spray, 3-6 body from just below the surface to deep.
const PIXEL_COLORS=['','#8ee8ff','#c8f4ff','#2bb8f0','#1a9fe0','#1288cc','#0c70b4'];
export class ToyPreview {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.roll=0;this.pitch=0;this.spin=0;this.fill=50;this.showGrid=false;this.mode='water';this.mono=false;this.shakenAt=-10;this.dice=3;this.motion=new MotionState();this.reset();this.last=performance.now();this.running=true;this.bindStir();requestAnimationFrame(t=>this.frame(t));}
  reset(){this.motion.reset();this.motionTime=0;this.spinAngle=0;this.kick={x:0,y:0};this.ball={x:-.5,y:.5,vx:.3,vy:-.4};this.score=0;this.flakes=Array.from({length:36},()=>({x:Math.random()*1.6-.8,y:Math.random()*1.6-.8,vx:0,vy:0}));this.layout=fluidLayout(this.canvas.width,this.canvas.height,!!this.round);this.fluid=new FlipFluid(this.layout.nx,this.layout.ny,!!this.round,this.fill);
    const v=this.pixelView=pixelLayout(this.canvas.width,this.canvas.height,!!this.round,this.mono);this.pixelForce=[0,64];this.pixelClock=0;this.pixelFrame=0;this.drops=new PixelFlow(v.cols,v.rows,v.shape,this.fill,1+Math.floor(Math.random()*0x7ffffffe));}
  setTilt(roll,pitch){this.roll=roll;this.pitch=pitch;this.spinAngle=0;this.motion.reset();}
  jolt(x,y){this.kick={x,y};}
  updateMotion(dt){
    this.motionTime=Math.min(.075,this.motionTime+dt);
    const speed=this.mode==='water-swirl'?this.spin*Math.PI/180:0,planar=Math.cos(this.pitch*Math.PI/180);
    while(this.motionTime>=.01-1e-8){
      this.spinAngle+=speed*.01;
      const angle=this.roll*Math.PI/180+this.spinAngle;
      const kicked=this.mode==='water-inertia'||this.mode==='pixel-flow';
      this.motion.update({ax:GRAVITY*Math.sin(angle)*planar+(kicked?this.kick.x:0),ay:GRAVITY*Math.cos(angle)*planar+(kicked?this.kick.y:0),az:GRAVITY*Math.sin(this.pitch*Math.PI/180),gx:0,gy:0,gz:speed});
      this.kick.x*=Math.exp(-.01/.08);this.kick.y*=Math.exp(-.01/.08);this.motionTime-=.01;
    }
    return this.motion.consumeFrame();
  }
  setProfile(p){this.canvas.width=p.width;this.canvas.height=p.height;this.mono=!!p.mono;this.round=p.shape==='round';this.reset();}
  setMode(mode){this.mode=mode;this.spin=0;this.reset();}
  setFill(value){this.fill=value;this.fluid.reset(value);this.drops.reset(value,...this.pixelForce,1+Math.floor(Math.random()*0x7ffffffe));}
  shake(){this.shakenAt=performance.now()/1000;this.fluid.impulse(Math.sin(this.roll*Math.PI/180),Math.cos(this.roll*Math.PI/180));this.drops.shake(...this.pixelForce);this.dice=1+Math.floor(Math.random()*6);for(const f of this.flakes){f.vx=(Math.random()-.5)*4;f.vy=(Math.random()-.5)*4;}}
  bindStir(){const canvas=this.canvas;let previous=null;
    const point=e=>{const box=canvas.getBoundingClientRect(),l=this.layout,f=this.fluid,px=(e.clientX-box.left)*canvas.width/box.width,py=(e.clientY-box.top)*canvas.height/box.height;return {px,py,x:f.h+(px-l.x)/l.width*(f.nx-2)*f.h,y:f.h+(py-l.y)/l.height*(f.ny-2)*f.h,time:e.timeStamp};};
    canvas.addEventListener('pointerdown',e=>{if(isLiquidMode(this.mode)){previous=point(e);canvas.setPointerCapture(e.pointerId);}});
    canvas.addEventListener('pointermove',e=>{if(!previous||!isLiquidMode(this.mode))return;const p=point(e),dt=Math.max(.01,(p.time-previous.time)/1000);
      if(this.mode==='pixel-flow'){const v=this.pixelView,toQ8=256*PIXEL_STEP/v.pitch;this.drops.push(Math.floor((p.px-v.x)/v.pitch),Math.floor((p.py-v.y)/v.pitch),Math.trunc((p.px-previous.px)/dt*toQ8),Math.trunc((p.py-previous.py)/dt*toQ8),3);}
      else this.fluid.stir(p.x,p.y,(p.x-previous.x)/dt,(p.y-previous.y)/dt);
      previous=p;});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>previous=null);}
  frame(now){if(!this.running)return;const dt=Math.min(.05,(now-this.last)/1000);this.last=now;if(!document.hidden)this.draw(now/1000,dt);requestAnimationFrame(t=>this.frame(t));}
  draw(t,dt){const c=this.ctx,w=this.canvas.width,h=this.canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-2,theta=this.roll*Math.PI/180,gx=Math.sin(theta),gy=Math.cos(theta),white=this.mono?'#edf5ec':'#e3eee9',accent=this.mono?white:'#b9ee82',blue=this.mono?white:'#38bfe8';c.fillStyle=this.mono?'#060b08':'#041419';c.fillRect(0,0,w,h);c.save();c.translate(cx,cy);c.lineWidth=1;c.strokeStyle=white;c.fillStyle=blue;
    const circle=(x,y,radius,fill=true)=>{c.beginPath();c.arc(x,y,Math.max(1,radius),0,Math.PI*2);fill?c.fill():c.stroke();};
    if(this.mode==='pixel-flow'){
      // Same forces as water-inertia, stepped at the firmware's fixed 30 Hz.
      const v=this.pixelView,f=this.drops,input=this.updateMotion(dt),forces=waterForces('water-inertia',this.motion.gravity,input.linear,0,0);
      const ax=forceToQ8(forces.ax),ay=forceToQ8(forces.ay);this.pixelForce=[ax,ay];
      this.pixelClock=Math.min(2*PIXEL_STEP,this.pixelClock+dt);
      while(this.pixelClock>=PIXEL_STEP-1e-9){f.step(ax,ay);this.pixelClock-=PIXEL_STEP;}
      const look=f.shade(ax,ay,this.pixelFrame++),left=v.x-cx,top=v.y-cy,size=v.pitch-1;
      for(let k=0;k<v.cols*v.rows;k++)if(look[k]){c.fillStyle=this.mono?white:PIXEL_COLORS[look[k]];c.fillRect(left+(k%v.cols)*v.pitch,top+Math.floor(k/v.cols)*v.pitch,size,size);}
    } else if(isWaterMode(this.mode)){
      const f=this.fluid,l=this.layout,input=this.updateMotion(dt),planar=Math.cos(this.pitch*Math.PI/180);
      const g=this.mode==='water'?{x:gx*planar,y:gy*planar,z:Math.sin(this.pitch*Math.PI/180)}:this.motion.gravity;
      const forces=waterForces(this.mode,g,input.linear,this.motion.omega.z,input.omegaDot);
      f.advance(dt,forces.ax,forces.ay,forces.omega,forces.omegaDot,.9,forces.wallDrag);
      const sx=l.width/((f.nx-2)*f.h),sy=l.height/((f.ny-2)*f.h),left=l.x-cx,top=l.y-cy;
      const cell=Math.max(3,Math.round(Math.min(l.width,l.height)/34)),cols=Math.min(64,Math.floor(l.width/cell)),rows=Math.min(64,Math.floor(l.height/cell)),ox=(l.width-cols*cell)/2,oy=(l.height-rows*cell)/2;
      c.save();c.beginPath();if(this.round)c.arc(0,0,l.width/2,0,Math.PI*2);else c.rect(left,top,l.width,l.height);c.clip();
      if(this.showGrid){c.strokeStyle=this.mono?'#365343':'#184051';c.lineWidth=1;for(let i=0;i<=f.nx-2;i++){const x=left+i*f.h*sx;c.beginPath();c.moveTo(x,top);c.lineTo(x,top+l.height);c.stroke();}for(let j=0;j<=f.ny-2;j++){const y=top+j*f.h*sy;c.beginPath();c.moveTo(left,y);c.lineTo(left+l.width,y);c.stroke();}}
      if(this.pixels?.length!==cols*rows)this.pixels=new Uint8Array(cols*rows);
      pixelWater(f,cols,rows,f.h+ox/sx,f.h+oy/sy,cell/sx,cell/sy,g.x,g.y,this.pixels);
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const v=this.pixels[j*cols+i];if(v===1||v===2){c.fillStyle=this.mono?white:v===2?'#9ee6fb':'#1fa2e0';c.fillRect(left+ox+i*cell,top+oy+j*cell,cell-1,cell-1);}}
      c.restore();
    } else if(this.mode==='maze'){
      const b=this.ball,old={x:b.x,y:b.y};b.vx=(b.vx+gx*dt*2.5)*Math.pow(.1,dt);b.vy=(b.vy-Math.sin(this.pitch*Math.PI/180)*dt*2.5)*Math.pow(.1,dt);b.x+=b.vx*dt;b.y+=b.vy*dt;let length=Math.hypot(b.x,b.y);if(length>.85){b.x*=.85/length;b.y*=.85/length;b.vx*= -.3;b.vy*= -.3;}const walls=[[-.3,-.65,-.17,.3],[.17,-.2,.3,.65]];c.fillStyle=white;for(const[a,y,z,end]of walls){if(b.x>a-.08&&b.x<z+.08&&b.y>y-.08&&b.y<end+.08){b.x=old.x;b.y=old.y;b.vx*= -.2;b.vy*= -.2;}c.fillRect(a*r,y*r,(z-a)*r,(end-y)*r);}c.strokeStyle=accent;circle(.58*r,-.58*r,r*.12,false);c.fillStyle=blue;circle(b.x*r,b.y*r,r*.065);if(Math.hypot(b.x-.58,b.y+.58)<.14){this.score++;b.x=-.55;b.y=.5;b.vx=b.vy=0;}
    } else if(this.mode==='snow'){
      c.fillStyle=white;for(const f of this.flakes){f.vx=(f.vx+gx*dt*.7)*Math.pow(.35,dt);f.vy=(f.vy+gy*dt*.7)*Math.pow(.35,dt);f.x+=f.vx*dt;f.y+=f.vy*dt;const m=Math.hypot(f.x,f.y);if(m>.95){f.x*=.95/m;f.y*=.95/m;const dot=f.vx*f.x+f.vy*f.y;f.vx-=dot*f.x*1.5;f.vy-=dot*f.y*1.5;}circle(f.x*r,f.y*r,r>40?2:1);}
    } else if(this.mode==='pong'){
      const b=this.ball,paddle=this.roll/60*Math.PI;b.x+=b.vx*dt;b.y+=b.vy*dt;const m=Math.hypot(b.x,b.y);if(m>.86){const hit=Math.atan2(b.x,-b.y),diff=Math.atan2(Math.sin(hit-paddle),Math.cos(hit-paddle));if(Math.abs(diff)<.48){const dot=(b.vx*b.x+b.vy*b.y)/(m*m);b.vx-=2*dot*b.x;b.vy-=2*dot*b.y;b.x*=.84/m;b.y*=.84/m;this.score++;}else{b.x=b.y=0;b.vx=.3;b.vy=-.4;this.score=0;}}c.strokeStyle=accent;c.lineWidth=Math.max(2,r*.065);c.beginPath();c.arc(0,0,r*.94,paddle-Math.PI/2-.4,paddle-Math.PI/2+.4);c.stroke();c.fillStyle=blue;circle(b.x*r,b.y*r,r*.055);
    } else if(this.mode==='pet'){
      const blink=t%4.5>4.32;c.fillStyle=white;for(const side of[-1,1]){const x=side*r*.43;if(blink)c.fillRect(x-r*.26,-1,r*.52,2);else{c.beginPath();c.roundRect(x-r*.28,-r*.4,r*.56,r*.8,Math.max(2,r*.22));c.fill();c.fillStyle='#041419';circle(x+gx*r*.09,-Math.sin(this.pitch*Math.PI/180)*r*.12,r*.14);c.fillStyle=white;}}
    } else {
      const size=r*1.4;c.strokeStyle=white;c.beginPath();c.roundRect(-size/2,-size/2,size,size,size/8);c.stroke();const value=t-this.shakenAt<.45?1+Math.floor(t*16)%6:this.dice,positions=[[4],[0,8],[0,4,8],[0,2,6,8],[0,2,4,6,8],[0,2,3,5,6,8]];c.fillStyle=accent;for(const index of positions[value-1])circle(-size/2+size*(.25+(index%3)*.25),-size/2+size*(.25+Math.floor(index/3)*.25),size*.055);
    }
    c.restore();
  }
}
