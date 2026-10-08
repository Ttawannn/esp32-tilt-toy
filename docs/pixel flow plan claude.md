# Pixel Flow — แผนงานโหมดน้ำพิกเซล

ผู้เขียน: Claude · 8 ตุลาคม 2026 · เริ่มจาก branch `main` (`da4548a`, firmware v0.1.3) · ปล่อยเป็น v0.1.4

ต้นแบบที่อยากได้: https://www.youtube.com/shorts/LDzY95ezArg

---

## สรุปในหนึ่งย่อหน้า

เพิ่มโหมดที่ 9 ชื่อ `pixel-flow` ที่น้ำแต่ละเม็ดคือช่องสี่เหลี่ยมหนึ่งช่องบนจอ เม็ดมีความเร็วของตัวเอง ตกตามแรงโน้มถ่วงจาก IMU แล้วหาทางไหลไปช่องข้าง ๆ ด้วยเลขจำนวนเต็มล้วน วาดเป็นตาราง dot-matrix สีฟ้าไล่เฉด และส่งไปที่จอเฉพาะช่องที่เปลี่ยนเพื่อให้ได้ราว 30 fps โหมดน้ำ FLIP สามโหมดเดิมยังอยู่ครบและไม่ถูกแก้

---

## ภาพเป้าหมาย (จากการดูวิดีโอ)

- จอสี่เหลี่ยมมุมโค้ง พื้นดำ น้ำสีฟ้า cyan เป็นเม็ดสี่เหลี่ยมเล็กเรียงเป็นตาราง มีเส้นดำบาง ๆ คั่นทุกเม็ด
- ด้านกว้างจอมีราว 40 เม็ด น้ำประมาณครึ่งจอ
- เอียงเร็วแล้วน้ำกองเป็นทางลาดชันพาดขึ้นผนัง ก่อนค่อย ๆ ไหลลงมาราบ
- เขย่าแล้วมีเม็ดเดี่ยวหลุดลอยขึ้นมา มีโพรงอากาศในน้ำชั่วครู่
- ขอบบนของน้ำสว่างกว่าตัวน้ำ ตัวน้ำมีความสว่างแต่ละเม็ดไม่เท่ากันนิดหน่อย
- ภาพเคลื่อนไหวต่อเนื่อง ไม่กระตุก

สิ่งที่ `main` มีอยู่แล้วและใช้ต่อได้:

| ของที่มีใน `main` | ใช้ทำอะไรในโหมดใหม่ |
| --- | --- |
| `motion_state.h` + FIFO ของ BMI160/MPU6050 | ได้เวกเตอร์แรงโน้มถ่วงและแรงกระตุกต่อเนื่อง ไม่ขาดช่วงระหว่างส่งภาพ |
| `waterForces()` ใน `toy_modes.h` / `web/water-modes.js` | แปลงแรงโน้มถ่วง + แรงกระตุกเป็นแรงบนระนาบจอ (ใช้แบบ `water-inertia`) |
| กฎหาผิวน้ำใน `FlipFluid::rasterize` | ใช้หลักเดียวกันระบุเม็ดผิวน้ำ (มีช่องว่างอยู่ฝั่งตรงข้ามแรง) |
| ระบบ build 18 firmware, manifest, test runner | เพิ่มโหมดแล้ว rebuild ตามขั้นตอนเดิม |

---

## Phase 0 — เตรียม branch

1. จัดการงานค้างใน `codex_wire` ก่อน: ไฟล์ที่แก้ค้าง (`flip_fluid.h`, `tilt_toy.ino`, `web/fluid.js`, `web/preview.js`) ตรงกับ commit `63808ab` ใน `main` แล้ว จึงทิ้งได้หลังยืนยัน ส่วน `tests/fluid.test.mjs` ที่ยังไม่ได้ track ต่างจากของ `main` ให้เทียบก่อนทิ้ง
2. ตัดสินว่า commit `40b8cdb` (แก้จุดต่อสายในผังวงจร) จะ cherry-pick เข้า `main` หรือไม่ — ไม่เกี่ยวกับโหมดนี้ แต่ควรเคลียร์ก่อนแตก branch
3. `git switch main` แล้ว `git switch -c feature/pixel-flow`
4. รัน `npm ci && npm test` ให้ผ่านบน `main` เป็นจุดตั้งต้น

**เสร็จเมื่อ:** อยู่บน `feature/pixel-flow` working tree สะอาด test เดิมผ่านทั้งหมด

---

## Phase 1 — Engine (`pixel_flow.h` และ `web/pixel-flow.js`)

เขียนสองไฟล์คู่กันบรรทัดต่อบรรทัด ห้ามใช้ `float` ในลูป step เพื่อให้ผลตรงกันทุกบิต และเร็วบน ESP32-C3/C6 ที่ไม่มี FPU

### 1.1 หน่วยและค่าคงที่

- ตำแหน่ง/ความเร็วเป็น fixed-point Q8: `256` = 1 เม็ด
- 1 step = 1/30 วินาที
- RNG: xorshift32 หนึ่งตัวต่อ engine, seed ได้จาก `reset(fill, seed)` (บนเครื่องใช้ `esp_random()` เป็น seed, ใน test ใช้ค่าคงที่)

| ค่า | เริ่มต้น | ความหมาย |
| --- | --- | --- |
| `GRAVITY_Q8` | 72 | ความเร่งเมื่อจอตั้งตรง (≈ 0.28 เม็ด/step²) |
| `MAX_SPEED_Q8` | 768 | เพดานความเร็ว 3 เม็ด/step |
| `DAMP_SHIFT` | 6 | หน่วงความเร็ว `v -= v >> 6` ทุก step |
| `SLIDE` | 3 | ระยะไหลข้างสูงสุดเมื่อตกต่อไม่ได้ |
| `FRICTION` | 7/8 | คูณความเร็วแนวขนานผนังเมื่อชน |
| `COHESION_SHIFT` | 3 | ดึงความเร็วเข้าหาค่าเฉลี่ยเพื่อนบ้าน (0 = ปิด) |

ค่าทั้งหมดอยู่ใน struct `PixelFlowTuning` เพื่อจูนจาก test และ preview ได้โดยไม่แก้โค้ด

### 1.2 ข้อมูลในหน่วยความจำ (static, ไม่มี `new`)

```
MaxCols = 64, MaxRows = 64, MaxCells = 2048, MaxDrops = 1900

int16_t  cellOf[MaxCells]     // -2 ผนัง, -1 ว่าง, >=0 index ของเม็ด
uint8_t  col[MaxDrops], row[MaxDrops]
uint8_t  subX[MaxDrops], subY[MaxDrops]   // เศษตำแหน่ง Q8
int16_t  velX[MaxDrops], velY[MaxDrops]
int16_t  order[MaxDrops]      // ลำดับประมวลผลของ step นี้
uint16_t bucket[MaxCols+MaxRows+1]
uint8_t  look[MaxCells]       // เฉดที่ต้องวาด
uint8_t  onScreen[MaxCells]   // เฉดที่วาดไปแล้ว
```

ราว 26 KB เท่ากับ FLIP โดยประมาณ ถ้าวัดแล้ว heap ตึง (Phase 7) ให้รวม storage กับ `FlipFluid` เป็น `union` เพราะทำงานทีละโหมด

### 1.3 Container

`configure(cols, rows, shape)` โดย `shape` เป็น `Rect`, `Rounded` หรือ `Circle`

- `Rect`: ทุกช่องใช้ได้ (OLED)
- `Rounded`: ตัดมุมด้วยรัศมี `max(2, min(cols,rows)/12)` เม็ด ให้ขอบน้ำโค้งตามกรอบจอเหมือนในวิดีโอ (TFT เหลี่ยมทุกรุ่น)
- `Circle`: ช่องที่จุดกลางอยู่นอกวงกลมใน = ผนัง (GC9A01)

ผนังเขียนเป็น `-2` ลง `cellOf` ครั้งเดียว ไม่ต้องเช็กรูปทรงในลูป

### 1.4 เติมน้ำ

`reset(fill%, gx, gy, seed)` นับช่องที่ใช้ได้ คูณ `fill` (10–90) ได้จำนวนเม็ด แล้วเรียงช่องตามระยะตามทิศแรงโน้มถ่วง (ช่องที่ "ต่ำ" ที่สุดก่อน) เติมเม็ดจนครบ ความเร็วเริ่มเป็น 0 — น้ำจึงเริ่มนิ่งที่ก้นภาชนะตามท่าที่ถือเครื่องอยู่

### 1.5 หนึ่ง step

```
step(ax_q8, ay_q8):
  1. เรียงลำดับ: คำนวณ depth = col*ax + row*ay ของทุกเม็ด
     แล้ว counting sort ลง order[] จากลึกสุด (ใกล้พื้นตามแรง) ไปตื้นสุด
     ค่าเท่ากันให้สลับทิศซ้าย/ขวาทุก step  -> น้ำไม่เอียงไปข้างเดียว
  2. ทุกเม็ดตาม order:
     a. vel += (ax, ay);  vel -= vel >> DAMP_SHIFT;  จำกัดที่ MAX_SPEED
     b. sub += vel  -> ได้จำนวนเม็ดที่ต้องขยับ n (0..3)
     c. เดิน n ครั้ง ทีละช่อง ตามทิศหลัก dir (หนึ่งใน 8 ทิศ จากสัดส่วน velX:velY
        เทียบด้วยจำนวนเต็ม ไม่ใช้ atan2)
        - ช่อง dir ว่าง           -> ไป
        - ไม่ว่าง: ลอง dir±45°    (ข้างที่ใกล้แรงโน้มถ่วงก่อน, เสมอกันใช้ RNG)
        - ไม่ว่าง: ลอง dir±90°    ไหลข้างได้สูงสุด SLIDE ช่อง
        - ไปไม่ได้เลย             -> ชน: ตัดความเร็วฝั่งที่ชนเป็น 0
                                     ความเร็วที่เหลือคูณ FRICTION แล้วหยุดเดิน
  3. Cohesion (ถ้าเปิด): ทุก 2 step แต่ละเม็ด vel += (avg4 - vel) >> COHESION_SHIFT
     avg4 = เฉลี่ยความเร็วเพื่อนบ้านที่ติดกัน 4 ทิศ   -> ไหลเป็นก้อน ไม่เหมือนทราย
```

ทำไมเรียงตามความลึกแทนการกวาดทีละแถว: แรงโน้มถ่วงเอียงได้ทุกมุม ถ้ากวาดตามแกนจะมีบางมุม (เช่น 30°) ที่เม็ดบนขยับก่อนเม็ดล่างแล้วติดกันเอง การเรียงตาม `dot(position, gravity)` ใช้ได้ทุกมุม ต้นทุน O(N) เพราะค่า depth มีไม่เกิน `cols+rows` ค่า

### 1.6 Action

- `shake(strength)`: เม็ดที่อยู่ไม่เกิน 4 ช่องจากผิวได้ความเร็วสวนแรงโน้มถ่วง 1.5–3 เม็ด/step บวกส่วนข้างแบบสุ่ม
- `push(x, y, vx, vy, radius)`: preview ใช้ลากนิ้วกวนน้ำ
- `countDrops()`: ส่งจำนวนเม็ดไปที่ `/api/status`

### 1.7 คำนวณเฉดสำหรับวาด

`shade()` ใส่ค่าใน `look[]` ไม่แตะจอ:

| ค่า | เงื่อนไข |
| --- | --- |
| 0 | ว่างหรือผนัง |
| 1 | เม็ดผิวน้ำ — สว่างที่สุด |
| 2 | เม็ดที่เร็วเกิน 1 เม็ด/step — ฟอง |
| 3–6 | เนื้อน้ำ ไล่จากใกล้ผิวไปลึก แล้วสุ่ม ±1 เฉดด้วย `hash(col,row,frame>>3)` ให้เกิดประกายที่เปลี่ยนช้า ๆ |

**เสร็จเมื่อ:** engine คอมไพล์ได้ทั้ง host compiler และ Arduino ESP32 core, JS import ได้ใน Node และผ่าน test ใน Phase 2

---

## Phase 2 — Test ก่อนต่อเข้าเครื่อง

ไฟล์ `tests/pixel-flow.test.mjs`

| Test | ตรวจอะไร |
| --- | --- |
| mass | 1 000 step แรงสุ่ม + เขย่า 5 ครั้ง: จำนวนเม็ดคงที่, `cellOf` กับ `col/row` ชี้กันถูกทุกเม็ด, ไม่มีเม็ดในช่องผนัง |
| level | แรงลงล่าง 300 step: ความสูงแต่ละคอลัมน์ต่างกัน ≤ 1, แถวล่างสุดเต็ม, แถวบนสุดของน้ำได้เฉด 1 |
| any-angle | แรง 0°, 30°, 45°, 60°, 90°, 135°: หลัง 300 step ผิวน้ำตั้งฉากกับแรง (ค่า depth ของเม็ดผิวกระจาย ≤ 2) |
| momentum | สลับแรงจากลงล่างเป็นไปขวาทันที: ภายใน 12 step มีเม็ดบนผนังขวาสูงกว่าระดับนิ่ง แล้วกลับมาราบใน 240 step |
| splash | หลัง `shake()` มีเม็ดที่ไม่แตะเพื่อนบ้าน ≥ 5 เม็ด และไม่มีเหลือใน 150 step |
| fill | fill 10/50/90 ได้สัดส่วนเม็ดต่อช่องใช้ได้คลาด ≤ 1% |
| shapes | ทุกโปรไฟล์ใน `web/profiles.js` ได้กริด ≤ `MaxCells` และ `MaxDrops` พอสำหรับ fill 90% |
| determinism | seed เดียวกัน + แรงชุดเดียวกัน → `cellOf` เหมือนกันทุกครั้ง |

C++ parity `tests/motion/pixel_flow_parity.cpp` (สร้างแบบเดียวกับ `state_parity.cpp`): รัน 600 step ด้วย seed และลำดับแรงที่ JS สร้างไว้ แล้วพิมพ์ `cellOf` ออกมาให้ test JS เทียบ **ต้องตรงทุกช่อง**

**เสร็จเมื่อ:** `npm test` ผ่านทั้งหมด รวม test เดิมของ `main`

---

## Phase 3 — ต่อเข้าระบบโหมดของ firmware

### `firmware/tilt_toy/toy_modes.h`

- `enum ToyMode { …, WaterSwirl, PixelFlow, ModeCount }` → `PixelFlow = 8` (index เก่าใน NVS ไม่ขยับ)
- `modeIds[PixelFlow] = "pixel-flow"`
- ลำดับปุ่ม BOOT: `Water → WaterInertia → WaterSwirl → PixelFlow → Maze → Snow → Pong → Pet → Dice`
- `isWaterMode()` **ไม่** รวม `PixelFlow` (ฟังก์ชันนี้เป็นตัวเลือกให้รัน FLIP)
- เพิ่ม `usesFill(mode)` = `isWaterMode(mode) || mode == PixelFlow`
- เพิ่ม `pixelForces(gravity, linear, sensitivity)` คืนค่า Q8 โดยเรียก `waterForces(WaterInertia, …)` แล้วสเกลด้วย `GRAVITY_Q8 / 4`

### `firmware/tilt_toy/tilt_toy.ino`

1. `#include "pixel_flow.h"` และ `PixelFlow drops;`
2. `resetMode()`: ถ้าเป็น `PixelFlow` คำนวณ `pitch` จากด้านสั้นของจอ (ตาราง Phase 4) แล้ว `drops.configure(...)` + `drops.reset(fillPercent, …, esp_random())`
3. `renderGame()`: branch ใหม่เรียก `drops.step()` ผ่าน accumulator 1/30 s (ไม่เกิน 2 step ต่อเฟรม) จับเวลาใส่ `simulationMs`
4. `shake()`: ถ้าโหมดนี้เรียก `drops.shake()` และเปิดให้ตรวจการเขย่าจาก IMU ทำงานในโหมดนี้
5. `/api/status`: `particles` คืน `drops.countDrops()` เมื่ออยู่ในโหมดนี้
6. `/api/config`: รับ `mode=pixel-flow` (ใช้ `modeIds` อยู่แล้ว ตรวจให้แน่ใจว่า loop ถึง `ModeCount`)
7. หน้าตั้งค่าบนมือถือ: เพิ่ม `<option value="pixel-flow">น้ำพิกเซล</option>` ต่อจาก "น้ำวน" และให้ slider ระดับน้ำแสดงเมื่อ `usesFill`

### version

`TOY_VERSION` ใน `config.h`, `package.json`, `VERSION` ใน `web/profiles.js` → `0.1.4`

**เสร็จเมื่อ:** firmware ทุกโปรไฟล์คอมไพล์ผ่าน, กด BOOT วนครบ 9 โหมด, `tests/device.test.mjs` ตรวจ option ใหม่ผ่าน

---

## Phase 4 — วาดและส่งภาพให้ลื่น

### 4.1 ขนาดเม็ดต่อจอ

| จอ | ระยะห่างเม็ด (pitch) | เม็ดจริง | ตาราง | รูปทรง |
| --- | --- | --- | --- | --- |
| ST7789 / GMT130 240×240 | 6 px | 5 px | 40×40 | Rounded |
| GC9A01 240×240 | 6 px | 5 px | 40×40 | Circle |
| ST7735S 80×160 | 4 px | 3 px | 20×40 | Rounded |
| ST7735S 160×80 | 4 px | 3 px | 40×20 | Rounded |
| SSD1306 128×64 | 2 px | 1 px | 64×32 | Rect |

ตารางชิดกลางจอ เศษที่เหลือเป็นขอบดำ

### 4.2 สี

พาเลต RGB565 7 ช่องคำนวณครั้งเดียวด้วย `rgb()`:

| เฉด | สี |
| --- | --- |
| 1 ผิว | `#8EE8FF` |
| 2 ฟอง | `#C8F4FF` |
| 3–6 เนื้อน้ำ | `#2BB8F0` → `#1A9FE0` → `#1288CC` → `#0C70B4` |

OLED: เฉด ≠ 0 = ติด, 0 = ดับ

### 4.3 ส่งเฉพาะเม็ดที่เปลี่ยน (TFT)

ปัญหาเดิม: `present()` ส่ง framebuffer 240×240 ทั้งก้อน (115 KB) ราว 46 ms ที่ SPI 20 MHz และ `loop()` เว้นเฟรม 50 ms

ทางใหม่สำหรับโหมดนี้:

```
panel.startWrite();
for each cell:
  if look[cell] != onScreen[cell]:
    panel.writeFillRect(x, y, pitch-1, pitch-1, palette[look[cell]]);
    onScreen[cell] = look[cell];
panel.endWrite();
```

- ไม่วาดลง `GFXcanvas16` ไม่เรียก `drawRGBBitmap`
- ประมาณการ: เม็ดเปลี่ยน ~300 เม็ด/เฟรม × ~60 byte ≈ 18 KB ≈ 7–8 ms (ยังไม่ได้วัด)
- บังคับวาดใหม่ทั้งจอ (`fillScreen(0)` + `onScreen[] = 0xFF`) เมื่อ: เข้าโหมด, เปลี่ยน fill, หมุนจอ, สลับ inversion, ปิดหน้าจอ Wi-Fi
- ช่วงที่จอต้องแสดงชื่อ Wi-Fi/IP ให้ใช้ path framebuffer เดิมของ `present()`
- OLED ใช้ `drawBitmap` + `display()` เหมือนเดิม (ข้อมูลแค่ 1 KB)

### 4.4 จังหวะเฟรม

เปลี่ยน `if(now-lastFrame>=50)` ใน `loop()` เป็น `frameIntervalMs(activeMode)` ที่คืน 33 สำหรับ `PixelFlow` และ 50 สำหรับโหมดอื่น

**เสร็จเมื่อ:** preview บนเว็บกับภาพจากเครื่องจริงดูเป็นตารางเม็ดแบบวิดีโอ ไม่มีรอยค้างหลังสลับโหมด

---

## Phase 5 — Preview บนเว็บ

| ไฟล์ | สิ่งที่ทำ |
| --- | --- |
| `web/pixel-flow.js` | engine จาก Phase 1 |
| `web/water-modes.js` | export `usesFill()` และ `pixelForces()` ตรงกับ C++ |
| `web/profiles.js` | ต่อท้าย `modes`: `{ id: 'pixel-flow', name: 'น้ำพิกเซล', english: 'Pixel Flow', detail: 'น้ำเม็ดละเอียด เอียงให้ไหล เขย่าให้กระเซ็น', glyph: '▦' }` |
| `web/preview.js` | branch `pixel-flow`: accumulator 30 Hz, วาด `fillRect` ตามเฉด, ลากเพื่อ `push()`, ปุ่มเขย่าเรียก `shake()` |
| `web/index.html`, `web/app.js` | แสดง slider ระดับน้ำ + ปุ่มกระตุก 4 ทิศ (ชุดเดียวกับ `water-inertia`) เมื่อเลือกโหมดนี้, ซ่อน "แสดงกริด" |
| `tests/water-modes.test.mjs` | แก้ `modes.length` เป็น 9 และเพิ่ม assert ของ `usesFill` |

**เสร็จเมื่อ:** `npm run dev` เลือกโหมดนี้ได้ทุกจอ เอียง/เขย่า/ลากได้ และ `npm test` ผ่าน

---

## Phase 6 — Build, เอกสาร, release

1. `npm test`
2. `npm run firmware` → 18 merged binaries + manifest ใหม่ (`hardwareTested: false`)
3. `npm run build`
4. README: แถวใหม่ในตารางโหมด, หัวข้อ "โหมดน้ำพิกเซล" อธิบายหลักการ ขนาดตารางต่อจอ และความต่างจาก FLIP, ค่า `mode` ที่ `POST /api/config` รับ
5. `docs/VALIDATION.md`: จำนวน test, ขนาด firmware, Global RAM ที่เพิ่ม
6. `docs/HARDWARE.md`: เพิ่ม checklist ของ Phase 7
7. Commit แยกตาม phase: engine+test → firmware → preview → render path → docs+binaries

---

## Phase 7 — ทดสอบและจูนบนเครื่องจริง

วัดจาก `/api/status` บนทุกบอร์ดที่มี

| รายการ | เป้า | ถ้าไม่ถึง |
| --- | --- | --- |
| `simMs` ที่ fill 90% | < 8 ms บน C3/C6 | ลด `MaxDrops`/ขยาย pitch เป็น 7 px หรือปิด cohesion |
| `fps` ขณะเขย่าแรง (240×240) | ≥ 28 | ลอง SPI 40 MHz; ลด sparkle (sparkle ทำให้เม็ดเปลี่ยนเยอะ) |
| `freeHeap` ขณะเปิด Wi-Fi (C3) | ≥ 40 KB | ทำ `union` storage กับ `FlipFluid` |
| ความรู้สึก | ไหลแบบน้ำ ไม่ใช่ทราย | เพิ่ม `SLIDE`, ลด `COHESION_SHIFT`, ลด `DAMP_SHIFT` |
| ความคม | ไม่มีรอยค้าง ไม่มีเม็ดทะลุมุมโค้ง | ตรวจ invalidation ใน 4.3 |

บันทึกค่าที่จูนแล้วกลับไปเป็นค่าเริ่มต้นใน `PixelFlowTuning` และอัปเดต test ที่ผูกกับค่าคงที่

---

## ความเสี่ยง

| ความเสี่ยง | ผล | ทางรับมือ |
| --- | --- | --- |
| ดูเหมือนทรายมากกว่าน้ำ | ไม่ได้ภาพแบบวิดีโอ | cohesion + slide จูนได้จาก preview ก่อนลงเครื่อง |
| แรงโน้มถ่วงเล็กมากตอนวางเครื่องราบ | น้ำค้างเป็นกองเอียง | ถือว่าถูกต้องทางฟิสิกส์; ถ้าไม่ชอบ ใส่แรงขั้นต่ำเล็กน้อยตามทิศล่าสุด |
| เม็ดเปลี่ยนพร้อมกันเยอะตอนเขย่า | fps ตกชั่วขณะ | ถ้าเม็ดเปลี่ยน > 60% ให้ส่งทั้งเฟรมผ่าน framebuffer แทน |
| ไม่มีน้ำวนในโหมดนี้ | ผู้ใช้หมุนเครื่องแล้วไม่เกิดอะไร | ระบุใน README ว่าน้ำวนอยู่ในโหมด `water-swirl` |

---

## ไม่ทำในรอบนี้

- โปรไฟล์จอ 240×280 (ST7789V2 1.69") แบบเครื่องในวิดีโอ — เพิ่มทีหลังเป็นโปรไฟล์ที่ 7 (+3 firmware) ตาราง 40×46
- บอร์ด ESP32-S3 / IMU QMI8658
- Launcher ไอคอน, แถบเวลา/แบตเตอรี่ — ขัดกับหลัก "จอเป็นพื้นที่เล่นทั้งหมด" และเครื่องมีแค่ปุ่ม BOOT
- เลือกพาเลตสีจากมือถือ — พาเลตใน 4.2 แยกเป็นตารางไว้แล้ว เพิ่ม key `palette` ใน NVS ได้ภายหลัง
