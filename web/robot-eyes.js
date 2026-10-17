// Robot eyes for the web preview. Mirrors RobotEyes in firmware/tilt_toy/robot_eyes.h:
// the same moods, shapes, timing and drawing order, on a Canvas 2D context.
export const MOODS=['auto','normal','happy','angry','sad','tired','surprised','suspicious','love'];
const AUTO_MS=3500,DIZZY_MS=2200,BLINK_MS=180;
// Fractions of the base eye: size, a flat top lid, lids slanting toward the nose (inner) or cheek (outer), and a smile.
export function eyeShape(mood,side){
  switch(mood){
    case 'happy':return {width:1,height:1,lid:0,inner:0,outer:0,smile:.55};
    case 'angry':return {width:1,height:.85,lid:0,inner:.5,outer:0,smile:0};
    case 'sad':return {width:1,height:.85,lid:0,inner:0,outer:.5,smile:0};
    case 'tired':return {width:1,height:1,lid:.55,inner:0,outer:.15,smile:0};
    case 'surprised':return {width:.8,height:1.2,lid:0,inner:0,outer:0,smile:0};
    case 'suspicious':return side?{width:1,height:1,lid:.5,inner:0,outer:0,smile:0}:{width:1,height:.9,lid:0,inner:.15,outer:0,smile:0};
    default:return {width:1,height:1,lid:0,inner:0,outer:0,smile:0};
  }
}

export class RobotEyes {
  constructor(){this.mood='auto';this.sleepy=false;this.reset(0);}
  reset(now){
    this.current=[eyeShape('normal',0),eyeShape('normal',1)];
    this.gazeX=this.gazeY=this.glanceX=this.glanceY=0;
    this.autoMood=1;this.nextAuto=now+AUTO_MS;this.dizzyStart=this.dizzyUntil=-1;
    this.nextBlink=now+1500;this.blinkStart=-1e9;this.nextGlance=now+1000;
  }
  // Shake reaction: spinning dizzy eyes, then back to the mood. Shaking again keeps them dizzy.
  react(now){if(now>=this.dizzyUntil)this.dizzyStart=now;this.dizzyUntil=now+DIZZY_MS;}
  // sleepy: just before the toy rests, tired eyes whatever the mood.
  shown(now){return now<this.dizzyUntil?'dizzy':this.sleepy?'tired':this.mood==='auto'?MOODS[this.autoMood]:this.mood;}
  // now in ms; lookX/lookY in -1..1 move the gaze toward the tilt. Draws centred on (0, 0).
  draw(c,width,height,now,dt,lookX,lookY,eyeColor,heartColor,background='#000'){
    if(this.mood==='auto'&&now>=this.nextAuto){this.autoMood=this.autoMood%(MOODS.length-1)+1;this.nextAuto=now+AUTO_MS;}
    if(now>=this.nextBlink){this.blinkStart=now;this.nextBlink=now+2200+Math.random()*3300;}
    if(now>=this.nextGlance){this.glanceX=(Math.random()*121-60)/100;this.glanceY=(Math.random()*73-36)/100;this.nextGlance=now+1200+Math.random()*2800;}
    const face=this.shown(now),follow=1-Math.exp(-dt*12),glide=1-Math.exp(-dt*10),clamp=v=>Math.max(-1,Math.min(1,v));
    this.current=this.current.map((eye,side)=>{const target=eyeShape(face,side),next={};for(const key in eye)next[key]=eye[key]+(target[key]-eye[key])*follow;return next;});
    this.gazeX+=(clamp(lookX+this.glanceX)-this.gazeX)*glide;this.gazeY+=(clamp(lookY+this.glanceY)-this.gazeY)*glide;
    const since=now-this.blinkStart,blink=since<BLINK_MS?Math.max(.08,Math.abs(since-BLINK_MS/2)/(BLINK_MS/2)):1;
    const size=Math.min(width,height),baseW=size*.34,baseH=size*.42;
    if(face==='dizzy'){
      // The spirals grow in, spin the two eyes opposite ways while the head wobbles, and shrink away.
      const amount=Math.max(.3,Math.min(1,(now-this.dizzyStart)/150,(this.dizzyUntil-now)/300)),spin=now*.009;
      const wobbleX=Math.cos(now*.008)*size*.03,wobbleY=Math.sin(now*.008)*size*.03;
      for(let side=0;side<2;side++)spiral(c,(side?1:-1)*size*.25+wobbleX,wobbleY,Math.min(baseW,baseH)*.5*amount,side?-spin:spin,side?-1:1,eyeColor);
      return;
    }
    for(let side=0;side<2;side++){
      const eye=this.current[side],sign=side?1:-1;
      const cx=sign*size*.25+this.gazeX*size*.08,cy=this.gazeY*size*.08,ew=baseW*eye.width,eh=Math.max(2,baseH*eye.height*blink);
      const left=cx-ew/2,top=cy-eh/2;
      if(face==='love'&&blink===1){heart(c,cx,cy,ew,heartColor);continue;}
      c.fillStyle=eyeColor;c.beginPath();c.roundRect(left,top,ew,eh,Math.min(ew,eh)*.3);c.fill();
      // Lids are drawn in the background colour over the panel.
      c.fillStyle=background;
      if(eye.lid>.01)c.fillRect(left-1,top-1,ew+2,eye.lid*eh+1);
      const inner=side?left:left+ew,outer=side?left+ew:left;
      if(eye.inner>.01)triangle(c,inner,top-1,outer,top-1,inner,top+eye.inner*eh);
      if(eye.outer>.01)triangle(c,outer,top-1,inner,top-1,outer,top+eye.outer*eh);
      if(eye.smile>.01){c.beginPath();c.roundRect(left-2,top+eh-eye.smile*eh,ew+4,eh,(ew+4)/2);c.fill();}
    }
  }
}
// A thick spiral of about two and a half turns from the centre out; direction -1 mirrors it.
function spiral(c,cx,cy,radius,turn,direction,color){
  const end=2.6*Math.PI*2,dot=Math.max(1,radius*.11);
  c.strokeStyle=color;c.lineWidth=dot*2;c.lineCap='round';c.lineJoin='round';c.beginPath();
  for(let a=0;a<=end;a+=.08){const r=radius*a/end,angle=direction*a+turn;a?c.lineTo(cx+Math.cos(angle)*r,cy+Math.sin(angle)*r):c.moveTo(cx,cy);}
  c.stroke();
}
function triangle(c,x0,y0,x1,y1,x2,y2){c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.lineTo(x2,y2);c.closePath();c.fill();}
// Two lobes and a point, as wide as the eye.
function heart(c,cx,cy,width,color){
  const r=width*.27;c.fillStyle=color;
  for(const x of [cx-r,cx+r]){c.beginPath();c.arc(x,cy-r*.55,r,0,Math.PI*2);c.fill();}
  triangle(c,cx-2*r,cy-r*.2,cx+2*r,cy-r*.2,cx,cy+width*.5);
}
