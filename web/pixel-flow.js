// Pixel Flow: every drop is one display cell with its own Q8 velocity (256 = one cell per step).
// Integer only, so firmware/tilt_toy/pixel_flow.h produces the same grid bit for bit.
export const MAX_COLS=64, MAX_ROWS=64, MAX_CELLS=2048, MAX_DROPS=1900;
export const SHAPE_RECT=0, SHAPE_ROUNDED=1, SHAPE_CIRCLE=2;
export const STEP=1/30;
// Solver force 4 (one g at sensitivity 1) becomes 64 Q8, about a quarter cell per step².
export const FORCE_TO_Q8=16;
const WALL=-2, EMPTY=-1, MAX_SPEED=768, MAX_FORCE=256, FAST=512, SLIDE=2, LEVEL_MOVES=3, BUCKETS=2*(MAX_COLS+MAX_ROWS)+1;
// Eight directions clockwise from +x, with y pointing down the screen.
const DX=[1,1,0,-1,-1,-1,0,1], DY=[0,1,1,1,0,-1,-1,-1];
const STEP_DIR=[5,6,7,4,-1,0,3,2,1];
const clamp=(v,a,b)=>v<a?a:v>b?b:v;

// Nearest of the eight directions to (x, y); down when both are zero.
export function direction(x,y) {
  const ax=Math.abs(x),ay=Math.abs(y);
  if(ax===0&&ay===0)return 2;
  if(ay*5<ax*2)return x>0?0:4;
  if(ax*5<ay*2)return y<0?6:2;
  return x>0?(y>0?1:7):(y>0?3:5);
}

// Pitch is the cell spacing on screen; each drop is drawn pitch-1 pixels wide, leaving a dark gap.
export function pixelLayout(width,height,round=false,mono=false) {
  const short=Math.min(width,height),pitch=short>=200?6:short>=80?4:2;
  const cols=Math.min(MAX_COLS,Math.floor(width/pitch)),rows=Math.min(MAX_ROWS,Math.floor(height/pitch));
  return {pitch,cols,rows,x:(width-cols*pitch)>>1,y:(height-rows*pitch)>>1,shape:round?SHAPE_CIRCLE:mono?SHAPE_RECT:SHAPE_ROUNDED};
}

// Convert a solver force (water-modes.js units) to Q8 cells per step², rounding half away from zero.
export const forceToQ8=force=>{const q=Math.abs(force*FORCE_TO_Q8);return Math.sign(force)*Math.floor(q+.5);};

export class PixelFlow {
  constructor(cols=40,rows=40,shape=SHAPE_ROUNDED,fill=50,seed=1) {
    this.grid=new Int16Array(MAX_CELLS);this.look=new Uint8Array(MAX_CELLS);
    this.col=new Uint8Array(MAX_DROPS);this.row=new Uint8Array(MAX_DROPS);this.fx=new Uint8Array(MAX_DROPS);this.fy=new Uint8Array(MAX_DROPS);
    this.vx=new Int16Array(MAX_DROPS);this.vy=new Int16Array(MAX_DROPS);this.order=new Int16Array(MAX_DROPS);this.scratch=new Int16Array(MAX_DROPS);this.stamp=new Uint8Array(MAX_DROPS);
    this.bucket=new Uint16Array(BUCKETS);
    this.cols=0;this.rows=0;this.shape=shape;this.usable=0;this.count=0;this.seed=1;this.steps=0;
    if(!this.configure(cols,rows,shape))throw Error('Pixel grid exceeds its storage budget');
    this.reset(fill,0,64,seed);
  }
  configure(cols,rows,shape) {
    if(cols<4||rows<4||cols>MAX_COLS||rows>MAX_ROWS||cols*rows>MAX_CELLS)return false;
    this.cols=cols;this.rows=rows;this.shape=shape;this.usable=0;this.count=0;
    // Doubled coordinates keep cell centres on integers.
    const side=Math.min(cols,rows),corner=2*Math.max(2,Math.trunc(side/8));
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++) {
      const x=2*i+1,y=2*j+1;let wall=false;
      if(shape===SHAPE_CIRCLE){const dx=x-cols,dy=y-rows;wall=dx*dx+dy*dy>side*side;}
      else if(shape===SHAPE_ROUNDED) {
        const ex=Math.min(x,2*cols-x),ey=Math.min(y,2*rows-y);
        if(ex<corner&&ey<corner){const dx=corner-ex,dy=corner-ey;wall=dx*dx+dy*dy>corner*corner;}
      }
      this.grid[j*cols+i]=wall?WALL:EMPTY;if(!wall)this.usable++;
    }
    return true;
  }
  // Fill the cells deepest along gravity first, so the water starts at rest.
  reset(fill=50,ax=0,ay=64,seed=1) {
    const cells=this.cols*this.rows;
    for(let c=0;c<cells;c++)if(this.grid[c]!==WALL)this.grid[c]=EMPTY;
    this.seed=(seed>>>0)||1;this.steps=0;this.count=0;
    const target=Math.min(MAX_DROPS,Math.trunc(this.usable*clamp(Math.trunc(fill),10,90)/100));
    const d=direction(ax,ay),span=this.cols+this.rows;
    for(let depth=span;depth>=-span&&this.count<target;depth--)
      for(let j=0;j<this.rows&&this.count<target;j++)for(let i=0;i<this.cols&&this.count<target;i++) {
        const c=j*this.cols+i;
        if(this.grid[c]!==EMPTY||i*DX[d]+j*DY[d]!==depth)continue;
        const p=this.count++;
        this.col[p]=i;this.row[p]=j;this.fx[p]=128;this.fy[p]=128;this.vx[p]=0;this.vy[p]=0;this.grid[c]=p;
      }
  }
  nextRandom() {let x=this.seed;x^=x<<13;x^=x>>>17;x^=x<<5;this.seed=x>>>0;return this.seed;}
  // Cell content: a drop index, EMPTY, or WALL (also outside the grid).
  at(i,j) {return i>=0&&i<this.cols&&j>=0&&j<this.rows?this.grid[j*this.cols+i]:WALL;}
  empty(i,j) {return this.at(i,j)===EMPTY;}
  emptyToward(p,d) {return this.empty(this.col[p]+DX[d],this.row[p]+DY[d]);}
  moveTo(p,d) {
    this.grid[this.row[p]*this.cols+this.col[p]]=EMPTY;
    this.col[p]+=DX[d];this.row[p]+=DY[d];this.grid[this.row[p]*this.cols+this.col[p]]=p;
  }
  // Stable counting sort of drops from src to dst by col*dx+row*dy.
  sortPass(src,dst,dx,dy,descending,identity) {
    const span=this.cols+this.rows,size=2*span+1;
    this.bucket.fill(0,0,size);
    for(let k=0;k<this.count;k++){const p=identity?k:src[k];this.bucket[this.col[p]*dx+this.row[p]*dy+span]++;}
    let at=0;
    for(let b=0;b<size;b++){const key=descending?size-1-b:b,n=this.bucket[key];this.bucket[key]=at;at+=n;}
    for(let k=0;k<this.count;k++){const p=identity?k:src[k];dst[this.bucket[this.col[p]*dx+this.row[p]*dy+span]++]=p;}
  }
  // Deepest drops move first, so the ones above can follow. Ties alternate sides every step.
  sortDrops(g,flip) {
    const across=(g+2)&7;
    this.sortPass(this.scratch,this.scratch,DX[across],DY[across],flip,true);
    this.sortPass(this.scratch,this.order,DX[g],DY[g],true,false);
  }
  // One cell step. Blocked: slide 45° (downhill first), uphill only when moving fast.
  tryStep(p,mx,my,ax,ay,fast) {
    const d=STEP_DIR[(my+1)*3+mx+1];
    if(this.emptyToward(p,d)){this.moveTo(p,d);return true;}
    const a=(d+1)&7,b=(d+7)&7,da=DX[a]*ax+DY[a]*ay,db=DX[b]*ax+DY[b]*ay;
    const first=da>db?a:db>da?b:(this.nextRandom()&1?a:b),second=first===a?b:a;
    for(const e of [first,second]) {
      if((fast||DX[e]*ax+DY[e]*ay>=0)&&this.emptyToward(p,e)){this.moveTo(p,e);return true;}
    }
    return false;
  }
  step(ax,ay) {
    ax=clamp(ax,-MAX_FORCE,MAX_FORCE);ay=clamp(ay,-MAX_FORCE,MAX_FORCE);
    const g=direction(ax,ay),pulled=Math.abs(ax)+Math.abs(ay)>=4,odd=this.steps&1;
    this.steps++;
    this.sortDrops(g,odd===1);
    for(let k=0;k<this.count;k++)this.moveDrop(this.order[k],ax,ay,g,pulled);
    if(odd)this.blend();
    if(pulled)this.level(ax,ay,g);
  }
  moveDrop(p,ax,ay,g,pulled) {
    const tick=this.steps&255;this.stamp[p]=tick;
    let vx=this.vx[p]+ax,vy=this.vy[p]+ay;
    vx-=Math.trunc(vx/64);vy-=Math.trunc(vy/64);
    vx=clamp(vx,-MAX_SPEED,MAX_SPEED);vy=clamp(vy,-MAX_SPEED,MAX_SPEED);
    let fx=this.fx[p]+vx,fy=this.fy[p]+vy;
    const nx=fx>>8,ny=fy>>8,adx=Math.abs(nx),ady=Math.abs(ny),steps=Math.max(adx,ady);
    this.fx[p]=fx&255;this.fy[p]=fy&255;
    const sx=nx>0?1:nx<0?-1:0,sy=ny>0?1:ny<0?-1:0,fast=Math.abs(vx)+Math.abs(vy)>=FAST;
    let ex=0,ey=0;
    for(let k=0;k<steps;k++) {
      ex+=adx;ey+=ady;let mx=0,my=0;
      if(2*ex>=steps){mx=sx;ex-=steps;}
      if(2*ey>=steps){my=sy;ey-=steps;}
      if(this.tryStep(p,mx,my,ax,ay,fast))continue;
      // Blocked by a drop that has not moved yet this step: wait for it and keep the speed, so a body
      // moving together stays together. A drop that already moved or stopped caps the speed toward it.
      // A wall stops the motion into it and rubs off 1/8.
      const i=this.col[p],j=this.row[p];
      let hitX=mx!==0?this.at(i+mx,j):EMPTY,hitY=my!==0?this.at(i,j+my):EMPTY;
      if(hitX===EMPTY&&hitY===EMPTY)hitX=hitY=this.at(i+mx,j+my);
      if(hitX>=0&&this.stamp[hitX]===tick&&(vx-this.vx[hitX])*mx>0)vx=this.vx[hitX];
      if(hitY>=0&&this.stamp[hitY]===tick&&(vy-this.vy[hitY])*my>0)vy=this.vy[hitY];
      if(hitX===WALL||hitY===WALL) {
        // Stopped axes restart from the cell centre, so a resting body moves off in step.
        if(hitX===WALL){vx=0;this.fx[p]=128;}
        if(hitY===WALL){vy=0;this.fy[p]=128;}
        vx-=Math.trunc(vx/8);vy-=Math.trunc(vy/8);
      }
      break;
    }
    // A supported drop spreads sideways, which levels the surface. On a tilted surface it only goes downhill.
    if(pulled&&!this.emptyToward(p,g)&&!this.emptyToward(p,(g+1)&7)&&!this.emptyToward(p,(g+7)&7)) {
      const left=(g+2)&7,right=(g+6)&7,slope=DX[left]*ax+DY[left]*ay,along=vx*DX[left]+vy*DY[left];
      const tilted=4*Math.abs(slope)>this.norm(ax,ay);
      let side=tilted?(slope>0?left:right):along>0?left:along<0?right:(this.nextRandom()&1?left:right),slid=0;
      if(!tilted&&along===0&&!this.emptyToward(p,side))side=side===left?right:left;
      while(slid<SLIDE&&this.emptyToward(p,side)) {
        this.moveTo(p,side);slid++;
        if(this.emptyToward(p,g)||this.emptyToward(p,(g+1)&7)||this.emptyToward(p,(g+7)&7))break;
      }
      vx-=Math.trunc(vx/8);vy-=Math.trunc(vy/8);
      if(!slid&&!vx&&!vy){this.fx[p]=128;this.fy[p]=128;}
    }
    this.vx[p]=clamp(vx,-MAX_SPEED,MAX_SPEED);this.vy[p]=clamp(vy,-MAX_SPEED,MAX_SPEED);
  }
  // Integer length of (x, y), within about 12%.
  norm(x,y) {const a=Math.abs(x),b=Math.abs(y);return a>b?a+(b>>1):b+(a>>1);}
  resting(p,g) {return !this.emptyToward(p,g)&&Math.abs(this.vx[p])+Math.abs(this.vy[p])<128;}
  // Stand-in for pressure: the grid moves only in eight directions, so a gently tilted pool cannot
  // level itself. Move a few resting drops from the highest point of the surface to the lowest
  // resting place, measured along the true gravity, until they differ by less than one cell.
  level(ax,ay,g) {
    const cols=this.cols,up=(g+4)&7,upA=(up+1)&7,upB=(up+7)&7,cell=this.norm(ax,ay);
    for(let n=0;n<LEVEL_MOVES;n++) {
      let source=-1,high=0,target=-1,low=0;
      for(let p=0;p<this.count;p++) {
        if(!this.resting(p,g)||!(this.emptyToward(p,up)||this.emptyToward(p,upA)||this.emptyToward(p,upB)))continue;
        const depth=this.col[p]*ax+this.row[p]*ay;
        if(source<0||depth<high){source=p;high=depth;}
      }
      if(source<0)return;
      for(let j=0;j<this.rows;j++)for(let i=0;i<cols;i++) {
        if(this.grid[j*cols+i]!==EMPTY)continue;
        const a=i+DX[g],b=j+DY[g];
        if(a>=0&&a<cols&&b>=0&&b<this.rows&&this.grid[b*cols+a]===EMPTY)continue;
        const depth=i*ax+j*ay;
        if(target<0||depth>low){target=j*cols+i;low=depth;}
      }
      if(target<0||low-high<cell)return;
      this.grid[this.row[source]*cols+this.col[source]]=EMPTY;
      this.col[source]=target%cols;this.row[source]=Math.trunc(target/cols);this.grid[target]=source;
      this.vx[source]=0;this.vy[source]=0;this.fx[source]=128;this.fy[source]=128;
    }
  }
  // Pull each drop's velocity toward its touching neighbours, so water moves as a body, not as sand.
  blend() {
    const cols=this.cols;
    for(let k=0;k<this.count;k++) {
      const p=this.order[k],i=this.col[p],j=this.row[p];let sx=0,sy=0,n=0;
      for(let d=0;d<8;d+=2) {
        const a=i+DX[d],b=j+DY[d];
        if(a<0||a>=cols||b<0||b>=this.rows)continue;
        const q=this.grid[b*cols+a];if(q<0)continue;
        sx+=this.vx[q];sy+=this.vy[q];n++;
      }
      if(n){this.vx[p]+=Math.trunc((Math.trunc(sx/n)-this.vx[p])/8);this.vy[p]+=Math.trunc((Math.trunc(sy/n)-this.vy[p])/8);}
    }
  }
  // Is there air within four cells above the drop (opposite to gravity)?
  nearSurface(p,up) {
    for(let k=1;k<=4;k++) {
      const a=this.col[p]+DX[up]*k,b=this.row[p]+DY[up]*k;
      if(a<0||a>=this.cols||b<0||b>=this.rows)return false;
      const q=this.grid[b*this.cols+a];
      if(q===EMPTY)return true;if(q===WALL)return false;
    }
    return false;
  }
  // Throw the drops near the surface up against gravity, with a random sideways part.
  shake(ax=0,ay=64) {
    const g=direction(ax,ay),up=(g+4)&7,across=(g+2)&7;
    for(let p=0;p<this.count;p++) {
      if(!this.nearSurface(p,up))continue;
      const lift=384+this.nextRandom()%385,side=this.nextRandom()%513-256;
      this.vx[p]=clamp(this.vx[p]+DX[up]*lift+DX[across]*side,-MAX_SPEED,MAX_SPEED);
      this.vy[p]=clamp(this.vy[p]+DY[up]*lift+DY[across]*side,-MAX_SPEED,MAX_SPEED);
    }
  }
  // Add velocity to drops within radius cells of (i, j).
  push(i,j,vx,vy,radius=3) {
    for(let p=0;p<this.count;p++) {
      const dx=this.col[p]-i,dy=this.row[p]-j;
      if(dx*dx+dy*dy>radius*radius)continue;
      this.vx[p]=clamp(this.vx[p]+vx,-MAX_SPEED,MAX_SPEED);this.vy[p]=clamp(this.vy[p]+vy,-MAX_SPEED,MAX_SPEED);
    }
  }
  // look: 0 empty or wall, 1 surface, 2 fast spray, 3-6 body from just below the surface to deep.
  // An empty cell with drops on three or four sides is drawn as body, so a moving mass stays solid.
  shade(ax,ay,frame=0) {
    const cols=this.cols,g=direction(ax,ay),up=(g+4)&7,upA=(up+1)&7,upB=(up+7)&7,tick=(frame>>3)&255;
    this.look.fill(0,0,cols*this.rows);
    for(let p=0;p<this.count;p++) {
      const i=this.col[p],j=this.row[p];let shade;
      if(this.emptyToward(p,up)||this.emptyToward(p,upA)||this.emptyToward(p,upB))shade=1;
      else if(Math.abs(this.vx[p])+Math.abs(this.vy[p])>384)shade=2;
      else {
        let n=0;
        for(let k=1;k<=4;k++){const a=i+DX[up]*k,b=j+DY[up]*k;if(a<0||a>=cols||b<0||b>=this.rows||this.grid[b*cols+a]<0)break;n++;}
        shade=2+Math.max(1,n);
        // A slow shimmer: about one body drop in four is a shade lighter or darker for eight frames.
        let h=i|j<<8|tick<<16;h=Math.imul(h^h>>>15,0x2c1b3c6d);h^=h>>>12;h=Math.imul(h,0x297a2d39);h=(h^h>>>15)&7;
        if(h===0&&shade>3)shade--;else if(h===1&&shade<6)shade++;
      }
      this.look[j*cols+i]=shade;
    }
    for(let j=1;j<this.rows-1;j++)for(let i=1;i<cols-1;i++) {
      const c=j*cols+i;
      if(this.grid[c]===EMPTY&&(this.grid[c-1]>=0)+(this.grid[c+1]>=0)+(this.grid[c-cols]>=0)+(this.grid[c+cols]>=0)>=3)this.look[c]=3;
    }
    return this.look;
  }
}
