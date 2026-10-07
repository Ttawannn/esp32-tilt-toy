import test from 'node:test';
import assert from 'node:assert/strict';
import { FlipFluid, pixelWater } from '../web/fluid.js';

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
