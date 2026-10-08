import test from 'node:test';
import assert from 'node:assert/strict';
import { FlipFluid, pixelWater, FULL_WATER_FLIP, fullWaterColor, fullWaterCssColor } from '../web/fluid.js';

const settle = (fluid, gx = 0, gy = 4) => { for (let i = 0; i < 120; i++) fluid.advance(.025, gx, gy); };
const view = (fluid, cols, rows) => [fluid.h, fluid.h, (fluid.nx - 2) * fluid.h / cols, (fluid.ny - 2) * fluid.h / rows];

test('settled water fills the bottom as whole pixels with a pale surface row on top', () => {
  const fluid = new FlipFluid(18, 18, false, 50), cols = 32, rows = 32;
  settle(fluid);
  const cells = pixelWater(fluid, cols, rows, ...view(fluid, cols, rows), 0, 4);
  const at = (i, j) => cells[j * cols + i];
  for (let i = 0; i < cols; i++) {
    assert.notEqual(at(i, rows - 1), 0, `bottom pixel ${i} is water up to the wall`);
    assert.equal(at(i, 0), 0, `top pixel ${i} is air`);
    const column = Array.from({ length: rows }, (_, j) => at(i, j));
    const first = column.findIndex(v => v !== 0);
    assert.equal(column[first], 2, `column ${i} starts with a surface pixel`);
    assert.ok(column.slice(first + 2).every(v => v === 1), `column ${i} is solid body water below the surface`);
  }
  const water = cells.filter(v => v === 1 || v === 2).length / cells.length;
  assert.ok(water > .35 && water < .65, `about half full, got ${water.toFixed(2)}`);
});

test('surface follows tilt and round vessels mark pixels outside the glass', () => {
  const fluid = new FlipFluid(20, 20, true, 40), cols = 30, rows = 30;
  settle(fluid, 4, 0);
  const cells = pixelWater(fluid, cols, rows, ...view(fluid, cols, rows), 4, 0);
  const at = (i, j) => cells[j * cols + i];
  assert.equal(at(0, 0), 3); assert.equal(at(cols - 1, rows - 1), 3);
  assert.notEqual(at(cols - 1, rows / 2), 0, 'water sits against the right wall when gravity points right');
  assert.equal(at(0, rows / 2), 0, 'the left side is air');
  for (let j = 0; j < rows; j++) for (let i = 1; i < cols; i++) {
    if (at(i, j) === 2) assert.ok([at(i - 1, j - 1), at(i - 1, j), at(i - 1, j + 1)].includes(0), 'a surface pixel has air on its upper (left) side');
  }
});

test('full water highlights exposed air boundaries in every direction without marking vessel walls',()=>{
  const fluid=new FlipFluid(20,20,true,50),cols=32,rows=32;
  for(let i=0;i<80;i++)fluid.advance(.025,0,0,4,i===0?40:0,FULL_WATER_FLIP,.10);
  const args=view(fluid,cols,rows);
  const first=pixelWater(fluid,cols,rows,...args,0,4,new Uint8Array(cols*rows),true);
  const second=pixelWater(fluid,cols,rows,...args,4,0,new Uint8Array(cols*rows),true);
  assert.deepEqual(first,second,'full-water exposed edges do not disappear when gravity changes');
  let surfaces=0,bodies=0;
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const cell=first[j*cols+i];if(cell!==1&&cell!==2)continue;
    let air=false;
    for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++)if(i+dx>=0&&i+dx<cols&&j+dy>=0&&j+dy<rows&&first[(j+dy)*cols+i+dx]===0)air=true;
    assert.equal(cell===2,air,'only water touching air is a bright surface');
    if(cell===2)surfaces++;else bodies++;
  }
  assert.ok(surfaces>0&&bodies>0);assert.equal(first[0],3);
  assert.notEqual(fullWaterColor(false,0,0),fullWaterColor(false,1,0));
  assert.equal(fullWaterColor(true,0,0),fullWaterColor(true,5,7));
  assert.ok(fullWaterCssColor(true,0,0).startsWith('rgb('));
});
