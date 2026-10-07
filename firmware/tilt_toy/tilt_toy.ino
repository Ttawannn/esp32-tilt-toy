#include <Arduino.h>
#include <Wire.h>
#include <SPI.h>
#include <WiFi.h>
#include <WebServer.h>
#include <Preferences.h>
#include <Adafruit_GFX.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_ST7735.h>
#include <Adafruit_ST7789.h>
#include <Adafruit_GC9A01A.h>
#include <Adafruit_SSD1306.h>
#include "config.h"
#include "flip_fluid.h"

// One shared renderer; each release selects a concrete panel initializer.
#if DISPLAY_PROFILE == 0
Adafruit_ST7735 panel(&SPI, TOY_CS, TOY_DC, TOY_RST);
const char *profileName = "tft-80x160";
#elif DISPLAY_PROFILE == 1
Adafruit_ST7789 panel(&SPI, -1, TOY_DC, TOY_RST);
const char *profileName = "gmt130-240x240";
#elif DISPLAY_PROFILE == 2
Adafruit_ST7789 panel(&SPI, TOY_CS, TOY_DC, TOY_RST);
const char *profileName = "tft-240x240-st7789";
#elif DISPLAY_PROFILE == 3
Adafruit_GC9A01A panel(&SPI, TOY_DC, TOY_CS, TOY_RST);
const char *profileName = "tft-240x240-gc9a01";
#elif DISPLAY_PROFILE == 4
Adafruit_SSD1306 panel(128, 64, &Wire, -1);
const char *profileName = "oled-128x64";
#else
#error Unknown DISPLAY_PROFILE
#endif

const char *modeIds[] = {"water", "maze", "snow", "pong", "pet", "dice"};
Preferences preferences;
WebServer server(80);
Adafruit_MPU6050 imu;
Adafruit_GFX *scene = nullptr;
GFXcanvas16 *colorCanvas = nullptr;
GFXcanvas1 *monoCanvas = nullptr;
bool imuReady = false, apActive = false, closeRequested = false;
uint32_t apStarted = 0, closeAt = 0, lastShake = 0;
String apSsid;
int activeMode = 0, rotation = 0, spiMode = 3;
bool inverted = true;
float fillPercent = 50, sensitivity = 1.0f;
float accelX = 0, accelY = 9.81f, accelZ = 0, roll = 0, pitch = 0;
float gyroXBias = 0, gyroYBias = 0, gyroZBias = 0;
FlipFluid fluid;
float simulationMs = 0;
float ballX = 0, ballY = 0, ballVX = 0.1f, ballVY = -0.35f;
int score = 0, diceValue = 1;
struct Particle { float x, y, vx, vy; };
Particle flakes[36];
uint32_t lastFrame = 0, lastImu = 0, frameCount = 0, fpsAt = 0;
float fps = 0;

uint16_t ink(uint16_t value) {
#if DISPLAY_PROFILE == 4
  return value ? 1 : 0;
#else
  return value;
#endif
}
uint16_t rgb(uint8_t r, uint8_t g, uint8_t b) { return ink(((r & 248) << 8) | ((g & 252) << 3) | (b >> 3)); }
float limit(float value, float low, float high) { return fmaxf(low, fminf(high, value)); }
float randomUnit() { return (float)esp_random() / (float)UINT32_MAX; }

void resetMode() {
  ballX = -0.55f; ballY = 0.5f; ballVX = 0.3f; ballVY = -0.4f;
  score = 0;
  if (scene) {
    const float w = scene->width()-4, h = scene->height()-4;
    const float shortest = fminf(w,h);
    const int cells = shortest < 40 ? 6 : shortest < 100 ? 8 : 16;
    const int nx = 2 + fminf(30,roundf(cells*w/shortest)), ny = 2 + fminf(30,roundf(cells*h/shortest));
    fluid.configure(DISPLAY_PROFILE == 3 ? 20 : nx, DISPLAY_PROFILE == 3 ? 20 : ny, DISPLAY_PROFILE == 3, fillPercent);
  }
  for (auto &f : flakes) { f.x = randomUnit() * 1.8f - 0.9f; f.y = randomUnit() * 1.8f - 0.9f; f.vx = 0; f.vy = 0; }
}
void saveSettings() {
  preferences.putInt("mode", activeMode);
  preferences.putInt("rotation", rotation);
  preferences.putBool("invert", inverted);
  preferences.putInt("spiMode", spiMode);
  preferences.putFloat("fill", fillPercent);
  preferences.putFloat("sensitivity", sensitivity);
}
bool allocateScene() {
  delete colorCanvas; colorCanvas = nullptr;
  delete monoCanvas; monoCanvas = nullptr;
#if DISPLAY_PROFILE == 4
  monoCanvas = new GFXcanvas1(panel.width(), panel.height()); scene = monoCanvas;
  return monoCanvas && monoCanvas->getBuffer();
#else
  colorCanvas = new GFXcanvas16(panel.width(), panel.height()); scene = colorCanvas;
  return colorCanvas && colorCanvas->getBuffer();
#endif
}
bool beginPanel() {
#if DISPLAY_PROFILE == 4
  uint8_t address = 0;
  for (uint8_t candidate : {0x3C, 0x3D}) {
    Wire.beginTransmission(candidate);
    if (Wire.endTransmission() == 0) { address = candidate; break; }
  }
  if (!address || !panel.begin(SSD1306_SWITCHCAPVCC, address)) return false;
#elif DISPLAY_PROFILE == 0
  SPI.begin(TOY_SCK, -1, TOY_MOSI, TOY_CS);
  panel.initR(INITR_MINI160x80); panel.setSPISpeed(20000000);
#elif DISPLAY_PROFILE == 1 || DISPLAY_PROFILE == 2
  SPI.begin(TOY_SCK, -1, TOY_MOSI, DISPLAY_PROFILE == 1 ? -1 : TOY_CS);
  panel.init(240, 240, spiMode == 3 ? SPI_MODE3 : SPI_MODE0); panel.setSPISpeed(20000000);
#elif DISPLAY_PROFILE == 3
  SPI.begin(TOY_SCK, -1, TOY_MOSI, TOY_CS);
  panel.begin(20000000);
#endif
  panel.setRotation(rotation);
#if DISPLAY_PROFILE != 4
  panel.invertDisplay(inverted);
#else
  panel.invertDisplay(false);
#endif
  return allocateScene();
}
void present() {
#if DISPLAY_PROFILE == 4
  panel.clearDisplay();
  panel.drawBitmap(0, 0, monoCanvas->getBuffer(), scene->width(), scene->height(), SSD1306_WHITE);
  panel.display();
#else
  panel.drawRGBBitmap(0, 0, colorCanvas->getBuffer(), scene->width(), scene->height());
#endif
}
void textCenter(const char *text, int y, uint16_t color, int size = 1) {
  scene->setTextSize(size); scene->setTextColor(ink(color));
  scene->setCursor((scene->width() - strlen(text) * 6 * size) / 2, y);
  scene->print(text);
}
void shake() {
  lastShake = millis();
  if (activeMode == 0) fluid.impulse(sinf(roll*PI/180),cosf(roll*PI/180));
  diceValue = 1 + esp_random() % 6;
  for (auto &f : flakes) { f.vx = (randomUnit() - 0.5f) * 4; f.vy = (randomUnit() - 0.5f) * 4; }
}
void calibrateImu() {
  if (!imuReady) return;
  float x = 0, y = 0, z = 0;
  sensors_event_t a, g, t;
  for (int i = 0; i < 40; i++) { imu.getEvent(&a, &g, &t); x += g.gyro.x; y += g.gyro.y; z += g.gyro.z; delay(10); }
  gyroXBias = x / 40; gyroYBias = y / 40; gyroZBias = z / 40;
}
void readImu(float dt) {
  if (!imuReady) return;
  sensors_event_t a, g, t;
  if (!imu.getEvent(&a, &g, &t)) return;
  accelX += (a.acceleration.x - accelX) * 0.16f;
  accelY += (a.acceleration.y - accelY) * 0.16f;
  accelZ += (a.acceleration.z - accelZ) * 0.16f;
  // Remap the sensor's X/Y axes when the screen is rotated in software.
  float ax = accelX, ay = accelY;
  if (rotation == 1) { ax = -accelY; ay = accelX; }
  else if (rotation == 2) { ax = -accelX; ay = -accelY; }
  else if (rotation == 3) { ax = accelY; ay = -accelX; }
  roll = atan2f(ax, ay) * 180 / PI;
  pitch = atan2f(accelZ, sqrtf(ax * ax + ay * ay)) * 180 / PI;
  float spin = fabsf(g.gyro.x - gyroXBias) + fabsf(g.gyro.y - gyroYBias) + fabsf(g.gyro.z - gyroZBias);
  float magnitude = sqrtf(a.acceleration.x * a.acceleration.x + a.acceleration.y * a.acceleration.y + a.acceleration.z * a.acceleration.z);
  if ((fabsf(magnitude - 9.81f) > 7 || spin > 5) && millis() - lastShake > 800) shake();
}

void renderGame(float dt) {
  const int w = scene->width(), h = scene->height();
  const float cx = w * 0.5f, cy = h * 0.5f;
  // The whole panel is the play area: no frame, title or readouts on screen.
  const float radius = fminf(w, h) * 0.5f - 2;
  const uint16_t white = ink(0xFFFF), accent = rgb(65, 224, 184), blue = rgb(42, 140, 238);
  scene->fillScreen(0);
  float theta = roll * PI / 180;
  float gx = sinf(theta) * sensitivity, gy = cosf(theta) * sensitivity;
  if (!imuReady) { gx = 0; gy = 1; }
  if (activeMode == 0) {
    uint32_t started = micros();
    float planar = cosf(pitch*PI/180);
    fluid.advance(dt,gx*4*planar,gy*4*planar);
    simulationMs = (micros()-started)*.001f;
    const float left = DISPLAY_PROFILE == 3 ? 4 : 2, top = left;
    const float viewW = w-left*2, viewH = h-top*2;
    const float scaleX = viewW/((fluid.nx-2)*fluid.h), scaleY = viewH/((fluid.ny-2)*fluid.h);
    const int particleSize = fmaxf(1,fluid.radius*fminf(scaleX,scaleY)*.92f);
    for (int p=0;p<fluid.count;p++) {
      int x=left+(fluid.x[p]-fluid.h)*scaleX, y=top+(fluid.y[p]-fluid.h)*scaleY;
      const bool spray = fluid.density[fluid.cell(fluid.x[p],fluid.y[p])] < fluid.restDensity*.65f;
      const uint16_t color = spray ? rgb(137,227,255) : rgb(24,105,245);
      scene->fillCircle(x,y,particleSize,color);
    }
  } else if (activeMode == 1) {
    float oldX = ballX, oldY = ballY;
    ballVX = (ballVX + gx * dt * 2.5f) * powf(0.1f, dt);
    ballVY = (ballVY + -sinf(pitch * PI / 180) * sensitivity * dt * 2.5f) * powf(0.1f, dt);
    ballX = limit(ballX + ballVX * dt, -0.85f, 0.85f);
    ballY = limit(ballY + ballVY * dt, -0.85f, 0.85f);
    float m = sqrtf(ballX * ballX + ballY * ballY);
    if (m > 0.85f) { ballX *= 0.85f / m; ballY *= 0.85f / m; ballVX *= -0.3f; ballVY *= -0.3f; }
    const float walls[2][4] = {{-0.3f,-0.65f,-0.17f,0.3f},{0.17f,-0.2f,0.3f,0.65f}};
    for (auto &wall : walls) {
      if (ballX > wall[0] - 0.08f && ballX < wall[2] + 0.08f && ballY > wall[1] - 0.08f && ballY < wall[3] + 0.08f) { ballX = oldX; ballY = oldY; ballVX *= -0.2f; ballVY *= -0.2f; }
      scene->fillRect(cx + wall[0] * radius, cy + wall[1] * radius, (wall[2]-wall[0])*radius, (wall[3]-wall[1])*radius, white);
    }
    scene->drawCircle(cx + radius * 0.58f, cy - radius * 0.58f, fmaxf(3,radius*0.12f), accent);
    scene->fillCircle(cx + ballX * radius, cy + ballY * radius, fmaxf(2,radius*0.065f), blue);
    if (hypotf(ballX - 0.58f, ballY + 0.58f) < 0.14f) { score++; ballX = -0.55f; ballY = 0.5f; ballVX = ballVY = 0; }
  } else if (activeMode == 2) {
    for (auto &f : flakes) {
      f.vx += gx * dt * 0.7f; f.vy += gy * dt * 0.7f;
      f.vx *= powf(0.35f, dt); f.vy *= powf(0.35f, dt);
      f.x += f.vx * dt; f.y += f.vy * dt;
      float m = hypotf(f.x,f.y);
      if (m > 0.95f) { f.x *= 0.95f/m; f.y *= 0.95f/m; float dot=f.vx*f.x+f.vy*f.y; f.vx-=dot*f.x*1.5f; f.vy-=dot*f.y*1.5f; }
      scene->fillCircle(cx+f.x*radius,cy+f.y*radius,radius>40?2:1,white);
    }
  } else if (activeMode == 3) {
    ballX += ballVX * dt; ballY += ballVY * dt;
    float m = hypotf(ballX,ballY), paddle = limit(roll / 60,-1,1) * PI;
    if (m > 0.86f) {
      float hit = atan2f(ballX,-ballY), diff = atan2f(sinf(hit-paddle),cosf(hit-paddle));
      if (fabsf(diff) < 0.48f) { float dot=(ballVX*ballX+ballVY*ballY)/(m*m); ballVX-=2*dot*ballX; ballVY-=2*dot*ballY; ballX*=0.84f/m; ballY*=0.84f/m; score++; }
      else { ballX=ballY=0; ballVX=0.3f; ballVY=-0.4f; score=0; }
    }
    for(int i=-16;i<=16;i++){float a=paddle+i*0.025f;scene->fillCircle(cx+sinf(a)*radius*0.94f,cy-cosf(a)*radius*0.94f,fmaxf(1,radius*0.035f),accent);}
    scene->fillCircle(cx+ballX*radius,cy+ballY*radius,fmaxf(2,radius*0.055f),blue);
  } else if (activeMode == 4) {
    bool blink = (millis()%4500)>4320;
    for (int eye=-1;eye<=1;eye+=2) {
      int x=cx+eye*radius*0.43f, y=cy;
      if(blink) scene->drawFastHLine(x-radius*0.26f,y,radius*0.52f,white);
      else { scene->fillRoundRect(x-radius*0.28f,y-radius*0.4f,radius*0.56f,radius*0.8f,fmaxf(2,radius*0.22f),white); scene->fillCircle(x+gx*radius*0.09f,y-sinf(pitch*PI/180)*radius*0.12f,fmaxf(2,radius*0.14f),0); }
    }
  } else {
    int size=radius*1.4f, left=cx-size/2, top=cy-size/2;
    scene->drawRoundRect(left,top,size,size,fmaxf(2,size/8),white);
    const int positions[6][7]={{1,4},{2,0,8},{3,0,4,8},{4,0,2,6,8},{5,0,2,4,6,8},{6,0,2,3,5,6,8}};
    int value=millis()-lastShake<450?1+(millis()/60)%6:diceValue;
    for(int i=1;i<=positions[value-1][0];i++){int index=positions[value-1][i];scene->fillCircle(left+size*(0.25f+(index%3)*0.25f),top+size*(0.25f+(index/3)*0.25f),fmaxf(1,size*0.055f),accent);}
  }
  // Live values are shown on the phone page; the panel only says how to reach it.
  const int titleY = DISPLAY_PROFILE == 3 ? 22 : 2;
  const int footerY = DISPLAY_PROFILE == 3 ? h-30 : h-10;
  if (apActive) { textCenter(apSsid.c_str(), titleY, 0xFFFF); textCenter("192.168.4.1", footerY, 0xFFFF); }
  else if (!imuReady) textCenter("IMU NOT FOUND", footerY, 0xFFFF);
}

// Device-local controls are served by the ESP32's AP, independent of the hosted installer.
const char devicePage[] PROGMEM = R"HTML(<!doctype html><html lang="th"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Tilt Toy</title><style>body{font:16px system-ui;background:#111820;color:#edf4f6;max-width:560px;margin:auto;padding:24px}h1{font-size:26px;margin:0 0 4px}h2{font-size:15px;margin:28px 0 10px;color:#b3c1ca;font-weight:600;display:flex;justify-content:space-between;align-items:center}label{display:block;margin:22px 0}.row{display:flex;justify-content:space-between}output{font-variant-numeric:tabular-nums;color:#bef365}select,input,button{font:inherit;width:100%;box-sizing:border-box;padding:13px;border:1px solid #394652;border-radius:10px;background:#1d2833;color:inherit}input[type=range]{padding:0;margin-top:12px;accent-color:#bef365}button{background:#bef365;color:#162109;margin:10px 0;cursor:pointer}[hidden]{display:none!important}small{color:#b3c1ca}#status{min-height:24px}.live{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.stat{background:#1d2833;border:1px solid #394652;border-radius:10px;padding:10px 12px;min-width:0}.stat span{display:block;font-size:12px;color:#b3c1ca}.stat b{display:block;font-size:20px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.wide{grid-column:1/-1}#link{font-size:12px;font-weight:400}#link:before{content:'';display:inline-block;width:8px;height:8px;border-radius:50%;background:#6b7a86;margin-right:6px}#link[data-on]:before{background:#bef365}@media(max-width:360px){.live{grid-template-columns:repeat(2,1fr)}}</style><h1>esp32-tilt-toy</h1><small id="hardware"></small><h2>ค่าบนเครื่อง <span id="link">กำลังเชื่อมต่อ…</span></h2><div class="live" aria-live="off"><div class="stat wide"><span>โหมด</span><b id="vMode">–</b></div><div class="stat"><span>Roll</span><b id="vRoll">–</b></div><div class="stat"><span>Pitch</span><b id="vPitch">–</b></div><div class="stat"><span>FPS</span><b id="vFps">–</b></div><div class="stat" id="sScore"><span>คะแนน</span><b id="vScore">–</b></div><div class="stat" id="sSim"><span>Solver</span><b id="vSim">–</b></div><div class="stat" id="sParticles"><span>อนุภาค</span><b id="vParticles">–</b></div><div class="stat"><span>Heap ว่าง</span><b id="vHeap">–</b></div></div><h2>ตั้งค่า</h2><label>โหมด<select id="mode"><option value="water">น้ำในลูกแก้ว</option><option value="maze">เขาวงกต</option><option value="snow">ลูกแก้วหิมะ</option><option value="pong">Pong</option><option value="pet">ตาการ์ตูน</option><option value="dice">ลูกเต๋า</option></select></label><label><span class="row">ระดับน้ำ <output id="fillOut"></output></span><input id="fill" type="range" min="10" max="90"></label><label><span class="row">ความไว <output id="sensOut"></output></span><input id="sensitivity" type="range" min="0.4" max="2" step="0.1"></label><label>หมุนภาพ<select id="rotation"><option value="0">0°</option><option value="1">90°</option><option value="2">180°</option><option value="3">270°</option></select></label><label id="invertWrap">สีจอ TFT<select id="invert"><option value="1">เปิด inversion</option><option value="0">ปิด inversion</option></select></label><label id="spiWrap">SPI ของ ST7789<select id="spiMode"><option value="3">Mode 3</option><option value="0">Mode 0</option></select></label><button id="save">บันทึกและใช้โหมดนี้</button><button id="shake">เขย่า / ทอยลูกเต๋า</button><button id="calibrate">คาลิเบรต gyro (วางเครื่องนิ่ง)</button><button id="close">ปิด Wi-Fi แล้วเล่นต่อ</button><p id="status" role="status"></p><small>กดปุ่มบนเครื่องสั้น ๆ เพื่อเปลี่ยนโหมด กดค้าง 2 วินาทีเพื่อเปิด/ปิด Wi-Fi</small><script>
const $=id=>document.getElementById(id),ids=['mode','fill','sensitivity','rotation','invert','spiMode'],status=$('status');const names={water:'น้ำในลูกแก้ว',maze:'เขาวงกต',snow:'ลูกแก้วหิมะ',pong:'Pong',pet:'ตาการ์ตูน',dice:'ลูกเต๋า'};let stopped=false,busy=false;const deg=v=>(v>0?'+':'')+v.toFixed(0)+'°';function showValues(){$('fillOut').value=$('fill').value+'%';$('sensOut').value=Number($('sensitivity').value).toFixed(1)+'×';}$('fill').oninput=$('sensitivity').oninput=showValues;async function post(path,data={}){const response=await fetch(path,{method:'POST',body:new URLSearchParams(data)});if(!response.ok)throw Error(await response.text());return response;}async function read(){const r=await fetch('/api/status',{cache:'no-store',signal:AbortSignal.timeout?AbortSignal.timeout(2500):undefined});if(!r.ok)throw Error('อ่านข้อมูลเครื่องไม่ได้');return r.json();}function live(s){$('vMode').textContent=names[s.mode]||s.mode;$('vRoll').textContent=s.imu?deg(s.roll):'–';$('vPitch').textContent=s.imu?deg(s.pitch):'–';$('vFps').textContent=s.fps.toFixed(1);$('vScore').textContent=s.score;$('vSim').textContent=s.simMs.toFixed(1)+' ms';$('vParticles').textContent=s.particles;$('vHeap').textContent=Math.round(s.freeHeap/1024)+' KB';$('sScore').hidden=s.mode!=='maze'&&s.mode!=='pong';$('sSim').hidden=$('sParticles').hidden=s.mode!=='water';$('link').dataset.on='';$('link').textContent='อัปเดตสด';}function offline(text){delete $('link').dataset.on;$('link').textContent=text;}async function load(){const s=await read();ids.forEach(id=>$(id).value=String(id==='invert'?Number(s[id]):s[id]));$('hardware').textContent=s.profile+' · v'+s.version+(s.imu?' · MPU6050':' · ไม่พบ MPU6050');$('invertWrap').hidden=s.profile==='oled-128x64';$('spiWrap').hidden=!s.profile.includes('st7789')&&!s.profile.includes('gmt130');showValues();live(s);}setInterval(async()=>{if(stopped||busy||document.hidden)return;busy=true;try{live(await read());}catch{offline('ขาดการเชื่อมต่อ');}busy=false;},1000);$('save').onclick=async()=>{try{const data={};ids.forEach(id=>data[id]=$(id).value);await post('/api/config',data);status.textContent='บันทึกแล้ว';}catch(e){status.textContent=e.message;}};for(const [id,path,message]of[['shake','/api/shake','ทำแอ็กชันแล้ว'],['calibrate','/api/calibrate','คาลิเบรตแล้ว'],['close','/api/close','ปิด Wi-Fi แล้ว กลับไปเล่นบนเครื่องได้เลย']])$(id).onclick=async()=>{try{await post(path);status.textContent=message;if(id==='close'){stopped=true;offline('ปิด Wi-Fi แล้ว');}}catch(e){status.textContent=e.message;}};load().catch(e=>{status.textContent=e.message;offline('ขาดการเชื่อมต่อ');});
</script></html>)HTML";

void setupRoutes() {
  server.on("/license",HTTP_GET,[](){server.send(200,"text/plain; charset=utf-8",fluidLicense);});
  server.on("/", HTTP_GET, [](){server.send_P(200,"text/html; charset=utf-8",devicePage);});
  server.on("/api/status", HTTP_GET, [](){
    char json[512]; snprintf(json,sizeof(json),"{\"version\":\"%s\",\"profile\":\"%s\",\"mode\":\"%s\",\"rotation\":%d,\"invert\":%s,\"spiMode\":%d,\"fill\":%.1f,\"sensitivity\":%.2f,\"imu\":%s,\"roll\":%.1f,\"pitch\":%.1f,\"fps\":%.1f,\"simMs\":%.2f,\"score\":%d,\"particles\":%d,\"freeHeap\":%u}",TOY_VERSION,profileName,modeIds[activeMode],rotation,inverted?"true":"false",spiMode,fillPercent,sensitivity,imuReady?"true":"false",roll,pitch,fps,simulationMs,score,fluid.count,ESP.getFreeHeap());
    server.send(200,"application/json",json);
  });
  server.on("/api/config", HTTP_POST, [](){
    int nextMode=activeMode;
    if(server.hasArg("mode")){ nextMode=-1; for(int i=0;i<6;i++)if(server.arg("mode")==modeIds[i])nextMode=i; if(nextMode<0){server.send(400,"text/plain","Unknown mode");return;} }
    int nextRotation=rotation,nextSpi=spiMode;
    if(server.hasArg("rotation")){nextRotation=server.arg("rotation").toInt();if(nextRotation<0||nextRotation>3){server.send(400,"text/plain","Invalid rotation");return;}}
    if(server.hasArg("spiMode")){nextSpi=server.arg("spiMode").toInt();if(nextSpi!=0&&nextSpi!=3){server.send(400,"text/plain","Invalid SPI mode");return;}}
    bool nextInvert=server.hasArg("invert")?server.arg("invert")=="1":inverted;
    fillPercent=server.hasArg("fill")?limit(server.arg("fill").toFloat(),10,90):fillPercent;
    sensitivity=server.hasArg("sensitivity")?limit(server.arg("sensitivity").toFloat(),0.4f,2):sensitivity;
    bool rebuild=nextRotation!=rotation||nextSpi!=spiMode;
    activeMode=nextMode; rotation=nextRotation; spiMode=nextSpi; inverted=nextInvert;
    if(rebuild&&!beginPanel()){server.send(500,"text/plain","Display allocation failed");return;}
#if DISPLAY_PROFILE != 4
    panel.invertDisplay(inverted);
#endif
    resetMode();saveSettings();server.send(200,"application/json","{\"ok\":true}");
  });
  server.on("/api/shake",HTTP_POST,[](){shake();server.send(200,"application/json","{\"ok\":true}");});
  server.on("/api/calibrate",HTTP_POST,[](){calibrateImu();server.send(200,"application/json","{\"ok\":true}");});
  server.on("/api/close",HTTP_POST,[](){closeRequested=true;closeAt=millis()+300;server.send(200,"application/json","{\"ok\":true}");});
  server.onNotFound([](){server.send(404,"text/plain","Not found");});
}
void closeAp(){server.stop();WiFi.softAPdisconnect(true);WiFi.mode(WIFI_OFF);apActive=false;closeRequested=false;Serial.println("Wi-Fi off");}
void openAp(){WiFi.mode(WIFI_AP);if(WiFi.softAP(apSsid.c_str(),"tilttoy32")){apActive=true;apStarted=millis();server.begin();Serial.printf("Wi-Fi %s password tilttoy32 http://192.168.4.1\n",apSsid.c_str());}}

void setup(){
  Serial.begin(115200); // Never wait for USB: the toy must boot without a computer.
  pinMode(TOY_BUTTON,INPUT_PULLUP);
  Wire.begin(TOY_SDA,TOY_SCL);Wire.setClock(400000);Wire.setTimeOut(40);
  preferences.begin("tilt-toy",false);
  activeMode=constrain(preferences.getInt("mode",0),0,5);
  rotation=constrain(preferences.getInt("rotation",0),0,3);
  inverted=preferences.getBool("invert",DISPLAY_PROFILE!=3);
  spiMode=preferences.getInt("spiMode",DISPLAY_PROFILE==1?3:0);
  fillPercent=limit(preferences.getFloat("fill",50),10,90);
  sensitivity=limit(preferences.getFloat("sensitivity",1),0.4f,2);
  if(!beginPanel()){Serial.println("Display init / framebuffer failed");while(true)delay(1000);}
  imuReady=imu.begin(0x68,&Wire)||imu.begin(0x69,&Wire);
  if(imuReady){imu.setAccelerometerRange(MPU6050_RANGE_8_G);imu.setGyroRange(MPU6050_RANGE_500_DEG);imu.setFilterBandwidth(MPU6050_BAND_21_HZ);calibrateImu();}
  resetMode();setupRoutes();
  char name[32];snprintf(name,sizeof(name),"TiltToy-%04X",(unsigned)(ESP.getEfuseMac()&0xFFFF));apSsid=name;
  WiFi.mode(WIFI_OFF); // AP starts only after holding the user button.
  Serial.printf("ESP32 Tilt Toy %s | %s | IMU %s\n",TOY_VERSION,profileName,imuReady?"ready":"missing");
}
void loop(){
  uint32_t now=millis();
  static bool pressed=false,longHandled=false;
  static uint32_t pressedAt=0,lastRelease=0;
  bool down=digitalRead(TOY_BUTTON)==LOW;
  if(down&&!pressed&&now-lastRelease>40){pressed=true;pressedAt=now;longHandled=false;}
  if(down&&pressed&&!longHandled&&now-pressedAt>=2000){longHandled=true;if(apActive)closeAp();else openAp();}
  if(!down&&pressed){if(!longHandled&&now-pressedAt>=40){activeMode=(activeMode+1)%6;resetMode();saveSettings();}pressed=false;lastRelease=now;}
  if(apActive){server.handleClient();if((closeRequested&&(int32_t)(now-closeAt)>=0)||now-apStarted>180000)closeAp();}
  if(now-lastImu>=10){float dt=limit((now-lastImu)*0.001f,0.001f,0.08f);lastImu=now;readImu(dt);}
  if(now-lastFrame>=50){float dt=limit((now-lastFrame)*0.001f,0.01f,0.1f);lastFrame=now;renderGame(dt);present();frameCount++;}
  if(now-fpsAt>=1000){fps=frameCount*1000.0f/(now-fpsAt);frameCount=0;fpsAt=now;}
  delay(1);
}
