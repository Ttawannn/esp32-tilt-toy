// Browser simulation of the six toy modes. Hardware reads BMI160 or MPU6050 instead of sliders.
import { FlipFluid, fluidLayout } from './fluid.js';
export class ToyPreview {
  constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.roll=0;this.pitch=0;this.fill=50;this.showGrid=false;this.mode='water';this.mono=false;this.shakenAt=-10;this.dice=3;this.reset();this.last=performance.now();this.running=true;this.bindStir();requestAnimationFrame(t=>this.frame(t));}
  reset(){this.ball={x:-.5,y:.5,vx:.3,vy:-.4};this.score=0;this.flakes=Array.from({length:36},()=>({x:Math.random()*1.6-.8,y:Math.random()*1.6-.8,vx:0,vy:0}));this.layout=fluidLayout(this.canvas.width,this.canvas.height,!!this.round);this.fluid=new FlipFluid(this.layout.nx,this.layout.ny,!!this.round,this.fill);}
  setProfile(p){this.canvas.width=p.width;this.canvas.height=p.height;this.mono=!!p.mono;this.round=p.shape==='round';this.reset();}
  setMode(mode){this.mode=mode;this.reset();}
  setFill(value){this.fill=value;this.fluid.reset(value);}
  shake(){this.shakenAt=performance.now()/1000;this.fluid.impulse(Math.sin(this.roll*Math.PI/180),Math.cos(this.roll*Math.PI/180));this.dice=1+Math.floor(Math.random()*6);for(const f of this.flakes){f.vx=(Math.random()-.5)*4;f.vy=(Math.random()-.5)*4;}}
  bindStir(){const canvas=this.canvas;let previous=null;const point=e=>{const box=canvas.getBoundingClientRect(),l=this.layout,f=this.fluid;return {x:f.h+((e.clientX-box.left)*canvas.width/box.width-l.x)/l.width*(f.nx-2)*f.h,y:f.h+((e.clientY-box.top)*canvas.height/box.height-l.y)/l.height*(f.ny-2)*f.h,time:e.timeStamp};};canvas.addEventListener('pointerdown',e=>{if(this.mode==='water'){previous=point(e);canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointermove',e=>{if(previous&&this.mode==='water'){const p=point(e),dt=Math.max(.01,(p.time-previous.time)/1000);this.fluid.stir(p.x,p.y,(p.x-previous.x)/dt,(p.y-previous.y)/dt);previous=p;}});for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>previous=null);}
  frame(now){if(!this.running)return;const dt=Math.min(.05,(now-this.last)/1000);this.last=now;if(!document.hidden)this.draw(now/1000,dt);requestAnimationFrame(t=>this.frame(t));}
  draw(t,dt){const c=this.ctx,w=this.canvas.width,h=this.canvas.height,cx=w/2,cy=h/2,r=Math.min(w,h)/2-2,theta=this.roll*Math.PI/180,gx=Math.sin(theta),gy=Math.cos(theta),white=this.mono?'#edf5ec':'#e3eee9',accent=this.mono?white:'#b9ee82',blue=this.mono?white:'#38bfe8';c.fillStyle=this.mono?'#060b08':'#041419';c.fillRect(0,0,w,h);c.save();c.translate(cx,cy);c.lineWidth=1;c.strokeStyle=white;c.fillStyle=blue;
    const circle=(x,y,radius,fill=true)=>{c.beginPath();c.arc(x,y,Math.max(1,radius),0,Math.PI*2);fill?c.fill():c.stroke();};
    if(this.mode==='water'){
      const f=this.fluid,l=this.layout,planar=Math.cos(this.pitch*Math.PI/180);f.advance(dt,gx*4*planar,gy*4*planar);
      const sx=l.width/((f.nx-2)*f.h),sy=l.height/((f.ny-2)*f.h),left=l.x-cx,top=l.y-cy,size=Math.max(1,Math.floor(f.radius*Math.min(sx,sy)*.92));
      c.save();c.beginPath();if(this.round)c.arc(0,0,l.width/2,0,Math.PI*2);else c.rect(left,top,l.width,l.height);c.clip();
      if(this.showGrid){c.strokeStyle=this.mono?'#365343':'#184051';c.lineWidth=1;for(let i=0;i<=f.nx-2;i++){const x=left+i*f.h*sx;c.beginPath();c.moveTo(x,top);c.lineTo(x,top+l.height);c.stroke();}for(let j=0;j<=f.ny-2;j++){const y=top+j*f.h*sy;c.beginPath();c.moveTo(left,y);c.lineTo(left+l.width,y);c.stroke();}}
      for(let p=0;p<f.count;p++){const spray=f.density[f.cell(f.x[p],f.y[p])]<f.restDensity*.65;c.fillStyle=this.mono?white:spray?'#89e3ff':'#1869f5';circle(left+(f.x[p]-f.h)*sx,top+(f.y[p]-f.h)*sy,size);}
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
