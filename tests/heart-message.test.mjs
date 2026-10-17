import test from 'node:test';
import assert from 'node:assert/strict';
import { HeartBeat, heartBeat, heartShade, sparkDot } from '../web/heart.js';
import { BannerScroll, dotAt, dotGrid, packBits, wrapLines } from '../web/message.js';

test('the heart beats lub-dub, is lit from the upper left, leans with the tilt, and its sparks rise against gravity', () => {
  assert.ok(heartBeat(66) > .99 && heartBeat(286) > .55 && heartBeat(286) < .61 && heartBeat(700) === 0, 'a strong beat, a softer one, then rest');
  const at = (x, y, lean = 0) => heartShade(x, y, 30, 30, 18, lean);
  assert.ok(at(30, 30) > 0, 'the middle is inside');
  assert.equal(at(30, 5), 0, 'the dip between the lobes is outside');
  assert.ok(at(30, 48) > 0 && at(30, 52) === 0, 'the point is at the bottom');
  assert.ok(at(20, 18) > at(40, 40), 'brighter at the upper left');
  assert.notEqual(at(46, 22, .45), at(46, 22, 0), 'the tilt leans it');
  assert.ok(sparkDot(1, 0) && !sparkDot(0, 0) && sparkDot(2, 3) && !sparkDot(5, 0));
  const heart = new HeartBeat(); heart.reset(0, 7);
  heart.burst(30, 30);
  assert.equal(heart.sparks.filter(s => s.life > 0).length, 8);
  for (let t = 0; t < 1; t += .02) heart.step(.02, 0, -1, t * 1000, 30, 30, 18);
  const alive = heart.sparks.filter(s => s.life > 0), meanY = alive.reduce((a, s) => a + s.y, 0) / alive.length;
  assert.ok(alive.length >= 8 && meanY < 30, `the little hearts float up: mean y ${meanY}`);
  for (let t = 1; t < 4; t += .02) heart.step(.02, 0, -1, t * 1000, 30, 30, 18);
  assert.ok(heart.sparks.filter(s => s.life > 0).length < 8, 'they fade, and only an occasional one rises on its own');
});

test('message pictures pack column by column, scroll in from the right and loop, and still text wraps at spaces', () => {
  assert.deepEqual(dotGrid(240, 240), { pitch: 4, cols: 60, rows: 60, x: 0, y: 0 });
  assert.deepEqual(dotGrid(80, 160), { pitch: 2, cols: 40, rows: 80, x: 0, y: 0 });
  assert.deepEqual(dotGrid(128, 64), { pitch: 2, cols: 64, rows: 32, x: 0, y: 0 });
  const w = 3, h = 24, rgba = new Uint8Array(w * h * 4);
  rgba[(5 * w + 2) * 4] = 255;
  const picture = { bits: packBits(rgba, w, h), width: w, height: h };
  assert.equal(picture.bits.length, 9);
  assert.ok(dotAt(picture, 2, 5) && !dotAt(picture, 1, 5) && !dotAt(picture, 2, 6) && !dotAt(picture, 3, 5));
  assert.equal(picture.bits[(2 * 24 + 5) >> 3], 1 << ((2 * 24 + 5) & 7), 'bit x * height + y');
  const scroll = new BannerScroll();
  assert.equal(scroll.bannerColumn(59, 60), -1, 'starts just off the right edge');
  scroll.advance(1, 30, 100, 60);
  assert.equal(scroll.bannerColumn(59, 60), 29);
  scroll.advance(5, 30, 100, 60);
  assert.ok(scroll.position < 160 && scroll.position >= 0, 'loops after the banner has left');
  const measure = text => text.length * 10;
  assert.deepEqual(wrapLines(measure, 'hello big world', 100), ['hello big', 'world']);
  assert.deepEqual(wrapLines(measure, 'abcdefghijklm', 50), ['abcde', 'fghij', 'klm'], 'no spaces: breaks between characters');
  assert.deepEqual(wrapLines(measure, 'one\ntwo', 100), ['one', 'two']);
});
