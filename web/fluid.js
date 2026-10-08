/*
 * Compact FLIP/PIC solver adapted from Ten Minute Physics, example 18.
 * Copyright 2022 Matthias Müller - Ten Minute Physics
 * MIT license: ./licenses/ten-minute-physics.txt
 * Changes: bounded storage, circular vessels, tilt gravity, fixed stepping,
 * linked-cell particle separation, and square-pixel rendering (pixelWater).
 */
const SOLID=2, AIR=1, FLUID=0, STEP=.025;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

export function fluidLayout(width,height,round=false) {
  if(round)return {nx:20,ny:20,x:4,y:4,width:width-8,height:height-8,round:true};
  const w=width-4,h=height-4,short= Math.min(w,h)<40?6:Math.min(w,h)<100?8:16;
  return {nx:2+Math.min(30,Math.round(short*w/Math.min(w,h))),ny:2+Math.min(30,Math.round(short*h/Math.min(w,h))),x:2,y:2,width:w,height:h,round:false};
}

export class FlipFluid {
  constructor(nx=20,ny=20,round=true,fill=50) {
    if(nx<4||ny<4||nx*ny>400)throw Error('Fluid grid exceeds its storage budget');
    this.nx=nx;this.ny=ny;this.round=round;this.h=1/(Math.min(nx,ny)-2);
    this.radius=.32*this.h;this.cx=nx*this.h/2;this.cy=ny*this.h/2;
    this.vesselRadius=(Math.min(nx,ny)-2)*this.h/2;
    const cells=nx*ny;
    for(const name of ['u','v','oldU','oldV','weightU','weightV','density'])this[name]=new Float32Array(cells);
    this.kind=new Uint8Array(cells);this.head=new Int16Array(cells);this.next=new Int16Array(900);
    this.x=new Float32Array(900);this.y=new Float32Array(900);this.vx=new Float32Array(900);this.vy=new Float32Array(900);
    for(let i=0;i<nx;i++)for(let j=0;j<ny;j++) {
      const dx=(i+.5)*this.h-this.cx,dy=(j+.5)*this.h-this.cy;
      this.kind[i*ny+j]=(i===0||j===0||i===nx-1||j===ny-1||round&&dx*dx+dy*dy>this.vesselRadius**2)?SOLID:AIR;
    }
    this.reset(fill);
  }
  reset(fill=50) {
    this.count=0;this.accumulator=0;this.restDensity=0;
    for(const name of ['u','v','oldU','oldV','vx','vy','density'])this[name].fill(0);
    const spacing=2.12*this.radius,dy=spacing*Math.sqrt(3)/2,edge=this.h+this.radius;
    const maxX=(this.nx-1)*this.h-this.radius,maxY=(this.ny-1)*this.h-this.radius;
    let total=0;
    const seed=visit=>{let row=0;for(let y=maxY;y>=edge;y-=dy,row++)for(let x=edge+(row%2)*spacing/2;x<=maxX;x+=spacing) {
      if(this.round&&Math.hypot(x-this.cx,y-this.cy)>this.vesselRadius-.8*this.h)continue;
      visit(x,y);
    }};
    seed(()=>total++);
    const target=Math.min(900,Math.round(total*clamp(fill,10,90)/100));
    seed((x,y)=>{if(this.count<target){this.x[this.count]=x;this.y[this.count++]=y;}});
    this.toGrid();this.updateDensity();
  }
  cell(x,y) {return clamp(Math.floor(x/this.h),0,this.nx-1)*this.ny+clamp(Math.floor(y/this.h),0,this.ny-1);}
  keepInside() {
    const min=this.h+this.radius,maxX=(this.nx-1)*this.h-this.radius,maxY=(this.ny-1)*this.h-this.radius;
    const radius=this.vesselRadius-.8*this.h;
    for(let p=0;p<this.count;p++) {
      if(this.round) {
        const dx=this.x[p]-this.cx,dy=this.y[p]-this.cy,d=Math.hypot(dx,dy);
        if(d>radius){const nx=dx/d,ny=dy/d;this.x[p]=this.cx+nx*radius;this.y[p]=this.cy+ny*radius;
          const outward=this.vx[p]*nx+this.vy[p]*ny;if(outward>0){this.vx[p]-=outward*nx;this.vy[p]-=outward*ny;}}
      } else {
        if(this.x[p]<min){this.x[p]=min;this.vx[p]=Math.max(0,this.vx[p]);}
        if(this.x[p]>maxX){this.x[p]=maxX;this.vx[p]=Math.min(0,this.vx[p]);}
        if(this.y[p]<min){this.y[p]=min;this.vy[p]=Math.max(0,this.vy[p]);}
        if(this.y[p]>maxY){this.y[p]=maxY;this.vy[p]=Math.min(0,this.vy[p]);}
      }
    }
  }
  separate() {
    const distance=2*this.radius;
    for(let pass=0;pass<2;pass++) {
      this.head.fill(-1);
      for(let p=0;p<this.count;p++){const c=this.cell(this.x[p],this.y[p]);this.next[p]=this.head[c];this.head[c]=p;}
      for(let p=0;p<this.count;p++) {
        const xi=Math.floor(this.x[p]/this.h),yi=Math.floor(this.y[p]/this.h);
        for(let i=Math.max(0,xi-1);i<=Math.min(this.nx-1,xi+1);i++)for(let j=Math.max(0,yi-1);j<=Math.min(this.ny-1,yi+1);j++) {
          for(let q=this.head[i*this.ny+j];q>=0;q=this.next[q]) {
            if(q<=p)continue;
            let dx=this.x[q]-this.x[p],dy=this.y[q]-this.y[p],d2=dx*dx+dy*dy;
            if(d2>=distance*distance)continue;
            if(d2<1e-12){dx=this.h*.0001;dy=this.h*.00007;d2=dx*dx+dy*dy;}
            const d=Math.sqrt(d2),scale=.5*(distance-d)/d;dx*=scale;dy*=scale;
            this.x[p]-=dx;this.y[p]-=dy;this.x[q]+=dx;this.y[q]+=dy;
          }
        }
      }
      this.keepInside();
    }
  }
  // Bilinear weights for a staggered MAC face (u/v) or cell centre (density).
  stencil(x,y,ox,oy,visit) {
    const sx=clamp(x/this.h-ox,0,this.nx-1.001),sy=clamp(y/this.h-oy,0,this.ny-1.001);
    const i=Math.floor(sx),j=Math.floor(sy),tx=sx-i,ty=sy-j,c=i*this.ny+j;
    visit(c,(1-tx)*(1-ty));visit(c+this.ny,tx*(1-ty));visit(c+this.ny+1,tx*ty);visit(c+1,(1-tx)*ty);
  }
  toGrid() {
    this.u.fill(0);this.v.fill(0);this.weightU.fill(0);this.weightV.fill(0);
    for(let c=0;c<this.kind.length;c++)if(this.kind[c]!==SOLID)this.kind[c]=AIR;
    for(let p=0;p<this.count;p++) {
      const c=this.cell(this.x[p],this.y[p]);if(this.kind[c]!==SOLID)this.kind[c]=FLUID;
      this.stencil(this.x[p],this.y[p],0,.5,(c,w)=>{this.u[c]+=this.vx[p]*w;this.weightU[c]+=w;});
      this.stencil(this.x[p],this.y[p],.5,0,(c,w)=>{this.v[c]+=this.vy[p]*w;this.weightV[c]+=w;});
    }
    for(let i=0;i<this.nx;i++)for(let j=0;j<this.ny;j++) {
      const c=i*this.ny+j;
      if(this.weightU[c]>0)this.u[c]/=this.weightU[c];if(this.weightV[c]>0)this.v[c]/=this.weightV[c];
      if(this.kind[c]===SOLID||i===0||this.kind[c-this.ny]===SOLID)this.u[c]=0;
      if(this.kind[c]===SOLID||j===0||this.kind[c-1]===SOLID)this.v[c]=0;
    }
    this.oldU.set(this.u);this.oldV.set(this.v);
  }
  updateDensity() {
    this.density.fill(0);
    for(let p=0;p<this.count;p++)this.stencil(this.x[p],this.y[p],.5,.5,(c,w)=>{this.density[c]+=w;});
    if(!this.restDensity){let sum=0,n=0;for(let c=0;c<this.kind.length;c++)if(this.kind[c]===FLUID){sum+=this.density[c];n++;}this.restDensity=n?sum/n:0;}
  }
  project(iterations=12,compensate=true) {
    const n=this.ny;
    for(let pass=0;pass<iterations;pass++)for(let i=1;i<this.nx-1;i++)for(let j=1;j<n-1;j++) {
      const c=i*n+j;if(this.kind[c]!==FLUID)continue;
      const left=this.kind[c-n]!==SOLID?1:0,right=this.kind[c+n]!==SOLID?1:0,up=this.kind[c-1]!==SOLID?1:0,down=this.kind[c+1]!==SOLID?1:0;
      const open=left+right+up+down;if(!open)continue;
      let divergence=this.u[c+n]-this.u[c]+this.v[c+1]-this.v[c];
      if(compensate)divergence-=.03*Math.max(0,this.density[c]-this.restDensity);
      const pressure=-1.6*divergence/open;
      this.u[c]-=left*pressure;this.u[c+n]+=right*pressure;this.v[c]-=up*pressure;this.v[c+1]+=down*pressure;
    }
  }
  toParticles(flip=.9) {
    flip=clamp(flip,0,1);
    for(let component=0;component<2;component++) {
      const field=component?this.v:this.u,old=component?this.oldV:this.oldU,velocity=component?this.vy:this.vx,offset=component?1:this.ny;
      for(let p=0;p<this.count;p++) {
        let weight=0,pic=0,change=0;
        this.stencil(this.x[p],this.y[p],component?.5:0,component?0:.5,(c,w)=>{
          if(this.kind[c]===FLUID||c>=offset&&this.kind[c-offset]===FLUID){weight+=w;pic+=w*field[c];change+=w*(field[c]-old[c]);}
        });
        if(weight>0)velocity[p]=(1-flip)*pic/weight+flip*(velocity[p]+change/weight);
      }
    }
    this.limitSpeed();
  }
  limitSpeed() {
    const max=.65*this.h/STEP;
    for(let p=0;p<this.count;p++){const speed=Math.hypot(this.vx[p],this.vy[p]);if(speed>max){this.vx[p]*=max/speed;this.vy[p]*=max/speed;}}
  }
  impulse(gx=0,gy=1) {
    const length=Math.hypot(gx,gy)||1;gx/=length;gy/=length;
    for(let p=0;p<this.count;p++){const swirl=(p%7-3)*.12;this.vx[p]+=-gx*1.5+gy*.6+(this.y[p]-this.cy)*swirl;this.vy[p]+=-gy*1.5-gx*.6-(this.x[p]-this.cx)*swirl;}
    this.limitSpeed();
  }
  stir(x,y,vx,vy) {
    const radius=this.h*3;
    for(let p=0;p<this.count;p++){const d=Math.hypot(this.x[p]-x,this.y[p]-y);if(d<radius){const weight=.6*(1-d/radius);this.vx[p]+=(vx-this.vx[p])*weight;this.vy[p]+=(vy-this.vy[p])*weight;}}
    this.limitSpeed();
  }
  advance(dt,gx=0,gy=4,omega=0,omegaDot=0,flip=.9,wallDrag=0) {
    omega=clamp(omega,-12,12);omegaDot=clamp(omegaDot,-40,40);
    wallDrag=clamp(wallDrag,0,.5);
    this.accumulator=Math.min(.075,this.accumulator+clamp(dt,0,.1));
    while(this.accumulator>=STEP-1e-8) {
      for(let p=0;p<this.count;p++){
        const rx=this.x[p]-this.cx,ry=this.y[p]-this.cy,oldX=this.vx[p],oldY=this.vy[p];
        this.vx[p]=(oldX+(gx+omegaDot*ry+2*omega*oldY+omega*omega*rx)*STEP)*.996;
        this.vy[p]=(oldY+(gy-omegaDot*rx-2*omega*oldX+omega*omega*ry)*STEP)*.996;
        if(wallDrag>0){
          const nearWall=this.round?Math.hypot(rx,ry)>this.vesselRadius-1.8*this.h:this.x[p]<2*this.h+this.radius||this.x[p]>(this.nx-2)*this.h-this.radius||this.y[p]<2*this.h+this.radius||this.y[p]>(this.ny-2)*this.h-this.radius;
          if(nearWall){this.vx[p]*=1-wallDrag;this.vy[p]*=1-wallDrag;}
        }
      }
      this.limitSpeed();
      for(let p=0;p<this.count;p++){this.x[p]+=this.vx[p]*STEP;this.y[p]+=this.vy[p]*STEP;}
      this.keepInside();this.separate();this.toGrid();this.updateDensity();this.project();this.toParticles(flip);this.keepInside();
      this.accumulator-=STEP;
    }
  }
}

// Square pixels for drawing water: each screen cell is either water or not, so blocks never overlap.
// cells: 0 empty, 1 water, 2 surface (open toward -gravity), 3 outside the vessel.
// Pixel (i, j) covers simulation x = originX + i*cellX ... like the C++ FlipFluid::rasterize.
export function pixelWater(f,cols,rows,originX,originY,cellX,cellY,gx,gy,cells=new Uint8Array(cols*rows)) {
  cells.fill(0);
  const min=f.h+f.radius,maxX=(f.nx-1)*f.h-f.radius,maxY=(f.ny-1)*f.h-f.radius,rim=f.vesselRadius-.8*f.h,threshold=f.restDensity*.4,n=f.ny,d=f.density;
  // Sample density inside the particle domain so water reaches the walls particles cannot touch.
  const density=(x,y)=>{
    if(f.round){const dx=x-f.cx,dy=y-f.cy,r=Math.hypot(dx,dy);if(r>rim){x=f.cx+dx/r*rim;y=f.cy+dy/r*rim;}}
    else{x=clamp(x,min,maxX);y=clamp(y,min,maxY);}
    const sx=clamp(x/f.h-.5,0,f.nx-1.001),sy=clamp(y/f.h-.5,0,f.ny-1.001),i=Math.floor(sx),j=Math.floor(sy),tx=sx-i,ty=sy-j,c=i*n+j;
    return (1-tx)*(1-ty)*d[c]+tx*(1-ty)*d[c+n]+(1-tx)*ty*d[c+1]+tx*ty*d[c+n+1];
  };
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const x=originX+(i+.5)*cellX,y=originY+(j+.5)*cellY;
    cells[j*cols+i]=f.round&&Math.hypot(x-f.cx,y-f.cy)>f.vesselRadius?3:density(x,y)>threshold?1:0;
  }
  for(let p=0;p<f.count;p++){
    const i=Math.floor((f.x[p]-originX)/cellX),j=Math.floor((f.y[p]-originY)/cellY);
    if(i>=0&&i<cols&&j>=0&&j<rows&&cells[j*cols+i]===0)cells[j*cols+i]=1;
  }
  // Surface: a water pixel with an empty pixel above it (the up neighbour and the diagonals beside it).
  const length=Math.hypot(gx,gy),ux=length>1e-3?-gx/length:0,uy=length>1e-3?-gy/length:-1;
  const up=[[-1,-1],[0,-1],[1,-1],[-1,0],[1,0],[-1,1],[0,1],[1,1]].filter(([dx,dy])=>(dx*ux+dy*uy)/Math.hypot(dx,dy)>.38);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    if(cells[j*cols+i]!==1)continue;
    for(const[dx,dy]of up){const a=i+dx,b=j+dy;if(a>=0&&a<cols&&b>=0&&b<rows&&cells[b*cols+a]===0){cells[j*cols+i]=2;break;}}
  }
  return cells;
}
