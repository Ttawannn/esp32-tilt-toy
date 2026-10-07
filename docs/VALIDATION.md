# ผลตรวจ

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
