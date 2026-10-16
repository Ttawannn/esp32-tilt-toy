/*
 * Compact FLIP/PIC solver adapted from Ten Minute Physics, example 18.
 * Copyright 2022 Matthias Müller - Ten Minute Physics
 * MIT license: ./licenses/ten-minute-physics.txt
 * Changes: bounded storage, circular vessels, tilt gravity, fixed stepping,
 * linked-cell particle separation, Q16 fixed point, and square-pixel rendering (pixelWater).
 *
 * Mirrors FlipFluid in firmware/tilt_toy/flip_fluid.h operation for operation, so both give
 * bit-identical states. Integer products stay below 2^53, so doubles hold them exactly;
 * the few per-call float steps use Math.fround to match the firmware's float32 arithmetic.
 */
const SOLID=2, AIR=1, FLUID=0;
const f=Math.fround, STEP=f(.025), ONE=65536, HALF=32768;
// Particle radius .32 cell; separation keeps centres two radii apart.
const RADIUS=20972, GAP=2*RADIUS;
// Rim .8 cell inside the vessel, top speed .65 cell per step, damping .996, FLIP share .9.
const RIM_INSET=52429, MAX_SPEED=42598, DAMPING=65274, FLIP=58982;
// -1.6 / open sides, and the shake swirl (k-3) * .003 cells per step per cell.
const RELAX=[0,-104858,-52429,-34953,-26214], SWIRL=[-590,-393,-197,0,197,393,590];
const clampf=(v,a,b)=>f(Math.max(a,Math.min(b,v)));
const clampi=(v,a,b)=>v<a?a:v>b?b:v;
// Q16 product rounded down, like (a*b)>>16 on int64.
const mul=(a,b)=>Math.floor(a*b/ONE);
// lroundf: half away from zero. toQ converts a float32 value to Q16.
const roundAway=q=>q<0?-Math.floor(.5-q):Math.floor(q+.5);
const toQ=v=>roundAway(f(v)*ONE);
const isqrt=n=>{let r=Math.floor(Math.sqrt(n));while(r*r>n)r--;while((r+1)*(r+1)<=n)r++;return r;};

export function fluidLayout(width,height,round=false) {
  if(round)return {nx:20,ny:20,x:4,y:4,width:width-8,height:height-8,round:true};
  const w=width-4,h=height-4,short= Math.min(w,h)<40?6:Math.min(w,h)<100?8:16;
  return {nx:2+Math.min(30,Math.round(short*w/Math.min(w,h))),ny:2+Math.min(30,Math.round(short*h/Math.min(w,h))),x:2,y:2,width:w,height:h,round:false};
}

export class FlipFluid {
  constructor(nx=20,ny=20,round=true,fill=50) {
    if(nx<4||ny<4||nx*ny>400)throw Error('Fluid grid exceeds its storage budget');
    this.nx=nx;this.ny=ny;this.round=round;this.span=Math.min(nx,ny)-2;
    // Domain units (the vessel's short side is 1), as float32 like the firmware.
    this.h=f(1/this.span);this.radius=f(f(.32)*this.h);this.cx=f(f(nx*this.h)*.5);this.cy=f(f(ny*this.h)*.5);
    this.vesselRadius=f(f(this.span*this.h)*.5);
    // Q16: positions in grid cells, velocities in cells per step.
    this.centerX=nx*HALF;this.centerY=ny*HALF;this.vessel=this.span*HALF;this.rim=this.vessel-RIM_INSET;
    this.compensation=toQ(f(f(f(.03)*STEP)*this.span));
    const cells=nx*ny;
    for(const name of ['u','v','oldU','oldV','weightU','weightV','density'])this[name]=new Int32Array(cells);
    this.kind=new Uint8Array(cells);this.head=new Int16Array(cells);this.next=new Int16Array(900);
    for(const name of ['qx','qy','qvx','qvy'])this[name]=new Int32Array(900);
    // At most 64 pixels a side and 1600 in all, as in the firmware.
    this.pixels=new Uint8Array(1600);
    // Gradient look: Pixel Flow palette indices 0 none, 1 surface, 3-6 body from just below the surface to deep.
    this.look=new Uint8Array(1600);this.lookCols=this.lookRows=0;
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++) {
      const dx=(2*i+1)*HALF-this.centerX,dy=(2*j+1)*HALF-this.centerY;
      this.kind[i*ny+j]=(i===0||j===0||i===nx-1||j===ny-1||round&&dx*dx+dy*dy>this.vessel*this.vessel)?SOLID:AIR;
    }
    this.reset(fill);
  }
  // Particle state in domain units, for tests and tools.
  view(source,scale){const out=new Float64Array(this.count);for(let p=0;p<this.count;p++)out[p]=source[p]*scale;return out;}
  get x(){return this.view(this.qx,this.h/ONE);}
  get y(){return this.view(this.qy,this.h/ONE);}
  get vx(){return this.view(this.qvx,this.h/(ONE*STEP));}
  get vy(){return this.view(this.qvy,this.h/(ONE*STEP));}
  reset(fill=50) {
    this.count=0;this.accumulator=0;this.restDensity=0;
    for(const name of ['u','v','oldU','oldV','qvx','qvy','density'])this[name].fill(0);
    const spacing=Math.trunc(RADIUS*212/100),rowStep=mul(spacing,56756);
    const edge=ONE+RADIUS,maxX=(this.nx-1)*ONE-RADIUS,maxY=(this.ny-1)*ONE-RADIUS,limit=this.rim*this.rim;
    const percent=roundAway(f(fill)),share=percent<10?10:percent>90?90:percent;
    let total=0,target=0;
    for(let pass=0;pass<2;pass++){
      let row=0;
      for(let y=maxY;y>=edge;y-=rowStep,row++)for(let x=edge+(row%2)*(spacing>>1);x<=maxX;x+=spacing){
        const dx=x-this.centerX,dy=y-this.centerY;
        if(this.round&&dx*dx+dy*dy>limit)continue;
        if(!pass)total++;
        else if(this.count<target){this.qx[this.count]=x;this.qy[this.count++]=y;}
      }
      target=Math.min(900,Math.trunc((total*share+50)/100));
    }
    this.toGrid();this.updateDensity();
  }
  cell(x,y) {return clampi(x>>16,0,this.nx-1)*this.ny+clampi(y>>16,0,this.ny-1);}
  keepInside() {
    const low=ONE+RADIUS,highX=(this.nx-1)*ONE-RADIUS,highY=(this.ny-1)*ONE-RADIUS,limit=this.rim*this.rim;
    const {qx,qy,qvx,qvy}=this;
    for(let p=0;p<this.count;p++) {
      if(this.round) {
        const dx=qx[p]-this.centerX,dy=qy[p]-this.centerY,d2=dx*dx+dy*dy;
        if(d2>limit){
          const d=isqrt(d2),inside=this.rim-2,normalX=Math.trunc(dx*ONE/d),normalY=Math.trunc(dy*ONE/d);
          qx[p]=this.centerX+Math.trunc(dx*inside/d);qy[p]=this.centerY+Math.trunc(dy*inside/d);
          const outward=mul(qvx[p],normalX)+mul(qvy[p],normalY);
          if(outward>0){qvx[p]-=mul(outward,normalX);qvy[p]-=mul(outward,normalY);}
        }
      } else {
        if(qx[p]<low){qx[p]=low;if(qvx[p]<0)qvx[p]=0;}
        if(qx[p]>highX){qx[p]=highX;if(qvx[p]>0)qvx[p]=0;}
        if(qy[p]<low){qy[p]=low;if(qvy[p]<0)qvy[p]=0;}
        if(qy[p]>highY){qy[p]=highY;if(qvy[p]>0)qvy[p]=0;}
      }
    }
  }
  separate() {
    const limit=GAP*GAP,{qx,qy,head,next}=this;
    for(let pass=0;pass<2;pass++) {
      head.fill(-1);
      for(let p=0;p<this.count;p++){const c=this.cell(qx[p],qy[p]);next[p]=head[c];head[c]=p;}
      for(let p=0;p<this.count;p++) {
        const xi=qx[p]>>16,yi=qy[p]>>16;
        for(let i=Math.max(0,xi-1);i<=Math.min(this.nx-1,xi+1);i++)for(let j=Math.max(0,yi-1);j<=Math.min(this.ny-1,yi+1);j++) {
          for(let q=head[i*this.ny+j];q>=0;q=next[q]) {
            if(q<=p)continue;
            let dx=qx[q]-qx[p],dy=qy[q]-qy[p],d2=dx*dx+dy*dy;
            if(d2>=limit)continue;
            if(d2===0){dx=7;dy=5;d2=74;}
            const d=isqrt(d2),share=Math.trunc((GAP-d)*32768/d),mx=Math.floor(dx*share/ONE),my=Math.floor(dy*share/ONE);
            qx[p]-=mx;qy[p]-=my;qx[q]+=mx;qy[q]+=my;
          }
        }
      }
      this.keepInside();
    }
  }
  // Bilinear Q16 weights for a staggered MAC face (u/v) or cell centre (density).
  stencil(x,y,ox,oy,visit) {
    const sx=clampi(x-ox,0,(this.nx-1)*ONE-66),sy=clampi(y-oy,0,(this.ny-1)*ONE-66);
    const i=sx>>16,j=sy>>16,c=i*this.ny+j,tx=sx&0xFFFF,ty=sy&0xFFFF,rx=ONE-tx,ry=ONE-ty;
    visit(c,mul(rx,ry));visit(c+this.ny,mul(tx,ry));visit(c+this.ny+1,mul(tx,ty));visit(c+1,mul(rx,ty));
  }
  toGrid() {
    const {u,v,weightU,weightV,kind,qx,qy,qvx,qvy}=this,n=this.ny;
    u.fill(0);v.fill(0);weightU.fill(0);weightV.fill(0);
    for(let c=0;c<kind.length;c++)if(kind[c]!==SOLID)kind[c]=AIR;
    for(let p=0;p<this.count;p++) {
      const c=this.cell(qx[p],qy[p]);if(kind[c]!==SOLID)kind[c]=FLUID;
      this.stencil(qx[p],qy[p],0,HALF,(c,w)=>{u[c]+=mul(qvx[p],w);weightU[c]+=w;});
      this.stencil(qx[p],qy[p],HALF,0,(c,w)=>{v[c]+=mul(qvy[p],w);weightV[c]+=w;});
    }
    for(let i=0;i<this.nx;i++)for(let j=0;j<n;j++) {
      const c=i*n+j;
      if(weightU[c]>0)u[c]=Math.trunc(u[c]*ONE/weightU[c]);
      if(weightV[c]>0)v[c]=Math.trunc(v[c]*ONE/weightV[c]);
      if(kind[c]===SOLID||i===0||kind[c-n]===SOLID)u[c]=0;
      if(kind[c]===SOLID||j===0||kind[c-1]===SOLID)v[c]=0;
    }
    this.oldU.set(u);this.oldV.set(v);
  }
  updateDensity() {
    const {density,kind}=this;
    density.fill(0);
    for(let p=0;p<this.count;p++)this.stencil(this.qx[p],this.qy[p],HALF,HALF,(c,w)=>{density[c]+=w;});
    if(!this.restDensity){let sum=0,n=0;for(let c=0;c<kind.length;c++)if(kind[c]===FLUID){sum+=density[c];n++;}this.restDensity=n?Math.trunc(sum/n):0;}
  }
  project(iterations=12,compensate=true) {
    const {u,v,kind,density}=this,n=this.ny;
    for(let pass=0;pass<iterations;pass++)for(let i=1;i<this.nx-1;i++)for(let j=1;j<n-1;j++) {
      const c=i*n+j;if(kind[c]!==FLUID)continue;
      const left=kind[c-n]!==SOLID?1:0,right=kind[c+n]!==SOLID?1:0,up=kind[c-1]!==SOLID?1:0,down=kind[c+1]!==SOLID?1:0;
      const open=left+right+up+down;if(!open)continue;
      let divergence=u[c+n]-u[c]+v[c+1]-v[c];
      if(compensate&&density[c]>this.restDensity)divergence-=mul(this.compensation,density[c]-this.restDensity);
      const pressure=mul(divergence,RELAX[open]);
      u[c]-=left*pressure;u[c+n]+=right*pressure;v[c]-=up*pressure;v[c+1]+=down*pressure;
    }
  }
  // 90% FLIP, 10% PIC velocity transfer.
  toParticles() {
    for(let component=0;component<2;component++) {
      const field=component?this.v:this.u,old=component?this.oldV:this.oldU,velocity=component?this.qvy:this.qvx,offset=component?1:this.ny;
      for(let p=0;p<this.count;p++) {
        let weight=0,pic=0,change=0;
        this.stencil(this.qx[p],this.qy[p],component?HALF:0,component?0:HALF,(c,w)=>{
          if(this.kind[c]===FLUID||c>=offset&&this.kind[c-offset]===FLUID){weight+=w;pic+=mul(w,field[c]);change+=mul(w,field[c]-old[c]);}
        });
        if(weight>0){
          const inverse=Math.trunc(2**30/weight),average=Math.floor(pic*inverse/16384),delta=Math.floor(change*inverse/16384);
          velocity[p]=Math.floor(((ONE-FLIP)*average+FLIP*(velocity[p]+delta))/ONE);
        }
      }
    }
    this.limitSpeed();
  }
  limitSpeed() {
    const limit=MAX_SPEED*MAX_SPEED,{qvx,qvy}=this;
    for(let p=0;p<this.count;p++){
      const d2=qvx[p]*qvx[p]+qvy[p]*qvy[p];
      if(d2>limit){const speed=isqrt(d2);qvx[p]=Math.trunc(qvx[p]*MAX_SPEED/speed);qvy[p]=Math.trunc(qvy[p]*MAX_SPEED/speed);}
    }
  }
  impulse(gx=0,gy=1) {
    gx=f(gx);gy=f(gy);
    let length=f(Math.sqrt(f(f(gx*gx)+f(gy*gy))));if(length===0)length=1;gx=f(gx/length);gy=f(gy/length);
    const cells=f(this.span*STEP),six=f(.6);
    const kickX=toQ(f(f(f(-gx*1.5)+f(gy*six))*cells)),kickY=toQ(f(f(f(-gy*1.5)-f(gx*six))*cells));
    for(let p=0;p<this.count;p++){
      const swirl=SWIRL[p%7];
      this.qvx[p]+=kickX+mul(this.qy[p]-this.centerY,swirl);this.qvy[p]+=kickY-mul(this.qx[p]-this.centerX,swirl);
    }
    this.limitSpeed();
  }
  // Preview only: drag the water near (x, y) toward a pointer velocity (domain units per second).
  stir(x,y,vx,vy) {
    const scale=this.span*ONE,X=x*scale,Y=y*scale,VX=vx*scale*STEP,VY=vy*scale*STEP,radius=3*ONE;
    for(let p=0;p<this.count;p++){
      const d=Math.hypot(this.qx[p]-X,this.qy[p]-Y);
      if(d<radius){const weight=.6*(1-d/radius);this.qvx[p]+=Math.round((VX-this.qvx[p])*weight);this.qvy[p]+=Math.round((VY-this.qvy[p])*weight);}
    }
    this.limitSpeed();
  }
  // omega (rad/s) and omegaDot (rad/s²) turn the vessel about the screen axis; 0 for tilt-only water.
  advance(dt,gx=0,gy=4,omega=0,omegaDot=0) {
    omega=clampf(f(omega),-12,12);omegaDot=clampf(f(omegaDot),-40,40);
    // At most two steps per call: a late frame slows the water briefly instead of stalling later frames.
    this.accumulator=Math.min(f(2*STEP),f(this.accumulator+clampf(f(dt),0,f(.1))));
    const threshold=f(STEP-f(1e-8));
    if(this.accumulator<threshold)return;
    const stepCells=f(f(this.span*STEP)*STEP),forceX=toQ(f(f(gx)*stepCells)),forceY=toQ(f(f(gy)*stepCells)),{qx,qy,qvx,qvy}=this;
    const euler=toQ(f(f(omegaDot*STEP)*STEP)),coriolis=toQ(f(f(2*omega)*STEP)),turn=f(omega*STEP),centrifugal=toQ(f(turn*turn));
    while(this.accumulator>=threshold) {
      for(let p=0;p<this.count;p++){
        const rx=qx[p]-this.centerX,ry=qy[p]-this.centerY,oldX=qvx[p],oldY=qvy[p];
        // Euler, Coriolis and centrifugal forces in the rotating container frame.
        qvx[p]=mul(oldX+forceX+mul(euler,ry)+mul(coriolis,oldY)+mul(centrifugal,rx),DAMPING);
        qvy[p]=mul(oldY+forceY-mul(euler,rx)-mul(coriolis,oldX)+mul(centrifugal,ry),DAMPING);
      }
      this.limitSpeed();
      for(let p=0;p<this.count;p++){qx[p]+=qvx[p];qy[p]+=qvy[p];}
      this.keepInside();this.separate();this.toGrid();this.updateDensity();this.project();this.toParticles();this.keepInside();
      this.accumulator=f(this.accumulator-STEP);
    }
  }
  // Density inside the particle domain, so water reaches the walls particles cannot touch.
  densityAt(x,y) {
    if(this.round){
      const dx=x-this.centerX,dy=y-this.centerY,d2=dx*dx+dy*dy;
      if(d2>this.rim*this.rim){const d=isqrt(d2);x=this.centerX+Math.trunc(dx*this.rim/d);y=this.centerY+Math.trunc(dy*this.rim/d);}
    } else {
      x=clampi(x,ONE+RADIUS,(this.nx-1)*ONE-RADIUS);y=clampi(y,ONE+RADIUS,(this.ny-1)*ONE-RADIUS);
    }
    let sum=0;this.stencil(x,y,HALF,HALF,(c,w)=>{sum+=mul(w,this.density[c]);});
    return sum;
  }
  // Pixel (i, j) covers simulation x = originX + i*cellX, y = originY + j*cellY (domain units).
  rasterize(cols,rows,originX,originY,cellX,cellY,gx,gy,cells=this.pixels) {
    if(cols<1||rows<1||cols>64||rows>64||cols*rows>1600)return false;
    const left=toQ(f(f(originX)*this.span)),top=toQ(f(f(originY)*this.span)),stepX=toQ(f(f(cellX)*this.span)),stepY=toQ(f(f(cellY)*this.span));
    if(stepX<1||stepY<1)return false;
    const threshold=mul(this.restDensity,26214),outside=this.vessel*this.vessel;
    for(let j=0;j<rows;j++){
      const y=top+Math.floor((2*j+1)*stepY/2);
      for(let i=0;i<cols;i++){
        const x=left+Math.floor((2*i+1)*stepX/2);
        if(this.round){const dx=x-this.centerX,dy=y-this.centerY;if(dx*dx+dy*dy>outside){cells[j*cols+i]=3;continue;}}
        cells[j*cols+i]=this.densityAt(x,y)>threshold?1:0;
      }
    }
    for(let p=0;p<this.count;p++){
      if(this.qx[p]<left||this.qy[p]<top)continue;
      const i=Math.trunc((this.qx[p]-left)/stepX),j=Math.trunc((this.qy[p]-top)/stepY);
      if(i<cols&&j<rows&&cells[j*cols+i]===0)cells[j*cols+i]=1;
    }
    // Surface: a water pixel with an empty pixel above it (the up neighbour and the diagonals beside it).
    gx=f(gx);gy=f(gy);
    const length=f(Math.sqrt(f(f(gx*gx)+f(gy*gy)))),ux=length>f(1e-3)?f(-gx/length):0,uy=length>f(1e-3)?f(-gy/length):-1;
    const up=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].filter(([dx,dy])=>f(f(f(dx*ux)+f(dy*uy))/f(Math.sqrt(dx*dx+dy*dy)))>f(.38));
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      if(cells[j*cols+i]!==1)continue;
      for(const[dx,dy]of up){const a=i+dx,b=j+dy;if(a>=0&&a<cols&&b>=0&&b<rows&&cells[b*cols+a]===0){cells[j*cols+i]=2;break;}}
    }
    return true;
  }
  // Shades the last rasterize() by depth: two pixels per shade, counted toward -gravity.
  // A body pixel keeps its shade until its depth moves a whole pixel past that shade's band,
  // so a surface rippling by one pixel leaves the colours below it still. Same as the C++ shade().
  shade(cols,rows,gx,gy,cells=this.pixels,look=this.look) {
    if(cols<1||rows<1||cols>64||rows>64||cols*rows>1600)return look;
    if(cols!==this.lookCols||rows!==this.lookRows){look.fill(0);this.lookCols=cols;this.lookRows=rows;}
    gx=f(gx);gy=f(gy);
    const length=f(Math.sqrt(f(f(gx*gx)+f(gy*gy)))),ux=length>f(1e-3)?f(-gx/length):0,uy=length>f(1e-3)?f(-gy/length):-1;
    let dx=0,dy=-1,best=-2;
    for(const[ox,oy]of[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]]){
      const d=f(f(f(ox*ux)+f(oy*uy))/f(Math.sqrt(ox*ox+oy*oy)));
      if(d>best){best=d;dx=ox;dy=oy;}
    }
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const c=j*cols+i,value=cells[c];
      if(value!==1){look[c]=value===2?1:0;continue;}
      let depth=0;
      for(let a=i+dx,b=j+dy;depth<8&&a>=0&&a<cols&&b>=0&&b<rows;a+=dx,b+=dy){const above=cells[b*cols+a];if(above!==1&&above!==2)break;depth++;}
      const was=look[c]-3;
      if(was>=0&&was<=3&&depth>=2*was&&(was===3||depth<=2*was+3))continue;
      look[c]=3+Math.min(3,Math.floor((depth>0?depth-1:0)/2));
    }
    return look;
  }
}

// Square pixels for drawing water: each screen cell is either water or not, so blocks never overlap.
// cells: 0 empty, 1 water, 2 surface (open toward -gravity), 3 outside the vessel.
// Pixel (i, j) covers simulation x = originX + i*cellX ... like the C++ FlipFluid::rasterize.
export function pixelWater(fluid,cols,rows,originX,originY,cellX,cellY,gx,gy,cells=new Uint8Array(cols*rows)) {
  fluid.rasterize(cols,rows,originX,originY,cellX,cellY,gx,gy,cells);
  return cells;
}
