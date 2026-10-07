import { displayChoices, findProfile, modes, wiringFor, validateRelease } from './profiles.js';
import { ToyPreview } from './preview.js';
const $ = id => document.getElementById(id);
let saved={}; try { saved=JSON.parse(localStorage.getItem('tilt-toy-selection')||'{}'); } catch {}
let choice=displayChoices.some(d=>d.id===saved.choice)?saved.choice:'tft-240x240';
let driver=saved.driver==='ST7789'?'ST7789':'GC9A01';
let currentMode=modes.some(m=>m.id===saved.mode)?saved.mode:'water';
let profile=findProfile(choice,driver), generation=0, installerReady=false, releaseReady=false;
const supported=window.isSecureContext && 'serial' in navigator;
const preview=new ToyPreview($('toy-canvas'));
function remember(){try{localStorage.setItem('tilt-toy-selection',JSON.stringify({choice,driver,mode:currentMode}));}catch{}}
function syncFlash(){ $('flash-button').disabled=!(supported&&installerReady&&releaseReady); }
function status(state,message){$('release-status').dataset.state=state;$('release-message').textContent=message;}
async function verifyRelease(p,revision){
  releaseReady=false;syncFlash();$('install').removeAttribute('manifest');$('download').hidden=true;$('binary-size').textContent='';status('loading','กำลังตรวจไฟล์เฟิร์มแวร์…');
  try{
    const manifestUrl=new URL(`./firmware/${p.id}.json`,import.meta.url);
    const response=await fetch(manifestUrl);if(!response.ok)throw Error('ไม่พบเฟิร์มแวร์ของจอนี้');
    const release=validateRelease(await response.json(),p);
    const binaryUrl=new URL(release.builds[0].parts[0].path,manifestUrl);
    const file=await fetch(binaryUrl);if(!file.ok)throw Error('ดาวน์โหลดไฟล์เฟิร์มแวร์ไม่ได้');
    const bytes=await file.arrayBuffer();if(bytes.byteLength!==release.size)throw Error('ขนาดไฟล์เฟิร์มแวร์ไม่ตรง');
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==release.sha256)throw Error('Checksum ของเฟิร์มแวร์ไม่ตรง');
    if(revision!==generation)return;
    $('install').setAttribute('manifest',manifestUrl.href);
    $('download').href=binaryUrl.href;$('download').download=`esp32-tilt-toy-${p.id}-v${release.version}.bin`;$('download').hidden=false;
    $('binary-size').textContent=`${(bytes.byteLength/1024).toFixed(0)} KB · SHA-256 ✓`;
    status('ready',`v${release.version} · ${p.driver} · ตรวจไฟล์แล้ว`);releaseReady=true;syncFlash();
  }catch(error){if(revision!==generation)return;status('error',error.message);releaseReady=false;syncFlash();}
}
function chooseDisplay(){
  profile=findProfile(choice,driver);remember();
  document.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.display===choice)));
  $('driver-wrap').hidden=choice!=='tft-240x240';$('driver').value=driver;$('profile-note').textContent=profile.note;
  $('preview-panel-label').textContent=`${profile.width} × ${profile.height} / ${profile.driver}`;
  $('device').dataset.shape=profile.shape;$('device').dataset.format=profile.width<profile.height?'portrait':profile.width>profile.height?'wide':'square';
  preview.setProfile(profile);$('wiring-driver').textContent=profile.driver;
  $('wiring-rows').replaceChildren(...wiringFor(profile).map(([from,to])=>{const row=document.createElement('tr');for(const value of[from,to]){const cell=document.createElement('td');cell.textContent=value;row.append(cell);}return row;}));
  $('panel-source').href=profile.source;verifyRelease(profile,++generation);
}
function chooseMode(id){currentMode=id;remember();preview.setMode(id);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===id)));const m=modes.find(m=>m.id===id);$('mode-readout').textContent=m.english.toUpperCase();$('mode-description').textContent=`${m.detail} · ภาพจำลองบนเว็บ`;}
for(const d of displayChoices){const b=document.createElement('button');b.className='display-card';b.dataset.display=d.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="mini-screen ${d.shape}" aria-hidden="true"></span><span><strong>${d.title}</strong><small>${d.subtitle}</small></span>`;b.addEventListener('click',()=>{choice=d.id;chooseDisplay();});$('displays').append(b);}
for(const m of modes){const b=document.createElement('button');b.className='mode-button';b.dataset.mode=m.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="glyph" aria-hidden="true">${m.glyph}</span><span>${m.name}</span><small>${m.english}</small>`;b.addEventListener('click',()=>chooseMode(m.id));$('modes').append(b);}
$('driver').addEventListener('change',()=>{driver=$('driver').value;chooseDisplay();});
$('tilt').addEventListener('input',()=>{const value=Number($('tilt').value);preview.roll=value;$('tilt-value').textContent=value+'°';$('roll-readout').textContent=(value>=0?'+':'')+value+'°';$('device').style.transform=`rotate(${value*.12}deg)`;});
$('pitch').addEventListener('input',()=>{const value=Number($('pitch').value);preview.pitch=value;$('pitch-readout').textContent=(value>=0?'+':'')+value+'°';});
$('shake').addEventListener('click',()=>preview.shake());
if(!supported){$('browser-message').textContent=window.isSecureContext?'แฟลชผ่าน Chrome / Edge บนคอมพิวเตอร์ · มือถือใช้ตั้งค่าโหมดหลังแฟลชได้':'ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เพื่อใช้ Web Serial';}
else{$('browser-message').textContent='Chrome / Edge บนคอมพิวเตอร์ · ตัวแฟลชตรวจชิปและแสดงความคืบหน้าจริง';}
chooseMode(currentMode);chooseDisplay();
import('./assets/installer.js').then(async()=>{await customElements.whenDefined('esp-web-install-button');installerReady=true;syncFlash();}).catch(()=>{$('browser-message').textContent='โหลดระบบแฟลชไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ';installerReady=false;syncFlash();});
