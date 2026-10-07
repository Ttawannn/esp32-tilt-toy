# ผลตรวจ

## v0.1.2 — ESP32 30-pin / C3 SuperMini / C6 SuperMini

วันที่ 7 ตุลาคม 2026 · Flash 4MB · Arduino-ESP32 3.3.11

คอมไพล์ครบ **18 คู่บอร์ด/จอ** ด้วย target `esp32`, `esp32c3` และ `esp32c6` ตั้ง DIO และ partition `huge_app` (app 3MB) ใช้ USB CDC สำหรับ C3/C6 และ UART ผ่าน USB-to-Serial สำหรับ ESP32 30-pin ผลจาก compiler:

| บอร์ด | โปรไฟล์ | App (bytes) | Merged binary (bytes) | Global RAM (bytes) |
| --- | --- | ---: | ---: | ---: |
| ESP32 30-pin | tft-80x160 | 1,031,804 | 1,097,488 | 78,080 |
| ESP32 30-pin | tft-80x160-landscape | 1,031,820 | 1,097,504 | 78,080 |
| ESP32 30-pin | gmt130-240x240 | 1,031,496 | 1,097,184 | 78,088 |
| ESP32 30-pin | tft-240x240-st7789 | 1,031,496 | 1,097,184 | 78,088 |
| ESP32 30-pin | tft-240x240-gc9a01 | 1,030,300 | 1,095,984 | 78,072 |
| ESP32 30-pin | oled-128x64 | 1,029,896 | 1,095,584 | 78,016 |
| ESP32-C3 SuperMini | tft-80x160 | 1,123,595 | 1,189,280 | 67,960 |
| ESP32-C3 SuperMini | tft-80x160-landscape | 1,123,595 | 1,189,280 | 67,960 |
| ESP32-C3 SuperMini | gmt130-240x240 | 1,123,191 | 1,188,880 | 67,976 |
| ESP32-C3 SuperMini | tft-240x240-st7789 | 1,123,199 | 1,188,880 | 67,976 |
| ESP32-C3 SuperMini | tft-240x240-gc9a01 | 1,121,847 | 1,187,536 | 67,960 |
| ESP32-C3 SuperMini | oled-128x64 | 1,120,857 | 1,186,544 | 67,896 |
| ESP32-C6 SuperMini | tft-80x160 | 1,150,962 | 1,216,592 | 74,612 |
| ESP32-C6 SuperMini | tft-80x160-landscape | 1,150,962 | 1,216,592 | 74,612 |
| ESP32-C6 SuperMini | gmt130-240x240 | 1,150,550 | 1,216,192 | 74,628 |
| ESP32-C6 SuperMini | tft-240x240-st7789 | 1,150,558 | 1,216,192 | 74,628 |
| ESP32-C6 SuperMini | tft-240x240-gc9a01 | 1,149,218 | 1,214,848 | 74,612 |
| ESP32-C6 SuperMini | oled-128x64 | 1,148,232 | 1,213,872 | 74,548 |

`npm test` ผ่าน **28 tests** โดยใช้ MSVC (`CXX=cl`) ไม่มี test ที่ถูกข้าม ครอบคลุมการเลือก GPIO จาก target chip ทั้งแบบอัตโนมัติและ `BOARD_PROFILE`, การปฏิเสธ target ที่ขัดกับบอร์ด, pin mapping ของทุกบอร์ด/จอ/เซนเซอร์, I²C driver และหน้าเครื่อง รวมถึง artifacts ทั้ง 18 ชุด

ตรวจ chip ID ใน header ทั้ง bootloader และ app (`0`, `5`, `13` ตามชิป), bootloader offset `0x1000` สำหรับ ESP32 และ `0` สำหรับ C3/C6, padding ของ merged image, partition/app size, runtime board/profile ID, SHA-256 และ source hash ของ source ทั้งสี่ไฟล์ Manifest และตัวตรวจ header บนเว็บปฏิเสธไฟล์ที่เป็นคนละชิป

`npm run build` ผ่าน และตรวจว่า binary/manifest ทั้ง 18 ชุดใน `dist/` ตรงกับ release ที่ทดสอบแล้ว ยังรองรับเฉพาะ BMI160 และ MPU6050 ทุกบอร์ดใช้ shared I²C ตาม GPIO ของบอร์ดนั้น และ OLED init ไม่เรียก `Wire.begin()` กลับไปใช้ขาเริ่มต้น

ทดสอบหน้าเว็บใน Codex in-app browser:

- ตัวเลือกรุ่นบอร์ดมี ESP32 30-pin, ESP32-C3 SuperMini และ ESP32-C6 SuperMini; จำตัวเลือกหลัง reload
- เลือกครบ 18 คู่บอร์ด/จอแล้ว header/checksum ผ่าน ปุ่มแฟลชเปิดได้ และ manifest/download URL ตรงกับคู่ที่เลือก
- ผังและข้อความ I²C/SPI/BOOT เปลี่ยนตามบอร์ด เช่น ESP32 ใช้ SDA21/SCL22/BOOT0 และ C3 ใช้ SDA4/SCL5/BOOT9
- ทดสอบ viewport มือถือ 390×844 ไม่มี page horizontal overflow (ผังยังเลื่อนแนวนอนภายในกรอบได้)

ยังไม่ได้แฟลชหรือทดสอบบนบอร์ด จอ และเซนเซอร์จริง ทุก manifest จึงระบุ `hardwareTested: false` ต้องตรวจ GPIO/silkscreen ของ clone, BOOT/USB, การเอียง/คาลิเบรต, Wi-Fi AP, framebuffer/free heap และ FPS บนแต่ละบอร์ดตาม [HARDWARE.md](HARDWARE.md) ตัวเลข Global RAM จาก linker ยังไม่รวม framebuffer และ heap ที่ allocate ระหว่างรัน

## v0.1.1 — BMI160 / MPU6050

วันที่ 7 ตุลาคม 2026 · ESP32-C6 SuperMini / flash 4MB

คอมไพล์เฟิร์มแวร์ครบ 6 โปรไฟล์ด้วย Arduino-ESP32 3.3.11, USB CDC, DIO และ partition `huge_app` ไดรเวอร์ตรวจ Chip ID ของ BMI160 / MPU6050 อัตโนมัติที่ `0x68` / `0x69` และอ่านแรงเร่งกับ gyro เป็นหน่วย m/s² และ rad/s

| โปรไฟล์ | App จาก compiler (bytes) | Merged binary (bytes) | Global RAM (bytes) |
| --- | ---: | ---: | ---: |
| tft-80x160 | 1,150,796 | 1,216,432 | 74,612 |
| tft-80x160-landscape | 1,150,804 | 1,216,448 | 74,612 |
| gmt130-240x240 | 1,150,392 | 1,216,032 | 74,628 |
| tft-240x240-st7789 | 1,150,392 | 1,216,032 | 74,628 |
| tft-240x240-gc9a01 | 1,149,052 | 1,214,688 | 74,612 |
| oled-128x64 | 1,148,066 | 1,213,696 | 74,548 |

`npm test` ผ่าน 14 tests โดยตั้ง `CXX=cl` ใน environment ของ MSVC ไม่มี test ที่ถูกข้าม รวมการอ่าน signed data และสเกลของทั้งสองชิปทั้งสอง address, การข้าม temperature ของ MPU6050, I²C read/write ที่ล้มเหลวหรือได้ข้อมูลไม่ครบ, การไม่เขียนคำสั่งข้ามชนิดชิป, การแสดงรุ่นเซนเซอร์และคาลิเบรตในหน้าเครื่อง, pin mapping และ artifact ทั้ง 6 โปรไฟล์

การตรวจ artifacts ยืนยัน checksum, chip/partition layout, profile ID ภายใน binary และ source SHA-256 ซึ่งรวม `motion_sensor.h` แล้ว ทุก binary มีทั้ง BMI160 และ MPU6050; การ build แต่ละรันใช้ staging ของตัวเองเพื่อไม่ให้โปรไฟล์ปนกันเมื่อ build พร้อมกัน

`npm run build` ผ่าน หน้า installer ใน Codex in-app browser มีตัวเลือกเพียง GY-521 / MPU6050 และ BMI160; การสลับโมดูลเปลี่ยนชื่อและขาเลือก I²C ในผัง การ reload จำโมดูลที่เลือก และค่าโมดูลเก่าที่ไม่รองรับกลับไปใช้ MPU6050 ตรวจหน้า OLED + BMI160 ว่าใช้ SDA0/SCL1 ร่วมกัน พร้อม CS/CSB → 3V3 และ SDO/SA0 → GND และหน้าเว็บยืนยัน checksum ของเฟิร์มแวร์ใหม่แล้ว

ยังไม่ได้แฟลชหรือทดสอบกับเซนเซอร์และจอจริง ทุก manifest คง `hardwareTested: false` ต้องตรวจแกน, การคาลิเบรต, shake, I²C เมื่อใช้ OLED ร่วมกัน และประสิทธิภาพบนอุปกรณ์ตาม [HARDWARE.md](HARDWARE.md)

## บันทึกเดิม v0.1.0

วันที่ 7 ตุลาคม 2026 · เป้าหมาย ESP32-C6 SuperMini / flash 4MB

## Compile และ artifacts

ใช้ Arduino CLI 1.5.1, Arduino-ESP32 3.3.11, DIO, USB CDC และ partition `huge_app` ตามคำสั่งใน README คอมไพล์ source รุ่นสุดท้ายครบทั้ง 5 โปรไฟล์

| โปรไฟล์ | App จาก compiler (bytes) | Merged binary (bytes) | Global RAM (bytes) |
| --- | ---: | ---: | ---: |
| tft-80x160 | 1,155,478 | 1,221,120 | 74,668 |
| gmt130-240x240 | 1,155,096 | 1,220,736 | 74,668 |
| tft-240x240-st7789 | 1,155,104 | 1,220,736 | 74,668 |
| tft-240x240-gc9a01 | 1,153,762 | 1,219,392 | 74,652 |
| oled-128x64 | 1,152,772 | 1,218,416 | 74,604 |

Global RAM เป็นรายงาน static data จาก linker ยังไม่รวม framebuffer ที่ allocate ระหว่างรันหรือ heap ของ Wi-Fi จึงต้องวัดกับอุปกรณ์ก่อนสรุปหน่วยความจำและ FPS ส่วนที่เพิ่มราว 28 KB มาจาก array คงที่ของ FLIP solver (400 cells / 900 particles) ESP32-C6 ไม่มี FPU จึงต้องวัดเวลา solver จริงจาก `simMs` ใน `/api/status`

`npm test` ผ่าน 7 tests ตรวจ mapping ของจอและสาย, version/controller/profile contract, ขนาดไฟล์, SHA-256, source SHA-256, header ของ bootloader/app เป็น C6, DIO/flash4MB, partition app ที่ 0x10000 ขนาด 3MB และการปฏิเสธ manifest ที่ผิดชิป/จอ/offset/path/version

`npm run build` ผ่าน โดย bundle ESP Web Tools 10.4.0 ลง `dist/assets/installer.js` และคัดลอกไฟล์ firmware จริง

## Browser QA

ทดสอบด้วย Chrome แบบ headless ที่ 1440×1080 และ viewport มือถือ 390×844:

- เลือกครบ 5 โปรไฟล์แล้ว manifest, controller, canvas dimensions และลิงก์ดาวน์โหลดตรงกัน
- สลับครบ 6 โหมด ภาพจำลองต่างกัน และ slider เอียงเปลี่ยนภาพน้ำ
- จำโหมดที่เลือกหลัง reload
- checksum ที่ผิดปิดปุ่มแฟลช
- สลับจอเร็วขณะ request ก่อนหน้ายังไม่จบ ยังคง manifest ของจอล่าสุด
- กดปุ่มแฟลชเรียก Web Serial จริง; ทดสอบกรณีผู้ใช้ยกเลิกด้วย `requestPort` จำลอง ไม่เปิดพอร์ตฮาร์ดแวร์
- จำลอง browser ที่ไม่มี Web Serial: แสดงคำแนะนำใช้คอมพิวเตอร์และไม่แสดงปุ่มแฟลช
- หน้าเว็บมือถือไม่มี horizontal overflow และไม่พบ JavaScript error ใน installer
- หน้า device UI ส่ง POST สำหรับบันทึก/เขย่า/คาลิเบรต/ปิด Wi-Fi ถูก endpoint และ body โดยใช้ API response จำลอง
- ช่อง inversion/SPI ใน device UI แสดงตาม GC9A01, GMT130 และ SSD1306

## ยังไม่ได้ยืนยันบนฮาร์ดแวร์

ยังไม่ได้แฟลชหรือทดลองกับ ESP32-C6 และจอจริง รวมถึง Wi-Fi AP, การเอียงของ MPU6050, NVS หลัง reboot, SPI mode/inversion/offset ของแต่ละโมดูล, FPS/free heap และวงจรแบตเตอรี่ ทุก manifest จึงระบุ `hardwareTested: false`

GitHub Actions มี workflow แล้ว แต่ยังไม่ได้รันบน GitHub ดูเกณฑ์ทดลองอุปกรณ์ใน [PLAN.md ระยะ D–E](PLAN.md) และ [HARDWARE.md](HARDWARE.md)
