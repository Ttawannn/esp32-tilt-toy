# ฮาร์ดแวร์และโปรไฟล์จอ

บอร์ดเป้าหมาย: ESP32-C6 SuperMini; sensor: BMI160 หรือ GY-521/MPU6050; ใช้จอและเซนเซอร์อย่างละหนึ่งตัวต่อเครื่อง

ผังด้านล่างเป็น GPIO ตัวเลขจริง ไม่ใช่เลขขาบน header คำว่า SuperMini ครอบคลุมบอร์ดหลายผู้ผลิต ต้องตรวจ silkscreen และแพ็กเกจชิปของบอร์ดที่ซื้อก่อนต่อ

หน้าเว็บมีผังแบบกราฟพร้อมภาพอุปกรณ์และรายการคู่ pin ที่เปลี่ยนตามโปรไฟล์จอ เลือกสายเพื่อไฮไลต์ต้นทาง/ปลายทาง หรือใช้ “ลองลากต่อสาย” เพื่อฝึกต่อด้วยการลาก แตะทีละขา หรือ Enter/Space ระบบรับเฉพาะคู่ขาตามเฟิร์มแวร์ และนับสายที่ต่อครบแล้ว โหมดฝึกไม่ได้เปลี่ยน GPIO ในเฟิร์มแวร์ ภาพจัดตำแหน่งขาเพื่อให้อ่านง่าย ให้เทียบชื่อขากับโมดูลจริงก่อนประกอบ ส่วน BL/BLK แสดงคำแนะนำแยกเพราะต้องตรวจสเปกโมดูลก่อนกำหนดการต่อ

## GPIO เริ่มต้นสำหรับ ESP32-C6

| สัญญาณ | GPIO | การต่อ |
| --- | --- | --- |
| I²C SDA | 0 | BMI160 / MPU6050 SDA และ OLED SDA เมื่อใช้ OLED |
| I²C SCL | 1 | BMI160 / MPU6050 SCL และ OLED SCL เมื่อใช้ OLED |
| ปุ่ม BOOT บนบอร์ด | 9 | มีอยู่แล้ว ไม่ต้องต่อปุ่มแยก; ใช้ input pull-up และกดแล้วเป็น LOW |
| MPU interrupt (ตัวเลือก) | 3 | GY-521 INT; ต้องตั้ง sensor/wake เพิ่มก่อนใช้ |
| TFT SCK / CLK | 6 | SPI clock |
| TFT MOSI / DIN / SDA | 7 | SPI data ขาเข้า TFT |
| TFT CS | 18 | ใช้เมื่อโมดูลมี CS; GMT130 7 ขาใช้ค่า `-1` ใน driver |
| TFT DC | 19 | Data/command |
| TFT RST / RES | 20 | Reset จอ |
| TFT BL / BLK | ไฟตามสเปกโมดูล | รุ่นแรกใช้ไฟคงที่; GPIO21 สำหรับวงจรควบคุมเป็นงานต่อยอด |
| ไฟเลี้ยงและกราวด์ | 3V3 / GND | ใช้โมดูลที่รองรับไฟ 3.3V และกราวด์ร่วมกัน |

ผังสายอุปกรณ์ภายนอกเว้น strapping GPIO4/5/8/9/15 และ USB GPIO12/13 ส่วน GPIO24–30 เกี่ยวกับ flash ไม่ใช้ต่ออุปกรณ์ GPIO10/11 ไม่ถูกนำออกในชิปที่มี SiP flash และ GPIO14 มีข้อจำกัดในแพ็กเกจอื่น จึงเว้นทั้งสามไว้ ตรวจ GPIO16/17 และขาที่ใช้บนบอร์ดก่อนเปลี่ยน mapping [ข้อจำกัด GPIO ของ Espressif](https://docs.espressif.com/projects/esp-idf/en/stable/esp32c6/api-reference/peripherals/gpio.html)

เฟิร์มแวร์อ่านปุ่ม BOOT ที่ GPIO9 หลังเครื่องเริ่มทำงาน: กดสั้นเปลี่ยนโหมด กดค้าง 2 วินาทีเปิด/ปิด Wi-Fi ไม่ต้องต่อปุ่มหรือสายที่ GPIO2 เพิ่ม ปุ่ม RST ใช้รีสตาร์ตเครื่อง ให้ปล่อย BOOT ขณะเปิดเครื่องหรือกด RST เพื่อเข้าโปรแกรมตามปกติ เพราะ GPIO9 ที่เป็น LOW ขณะรีเซ็ตจะเลือกโหมดแฟลช ตรวจว่าปุ่ม BOOT ของ SuperMini รุ่นที่ใช้ต่อ GPIO9 จริงก่อนแฟลช [การเลือก boot mode ของ ESP32-C6](https://docs.espressif.com/projects/esptool/en/latest/esp32c6/advanced-topics/boot-mode-selection.html)

USB ของ C6 ใช้ GPIO12/13 ซึ่งต่างจาก C3 เว้นขาเหล่านี้เพื่อเก็บเส้นทางแฟลชผ่าน USB native ของบอร์ด [USB hardware guideline](https://docs.espressif.com/projects/esp-hardware-design-guidelines/en/latest/esp32c6/schematic-checklist.html)

## โปรไฟล์จอและค่าเริ่มต้น

ค่าต่อไปนี้เป็นจุดเริ่มต้นจากไลบรารี/โมดูลอ้างอิง ไม่ใช่การรับประกันทุก clone ให้รันภาพขอบจอและแถบ RGB ก่อนปรับความเร็ว SPI

| โปรไฟล์ | Init ที่แนะนำสำหรับ Adafruit drivers | ข้อที่ต้องตรวจจริง |
| --- | --- | --- |
| ST7735 80×160 / 160×80 | `initR(INITR_MINI160x80)`; rotation 0 สำหรับแนวตั้ง / 1 สำหรับแนวนอน | ชนิด panel/FPC, offset, RGB order, inversion |
| GMT130 ST7789 240×240 | driver CS = `-1`; `init(240, 240, SPI_MODE3)` | รุ่นแรกเริ่ม Mode3; เลือก Mode0 ในหน้าเครื่องได้ ต้องตรวจโมดูลจริง |
| ST7789 240×240 มี CS | driver CS = 18; `init(240, 240, SPI_MODE0)` | controller, CS wiring, offset, inversion |
| GC9A01 240×240 วงกลม | `begin(...)`; rotation 0 | โมดูลตรงชิป, RGB order, inversion, mask พื้นที่วงกลม |
| SSD1306 128×64 I²C | driver 128×64; reset `-1` สำหรับโมดูล auto-reset | scan `0x3C`/`0x3D`, ความสามารถไฟเลี้ยง, ชิปไม่ใช่ SH1106 |

เริ่ม SPI ที่ความเร็วอนุรักษ์นิยม เช่น 10–20 MHz สำหรับ prototype และเพิ่มเมื่อทดลองสายจริงผ่าน ค่า SPI สูงสุดที่ใช้ได้ขึ้นกับโมดูล ความยาวสาย และ driver ไม่ควรอ้าง FPS จาก preview บนคอมพิวเตอร์

### TFT 80×160

Adafruit ST7735 driver ใช้ offset `(24, 0)` สำหรับ `INITR_MINI160x80` และ `(26, 1)` สำหรับ `INITR_MINI160x80_PLUGIN` โดย plugin มี semantics inversion ต่างกัน จึงต้องตรวจรุ่น panel เมื่อภาพเลื่อน สีผิด หรือพื้นที่ขอบหาย `setRotation(0)` ให้พื้นที่ 80×160 และ rotation 1/3 สลับเป็น 160×80 [source ST7735 driver](https://github.com/adafruit/Adafruit-ST7735-Library/blob/master/Adafruit_ST7735.cpp)

### GMT130 และ TFT ST7789 240×240

GMT130-V1.0 ของ Goldenmorning ใช้ ST7789 และ header 7 ขา `GND, VCC, SCK, SDA, RES, DC, BLK` โดยไม่มี CS ให้ต่อ ขา **SDA ของจอนี้คือ SPI MOSI** ให้ต่อ GPIO7 ห้ามนำไปแชร์กับ I²C SDA ของ GY-521 [ข้อมูลโมดูลจากผู้ผลิต](https://goldenmorninglcd.com/tft-display-module/1.3-inch-240x240-st7789-gmt130-v1.0/)

โมดูลไม่มี CS ใช้ SPI bus สำหรับจอนั้นโดยเฉพาะในการออกแบบรุ่นแรก Driver รองรับค่า CS `-1` เมื่อไม่มี CS ที่ควบคุมได้ [Adafruit SPITFT source](https://github.com/adafruit/Adafruit-GFX-Library/blob/master/Adafruit_SPITFT.cpp)

ST7789 มีพื้นที่ address ภายในที่ใหญ่กว่าหน้าจอ 240×240 ไลบรารี Adafruit จัด offset ให้อัตโนมัติ: rotation 0 ใช้ row start 80 ส่วน rotation 2 ใช้ row start 0 อย่าเพิ่ม offset อีกชั้นใน game renderer จอบางรุ่นต้องปรับ SPI mode ตามข้อมูลผู้ขาย [source ST7789 driver](https://github.com/adafruit/Adafruit-ST7735-Library/blob/master/Adafruit_ST7789.cpp)

### GC9A01 จอกลม 240×240

GC9A01 ของ Waveshare เป็น SPI 240×240 มี `VCC, GND, DIN, CLK, CS, DC, RST, BL` ใช้ผัง TFT ในตารางได้ จอวงกลมมี buffer เชิงพิกัดสี่เหลี่ยม เกมและข้อความต้องคำนึงถึงมุมที่อยู่นอกพื้นที่มองเห็น [ข้อมูลโมดูล Waveshare](https://www.waveshare.com/wiki/1.28inch_LCD_Module)

ไลบรารี GC9A01A มี init และ rotation ของตัวเอง จึงไม่ใช้ init ของ ST7789 แม้ความละเอียดเท่ากัน [source GC9A01A driver](https://github.com/adafruit/Adafruit_GC9A01A/blob/main/Adafruit_GC9A01A.cpp)

### OLED 128×64

เลือก SSD1306 I²C 4 ขาที่รองรับ 3.3V จอและ BMI160 / MPU6050 ใช้ SDA0/SCL1 ร่วมกันได้ แต่ตรวจ address ทั้งสองจาก I²C scan ก่อนเริ่ม จอที่มี address `0x3C` หรือ `0x3D` ต้องใช้ค่าที่พบจริง ไม่ผูก address กับความละเอียดอย่างเดียว บางโมดูลต้องมี hardware reset เพิ่ม [ตัวอย่าง SSD1306 128×64](https://learn.adafruit.com/monochrome-oled-breakouts/wiring-128x64-oleds)

SH1106 128×64 ต้องใช้โปรไฟล์/ไลบรารีเพิ่ม ไม่ยืนยันเข้ากันได้เพียงเพราะขนาด 0.96 นิ้วเท่ากัน

## โมดูลเซนเซอร์ I²C

ทุก firmware ตรวจ Chip ID ของ BMI160 / MPU6050 ที่ `0x68` และ `0x69` เมื่อเปิดเครื่อง ไม่ต้องเลือก firmware แยกตามโมดูล ทั้งสองใช้ SDA → GPIO0, SCL → GPIO1, VCC → 3V3 และ GND ร่วมกัน ตรวจชื่อขาที่พิมพ์บนโมดูลจริง ผังเว็บวางขาเพื่อให้อ่านง่ายและมีตัวเลือก **โมดูลเซนเซอร์**

### BMI160

| ขาโมดูล | การต่อ |
| --- | --- |
| VCC / VIN, GND | 3V3, GND; ใช้โมดูลที่รองรับ 3.3V |
| SDA / SDI, SCL / SCK | GPIO0, GPIO1 |
| CS / CSB | 3V3 เพื่อเลือก I²C |
| SDO / SA0 | GND สำหรับ `0x68`; 3V3 สำหรับ `0x69` |
| INT1 / INT2 | ไม่ต้องต่อ; อ่านแบบ polling |

ตั้ง accelerometer ±8 g และ gyro ±500°/s ที่ 100 Hz รอ soft reset และช่วงเริ่มทำงานก่อนอ่านข้อมูล ตรวจ power mode และค่าที่เขียนกลับก่อนรายงานว่าใช้งานได้ [BMI160 datasheet จาก Bosch](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmi160-ds000.pdf)

### GY-521 / MPU6050

| GY-521 | การต่อ |
| --- | --- |
| VCC | ไฟตามสเปกของโมดูลที่ซื้อ; เลือกโมดูลรองรับ 3.3V สำหรับผังนี้ |
| GND | GND ของ SuperMini |
| SDA | GPIO0 |
| SCL | GPIO1 |
| AD0 | GND สำหรับ address `0x68`; high สำหรับ `0x69` เมื่อจำเป็น |
| INT | GPIO3 เป็นตัวเลือก; firmware เริ่มต้นอาจอ่านแบบ polling |

ใช้แรงเร่งและ gyro อ่านมุมและการขยับ คาลิเบรตเมื่อวางนิ่ง โดยกำหนดทิศแกนของโมดูลให้สัมพันธ์กับจอ ไฟ LED/regulator/pull-up บน GY-521 clone อาจต่างกัน ตรวจไม่ให้ I²C pull-up ไป 5V บน GPIO ของ ESP32 [MPU6050 driver จาก Adafruit](https://github.com/adafruit/Adafruit_MPU6050)

หน้าเครื่องและ `/api/status` แสดง `sensor` (ชื่อ), `sensorAddress` (เลขฐานสิบ) และ `gyro` (true เมื่อพบเซนเซอร์ เพราะทุกรุ่นที่รองรับมี gyro) โดยคง `imu` เป็นสถานะพร้อมอ่านข้อมูล หาก I²C ล้มเหลว 5 ครั้งติดกันให้ตรวจสายแล้วรีสตาร์ตเครื่อง

## ไฟเลี้ยงและ backlight

เริ่ม prototype ด้วย USB ก่อนวัดแบตเตอรี่ ถ้า BLK/BL ของจอเป็นขา logic enable ให้ควบคุมจาก GPIO21 ได้ตามสเปก หากเป็นไฟ LED backlight โดยตรง ให้ใช้วงจรขับ/ทรานซิสเตอร์ที่เหมาะกับกระแส ห้ามถือว่า GPIO รับภาระ LED ของทุกโมดูลได้ ไฟ LED บน SuperMini และ GY-521 รวมถึง regulator มีผลต่อ standby current จึงต้องวัดทั้งเครื่อง

สำหรับแบต Li-ion/LiPo ต้องเลือกวงจรชาร์จ การป้องกัน และ regulator ตามบอร์ดจริง ห้ามนำแรงดันเซลล์เต็ม 4.2V เข้าขา 3V3 โดยตรง ระบุ wiring แบตขั้นสุดท้ายหลังตรวจ schematic ของ SuperMini รุ่นที่ใช้งานแล้ว

## ตรวจรับฮาร์ดแวร์แต่ละโปรไฟล์

1. ตรวจชื่อชิป ขนาด flash และ GPIO บน silkscreen ของ C6 รุ่นจริง
2. ต่อไฟเลี้ยงและ sensor ก่อน I²C scan พบ BMI160 / MPU6050 และ OLED (ถ้าเลือก OLED)
3. รันภาพขอบจอทุกด้าน ข้อความมุมทั้งสี่ และแถบ RGB สำหรับ TFT
4. เปลี่ยน rotation แล้วทดสอบการเอียงแกน X/Y ไม่สลับทิศ
5. ทดสอบ BOOT/RESET และ USB flash ขณะอุปกรณ์ต่อครบ
6. บันทึกรุ่นโมดูล offsets/inversion/SPI mode/clock และผล FPS ของทุกโหมด
7. วัดกระแสตอนเล่น/AP/sleep ก่อนกำหนดแบตเตอรี่และขนาดเคส
