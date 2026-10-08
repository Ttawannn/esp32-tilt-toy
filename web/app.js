import { displayChoices, findProfile, findSensor, modes, sensors, validateRelease } from './profiles.js';
import { boards, findBoard, releasePath, validateFirmwareImage } from './boards.js';
import { isLiquidMode } from './water-modes.js';
import { ToyPreview } from './preview.js';
import { WiringGraph } from './wiring.js';
const $ = id => document.getElementById(id);
let saved={}; try { saved=JSON.parse(localStorage.getItem('tilt-toy-selection')||'{}'); } catch {}
let choice=displayChoices.some(d=>d.id===saved.choice)?saved.choice:'tft-240x240';
let driver=saved.driver==='ST7789'?'ST7789':'GC9A01';
let orientation=saved.orientation==='landscape'?'landscape':'portrait';
let sensorId=findSensor(saved.sensor).id;
let board=findBoard(saved.board);
let currentMode=modes.some(m=>m.id===saved.mode)?saved.mode:'water';
let fill=Number.isFinite(saved.fill)?Math.min(90,Math.max(10,Math.round(saved.fill))):50;
let profile=findProfile(choice,driver,orientation), generation=0, installerReady=false, releaseReady=false;
const supported=window.isSecureContext && 'serial' in navigator;
const preview=new ToyPreview($('toy-canvas'));preview.fill=fill;
const wiring=new WiringGraph($('wiring'));
function remember(){try{localStorage.setItem('tilt-toy-selection',JSON.stringify({board:board.id,choice,driver,orientation,sensor:sensorId,mode:currentMode,fill}));}catch{}}
function syncFlash(){ $('flash-button').disabled=!(supported&&installerReady&&releaseReady); }
function status(state,message){$('release-status').dataset.state=state;$('release-message').textContent=message;}
async function verifyRelease(p,b,revision){
  releaseReady=false;syncFlash();$('install').removeAttribute('manifest');$('download').hidden=true;$('binary-size').textContent='';status('loading','กำลังตรวจไฟล์เฟิร์มแวร์…');
  try{
    const manifestUrl=new URL(`./firmware/${releasePath(p,b)}.json`,import.meta.url);
    const response=await fetch(manifestUrl);if(!response.ok)throw Error('ไม่พบเฟิร์มแวร์ของบอร์ดและจอนี้');
    const release=validateRelease(await response.json(),p,b);
    const binaryUrl=new URL(release.builds[0].parts[0].path,manifestUrl);
    const file=await fetch(binaryUrl);if(!file.ok)throw Error('ดาวน์โหลดไฟล์เฟิร์มแวร์ไม่ได้');
    const bytes=await file.arrayBuffer();if(bytes.byteLength!==release.size)throw Error('ขนาดไฟล์เฟิร์มแวร์ไม่ตรง');
    validateFirmwareImage(bytes,b);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==release.sha256)throw Error('Checksum ของเฟิร์มแวร์ไม่ตรง');
    if(revision!==generation)return;
    $('install').setAttribute('manifest',manifestUrl.href);
    $('download').href=binaryUrl.href;$('download').download=`esp32-tilt-toy-${b.id}-${p.id}-v${release.version}.bin`;$('download').hidden=false;
    $('binary-size').textContent=`${(bytes.byteLength/1024).toFixed(0)} KB · SHA-256 ✓`;
    status('ready',`v${release.version} · ${b.chipFamily} · ${p.driver} · ตรวจไฟล์แล้ว`);releaseReady=true;syncFlash();
  }catch(error){if(revision!==generation)return;status('error',error.message);releaseReady=false;syncFlash();}
}
function chooseDisplay(){
  profile=findProfile(choice,driver,orientation);remember();
  $('board').value=board.id;$('board-name').textContent=board.name;$('board-note').textContent=board.note;
  document.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.display===choice)));
  $('driver-wrap').hidden=choice!=='tft-240x240';$('driver').value=driver;$('profile-note').textContent=profile.note;
  $('orientation-wrap').hidden=choice!=='tft-80x160';$('orientation').value=orientation;
  $('preview-panel-label').textContent=`${profile.width} × ${profile.height} / ${profile.driver}`;
  $('device').dataset.shape=profile.shape;$('device').dataset.format=profile.width<profile.height?'portrait':profile.width>profile.height?'wide':'square';
  preview.setProfile(profile);wiring.setProfile(profile,sensorId,board);
  $('panel-source').href=profile.source;verifyRelease(profile,board,++generation);
}
function chooseMode(id){currentMode=id;remember();preview.setMode(id);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===id)));const m=modes.find(m=>m.id===id);$('mode-readout').textContent=m.english.toUpperCase();$('mode-description').textContent=`${m.detail} · ภาพจำลองบนเว็บ`;$('fluid-controls').hidden=!isLiquidMode(id);$('spin-controls').hidden=id!=='water-swirl';$('jolt-controls').hidden=!['water-inertia','pixel-flow'].includes(id);$('fluid-grid').closest('label').hidden=id==='pixel-flow';$('shake').hidden=['water-inertia','water-swirl','water-full'].includes(id);$('spin').value=0;$('spin-value').textContent='0°/s';}
for(const d of displayChoices){const b=document.createElement('button');b.className='display-card';b.dataset.display=d.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="mini-screen ${d.shape}" aria-hidden="true"></span><span><strong>${d.title}</strong><small>${d.subtitle}</small></span>`;b.addEventListener('click',()=>{choice=d.id;chooseDisplay();});$('displays').append(b);}
for(const m of modes){const b=document.createElement('button');b.className='mode-button';b.dataset.mode=m.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="glyph" aria-hidden="true">${m.glyph}</span><span>${m.name}</span><small>${m.english}</small>`;b.addEventListener('click',()=>chooseMode(m.id));$('modes').append(b);}
$('driver').addEventListener('change',()=>{driver=$('driver').value;chooseDisplay();});
$('orientation').addEventListener('change',()=>{orientation=$('orientation').value;chooseDisplay();});
for(const b of boards){const option=document.createElement('option');option.value=b.id;option.textContent=b.name;$('board').append(option);}
$('board').addEventListener('change',()=>{board=findBoard($('board').value);chooseDisplay();});
for(const sensor of sensors){const option=document.createElement('option');option.value=sensor.id;option.textContent=sensor.module;$('sensor').append(option);}
$('sensor').value=sensorId;
$('sensor').addEventListener('change',()=>{sensorId=findSensor($('sensor').value).id;remember();wiring.setProfile(profile,sensorId,board);});
$('tilt').addEventListener('input',()=>{const value=Number($('tilt').value);preview.setTilt(value,preview.pitch);$('tilt-value').textContent=value+'°';$('roll-readout').textContent=(value>=0?'+':'')+value+'°';$('device').style.transform=`rotate(${value*.12}deg)`;});
$('pitch').addEventListener('input',()=>{const value=Number($('pitch').value);preview.setTilt(preview.roll,value);$('pitch-readout').textContent=(value>=0?'+':'')+value+'°';});
$('spin').addEventListener('input',()=>{preview.spin=Number($('spin').value);$('spin-value').textContent=preview.spin+'°/s';});
$('stop-spin').addEventListener('click',()=>{preview.spin=0;$('spin').value=0;$('spin-value').textContent='0°/s';});
$('flat').addEventListener('click',()=>{preview.setTilt(preview.roll,90);$('pitch').value=90;$('pitch-readout').textContent='+90°';});
document.querySelectorAll('[data-jolt]').forEach(button=>button.addEventListener('click',()=>preview.jolt(...button.dataset.jolt.split(',').map(Number))));
$('shake').addEventListener('click',()=>preview.shake());
$('fill').value=fill;$('fill-value').textContent=fill+'%';
$('fill').addEventListener('input',()=>{fill=Number($('fill').value);$('fill-value').textContent=fill+'%';preview.setFill(fill);remember();});
$('fluid-grid').addEventListener('change',()=>{preview.showGrid=$('fluid-grid').checked;});
if(!supported){$('browser-message').textContent=window.isSecureContext?'แฟลชผ่าน Chrome / Edge บนคอมพิวเตอร์ · มือถือใช้ตั้งค่าโหมดหลังแฟลชได้':'ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เพื่อใช้ Web Serial';}
else{$('browser-message').textContent='Chrome / Edge บนคอมพิวเตอร์ · ตัวแฟลชตรวจชิปและแสดงความคืบหน้าจริง';}
chooseMode(currentMode);chooseDisplay();
import('./assets/installer.js').then(async()=>{await customElements.whenDefined('esp-web-install-button');installerReady=true;syncFlash();}).catch(()=>{$('browser-message').textContent='โหลดระบบแฟลชไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ';installerReady=false;syncFlash();});
