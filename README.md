# esp32-tilt-toy

พวงกุญแจ **ESP32 30-pin / ESP32-C3 SuperMini / ESP32-C6 SuperMini + BMI160 / MPU6050** ที่เล่นด้วยการเอียงและเขย่า มีเว็บเลือกบอร์ด จอ และโมดูลเซนเซอร์ ทดลองเล่น และแฟลชผ่าน USB พร้อมหน้าตั้งค่าบนตัวเครื่องที่เปิดจากมือถือ

**เว็บ installer + preview:** https://ttawannn.github.io/esp32-tilt-toy/

## โหมดในเครื่อง

ทุก firmware มีครบ 6 โหมด กดปุ่ม **BOOT บนบอร์ด** สั้น ๆ เพื่อสลับ หน้าจอใช้เป็นพื้นที่เล่นทั้งหมด ไม่มีชื่อโหมด ตัวเลข หรือกรอบ ค่าต่าง ๆ ไปแสดงบนหน้าเว็บในมือถือแทน ข้อความบนจอมีแค่ 2 กรณี คือชื่อ Wi-Fi กับ IP ขณะเปิดโหมดตั้งค่า และ `IMU NOT FOUND` เมื่อไม่พบเซนเซอร์

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

ทั้งสองชุดใช้ fixed step 25 ms มีภาชนะทรงกลมสำหรับจอ GC9A01 หาเพื่อนบ้านด้วย linked-cell และแรงโน้มถ่วงมาจาก roll/pitch ของเซนเซอร์ที่ตรวจพบ ขนาดกริดปรับตามจอ ส่วนจอกลมใช้ 20×20

ต้องวัดเวลา solver บนบอร์ดแต่ละรุ่นจริง ดูได้จากช่อง Solver ในหน้าตั้งค่าบนมือถือ (หรือ `simMs` ใน `/api/status`) ถ้าเกินราว 25 ms ภาพจะกระตุก ให้ลดขนาดกริดหรือระดับน้ำ ข้อความ license อยู่ที่ [web/licenses/ten-minute-physics.txt](web/licenses/ten-minute-physics.txt) และที่ `/license` บนตัวเครื่อง

## บอร์ดที่รองรับ

| ตัวเลือกในเว็บ | ชิป / โมดูล | USB สำหรับแฟลช | Flash |
| --- | --- | --- | --- |
| ESP32 30-pin | ESP32, ESP-WROOM-32 / DevKit V1 รุ่น 30 ขา | USB-to-Serial บนบอร์ด | 4 MB |
| ESP32-C3 SuperMini | ESP32-C3 | USB Serial/JTAG | 4 MB |
| ESP32-C6 SuperMini | ESP32-C6 | USB Serial/JTAG | 4 MB |

เลือก **รุ่นบอร์ด** ก่อนเลือกจอ เว็บเปลี่ยนผัง GPIO และไฟล์เฟิร์มแวร์ตามบอร์ด และจำตัวเลือกหลัง reload บอร์ดเดิมที่ยังไม่ได้เลือกจะเริ่มที่ C6 รุ่น ESP32 30-pin ใช้กับ ESP-WROOM-32 / DevKit V1 ตามตาราง; ให้เทียบชื่อ GPIO ที่พิมพ์บนบอร์ดจริง

## จอที่รองรับ

| จอ | Controller | โปรไฟล์ |
| --- | --- | --- |
| TFT 80×160 แนวตั้ง | ST7735S Mini 160×80, rotation 0 | `tft-80x160` |
| TFT 160×80 แนวนอน | จอเดียวกัน, rotation 1 | `tft-80x160-landscape` |
| GMT130 240×240 | ST7789, 7 ขา ไม่มี CS | `gmt130-240x240` |
| TFT กลม 240×240 | GC9A01 | `tft-240x240-gc9a01` |
| TFT เหลี่ยม 240×240 | ST7789, มี CS | `tft-240x240-st7789` |
| OLED 128×64 | SSD1306, I²C 0x3C/0x3D | `oled-128x64` |

เลือก **TFT 80×160 → แนวของจอ → แนวตั้ง / แนวนอน** ในเว็บ installer ภาพ preview และไฟล์แฟลชเปลี่ยนตามแนวที่เลือก เว็บจำตัวเลือกหลัง reload เมื่อติดตั้งโปรไฟล์ Mini TFT คนละแนว firmware จะใช้ rotation ของโปรไฟล์ใหม่นั้น แม้มีค่าเดิมใน NVS เมื่อบูตครั้งต่อไปยังคงค่าที่เปลี่ยนจากมือถือได้ โดยเลือก **แนวจอ / หมุนภาพ** แล้วกดบันทึก

แต่ละคู่บอร์ดและโปรไฟล์จอมี merged binary แยกกัน รวม **18 ชุด / Flash 4MB** เว็บตรวจรุ่นชิป บอร์ด จอ และ checksum ก่อนเปิดปุ่มแฟลช ทุก manifest ระบุ `hardwareTested: false` เพราะยังไม่ได้ทดลองกับบอร์ดและจอจริง และยังไม่มีผลวัด FPS กระแสไฟ หรืออายุแบตเตอรี่ ส่วนจอ SH1106 และ ST7735 ที่ใช้ offsets ต่างจาก Mini160×80 ต้องเพิ่มโปรไฟล์ใหม่

## ต่อสาย (ย่อ)

| สัญญาณ | ESP32 30-pin | C3 SuperMini | C6 SuperMini |
| --- | --- | --- | --- |
| I²C SDA / SCL (BMI160, MPU6050 และ OLED) | 21 / 22 | 4 / 5 | 0 / 1 |
| SPI SCK / MOSI | 18 / 23 | 6 / 7 | 6 / 7 |
| CS / DC / RST | 27 / 26 / 25 | 10 / 3 / 1 | 18 / 19 / 20 |
| ปุ่ม BOOT บนบอร์ด (ไม่ต้องต่อเพิ่ม) | 0 | 9 | 9 |

ใช้ BOOT หลังเครื่องเริ่มทำงาน: กดสั้นเปลี่ยนโหมด กดค้าง 2 วินาทีเปิด/ปิด Wi-Fi ส่วนปุ่ม RST ใช้รีสตาร์ตเครื่อง ให้ปล่อย BOOT ขณะเปิดเครื่องหรือกด RST เพื่อบูตเล่นตามปกติ; กด BOOT ค้างช่วงนั้นจะเข้าโหมดแฟลช [การเลือก boot mode ของ ESP32-C6](https://docs.espressif.com/projects/esptool/en/latest/esp32c6/advanced-topics/boot-mode-selection.html)

ผังเต็ม ข้อควรระวังเรื่องไฟ backlight และ checklist ทดสอบอยู่ใน [docs/HARDWARE.md](docs/HARDWARE.md)

### โมดูลเซนเซอร์

เฟิร์มแวร์ทุกโปรไฟล์จอตรวจชนิดเซนเซอร์อัตโนมัติจาก Chip ID เมื่อเปิดเครื่อง ไม่ต้อง build แยกตามเซนเซอร์ เลือก **โมดูลเซนเซอร์** ในเว็บเพื่อดูผังสายให้ตรงกับโมดูลที่ใช้ ต่อเซนเซอร์หนึ่งตัวต่อเครื่อง โดยให้แกน X/Y สัมพันธ์กับจอ

| เซนเซอร์ | I²C address ที่ตรวจ | การตั้งขาเลือก I²C / address | การเคลื่อนไหว |
| --- | --- | --- | --- |
| BMI160 | `0x68` / `0x69` | CS/CSB → 3V3, SDO/SA0 → GND สำหรับ `0x68` หรือ 3V3 สำหรับ `0x69` | แรงเร่ง + gyro |
| MPU6050 / GY-521 | `0x68` / `0x69` | AD0 → GND สำหรับ `0x68` หรือ 3V3 สำหรับ `0x69` | แรงเร่ง + gyro |

ทั้งสองรุ่นเป็น IMU 6 แกน (แรงเร่ง + gyro) ตั้งค่าอ่านประมาณ 100 Hz, ช่วงแรงเร่ง ±8 g และ gyro ±500°/s ปัจจุบันอ่าน roll/pitch จากแรงโน้มถ่วง ไม่มี yaw แบบเข็มทิศ หากอ่าน I²C ล้มเหลวติดกัน 5 ครั้งจะแสดงว่าไม่พบเซนเซอร์ ให้ตรวจสายแล้วเปิดเครื่องใหม่

หน้าเว็บมีกราฟรูปอุปกรณ์และเส้นต่อสายตามบอร์ด จอ และเซนเซอร์ที่เลือก พร้อมรายการว่า pin ไหนต่อ pin ไหน กดสายเพื่อไฮไลต์คู่ขา หรือเลือก “ลองลากต่อสาย” เพื่อฝึกต่อได้ทั้งลากสาย แตะทีละขา และใช้คีย์บอร์ด ระบบตรวจคู่ขาและนับสายที่ต่อแล้ว โดยใช้ GPIO ตามเฟิร์มแวร์ของบอร์ดนั้น

## แฟลชผ่านเว็บ

1. เปิดเว็บ installer ด้วย **Chrome / Edge บนคอมพิวเตอร์** (ต้องเป็น HTTPS หรือ localhost)
2. เลือกบอร์ดและจอให้ตรงกับรุ่นที่ใช้ เว็บจะตรวจรุ่นชิป ขนาดไฟล์ และ SHA-256 ก่อนเปิดปุ่มแฟลช
3. ต่อสาย USB ที่รับส่งข้อมูลได้ แล้วกด **เชื่อมต่อและแฟลช** ถ้าเป็นการติดตั้งครั้งแรก ให้เลือก erase เพื่อเริ่มจากค่าเริ่มต้นของโปรไฟล์ (การ erase จะลบค่าที่บันทึกไว้)

ถ้าไม่เจอพอร์ต ให้ปิด Serial Monitor แล้วกด BOOT ค้างไว้ขณะเสียบสาย USB ปล่อย BOOT แล้วลองใหม่

ใช้ preview บนเว็บทดลองเล่นได้โดยไม่ต้องต่อบอร์ด มีแถบเลื่อนจำลองการเอียงและก้ม/เงย กับปุ่มเขย่า ในโหมดน้ำปรับระดับน้ำได้ เปิดแสดงกริดได้ และลากบนจอเพื่อกวนน้ำได้

## ตั้งค่าจากมือถือ

1. เมื่อเครื่องเริ่มทำงานแล้ว กดปุ่ม BOOT บนบอร์ดค้าง 2 วินาทีเพื่อเปิด Wi-Fi
2. เชื่อมต่อ `TiltToy-xxxx` รหัส `tilttoy32` แล้วเปิด `http://192.168.4.1`
3. ด้านบนของหน้าแสดงค่าสดที่อัปเดตทุก 1 วินาที ได้แก่ โหมด, roll/pitch, FPS, คะแนน (เขาวงกต/Pong), เวลา solver และจำนวนอนุภาค (โหมดน้ำ) และ heap ว่าง
4. ตั้งโหมด ระดับน้ำ ความไว และการหมุนภาพ แล้วกดบันทึก สำหรับจอ TFT ตั้ง inversion ได้ และสำหรับ ST7789 ตั้ง SPI mode ได้ ค่าทั้งหมดเก็บใน NVS
5. กดปิด Wi-Fi แล้วเล่นต่อ หรือรอให้ปิดเองหลัง 3 นาที

หน้าเครื่องแสดงชื่อบอร์ด พร้อมชื่อและ I²C address ของเซนเซอร์ที่ตรวจพบ ให้วางเครื่องนิ่งตอนเปิดเครื่องหรือตอนกดคาลิเบรต gyro ของ BMI160 / MPU6050 และวางแกน X/Y ของเซนเซอร์ให้ตรงกับจอ

| Endpoint | หน้าที่ |
| --- | --- |
| `GET /api/status` | version, `board`, `boardName`, `chipFamily`, profile, โหมด, ค่าตั้ง, `imu`, `sensor`, `sensorAddress` (เลขฐานสิบ), `gyro`, roll/pitch, `fps`, `simMs`, `score`, `particles`, `freeHeap` |
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
arduino-cli lib install "Adafruit GFX Library@1.12.6" "Adafruit BusIO@1.17.4" "Adafruit ST7735 and ST7789 Library@1.11.0" "Adafruit GC9A01A@1.1.1" "Adafruit SSD1306@2.5.17" "Adafruit Unified Sensor@1.1.15"
npm run firmware
npm test
npm run build
```

`npm run firmware` build ครบ 18 ชุด เลือกบอร์ดหรือจอเฉพาะได้ เช่น `npm run firmware -- esp32-c3-supermini` (6 แบบจอ), `npm run firmware -- tft-240x240-gc9a01` (3 บอร์ด) หรือ `npm run firmware -- esp32-30pin oled-128x64` (1 ชุด) ถ้า toolchain อยู่ที่อื่น ให้ตั้ง environment `ARDUINO_CLI`, `ARDUINO_DATA_DIR` หรือ `ESPTOOL`

script จะทำตามลำดับนี้

1. stage ไฟล์ `tilt_toy.ino`, `config.h`, `flip_fluid.h` และ `motion_sensor.h`
2. compile ด้วย FQBN `esp32:esp32:esp32`, `esp32c3` หรือ `esp32c6` ตามบอร์ด ตั้ง DIO, Flash 4M, partition `huge_app` คือ app 3MB ไม่มี OTA และเปิด USB CDC สำหรับ C3/C6
3. merge bootloader@0x1000 สำหรับ ESP32 หรือ @0 สำหรับ C3/C6, partitions@0x8000, boot_app0@0xe000 และ app@0x10000 เป็นไฟล์เดียวที่แฟลช @0 (ESP32 มี padding ด้านหน้า)
4. สร้าง manifest ใหม่ ซึ่งเก็บ SHA-256 ของ binary และ `sourceSha256` ของ source ทั้งสี่ไฟล์

ผล compile อยู่ใน `work/firmware/run-<pid>/<board-id>/` แต่ละรอบและแต่ละบอร์ดแยก staging และ cache เพื่อไม่ให้ build ที่รันพร้อมกันสลับโปรไฟล์กัน ส่วน artifacts ของ C6 อยู่ใน `web/firmware/` เพื่อรักษา URL เดิม; ESP32 และ C3 อยู่ในโฟลเดอร์ย่อย `esp32-30pin/` และ `esp32-c3-supermini/` ตามลำดับ `npm test` จะ fail ถ้าแก้ source แล้วไม่ได้ build firmware ใหม่ ตั้ง `FIRMWARE_WORK_DIR` เพื่อใช้ cache เดิมได้เมื่อไม่มี build อื่นใช้โฟลเดอร์นั้น

ใน Arduino IDE เลือก ESP32 Dev Module, ESP32C3 Dev Module หรือ ESP32C6 Dev Module และตัวเลือก Flash/partition ตาม `web/boards.js` ส่วน `config.h` เลือก GPIO จาก target chip ให้อัตโนมัติ การตั้ง `BOARD_PROFILE` ให้ขัดกับ target จะคอมไพล์ไม่ผ่าน

ไดรเวอร์เซนเซอร์ใช้ `Wire` โดยตรง ไม่ต้องลงไลบรารีเซนเซอร์เพิ่ม `npm test` ทดสอบ C++ driver กับ I²C จำลองด้วย `g++` หรือ compiler ในตัวแปร `CXX` (`clang++` / `cl` ใช้ได้) ถ้าไม่มี host compiler จะข้ามเฉพาะ test นี้ สำหรับ MSVC ให้รันใน Developer Command Prompt โดยตั้ง `CXX=cl`

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
