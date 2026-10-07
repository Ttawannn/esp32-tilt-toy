import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { profiles, findProfile, validateRelease, wiringFor } from '../web/profiles.js';
test('round and square TFT 240×240 have distinct drivers',()=>{
  assert.equal(findProfile('tft-240x240','GC9A01').id,'tft-240x240-gc9a01');
  assert.equal(findProfile('tft-240x240','ST7789').id,'tft-240x240-st7789');
});
test('GMT130 no-CS and shared I²C wiring match firmware',()=>{
  assert.equal(wiringFor(findProfile('gmt130-240x240')).some(([pin])=>pin==='CS'),false);
  assert.deepEqual(wiringFor(findProfile('oled-128x64')).slice(0,2),[['OLED SDA','GPIO0'],['OLED SCL','GPIO1']]);
  for(const p of profiles)assert.equal(wiringFor(p).some(([,pin])=>['GPIO4','GPIO5','GPIO8','GPIO9','GPIO10','GPIO11','GPIO12','GPIO13','GPIO15'].includes(pin)),false);
});
for(const profile of profiles)test(`release ${profile.id}: bytes, checksum, chip and partition layout`,async()=>{
  const base=new URL('../web/firmware/',import.meta.url);
  const release=validateRelease(JSON.parse(await readFile(new URL(`${profile.id}.json`,base),'utf8')),profile);
  const binary=await readFile(new URL(release.builds[0].parts[0].path,base));
  assert.ok(binary.includes(Buffer.from(profile.id)), 'image must contain its runtime profile ID');
  assert.equal(binary.length,release.size);
  assert.equal(createHash('sha256').update(binary).digest('hex'),release.sha256);
  assert.equal(binary[0],0xe9);assert.equal(binary.readUInt16LE(12),13);
  assert.equal(binary[2],2,'bootloader uses DIO');assert.equal(binary[3]>>4,2,'image flash size is 4MB');
  assert.equal(binary[0x10000],0xe9);assert.equal(binary.readUInt16LE(0x10000+12),13);
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
  assert.equal(createHash('sha256').update(source+'\n'+config+'\n'+fluid).digest('hex'),release.build.sourceSha256);
  assert.equal(config.match(/TOY_VERSION\s+"([^"]+)"/)[1],release.version);
  const bad=structuredClone(release);bad.builds[0].chipFamily='ESP32-C3';assert.throws(()=>validateRelease(bad,profile));
  assert.throws(()=>validateRelease(release,profiles.find(p=>p.id!==profile.id)));
  const wrongOffset=structuredClone(release);wrongOffset.builds[0].parts[0].offset=0x1000;assert.throws(()=>validateRelease(wrongOffset,profile));
  const wrongPath=structuredClone(release);wrongPath.builds[0].parts[0].path='../untrusted.bin';assert.throws(()=>validateRelease(wrongPath,profile));
  const wrongVersion=structuredClone(release);wrongVersion.version='9.9.9';assert.throws(()=>validateRelease(wrongVersion,profile));
});
