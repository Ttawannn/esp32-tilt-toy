// Browser simulation of the toy modes. Hardware uses BMI160 or MPU6050.
import { FlipFluid, fluidLayout, pixelWater } from './fluid.js';
import { MotionState, GRAVITY } from './motion.js';
import { isFlipMode, isLiquidMode, waterForces } from './water-modes.js';
import { PixelFlow, pixelLayout, forceToQ8, STEP as PIXEL_STEP } from './pixel-flow.js';
import { RobotEyes } from './robot-eyes.js';
import { findTheme } from './themes.js';
import { Puddle, DRY } from './puddle.js';
import { HeartBeat, HEART_SHADES, heartBeat, heartShade, sparkDot } from './heart.js';
import { BannerScroll, dotAt, dotGrid, renderBanner, renderStill } from './message.js';

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
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.roll=0;this.pitch=0;this.fill=50;this.showGrid=false;this.mode='water-slosh';this.mono=false;this.waterColor='gradient';this.theme=findTheme('ocean');this.motion=new MotionState();this.robot=new RobotEyes();this.puddle=new Puddle();this.heart=new HeartBeat();this.scroll=new BannerScroll();this.message={text:'Hello ♥',still:false,speed:30};this.messageBounce=-1e9;this.reset();this.last=performance.now();this.running=true;this.bindStir();requestAnimationFrame(t=>this.frame(t));}
  reset(){this.puddle.reset();this.heart.reset(performance.now(),1+Math.floor(Math.random()*0x7ffffffe));this.scroll.restart();this.pictures=null;this.motion.reset();this.motionTime=0;this.kick={x:0,y:0};this.tilt=this.mode==='water-slosh'?new TiltInput(this.roll,this.pitch):null;if(this.tilt){this.motion.update(this.tilt.sample(0));this.motion.consumeFrame();}this.robot.reset(performance.now());this.layout=fluidLayout(this.canvas.width,this.canvas.height,!!this.round);this.fluid=new FlipFluid(this.layout.nx,this.layout.ny,!!this.round,this.fill);
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
  // Colours of the water, Pixel Flow and the robot eyes, as in firmware/tilt_toy/themes.h.
  setTheme(id){this.theme=findTheme(id);}
  // Water and slosh water: 'classic' two-tone or 'gradient' depth shades in the Pixel Flow palette.
  setWaterColor(look){this.waterColor=look==='gradient'?'gradient':'classic';}
  // The message as the phone page would send it: drawn by the browser into dot pictures for this display's grid.
  setMessage(text,still,speed){this.message={text:text||'♥',still:!!still,speed};this.pictures=null;this.scroll.restart();}
  messagePictures(grid){
    if(this.pictures?.cols===grid.cols&&this.pictures?.rows===grid.rows)return this.pictures;
    const text=this.message.text,ready=typeof document!=='undefined';
    return this.pictures={cols:grid.cols,rows:grid.rows,banner:ready?renderBanner(text):null,still:ready?renderStill(text,grid.cols,grid.rows,!!this.round):null};
  }
  shake(){this.robot.react(performance.now());this.puddle.ripple(0,0);this.messageBounce=performance.now();if(this.mode==='heart'){const g=dotGrid(this.canvas.width,this.canvas.height);this.heart.burst(g.cols/2,g.rows/2);}this.fluid.impulse(Math.sin(this.roll*Math.PI/180),Math.cos(this.roll*Math.PI/180));this.drops.shake(...this.pixelForce);}
  bindStir(){const canvas=this.canvas;let previous=null;
    const point=e=>{const box=canvas.getBoundingClientRect(),l=this.layout,f=this.fluid,px=(e.clientX-box.left)*canvas.width/box.width,py=(e.clientY-box.top)*canvas.height/box.height;return {px,py,x:f.h+(px-l.x)/l.width*(f.nx-2)*f.h,y:f.h+(py-l.y)/l.height*(f.ny-2)*f.h,time:e.timeStamp};};
    canvas.addEventListener('pointerdown',e=>{
      // Lying flat, a tap drops a ring where it lands; otherwise drag to stir.
      const g=this.puddleGrid;if(g&&this.puddle.flat&&this.puddle.amount>=1){const p=point(e);this.puddle.ripple(Math.round(2*(p.px-g.x)/g.cell-g.cols),Math.round(2*(p.py-g.y)/g.cell-g.rows));return;}
      if(isLiquidMode(this.mode)){previous=point(e);canvas.setPointerCapture(e.pointerId);}});
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
      for(let k=0;k<v.cols*v.rows;k++)if(look[k]){c.fillStyle=this.mono?white:this.theme.shades[look[k]];c.fillRect(left+(k%v.cols)*v.pitch,top+Math.floor(k/v.cols)*v.pitch,size,size);}
    } else if(isFlipMode(this.mode)){
      // Slosh water reads the simulated IMU like the firmware does.
      const f=this.fluid,l=this.layout,input=this.updateMotion(dt),g=this.motion.gravity;
      const forces=waterForces('water-slosh',g,input.linear,this.motion.omega.z,input.omegaDot);
      f.advance(dt,forces.ax,forces.ay,forces.omega,forces.omegaDot);
      const sx=l.width/((f.nx-2)*f.h),sy=l.height/((f.ny-2)*f.h),left=l.x-cx,top=l.y-cy;
      const cell=Math.max(3,Math.round(Math.min(l.width,l.height)/34)),cols=Math.min(64,Math.floor(l.width/cell)),rows=Math.min(64,Math.floor(l.height/cell),Math.floor(1600/Math.max(cols,1))),ox=(l.width-cols*cell)/2,oy=(l.height-rows*cell)/2;
      c.save();c.beginPath();if(this.round)c.arc(0,0,l.width/2,0,Math.PI*2);else c.rect(left,top,l.width,l.height);c.clip();
      if(this.showGrid){c.strokeStyle=this.mono?'#365343':'#184051';c.lineWidth=1;for(let i=0;i<=f.nx-2;i++){const x=left+i*f.h*sx;c.beginPath();c.moveTo(x,top);c.lineTo(x,top+l.height);c.stroke();}for(let j=0;j<=f.ny-2;j++){const y=top+j*f.h*sy;c.beginPath();c.moveTo(left,y);c.lineTo(left+l.width,y);c.stroke();}}
      if(this.pixels?.length!==cols*rows)this.pixels=new Uint8Array(cols*rows);
      pixelWater(f,cols,rows,f.h+ox/sx,f.h+oy/sy,cell/sx,cell/sy,g.x,g.y,this.pixels);
      const shades=this.waterColor==='gradient'?f.shade(cols,rows,g.x,g.y,this.pixels):null;
      // Lying flat shows the water from above, as on the toy; an OLED draws the puddle as dots with a solid shore.
      const puddle=this.puddle.update(dt,g.x,g.y,g.z,this.pixels,cols,rows,this.fill)?this.puddle.look:null;this.puddleGrid={x:l.x+ox,y:l.y+oy,cell,cols,rows};
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
        const k=j*cols+i,p=puddle&&k<puddle.length?puddle[k]:0,v=this.pixels[k];let color=null;
        if(p){if(p!==DRY&&!(this.mono&&p>2&&(i+j)&1))color=this.mono?white:shades?this.theme.shades[p]:p<=2?this.theme.top:this.theme.body;}
        else if(v===1||v===2)color=this.mono?white:shades?this.theme.shades[shades[k]]:v===2?this.theme.top:this.theme.body;
        if(color){c.fillStyle=color;c.fillRect(left+ox+i*cell,top+oy+j*cell,cell-1,cell-1);}
      }
      c.restore();
    } else if(this.mode==='heart'){
      // Beating heart on the dot grid; little hearts rise against gravity.
      const grid=dotGrid(w,h),now=t*1000,tilt=Math.max(-1,Math.min(1,gx)),hx=(grid.cols-1)/2+tilt*grid.cols*.06,hy=(grid.rows-1)/2;
      const size=Math.min(grid.cols,grid.rows)*.3*(1+.1*heartBeat(now)),length=Math.hypot(gx,gy),dot=grid.pitch>2?grid.pitch-1:grid.pitch;
      this.heart.step(dt,length>.05?-gx/length:0,length>.05?-gy/length:-1,now,hx,hy,size);
      const fill=(i,j,shade)=>{c.fillStyle=this.mono?white:HEART_SHADES[shade];c.fillRect(grid.x+i*grid.pitch-cx,grid.y+j*grid.pitch-cy,dot,dot);};
      for(let j=0;j<grid.rows;j++)for(let i=0;i<grid.cols;i++){const s=heartShade(i,j,hx,hy,size,tilt*.45);if(s)fill(i,j,s);}
      for(const s of this.heart.sparks){if(s.life<=0)continue;const shade=s.life>1?3:s.life>.5?2:1,x0=Math.round(s.x)-2,y0=Math.round(s.y)-2;
        for(let dy=0;dy<4;dy++)for(let dx=0;dx<5;dx++){const i=x0+dx,j=y0+dy;if(sparkDot(dx,dy)&&i>=0&&i<grid.cols&&j>=0&&j<grid.rows)fill(i,j,shade);}}
    } else if(this.mode==='message'){
      // LED board: unlit dots stay faintly visible; a shake bounces the text.
      const grid=dotGrid(w,h),pictures=this.messagePictures(grid),still=this.message.still,picture=still?pictures.still:pictures.banner,dot=grid.pitch>2?grid.pitch-1:grid.pitch;
      if(!still&&picture)this.scroll.advance(dt,this.message.speed,picture.width,grid.cols);
      const since=performance.now()-this.messageBounce,bounce=since<600?Math.round(-Math.sin(since/600*3*Math.PI)*3*(1-since/600)):0;
      const top=picture?Math.trunc((grid.rows-picture.height)/2)+bounce:0,left=picture?Math.trunc((grid.cols-picture.width)/2):0;
      for(let j=0;j<grid.rows;j++)for(let i=0;i<grid.cols;i++){
        const on=dotAt(picture,still?i-left:this.scroll.bannerColumn(i,grid.cols),j-top);
        if(!on&&this.mono)continue;
        c.fillStyle=on?(this.mono?white:this.theme.eye):'#10141e';c.fillRect(grid.x+i*grid.pitch-cx,grid.y+j*grid.pitch-cy,dot,dot);
      }
    } else {
      const clamp=v=>Math.max(-1,Math.min(1,v));
      this.robot.draw(c,w,h,t*1000,dt,clamp(gx),clamp(-Math.sin(this.pitch*Math.PI/180)),this.mono?white:this.theme.eye,this.mono?white:'#ff468c',this.mono?'#060b08':'#041419');
    }
    c.restore();
  }
}
