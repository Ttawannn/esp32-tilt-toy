import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { profiles, findProfile, validateRelease, wiringFor } from '../web/profiles.js';
import { boards, releasePath, validateFirmwareImage } from '../web/boards.js';
test('round and square TFT 240×240 have distinct drivers',()=>{
  assert.equal(findProfile('tft-240x240','GC9A01').id,'tft-240x240-gc9a01');
  assert.equal(findProfile('tft-240x240','ST7789').id,'tft-240x240-st7789');
});
test('Mini TFT orientation selects dimensions and the matching firmware preset',()=>{
  const portrait=findProfile('tft-80x160','GC9A01','portrait');
  const landscape=findProfile('tft-80x160','GC9A01','landscape');
  assert.equal(portrait.id,'tft-80x160');
  assert.equal(landscape.id,'tft-80x160-landscape');
  assert.deepEqual([portrait.width,portrait.height,portrait.defaultRotation],[80,160,0]);
  assert.deepEqual([landscape.width,landscape.height,landscape.defaultRotation],[160,80,1]);
  assert.notEqual(portrait.firmwareId,landscape.firmwareId);
  assert.equal(portrait.driver,landscape.driver);
  assert.deepEqual(wiringFor(portrait),wiringFor(landscape));
  assert.equal(findProfile('tft-240x240','GC9A01','landscape').id,'tft-240x240-gc9a01');
});
test('GMT130 no-CS and shared I²C wiring match firmware',()=>{
  for (const board of boards) {
    assert.equal(wiringFor(findProfile('gmt130-240x240'), 'mpu6050', board).some(([pin])=>pin==='CS'),false);
    assert.deepEqual(wiringFor(findProfile('oled-128x64'), 'mpu6050', board).slice(0,2),[['OLED SDA',`GPIO${board.pins.SDA}`],['OLED SCL',`GPIO${board.pins.SCL}`]]);
    for(const p of profiles)assert.equal(wiringFor(p,'mpu6050',board).some(([,pin])=>board.reserved.map(n=>`GPIO${n}`).includes(pin)),false);
  }
});
for(const board of boards) for(const profile of profiles)test(`release ${board.id}/${profile.id}: bytes, checksum, chip and partition layout`,async()=>{
  const base=new URL('../web/firmware/',import.meta.url);
  const manifestUrl=new URL(`${releasePath(profile,board)}.json`,base);
  const release=validateRelease(JSON.parse(await readFile(manifestUrl,'utf8')),profile,board);
  const binary=await readFile(new URL(release.builds[0].parts[0].path,manifestUrl));
  validateFirmwareImage(binary,board);
  assert.throws(()=>validateFirmwareImage(binary,boards.find(b=>b.id!==board.id)));
  const wrongAppChip=Buffer.from(binary);wrongAppChip.writeUInt16LE(0xffff,0x10000+12);assert.throws(()=>validateFirmwareImage(wrongAppChip,board));
  assert.throws(()=>validateFirmwareImage(binary.subarray(0,32),board));
  assert.ok(binary.includes(Buffer.from(board.id+'\0')), 'image must contain its runtime board ID');
  assert.ok(binary.includes(Buffer.from(profile.id+'\0')), 'image must contain its complete runtime profile ID');
  for (const mode of ['water-inertia','water-swirl']) assert.ok(binary.includes(Buffer.from(mode+'\0')), `image must contain the separate ${mode} mode`);
  assert.equal(binary.length,release.size);
  assert.equal(createHash('sha256').update(binary).digest('hex'),release.sha256);
  const boot=board.bootloaderOffset;
  if(boot)assert.ok(binary.subarray(0,boot).every(value=>value===0xff),'merged image pads to flash offset zero');
  assert.equal(binary[boot],0xe9);assert.equal(binary.readUInt16LE(boot+12),board.chipId);
  assert.equal(binary[boot+2],2,'bootloader uses DIO');assert.equal(binary[boot+3]>>4,2,'image flash size is 4MB');
  assert.equal(binary[0x10000],0xe9);assert.equal(binary.readUInt16LE(0x10000+12),board.chipId);
  assert.equal(binary.readUInt16LE(0x8000),0x50aa);
  let appSize=0;
  for(let entry=0x8000;entry<0x8c00;entry+=32){
    if(binary.readUInt16LE(entry)!==0x50aa)break;
    if(binary[entry+2]===0 && binary.readUInt32LE(entry+4)===0x10000)appSize=binary.readUInt32LE(entry+8);
  }
  assert.equal(appSize,0x300000);assert.ok(binary.length-0x10000<=appSize);
  const source = (await readFile(new URL('../firmware/tilt_toy/tilt_toy.ino',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const config = (await readFile(new URL('../firmware/tilt_toy/config.h',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const fluid = (await readFile(new URL('../firmware/tilt_toy/flip_fluid.h',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const motion = (await readFile(new URL('../firmware/tilt_toy/motion_sensor.h',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const state = (await readFile(new URL('../firmware/tilt_toy/motion_state.h',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  const modes = (await readFile(new URL('../firmware/tilt_toy/toy_modes.h',import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  assert.equal(createHash('sha256').update(source+'\n'+config+'\n'+fluid+'\n'+motion+'\n'+state+'\n'+modes).digest('hex'),release.build.sourceSha256);
  for(const sensor of ['BMI160','MPU6050'])assert.ok(binary.includes(Buffer.from(sensor)),`image must support ${sensor}`);
  assert.equal(config.match(/TOY_VERSION\s+"([^"]+)"/)[1],release.version);
  const otherBoard=boards.find(b=>b.id!==board.id);
  const bad=structuredClone(release);bad.builds[0].chipFamily=otherBoard.chipFamily;assert.throws(()=>validateRelease(bad,profile,board));
  assert.throws(()=>validateRelease(release,profile,otherBoard));
  assert.throws(()=>validateRelease(release,profiles.find(p=>p.id!==profile.id),board));
  const wrongBoard=structuredClone(release);wrongBoard.board=otherBoard.id;assert.throws(()=>validateRelease(wrongBoard,profile,board));
  const wrongFqbn=structuredClone(release);wrongFqbn.build.fqbn=otherBoard.fqbn;assert.throws(()=>validateRelease(wrongFqbn,profile,board));
  const wrongBoot=structuredClone(release);wrongBoot.build.bootloaderOffset=board.bootloaderOffset===0?0x1000:0;assert.throws(()=>validateRelease(wrongBoot,profile,board));
  const wrongOffset=structuredClone(release);wrongOffset.builds[0].parts[0].offset=0x1000;assert.throws(()=>validateRelease(wrongOffset,profile,board));
  const wrongPath=structuredClone(release);wrongPath.builds[0].parts[0].path='../untrusted.bin';assert.throws(()=>validateRelease(wrongPath,profile,board));
  const wrongVersion=structuredClone(release);wrongVersion.version='9.9.9';assert.throws(()=>validateRelease(wrongVersion,profile,board));
  const wrongRotation=structuredClone(release);wrongRotation.build.initialRotation=release.build.initialRotation===0?1:0;assert.throws(()=>validateRelease(wrongRotation,profile,board));
});
