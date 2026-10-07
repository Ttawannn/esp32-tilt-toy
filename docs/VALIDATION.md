# ผลตรวจ v0.1.0

วันที่ 7 ตุลาคม 2026 · เป้าหมาย ESP32-C6 SuperMini / flash 4MB

## Compile และ artifacts

ใช้ Arduino CLI 1.5.1, Arduino-ESP32 3.3.11, DIO, USB CDC และ partition `huge_app` ตามคำสั่งใน README คอมไพล์ source รุ่นสุดท้ายครบทั้ง 5 โปรไฟล์

| โปรไฟล์ | App จาก compiler (bytes) | Merged binary (bytes) | Global RAM (bytes) |
| --- | ---: | ---: | ---: |
| tft-80x160 | 1,113,634 | 1,179,264 | 46,044 |
| gmt130-240x240 | 1,113,258 | 1,178,896 | 46,044 |
| tft-240x240-st7789 | 1,113,258 | 1,178,896 | 46,044 |
| tft-240x240-gc9a01 | 1,112,112 | 1,177,744 | 46,028 |
| oled-128x64 | 1,110,990 | 1,176,624 | 45,980 |

Global RAM เป็นรายงาน static data จาก linker ยังไม่รวม framebuffer ที่ allocate ระหว่างรันหรือ heap ของ Wi-Fi จึงต้องวัดกับอุปกรณ์ก่อนสรุปหน่วยความจำและ FPS

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
