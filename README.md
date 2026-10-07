# esp32-tilt-toy

พวงกุญแจ **ESP32-C6 SuperMini + GY-521/MPU6050** ที่เล่นด้วยการเอียงและเขย่า มีเว็บเลือกจอ ทดลองเล่น และแฟลชผ่าน USB พร้อมหน้าตั้งค่าบนตัวเครื่องที่เปิดจากมือถือ

**เว็บ installer + preview:** https://ttawannn.github.io/esp32-tilt-toy/

## โหมดในเครื่อง

ทุก firmware มีครบ 6 โหมด กดปุ่มสั้นเพื่อสลับ หน้าจอใช้เป็นพื้นที่เล่นทั้งหมด ไม่มีชื่อโหมด ตัวเลข หรือกรอบ ค่าต่าง ๆ ไปแสดงบนหน้าเว็บในมือถือแทน ข้อความบนจอมีแค่ 2 กรณี คือชื่อ Wi-Fi กับ IP ขณะเปิดโหมดตั้งค่า และ `IMU NOT FOUND` เมื่อไม่พบเซนเซอร์

| โหมด | เล่นอย่างไร |
| --- | --- |
| **Flip Liquid** | น้ำแบบอนุภาคไหลตามการเอียง เขย่าให้กระเซ็น ปรับระดับน้ำได้ 10–90% |
| Tilt maze | กลิ้งลูกบอลหลบกำแพงไปยังเป้าหมาย |
| Snow globe | เขย่าให้หิมะฟุ้ง แล้วค่อย ๆ ตกตามแรงโน้มถ่วง |
| Orbit pong | เอียงเพื่อเลื่อนแป้นรอบวงรับลูกบอล |
| Pocket eyes | ตาการ์ตูนมองตามทิศที่เอียง |
| Shake & roll | เขย่าเพื่อทอยลูกเต๋า |

### โหมดน้ำ (FLIP/PIC)

โหมดน้ำจำลองของไหลแบบ FLIP/PIC บนกริด MAC ดัดแปลงจาก [Ten Minute Physics #18](https://matthias-research.github.io/pages/tenMinutePhysics/18-flip.html) ของ Matthias Müller (MIT license) มีโค้ดสองชุดที่ใช้สมการและค่าคงที่เดียวกัน

- `firmware/tilt_toy/flip_fluid.h`: C++ จองหน่วยความจำคงที่ไว้สูงสุด 400 cells / 900 particles (~28 KB) ไม่ allocate ระหว่างรัน
- `web/fluid.js`: JavaScript สำหรับ preview บนเว็บ

ทั้งสองชุดใช้ fixed step 25 ms มีภาชนะทรงกลมสำหรับจอ GC9A01 หาเพื่อนบ้านด้วย linked-cell และแรงโน้มถ่วงมาจาก roll/pitch ของ MPU6050 ขนาดกริดปรับตามจอ ส่วนจอกลมใช้ 20×20

ESP32-C6 ไม่มี FPU จึงต้องวัดเวลา solver บนบอร์ดจริง ดูได้จากช่อง Solver ในหน้าตั้งค่าบนมือถือ (หรือ `simMs` ใน `/api/status`) ถ้าเกินราว 25 ms ภาพจะกระตุก ให้ลดขนาดกริดหรือระดับน้ำ ข้อความ license อยู่ที่ [web/licenses/ten-minute-physics.txt](web/licenses/ten-minute-physics.txt) และที่ `/license` บนตัวเครื่อง

## จอที่รองรับ

| จอ | Controller | โปรไฟล์ |
| --- | --- | --- |
| TFT 80×160 | ST7735S Mini 160×80 | `tft-80x160` |
| GMT130 240×240 | ST7789, 7 ขา ไม่มี CS | `gmt130-240x240` |
| TFT กลม 240×240 | GC9A01 | `tft-240x240-gc9a01` |
| TFT เหลี่ยม 240×240 | ST7789, มี CS | `tft-240x240-st7789` |
| OLED 128×64 | SSD1306, I²C 0x3C/0x3D | `oled-128x64` |

แต่ละโปรไฟล์มี merged binary แยกกัน ไฟล์เป็นรุ่นทดลองสำหรับ **C6 / Flash 4MB** ทุก manifest ระบุ `hardwareTested: false` เพราะยังไม่ได้ทดลองกับบอร์ดและจอจริง และยังไม่มีผลวัด FPS กระแสไฟ หรืออายุแบตเตอรี่ ส่วนจอ SH1106 และ ST7735 ที่ใช้ offsets ต่างจาก Mini160×80 ต้องเพิ่มโปรไฟล์ใหม่

## ต่อสาย (ย่อ)

| สัญญาณ | GPIO |
| --- | --- |
| I²C SDA / SCL (MPU6050 และ OLED) | 0 / 1 |
| SPI SCK / MOSI | 6 / 7 |
| CS / DC / RST | 18 / 19 / 20 |
| ปุ่มใช้งาน (ต่อลง GND) | 2 |

ผังเต็ม ข้อควรระวังเรื่องไฟ backlight และ checklist ทดสอบอยู่ใน [docs/HARDWARE.md](docs/HARDWARE.md)

## แฟลชผ่านเว็บ

1. เปิดเว็บ installer ด้วย **Chrome / Edge บนคอมพิวเตอร์** (ต้องเป็น HTTPS หรือ localhost)
2. เลือกจอให้ตรงกับชิปของโมดูล เว็บจะตรวจขนาดไฟล์และ SHA-256 ก่อนเปิดปุ่มแฟลช
3. ต่อสาย USB ที่รับส่งข้อมูลได้ แล้วกด **เชื่อมต่อและแฟลช** ถ้าเป็นการติดตั้งครั้งแรก ให้เลือก erase เพื่อเริ่มจากค่าเริ่มต้นของโปรไฟล์ (การ erase จะลบค่าที่บันทึกไว้)

ถ้าไม่เจอพอร์ต ให้ปิด Serial Monitor แล้วกด BOOT ค้างไว้ขณะเสียบสาย USB ปล่อย BOOT แล้วลองใหม่

ใช้ preview บนเว็บทดลองเล่นได้โดยไม่ต้องต่อบอร์ด มีแถบเลื่อนจำลองการเอียงและก้ม/เงย กับปุ่มเขย่า ในโหมดน้ำปรับระดับน้ำได้ เปิดแสดงกริดได้ และลากบนจอเพื่อกวนน้ำได้

## ตั้งค่าจากมือถือ

1. กดปุ่ม GPIO2 ค้าง 2 วินาทีเพื่อเปิด Wi-Fi
2. เชื่อมต่อ `TiltToy-xxxx` รหัส `tilttoy32` แล้วเปิด `http://192.168.4.1`
3. ด้านบนของหน้าแสดงค่าสดที่อัปเดตทุก 1 วินาที ได้แก่ โหมด, roll/pitch, FPS, คะแนน (เขาวงกต/Pong), เวลา solver และจำนวนอนุภาค (โหมดน้ำ) และ heap ว่าง
4. ตั้งโหมด ระดับน้ำ ความไว และการหมุนภาพ แล้วกดบันทึก สำหรับจอ TFT ตั้ง inversion ได้ และสำหรับ ST7789 ตั้ง SPI mode ได้ ค่าทั้งหมดเก็บใน NVS
5. กดปิด Wi-Fi แล้วเล่นต่อ หรือรอให้ปิดเองหลัง 3 นาที

ให้วางเครื่องนิ่งตอนเปิดเครื่องหรือตอนกดคาลิเบรต gyro และวางแกน X/Y ของเซนเซอร์ให้ตรงกับจอ MPU6050 วัดได้แค่ roll/pitch จากแรงโน้มถ่วง ไม่มี yaw

| Endpoint | หน้าที่ |
| --- | --- |
| `GET /api/status` | version, profile, โหมด, ค่าตั้ง, roll/pitch, `fps`, `simMs`, `score`, `particles`, `freeHeap` |
| `POST /api/config` | `mode`, `fill`, `sensitivity`, `rotation`, `invert`, `spiMode` |
| `POST /api/shake` · `/api/calibrate` · `/api/close` | เขย่า, คาลิเบรต gyro, ปิด Wi-Fi |
| `GET /license` | ข้อความ MIT license ของ FLIP solver |

## พัฒนาบนเครื่อง

ใช้ Node.js 22 ขึ้นไป มี binary ที่ build แล้วอยู่ใน `web/firmware/` จึงเปิดเว็บได้โดยไม่ต้องติดตั้ง Arduino toolchain

```sh
npm ci
npm test
npm run build
npm run dev
```

จากนั้นเปิด `http://localhost:4173`

### Build firmware ใหม่

ติดตั้ง Arduino CLI 1.5.1 พร้อม core และไลบรารีตามรายการด้านล่าง หรือใช้ Arduino IDE ซึ่งมี CLI อยู่ข้างใน (script หา path มาตรฐานบน Windows ให้เอง)

```sh
arduino-cli config init
arduino-cli config add board_manager.additional_urls https://espressif.github.io/arduino-esp32/package_esp32_index.json
arduino-cli core update-index
arduino-cli core install esp32:esp32@3.3.11
arduino-cli lib install "Adafruit GFX Library@1.12.6" "Adafruit BusIO@1.17.4" "Adafruit ST7735 and ST7789 Library@1.11.0" "Adafruit GC9A01A@1.1.1" "Adafruit SSD1306@2.5.17" "Adafruit MPU6050@2.2.9" "Adafruit Unified Sensor@1.1.15"
npm run firmware
npm test
npm run build
```

ถ้าต้องการ build จอเดียว ใช้ `npm run firmware -- tft-240x240-gc9a01` ถ้า toolchain อยู่ที่อื่น ให้ตั้ง environment `ARDUINO_CLI`, `ARDUINO_DATA_DIR` หรือ `ESPTOOL`

script จะทำตามลำดับนี้

1. stage ไฟล์ `tilt_toy.ino`, `config.h` และ `flip_fluid.h`
2. compile ด้วย FQBN `esp32:esp32:esp32c6` (USB CDC, DIO, Flash 4M, partition `huge_app` คือ app 3MB ไม่มี OTA)
3. merge bootloader@0, partitions@0x8000, boot_app0@0xe000 และ app@0x10000 เป็นไฟล์เดียว
4. สร้าง manifest ใหม่ ซึ่งเก็บ SHA-256 ของ binary และ `sourceSha256` ของ source ทั้งสามไฟล์

ผล compile อยู่ใน `work/firmware/` ส่วน artifacts อยู่ใน `web/firmware/` และ `npm test` จะ fail ถ้าแก้ source แล้วไม่ได้ build firmware ใหม่

## โครงสร้าง

- `firmware/tilt_toy/`: sketch, IMU, 6 โหมด, FLIP solver, Wi-Fi UI, NVS
- `web/`: installer, preview (`preview.js`, `fluid.js`), profile contract, firmware artifacts และ licenses
- `scripts/`: build เว็บ, build/merge firmware และ local server
- `tests/`: ตรวจ profile, การต่อสาย, binary header/chip, partition, checksum และ source hash
- `docs/`: [แผนพัฒนา](docs/PLAN.md), [ฮาร์ดแวร์](docs/HARDWARE.md), [ผลตรวจ](docs/VALIDATION.md) และ [GitHub Pages](docs/GITHUB-PAGES.md)
- `.github/workflows/`: `ci.yml` ตรวจเว็บและ build firmware ครบทุกโปรไฟล์ ส่วน `pages.yml` deploy เว็บเมื่อ push ขึ้น `main`

เว็บ build ออกมาเป็น static files ใน `dist/` และ bundle ESP Web Tools ไว้ในตัว จึง host บน HTTPS host ไหนก็ได้

## เครดิต

- FLIP fluid ดัดแปลงจาก Ten Minute Physics โดย Matthias Müller ใช้ MIT license ตาม [web/licenses/ten-minute-physics.txt](web/licenses/ten-minute-physics.txt)
- ตัวแฟลชใช้ [ESP Web Tools](https://esphome.github.io/esp-web-tools/)
