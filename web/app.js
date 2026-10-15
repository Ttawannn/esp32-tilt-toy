import { displayChoices, findProfile, findSensor, modes, sensors, validateRelease } from './profiles.js';
import { boards, findBoard, releasePath, validateFirmwareImage } from './boards.js';
import { isFlipMode, isLiquidMode } from './water-modes.js';
import { ToyPreview } from './preview.js';
import { MOODS } from './robot-eyes.js';
import { CORE, ideSettings, libraries, sketchName, sketchPath } from './arduino.js';
import { WiringGraph, previewModule } from './wiring.js';
import { modeIcons } from './icons.js';
import { THEMES, findTheme } from './themes.js';
import { getLanguage, initLanguage, localizedError, onLanguageChange, t } from './i18n.js';
initLanguage();
const $ = id => document.getElementById(id);
let saved={}; try { saved=JSON.parse(localStorage.getItem('tilt-toy-selection')||'{}'); } catch {}
let choice=displayChoices.some(d=>d.id===saved.choice)?saved.choice:'tft-240x240';
let orientation=saved.orientation==='landscape'?'landscape':'portrait';
let sensorId=findSensor(saved.sensor).id;
let board=findBoard(saved.board);
let currentMode=modes.some(m=>m.id===saved.mode)?saved.mode:'water';
let mood=MOODS.includes(saved.mood)?saved.mood:'auto';
let waterColor=saved.waterColor==='gradient'?'gradient':'classic';
let theme=findTheme(saved.theme).id;
let fill=Number.isFinite(saved.fill)?Math.min(90,Math.max(10,Math.round(saved.fill))):50;
let profile=findProfile(choice,orientation), generation=0, installerReady=false, releaseReady=false;
const supported=window.isSecureContext && 'serial' in navigator;
const preview=new ToyPreview($('toy-canvas'));preview.fill=fill;
const wiring=new WiringGraph($('wiring'));
function remember(){try{localStorage.setItem('tilt-toy-selection',JSON.stringify({board:board.id,choice,orientation,sensor:sensorId,mode:currentMode,mood,waterColor,theme,fill}));}catch{}}
// The preview shows the selected module at a size that fits the stage, with the canvas on its screen.
let module=null;
function showModule(){
  module=previewModule(profile);$('module-art').innerHTML=module.svg;
  const s=module.screen,screen=$('device-screen');
  Object.assign(screen.style,{left:s.left*100+'%',top:s.top*100+'%',width:s.width*100+'%',height:s.height*100+'%'});
  screen.toggleAttribute('data-round',s.round);fitModule();
}
function fitModule(){
  if(!module)return;const stage=$('device').parentElement,scale=Math.min(10,(stage.clientWidth-48)/module.width,(stage.clientHeight-72)/module.height);
  $('device').style.width=module.width*scale+'px';
}
addEventListener('resize',fitModule);
function syncFlash(){ $('flash-button').disabled=!(supported&&installerReady&&releaseReady); }
let releaseMessage={key:'release.loading',values:{}};
let browserMessageKey=!supported?(window.isSecureContext?'browser.desktop':'browser.secure'):'browser.ready';
function status(state,key,values={}){releaseMessage={key,values};$('release-status').dataset.state=state;$('release-message').textContent=t(key,values);}
function refreshCopy(){
  $('board-note').textContent=board.note;$('profile-note').textContent=profile.note;
  for(const mode of modes){const button=document.querySelector(`[data-mode="${mode.id}"]`);button.querySelector('.mode-name').textContent=mode.name;button.querySelector('small').hidden=getLanguage()==='en';}
  const mode=modes.find(m=>m.id===currentMode);
  $('mode-readout').textContent=mode.name.toUpperCase();
  updateArduino();
  for(const option of $('mood').options)option.textContent=t(`mood.${option.value}`);
  document.querySelectorAll('[data-theme-id]').forEach(b=>{const name=t(`theme.${b.dataset.themeId}`);b.title=name;b.setAttribute('aria-label',name);});
  $('mode-description').textContent=`${mode.detail} · ${t('preview.web')}`;
  $('release-message').textContent=t(releaseMessage.key,releaseMessage.values);
  $('browser-message').textContent=t(browserMessageKey);
}
async function verifyRelease(p,b,revision){
  releaseReady=false;syncFlash();$('install').removeAttribute('manifest');$('download').hidden=true;$('binary-size').textContent='';status('loading','release.loading');
  try{
    const manifestUrl=new URL(`./firmware/${releasePath(p,b)}.json`,import.meta.url);
    const response=await fetch(manifestUrl);if(!response.ok)throw localizedError('release.missing');
    const release=validateRelease(await response.json(),p,b);
    const binaryUrl=new URL(release.builds[0].parts[0].path,manifestUrl);
    const file=await fetch(binaryUrl);if(!file.ok)throw localizedError('release.downloadError');
    const bytes=await file.arrayBuffer();if(bytes.byteLength!==release.size)throw localizedError('release.sizeError');
    validateFirmwareImage(bytes,b);
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
    if(hash!==release.sha256)throw localizedError('release.hashError');
    if(revision!==generation)return;
    $('install').setAttribute('manifest',manifestUrl.href);
    $('download').href=binaryUrl.href;$('download').download=`esp32-tilt-toy-${b.id}-${p.id}-v${release.version}.bin`;$('download').hidden=false;
    $('binary-size').textContent=`${(bytes.byteLength/1024).toFixed(0)} KB · SHA-256 ✓`;
    status('ready','release.ready',{version:release.version,board:b.chipFamily,driver:p.driver});releaseReady=true;syncFlash();
  }catch(error){if(revision!==generation)return;status('error',error.translationKey||error.message);releaseReady=false;syncFlash();}
}
function chooseDisplay(){
  profile=findProfile(choice,orientation);remember();
  $('board').value=board.id;$('board-name').textContent=board.name;$('board-note').textContent=board.note;
  document.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.display===choice)));
  $('profile-note').textContent=profile.note;
  $('orientation-wrap').hidden=choice!=='tft-80x160';$('orientation').value=orientation;
  $('preview-panel-label').textContent=`${profile.width} × ${profile.height} / ${profile.driver}`;
  showModule();
  preview.setProfile(profile);wiring.setProfile(profile,sensorId,board);
  updateArduino();
  $('panel-source').href=profile.source;verifyRelease(profile,board,++generation);
}
// Arduino IDE: the generated sketch for the chosen board and display, and its Tools settings.
let sketchText=null,sketchFor='';
function updateArduino(){
  const path=sketchPath(board,profile);
  if(sketchFor!==path){sketchFor=path;sketchText=null;$('arduino-code').textContent='';$('arduino-status').textContent='';}
  $('arduino-download').href='./'+path;$('arduino-download').download=sketchName(board,profile)+'.ino';
  $('arduino-core-url').textContent=CORE.url;$('arduino-core').textContent=`${CORE.name} ${CORE.version}`;
  $('arduino-libraries').replaceChildren(...libraries(profile).map(([name,version])=>{const item=document.createElement('li');item.textContent=`${name} ${version}`;return item;}));
  $('arduino-settings').replaceChildren(...ideSettings(board).map(([key,value])=>{
    const row=document.createElement('tr'),label=document.createElement('td'),setting=document.createElement('td'),meaning=document.createElement('small');
    label.textContent=t(`arduino.setting.${key}`);setting.textContent=value;meaning.textContent=t(`arduino.meaning.${key}`);label.append(meaning);row.append(label,setting);return row;
  }));
}
async function loadSketch(){
  const path=sketchFor;
  if(sketchText===null){const response=await fetch('./'+path);if(!response.ok)throw Error(t('arduino.loadFailed'));const text=await response.text();if(path!==sketchFor)return null;sketchText=text;}
  return sketchText;
}
// The Clipboard API can be unavailable (permissions, embedded browsers); fall back to a selected textarea.
function copyText(text){
  const fallback=()=>{const area=document.createElement('textarea');area.value=text;area.setAttribute('readonly','');area.style.cssText='position:fixed;top:0;opacity:0';document.body.append(area);area.select();const copied=document.execCommand('copy');area.remove();if(!copied)throw Error('copy');};
  return navigator.clipboard?.writeText?navigator.clipboard.writeText(text).catch(fallback):Promise.resolve().then(fallback);
}
$('arduino-copy').addEventListener('click',async()=>{
  try{$('arduino-status').textContent=t('arduino.loading');const text=await loadSketch();if(text===null)return;await copyText(text);$('arduino-status').textContent=t('arduino.copied');}
  catch{$('arduino-status').textContent=t('arduino.copyFailed');}
});
// Fetch the sketch when the section opens, so Copy runs while the click still counts as a user action.
$('arduino-ide').addEventListener('toggle',event=>{if(event.target.open)loadSketch().catch(()=>{});});
document.querySelector('.arduino-view').addEventListener('toggle',async event=>{
  if(!event.target.open||$('arduino-code').textContent)return;
  try{$('arduino-code').textContent=t('arduino.loading');const text=await loadSketch();if(text!==null)$('arduino-code').textContent=text;}
  catch(error){$('arduino-code').textContent=error.message;}
});
function chooseMode(id){currentMode=id;remember();preview.setMode(id);document.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===id)));const m=modes.find(m=>m.id===id);$('mode-readout').textContent=m.name.toUpperCase();$('mode-description').textContent=`${m.detail} · ${t('preview.web')}`;$('fluid-controls').hidden=!isLiquidMode(id);$('jolt-controls').hidden=!['water-slosh','pixel-flow'].includes(id);$('fluid-grid').closest('label').hidden=id==='pixel-flow';$('shake').hidden=id==='pet';$('mood-controls').hidden=id!=='robot';$('water-color-controls').hidden=!isFlipMode(id);$('theme-controls').hidden=id==='pet';}
for(const d of displayChoices){const b=document.createElement('button');b.className='display-card';b.dataset.display=d.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="mini-screen ${d.shape}" aria-hidden="true"></span><span><strong>${d.title}</strong><small>${d.subtitle}</small></span>`;b.addEventListener('click',()=>{choice=d.id;chooseDisplay();});$('displays').append(b);}
for(const m of modes){const b=document.createElement('button');b.className='mode-button';b.dataset.mode=m.id;b.setAttribute('aria-pressed','false');b.innerHTML=`<span class="glyph" aria-hidden="true">${modeIcons[m.id]}</span><span class="mode-name">${m.name}</span><small>${m.english}</small>`;b.addEventListener('click',()=>chooseMode(m.id));$('modes').append(b);}
$('orientation').addEventListener('change',()=>{orientation=$('orientation').value;chooseDisplay();});
for(const b of boards){const option=document.createElement('option');option.value=b.id;option.textContent=b.name;$('board').append(option);}
$('board').addEventListener('change',()=>{board=findBoard($('board').value);chooseDisplay();});
for(const sensor of sensors){const option=document.createElement('option');option.value=sensor.id;option.textContent=sensor.module;$('sensor').append(option);}
$('sensor').value=sensorId;
$('sensor').addEventListener('change',()=>{sensorId=findSensor($('sensor').value).id;remember();wiring.setProfile(profile,sensorId,board);});
$('tilt').addEventListener('input',()=>{const value=Number($('tilt').value);preview.setTilt(value,preview.pitch);$('tilt-value').textContent=value+'°';$('roll-readout').textContent=(value>=0?'+':'')+value+'°';$('device').style.transform=`rotate(${value*.12}deg)`;});
$('pitch').addEventListener('input',()=>{const value=Number($('pitch').value);preview.setTilt(preview.roll,value);$('pitch-readout').textContent=(value>=0?'+':'')+value+'°';});
document.querySelectorAll('[data-jolt]').forEach(button=>button.addEventListener('click',()=>preview.jolt(...button.dataset.jolt.split(',').map(Number))));
$('shake').addEventListener('click',()=>preview.shake());
$('mood').addEventListener('change',()=>{preview.setMood($('mood').value);mood=$('mood').value;remember();});
function chooseWaterColor(look){waterColor=look;preview.setWaterColor(look);document.querySelectorAll('[data-water-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.waterColor===look)));}
document.querySelectorAll('[data-water-color]').forEach(b=>b.addEventListener('click',()=>{chooseWaterColor(b.dataset.waterColor);remember();}));
$('fill').value=fill;$('fill-value').textContent=fill+'%';
$('fill').addEventListener('input',()=>{fill=Number($('fill').value);$('fill-value').textContent=fill+'%';preview.setFill(fill);remember();});
$('fluid-grid').addEventListener('change',()=>{preview.showGrid=$('fluid-grid').checked;});
// Theme swatches: each shows the theme's water from surface to deep.
function chooseTheme(id){theme=id;preview.setTheme(id);document.querySelectorAll('[data-theme-id]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.themeId===id)));}
for(const th of THEMES){const b=document.createElement('button');b.type='button';b.className='theme-swatch';b.dataset.themeId=th.id;b.style.background=`linear-gradient(180deg,${th.shades[1]} 0 22%,${th.shades[3]} 22%,${th.shades[5]} 70%,${th.shades[6]})`;b.innerHTML=`<span class="swatch-eye" style="background:${th.eye}"></span>`;b.addEventListener('click',()=>{chooseTheme(th.id);remember();});$('themes').append(b);}
for(const id of MOODS){const option=document.createElement('option');option.value=id;$('mood').append(option);}
$('mood').value=mood;preview.setMood(mood);chooseWaterColor(waterColor);chooseTheme(theme);
chooseMode(currentMode);chooseDisplay();
refreshCopy();
onLanguageChange(()=>{refreshCopy();wiring.setLanguage();});
import('./assets/installer.js').then(async()=>{await customElements.whenDefined('esp-web-install-button');installerReady=true;syncFlash();}).catch(()=>{browserMessageKey='browser.failed';refreshCopy();installerReady=false;syncFlash();});
