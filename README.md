# esp32-tilt-toy

พวงกุญแจ **ESP32-C6 SuperMini + GY-521/MPU6050** ที่เล่นด้วยการเอียงและเขย่า มีเว็บเลือกจอ ทดลองโหมด และแฟลชผ่าน USB พร้อมหน้าเว็บบนอุปกรณ์สำหรับตั้งค่าจากมือถือ

## รุ่นแรก v0.1.0

มี source firmware และ merged binary แยกตามจอ 5 โปรไฟล์ รวมโหมด Liquid, Tilt maze, Snow globe, Orbit pong, Pocket eyes และ Dice ในแต่ละไฟล์ โหมดน้ำเป็นกราฟิกผิวน้ำ 2D พร้อมคลื่นและ damping

| จอ | Controller | โปรไฟล์ |
| --- | --- | --- |
| TFT 80×160 | ST7735S Mini 160×80 | `tft-80x160` |
| GMT130 240×240 | ST7789, 7 ขา ไม่มี CS | `gmt130-240x240` |
| TFT กลม 240×240 | GC9A01 | `tft-240x240-gc9a01` |
| TFT เหลี่ยม 240×240 | ST7789, มี CS | `tft-240x240-st7789` |
| OLED 128×64 | SSD1306, I²C 0x3C/0x3D | `oled-128x64` |

ไฟล์เป็นรุ่นทดลองสำหรับ **C6 / Flash 4MB** ต้องทดลองกับบอร์ดและจอจริงก่อนยืนยัน compatibility ของโมดูลแต่ละผู้ผลิต ยังไม่มีผลวัด FPS กระแสไฟ หรืออายุแบตเตอรี่ จอ SH1106 และ ST7735 ที่ใช้ offsets ต่างจาก Mini160×80 ต้องเพิ่มโปรไฟล์

อ่าน [แผนพัฒนา](docs/PLAN.md) และ [ผังสาย/รายละเอียดฮาร์ดแวร์](docs/HARDWARE.md)

## เปิดเว็บในเครื่อง

ใช้ Node.js 22 ขึ้นไป Binary รุ่นแรกอยู่ใน `web/firmware/` จึงเปิดเว็บได้โดยไม่ต้องติดตั้ง toolchain ของ Arduino

```sh
npm ci
npm test
npm run build
npm run dev
```

เปิด `http://localhost:4173` เลือกจอ แล้วกดเชื่อมต่อและแฟลชผ่าน **Chrome / Edge บนคอมพิวเตอร์** ต้องใช้ HTTPS หรือ localhost และสาย USB data ตัวแฟลช ESP Web Tools ตรวจตระกูลชิปและแสดงผลแฟลชจริง หน้าเว็บตรวจขนาดไฟล์และ SHA-256 ก่อนเปิดปุ่ม ติดตั้งครั้งแรกเลือก erase หากต้องการเริ่มด้วยค่าจากโปรไฟล์ใหม่ การล้าง flash ลบค่าที่บันทึกไว้

ถ้าไม่เจอพอร์ต: ปิด Serial Monitor กด BOOT ค้างขณะเสียบสาย USB ปล่อย BOOT แล้วลองใหม่ โทรศัพท์ใช้ Wi-Fi ตั้งค่าหลังแฟลช ส่วนเว็บ preview ใช้เล่นจำลองได้โดยไม่ต่อบอร์ด

## ตั้งค่าจากมือถือ

1. ต่อปุ่มเพิ่มระหว่าง **GPIO2 ↔ GND** กดค้าง 2 วินาทีเพื่อเปิด Wi-Fi
2. เชื่อม `TiltToy-xxxx` รหัส `tilttoy32` แล้วเปิด `http://192.168.4.1`
3. เลือกโหมด ตั้งระดับน้ำ/ความไว/rotation และกดบันทึก ตั้ง inversion และ SPI mode ของ ST7789 ได้
4. ปิด Wi-Fi แล้วเล่นต่อ หรือรอ timeout 3 นาที โหมดและค่าตั้งเก็บใน NVS กดปุ่มสั้นเพื่อเปลี่ยนโหมด

วางเครื่องนิ่งเมื่อเปิดเครื่องหรือกดคาลิเบรต gyro ให้แกน X/Y ของเซนเซอร์สอดคล้องกับจอ MPU6050 ให้ roll/pitch จากแรงโน้มถ่วง ไม่มี compass yaw ปุ่ม GPIO2 เป็นปุ่มใช้งานของเล่นแยกจาก BOOT บนบอร์ด

## Build firmware ใหม่

ติดตั้ง Arduino CLI 1.5.1 และ core/ไลบรารีตามนี้ หรือใช้ Arduino IDE ที่มี CLI ภายใน (script ตรวจ path มาตรฐานบน Windows)

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

Build จอเดียว: `npm run firmware -- tft-240x240-gc9a01` ตั้ง environment `ARDUINO_CLI`, `ARDUINO_DATA_DIR` หรือ `ESPTOOL` หาก toolchain อยู่ที่อื่น

Script ใช้ FQBN `esp32:esp32:esp32c6`, USB CDC, DIO, Flash4M และ `huge_app` (3MB app, ไม่มี OTA) ใช้ค่าของ toolchain รุ่นที่ตรึงไว้ merge bootloader@0, partitions@0x8000, boot_app0@0xe000 และ app@0x10000 เป็นไฟล์เดียว ไม่ pad ให้เต็ม 4MB สร้าง manifest + SHA-256 ใหม่ทุกครั้ง ผล compile อยู่ใน `work/firmware/` และ artifacts ใน `web/firmware/`

## โครงสร้าง

- `firmware/tilt_toy/` — sketch, motion, 6 โหมด, Wi-Fi UI, NVS
- `web/` — installer, preview, profile contract และ firmware artifacts
- `scripts/` — build เว็บ, build/merge firmware และ local server
- `tests/` — ตรวจ profile, binary header/chip, partition และ checksum
- `docs/` — แผนและ hardware acceptance checklist
- `.github/workflows/ci.yml` — ตรวจเว็บและ build firmware ครบทุกโปรไฟล์

เว็บ build เป็น static files ใน `dist/` โดย bundle ESP Web Tools ไว้ในเว็บเอง รองรับ deployment ผ่าน GitHub Pages ด้วย [คู่มือและ workflow](docs/GITHUB-PAGES.md) รวมถึง Sites ผ่าน `.openai/hosting.json` และ HTTPS host อื่น
