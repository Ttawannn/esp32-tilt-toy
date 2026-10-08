// Mirror of firmware/tilt_toy/motion_state.h. SI units; x right, y down, z into screen.
export const GRAVITY = 9.81;
const degrees = 180/Math.PI;
const vector = (x=0,y=0,z=0) => ({x,y,z});
const length = v => Math.hypot(v.x,v.y,v.z);
const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
export function validAxes(x,y,z) {
  const [a,b,c]=[x,y,z].map(Math.abs);
  if (![x,y,z].every(Number.isInteger)||[a,b,c].some(v=>v<1||v>3)||new Set([a,b,c]).size!==3) return false;
  return ((Number(a>b)+Number(a>c)+Number(b>c)+Number(x<0)+Number(y<0)+Number(z<0))%2)===0;
}
export class MotionState {
  constructor(){this.axes=[1,2,3];this.rotation=0;this.reset();}
  reset(){this.q=[1,0,0,0];this.gravity=vector(0,1,0);this.omega=vector();this.linear=vector();this.bias=vector();this.roll=this.pitch=this.yaw=this.omegaDot=this.stillMs=0;this.ready=this.shake=false;this.frameSum=vector();this.frameCount=0;this.dotSum=0;}
  setAxes(x,y,z,rotation=0){if(!validAxes(x,y,z)||!Number.isInteger(rotation)||rotation<0||rotation>3)return false;this.axes=[x,y,z];this.rotation=rotation;this.reset();return true;}
  map(x,y,z){const source=[x,y,z],a=this.axes.map(i=>source[Math.abs(i)-1]*Math.sign(i));if(this.rotation===1)return vector(-a[1],a[0],a[2]);if(this.rotation===2)return vector(-a[0],-a[1],a[2]);if(this.rotation===3)return vector(a[1],-a[0],a[2]);return vector(...a);}
  normalize(){const n=Math.hypot(...this.q);this.q=this.q.map(v=>v/n);}
  estimateGravity(){const[w,x,y,z]=this.q;this.gravity=vector(2*(x*z-w*y),2*(w*x+y*z),1-2*(x*x+y*y));}
  update(sample,dt=.01){
    if(!Number.isFinite(dt)||dt<=0||dt>.05)return;
    const a=this.map(sample.ax,sample.ay,sample.az),w=this.map(sample.gx,sample.gy,sample.gz),magnitude=length(a);
    if(!Number.isFinite(magnitude)||!Number.isFinite(length(w)))return;
    if(!this.ready){if(magnitude<1)return;this.q=[1+a.z/magnitude,a.y/magnitude,-a.x/magnitude,0];if(this.q[0]<.00001)this.q=[0,1,0,0];this.normalize();this.estimateGravity();this.ready=true;}
    for(const axis of ['x','y','z'])w[axis]-=this.bias[axis];
    this.stillMs=length(w)<.05&&Math.abs(magnitude-GRAVITY)<.3?this.stillMs+dt*1000:0;
    if(this.stillMs>1000){const k=1-Math.exp(-dt*.2);for(const axis of ['x','y','z'])this.bias[axis]+=w[axis]*k;}
    const oldOmega=this.omega.z,k=1-Math.exp(-62.831853*dt);
    for(const axis of ['x','y','z'])this.omega[axis]+=(w[axis]-this.omega[axis])*k;
    this.omegaDot=clamp((this.omega.z-oldOmega)/dt,-40,40);
    let correction=vector();const g=this.gravity;
    if(Math.abs(magnitude-GRAVITY)<2&&magnitude>1)correction=vector((a.y*g.z-a.z*g.y)/magnitude,(a.z*g.x-a.x*g.z)/magnitude,(a.x*g.y-a.y*g.x)/magnitude);
    const wx=w.x+correction.x,wy=w.y+correction.y,wz=w.z+correction.z,[qw,qx,qy,qz]=this.q,half=dt*.5;
    this.q[0]+=(-qx*wx-qy*wy-qz*wz)*half;this.q[1]+=(qw*wx+qy*wz-qz*wy)*half;
    this.q[2]+=(qw*wy-qx*wz+qz*wx)*half;this.q[3]+=(qw*wz+qx*wy-qy*wx)*half;
    this.normalize();this.estimateGravity();
    this.linear=vector(a.x-GRAVITY*this.gravity.x,a.y-GRAVITY*this.gravity.y,a.z-GRAVITY*this.gravity.z);
    this.roll=Math.atan2(this.gravity.x,this.gravity.y)*degrees;this.pitch=Math.atan2(this.gravity.z,Math.hypot(this.gravity.x,this.gravity.y))*degrees;
    const[w0,x,y,z]=this.q;this.yaw=Math.atan2(2*(w0*z+x*y),1-2*(y*y+z*z))*degrees;
    this.shake=Math.abs(magnitude-GRAVITY)>7||Math.abs(w.x)+Math.abs(w.y)+Math.abs(w.z)>5;
    for(const axis of ['x','y','z'])this.frameSum[axis]+=this.linear[axis];this.dotSum+=this.omegaDot;this.frameCount++;
  }
  consumeFrame(){const result={linear:{...this.linear},omegaDot:0};if(this.frameCount){for(const axis of ['x','y','z'])result.linear[axis]=this.frameSum[axis]/this.frameCount;result.omegaDot=this.dotSum/this.frameCount;}this.frameSum=vector();this.frameCount=0;this.dotSum=0;return result;}
}
