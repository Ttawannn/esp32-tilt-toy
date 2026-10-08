// English is the default. Keep UI copy here so both languages stay in sync.
export const messages = {
  'meta.description': ['Choose a display, try the modes, and flash an ESP32 / ESP32-C3 / ESP32-C6 Tilt Toy over USB.', 'เลือกจอ ทดลองโหมด และแฟลช ESP32 / ESP32-C3 / ESP32-C6 Tilt Toy ผ่าน USB บนเว็บ'],
  'nav.phone': ['Phone setup', 'ตั้งค่าผ่านมือถือ'],
  'hero.first': ['A little toy.', 'ของเล่นจิ๋ว'],
  'hero.second': ['Moves with you', 'ที่ขยับไปกับคุณ'],
  'hero.copy': ['Add a display and a sensor. Turn your ESP32 into a pocket toy that plays with every tilt and shake.', 'ต่อจอ ใส่เซนเซอร์ แล้วเปลี่ยน ESP32 ให้เป็นพวงกุญแจที่เล่นด้วยการเอียงและเขย่า'],
  'preview.title': ['Try it before you build it', 'ลองเล่นก่อนประกอบ'],
  'preview.canvas': ['Toy mode preview', 'ภาพจำลองโหมดของเล่น'],
  'preview.tilt': ['Tilt', 'เอียงเครื่อง'],
  'preview.pitch': ['Pitch', 'ก้ม / เงย'],
  'preview.shake': ['↝ Shake', '↝ เขย่า'],
  'preview.fill': ['Water level', 'ระดับน้ำ'],
  'preview.spin': ['Spin around the screen', 'หมุนรอบจอ'],
  'preview.flat': ['Lay flat', 'วางราบ'],
  'preview.stopSpin': ['Stop spinning', 'หยุดหมุน'],
  'preview.spinHint': ['Lay it flat, then spin to swirl the water. The water keeps moving after you stop.', 'กดวางราบ แล้วหมุนเพื่อดูน้ำวน · หยุดหมุนแล้วน้ำยังเคลื่อนต่อ'],
  'preview.jolt': ['Jolt', 'กระตุก'],
  'preview.joltGroup': ['Jolt the toy', 'กระตุกเครื่อง'],
  'preview.left': ['Jolt left', 'กระตุกซ้าย'],
  'preview.right': ['Jolt right', 'กระตุกขวา'],
  'preview.up': ['Jolt up', 'กระตุกขึ้น'],
  'preview.down': ['Jolt down', 'กระตุกลง'],
  'preview.stir': ['Drag on the screen to stir', 'ลากบนจอเพื่อกวนน้ำ'],
  'preview.grid': ['Show grid', 'แสดงกริด'],
  'preview.fullHint': ['Full-motion water combines tilt, jolts, and spin. The water keeps flowing after the toy stops.', 'น้ำสมจริง · เอียง กระตุก และหมุนร่วมกัน หยุดเครื่องแล้วน้ำยังไหลต่อ'],
  'preview.fullJolt': ['Jolt full-motion water', 'กระตุกน้ำสมจริง'],
  'preview.demo': ['Spin demo', 'หมุนเครื่องตัวอย่าง'],
  'preview.stopDemo': ['Stop demo', 'หยุดตัวอย่าง'],
  'preview.modes': ['Preview modes', 'โหมดทดลองเล่น'],
  'preview.note': ['Web preview · The real toy reads movement from a BMI160 / MPU6050.', 'ภาพจำลองบนเว็บ · เครื่องจริงรับการเคลื่อนไหวจาก BMI160 / MPU6050'],
  'preview.web': ['Web preview', 'ภาพจำลองบนเว็บ'],
  'preview.credit': ['FLIP from Ten Minute Physics ↗', 'FLIP จาก Ten Minute Physics ↗'],
  'installer.title': ['Build your little playground', 'ประกอบความสนุกของคุณ'],
  'installer.boardTitle': ['Your board', 'บอร์ดที่ใช้'],
  'installer.board': ['Board model', 'รุ่นบอร์ด'],
  'installer.displayTitle': ['Choose your display', 'เลือกจอของคุณ'],
  'installer.displays': ['Choose a display', 'เลือกจอ'],
  'installer.orientation': ['Display orientation', 'แนวของจอ'],
  'installer.portrait': ['Portrait — 80 × 160', 'แนวตั้ง — 80 × 160'],
  'installer.landscape': ['Landscape — 160 × 80', 'แนวนอน — 160 × 80'],
  'installer.driver': ['240 × 240 TFT controller', 'ชิปของ TFT 240 × 240'],
  'installer.round': ['GC9A01 — Round', 'GC9A01 — จอกลม'],
  'installer.square': ['ST7789 — Square, with CS', 'ST7789 — จอเหลี่ยม มี CS'],
  'installer.sensor': ['Sensor module', 'โมดูลเซนเซอร์'],
  'installer.sensorHint': ['Firmware detects a BMI160 / MPU6050 at startup. This selection changes the wiring diagram.', 'เฟิร์มแวร์ตรวจ BMI160 / MPU6050 อัตโนมัติเมื่อเปิดเครื่อง · ตัวเลือกนี้ใช้แสดงผังต่อสาย'],
  'installer.flashTitle': ['Flash it. Start playing.', 'แฟลช แล้วเริ่มเล่น'],
  'installer.copy': ['Connect your board with a USB data cable, click below, and select the ESP32 port in your browser.', 'ต่อบอร์ดด้วยสาย USB ที่ส่งข้อมูลได้ กดปุ่มด้านล่าง แล้วเลือกพอร์ตของ ESP32 ในหน้าต่างเบราว์เซอร์'],
  'installer.flash': ['Connect and flash', 'เชื่อมต่อและแฟลช'],
  'installer.unsupported': ['Flash over USB with desktop Chrome / Edge.', 'แฟลช USB ผ่าน Chrome / Edge บนคอมพิวเตอร์'],
  'installer.secure': ['Open this page over HTTPS or localhost to flash.', 'เปิดหน้านี้ผ่าน HTTPS หรือ localhost เพื่อแฟลช'],
  'installer.download': ['↓ Download .bin', '↓ ดาวน์โหลด .bin'],
  'installer.hardware': ['Experimental · All profiles compile · Physical display testing is still needed.', 'รุ่นทดลอง · คอมไพล์ครบตามโปรไฟล์ · ยังต้องทดสอบกับจอจริง'],
  'installer.wiring': ['See the components and wiring', 'ดูรูปอุปกรณ์และผังต่อสาย'],
  'installer.troubleshooting': ['No port, or a blank display?', 'ถ้าไม่เจอพอร์ต หรือจอไม่แสดงภาพ'],
  'installer.usbHelp': ['Try a USB data cable, close Serial Monitor, and hold BOOT while plugging in USB. Release BOOT and try flashing again.', 'ลองสาย USB data ปิด Serial Monitor แล้วกด BOOT ค้างระหว่างเสียบ USB จากนั้นปล่อย BOOT และลองแฟลชอีกครั้ง'],
  'installer.displayHelp': ['Modules may need different inversion or SPI settings; change them from the device web page. An offset ST7735 image or an SH1106 OLED needs an adjusted profile and a new build.', 'จอแต่ละโมดูลอาจใช้ค่า inversion / SPI ต่างกัน ปรับได้ในเว็บบนเครื่อง หาก ST7735 ภาพเหลื่อม หรือ OLED ใช้ SH1106 ต้องแก้โปรไฟล์ก่อน build เพิ่มเติม'],
  'installer.eraseHelp': ['The installer offers installation and erase options. Erasing flash deletes saved settings.', 'ตัวแฟลชจะแสดงตัวเลือกติดตั้งและล้างข้อมูล การล้าง flash จะลบค่าที่เคยบันทึกไว้'],
  'release.loading': ['Checking firmware…', 'กำลังตรวจไฟล์เฟิร์มแวร์…'],
  'release.ready': ['v{version} · {board} · {driver} · File verified', 'v{version} · {board} · {driver} · ตรวจไฟล์แล้ว'],
  'release.missing': ['No firmware found for this board and display.', 'ไม่พบเฟิร์มแวร์ของบอร์ดและจอนี้'],
  'release.downloadError': ['Could not download the firmware.', 'ดาวน์โหลดไฟล์เฟิร์มแวร์ไม่ได้'],
  'release.sizeError': ['Firmware file size does not match.', 'ขนาดไฟล์เฟิร์มแวร์ไม่ตรง'],
  'release.hashError': ['Firmware checksum does not match.', 'Checksum ของเฟิร์มแวร์ไม่ตรง'],
  'release.profileError': ['Firmware metadata does not match the selected board or display.', 'ข้อมูลเฟิร์มแวร์ไม่ตรงกับบอร์ดหรือจอที่เลือก'],
  'release.formatError': ['Invalid merged firmware format.', 'รูปแบบไฟล์ merged firmware ไม่ถูกต้อง'],
  'release.metadataError': ['Invalid file size or checksum metadata.', 'ข้อมูลขนาดหรือ checksum ไม่ถูกต้อง'],
  'release.incomplete': ['Incomplete firmware file.', 'ไฟล์เฟิร์มแวร์ไม่ครบ'],
  'release.chipError': ['Firmware chip does not match the selected board.', 'ชิปในไฟล์เฟิร์มแวร์ไม่ตรงกับบอร์ดที่เลือก'],
  'browser.desktop': ['Use desktop Chrome / Edge to flash. Use your phone for device settings after flashing.', 'แฟลชผ่าน Chrome / Edge บนคอมพิวเตอร์ · มือถือใช้ตั้งค่าโหมดหลังแฟลชได้'],
  'browser.secure': ['Web Serial requires HTTPS or localhost.', 'ต้องเปิดเว็บผ่าน HTTPS หรือ localhost เพื่อใช้ Web Serial'],
  'browser.ready': ['Desktop Chrome / Edge · The installer checks the chip and shows live progress.', 'Chrome / Edge บนคอมพิวเตอร์ · ตัวแฟลชตรวจชิปและแสดงความคืบหน้าจริง'],
  'browser.failed': ['Could not load the installer. Please refresh the page.', 'โหลดระบบแฟลชไม่สำเร็จ กรุณารีเฟรชหน้าเว็บ'],
  'board.esp32-30pin': ['30-pin ESP-WROOM-32 / DevKit V1 · Flash 4 MB · Onboard USB-to-Serial', 'รุ่น 30 ขา ESP-WROOM-32 / DevKit V1 · Flash 4 MB · USB ผ่านชิป USB-to-Serial'],
  'board.esp32-c3-supermini': ['ESP32-C3 SuperMini · Flash 4 MB · USB Serial/JTAG · USB data cable', 'ESP32-C3 SuperMini · Flash 4 MB · USB Serial/JTAG · ใช้สาย USB data'],
  'board.esp32-c6-supermini': ['ESP32-C6 SuperMini · Flash 4 MB · USB Serial/JTAG · USB data cable', 'ESP32-C6 SuperMini · Flash 4 MB · USB Serial/JTAG · ใช้สาย USB data'],
  'profile.tft-80x160': ['Portrait 80×160 · Change rotation from your phone.', 'แนวตั้ง 80×160 • เปลี่ยนแนวเพิ่มเติมจากมือถือได้'],
  'profile.tft-80x160-landscape': ['Landscape 160×80 · Same 80×160 module and wiring.', 'แนวนอน 160×80 • ใช้จอ 80×160 และสายต่อชุดเดิม'],
  'profile.gmt130-240x240': ['GMT130-V1.0 · 7 pins, no CS · SPI Mode 3', 'GMT130-V1.0 • รุ่น 7 ขา ไม่มี CS • SPI Mode 3'],
  'profile.tft-240x240-st7789': ['Square ST7789 · Module with a CS pin', 'จอเหลี่ยม ST7789 • รุ่นที่มีขา CS'],
  'profile.tft-240x240-gc9a01': ['Round GC9A01 · Circular display area', 'จอกลม GC9A01 • พื้นที่แสดงผลทรงวงกลม'],
  'profile.oled-128x64': ['0.96-inch OLED · Monochrome · Address 0x3C / 0x3D', 'OLED 0.96 นิ้ว • สีเดียว • address 0x3C / 0x3D'],
  'sensor.mpu6050': ['AD0 → GND selects 0x68; connect to 3V3 for 0x69 · Accelerometer and gyro', 'AD0 → GND เลือก 0x68; ต่อ 3V3 เลือก 0x69 · มี accelerometer และ gyro'],
  'sensor.bmi160': ['CS / CSB → 3V3 enables I²C · SDO / SA0 → GND selects 0x68; connect to 3V3 for 0x69 · Accelerometer and gyro', 'CS / CSB → 3V3 เพื่อใช้ I²C · SDO / SA0 → GND เลือก 0x68; ต่อ 3V3 เลือก 0x69 · มี accelerometer และ gyro'],
  'mode.water': ['Liquid', 'น้ำปกติ'],
  'mode.water-inertia': ['Inertia water', 'น้ำมีแรงเฉื่อย'],
  'mode.water-swirl': ['Swirl water', 'น้ำวน'],
  'mode.water-full': ['Full-motion water', 'น้ำสมจริง'],
  'mode.pixel-flow': ['Pixel Flow', 'น้ำพิกเซล'],
  'mode.maze': ['Tilt maze', 'เขาวงกต'],
  'mode.snow': ['Snow globe', 'ลูกแก้วหิมะ'],
  'mode.pong': ['Orbit pong', 'Pong'],
  'mode.pet': ['Pocket eyes', 'ตาการ์ตูน'],
  'mode.dice': ['Shake & roll', 'ลูกเต๋า'],
  'detail.water': ['Classic water follows tilt; shake to make waves.', 'น้ำแบบเดิม ไหลตามการเอียงและเขย่าให้เกิดคลื่น'],
  'detail.water-inertia': ['Jolt the toy to send water in the opposite direction, then watch it settle.', 'กระตุกเครื่องให้น้ำซัดสวนทิศ แล้วไหลกลับ'],
  'detail.water-swirl': ['Spin around the screen to swirl the water. It keeps moving after you stop.', 'หมุนรอบจอให้น้ำวน หยุดหมุนแล้วน้ำยังเคลื่อนต่อ'],
  'detail.water-full': ['Tilt, jolt, or spin the toy. Water responds to all three forces.', 'เอียง กระตุก หรือหมุนเครื่อง น้ำตอบสนองครบทุกแรง'],
  'detail.pixel-flow': ['LED-style water drops: tilt to flow and shake to splash.', 'น้ำเม็ดละเอียดแบบจอ LED เอียงให้ไหล เขย่าให้กระเซ็น'],
  'detail.maze': ['Roll the ball to the goal.', 'กลิ้งลูกบอลไปยังเป้าหมาย'],
  'detail.snow': ['Shake the snow into the air, then watch it settle.', 'เขย่าให้หิมะฟุ้ง แล้วค่อย ๆ ตก'],
  'detail.pong': ['Tilt to move the paddle and catch the ball.', 'เอียงเพื่อเลื่อนแป้นรับลูกบอล'],
  'detail.pet': ['The eyes follow your tilt.', 'ดวงตาขยับตามการเอียง'],
  'detail.dice': ['Shake to roll the dice.', 'เขย่าเพื่อทอยลูกเต๋า'],
  'wiring.title': ['See every part. Connect every pin', 'เห็นอุปกรณ์ เห็นทุกสายที่ต้องต่อ'],
  'wiring.filters': ['Choose visible wires', 'เลือกสายที่แสดง'],
  'wiring.all': ['All wires', 'ทุกสาย'],
  'wiring.display': ['Display', 'จอ'],
  'wiring.practice': ['Try wiring it', 'ลองลากต่อสาย'],
  'wiring.finished': ['Show full diagram', 'ดูผังสำเร็จ'],
  'wiring.reset': ['Start over', 'เริ่มใหม่'],
  'wiring.scroll': ['Wiring diagram. Scroll horizontally to see all components.', 'ผังต่อสาย เลื่อนซ้ายขวาเพื่อดูอุปกรณ์ทั้งหมด'],
  'wiring.diagram': ['Wiring diagram for {board}, display, and sensor, with the module header positions.', 'ผังต่อสาย {board} กับจอและเซนเซอร์ ตามตำแหน่งขาจริงบนโมดูล'],
  'wiring.pairs': ['Pin-to-pin connections', 'pin ไหน ต่อ pin ไหน'],
  'wiring.help': ['Click a wire or connection to see both pins. Scroll the diagram sideways on mobile.', 'กดที่สายหรือรายการเพื่อดูคู่ pin · เลื่อนผังซ้าย–ขวาได้บนมือถือ'],
  'wiring.practiceHelp': ['Drag from a pin to its highlighted match. You can also tap pins or use Enter / Space.', 'ลากจากจุด pin ไปยังขาที่ไฮไลต์ · แตะทีละขาหรือใช้ Enter / Space ได้'],
  'wiring.physical': ['Headers follow common board and module layouts. If your module has a different pin order, follow its printed labels.', 'ภาพวางขาตามตำแหน่งจริงบนบอร์ดและโมดูลรุ่นที่พบบ่อย · ถ้าลำดับขาบนโมดูลของคุณต่างไป ให้ยึดตัวหนังสือบนโมดูลจริง'],
  'wiring.voltage': ['Use modules compatible with 3.3V power and logic. Connect all grounds together.', 'ใช้โมดูลที่รองรับไฟและลอจิก 3.3V · GND ร่วมกันทุกอุปกรณ์'],
  'wiring.source': ['Display module reference ↗', 'ดูข้อมูลโมดูลจอ ↗'],
  'wiring.i2c': ['OLED and {sensor} share I²C: SDA → GPIO{sda}, SCL → GPIO{scl}, with different addresses.', 'OLED และ {sensor} แชร์ I²C: SDA → GPIO{sda}, SCL → GPIO{scl} โดยมี address ต่างกัน'],
  'wiring.spi': ['SPI display SDA / DIN is MOSI → GPIO{mosi}; {sensor} SDA → GPIO{sda}', 'ขา SDA / DIN ของจอ SPI คือ MOSI → GPIO{mosi} ส่วน {sensor} SDA → GPIO{sda}'],
  'wiring.noCs': [' · The 7-pin GMT130 has no CS.', ' · GMT130 รุ่น 7 ขาไม่มี CS'],
  'wiring.boot': ['Use the onboard BOOT button on {board} (GPIO{pin}). Tap to change modes; hold 2 seconds to toggle Wi-Fi. Release BOOT at power-on or reset to boot normally.', 'ใช้ปุ่ม BOOT บน {board} (GPIO{pin}) · ไม่ต้องต่อปุ่มเพิ่ม · กดสั้นเปลี่ยนโหมด ค้าง 2 วินาทีเปิด/ปิด Wi-Fi · ปล่อย BOOT ขณะเปิดเครื่องหรือรีเซ็ตเพื่อบูตเล่นตามปกติ'],
  'wiring.bootShort': ['Onboard BOOT (GPIO{pin}) · No extra wire needed', 'ปุ่ม BOOT บนบอร์ด (GPIO{pin}) · ไม่ต้องต่อสายเพิ่ม'],
  'wiring.bootActions': ['Tap → Next mode · Hold 2 s → Toggle Wi-Fi', 'กดสั้น → เปลี่ยนโหมด · ค้าง 2 วิ → เปิด/ปิด Wi-Fi'],
  'wiring.backlight': ['BLK: Use the supply or driver specified for your display. Check whether this pin is an enable input or LED power. Do not connect a bare LED directly to a GPIO.', 'BLK: ต่อไฟหรือวงจรขับตามสเปกโมดูลจอ ตรวจว่าเป็นขา enable หรือไฟ LED ก่อนต่อ · ไม่ต่อ LED เปล่าเข้าขา GPIO'],
  'wiring.backlightShort': ['BLK: Use power or a driver as specified by the display module.', 'BLK: ต่อไฟหรือวงจรขับตามสเปกโมดูลจอ'],
  'wiring.backlightSupply': ['Power / driver as specified by the display', 'ไฟ / วงจรควบคุมตามสเปกจอ'],
  'wiring.grounds': ['All device grounds', 'GND ทุกอุปกรณ์'],
  'wiring.sensor': ['Motion sensor', 'โมดูลเซนเซอร์'],
  'wiring.cancel': ['Wire connection cancelled.', 'ยกเลิกการลากสายแล้ว'],
  'wiring.start': ['Start at either pin. Drag to a highlighted match, or select the two pins in order. Esc cancels.', 'เริ่มจากขาใดก็ได้ ลากไปยังขาที่ไฮไลต์ หรือกดเลือกขาต้นทางแล้วปลายทาง · Esc ยกเลิก'],
  'wiring.select': ['Select a wire to see its endpoints, or choose “Try wiring it” to practice every connection.', 'เลือกสายเพื่อดูต้นทางและปลายทาง หรือกด “ลองลากต่อสาย” เพื่อฝึกต่อให้ครบ'],
  'wiring.dragPair': [' · Drag between these two pins to connect them.', ' · ลากระหว่างขาคู่นี้เพื่อต่อสาย'],
  'wiring.wrong': ['These pins do not match the diagram: {first} ↔ {second}. Select a pin and connect to its highlighted match.', 'คู่นี้ไม่ตรงกับผัง: {first} ↔ {second} · เลือกขาใหม่แล้วต่อกับขาที่ไฮไลต์'],
  'wiring.done': [' · All wires connected!', ' · ครบทุกสายแล้ว!'],
  'wiring.checkBacklight': [' Check BL / BLK power against the display specification too.', ' ตรวจไฟ BL / BLK ตามสเปกจอด้วย'],
  'wiring.already': ['Already connected', 'ต่อไว้อยู่แล้ว'],
  'wiring.correct': ['Correct connection', 'ต่อถูกแล้ว'],
  'wiring.connected': [' connected', ' ต่อแล้ว'],
  'wiring.unconnected': [' not connected', ' ยังไม่ต่อ'],
  'wiring.count': ['{count} wires', '{count} สาย'],
  'wiring.drop': ['Drop the wire onto a highlighted pin to connect. Try dragging again.', 'ปล่อยสายบนจุด pin ที่ไฮไลต์เพื่อต่อ · ลองลากใหม่ได้'],
  'phone.title': ['Every mode. One little device', 'ทุกโหมด อยู่ในเครื่องเดียว'],
  'phone.copy': ['Choose modes and settings from your phone, then turn off Wi-Fi and keep playing.', 'ใช้มือถือเลือกโหมดและตั้งค่าได้ แล้วปิด Wi-Fi กลับไปเล่นบนพวงกุญแจ'],
  'phone.boot': ['Hold the onboard BOOT button for 2 seconds', 'กดปุ่ม BOOT บนบอร์ดค้าง 2 วินาที'],
  'phone.network': ['Enable device Wi-Fi: TiltToy-xxxx', 'เปิด Wi-Fi บนเครื่อง ชื่อ TiltToy-xxxx'],
  'phone.connect': ['Join Wi-Fi and open the device page', 'เชื่อม Wi-Fi แล้วเปิดหน้าเครื่อง'],
  'phone.password': ['Password', 'รหัส'],
  'phone.open': ['open', 'เปิด'],
  'phone.browser': ['in your browser', 'ในเบราว์เซอร์'],
  'phone.save': ['Choose a mode, save, and turn off Wi-Fi', 'เลือกโหมด กดบันทึก แล้วปิด Wi-Fi'],
  'phone.settings': ['Adjust water level, sensitivity, rotation, and BMI160 / MPU6050 gyro calibration.', 'ตั้งระดับน้ำ ความไว การหมุน และคาลิเบรต gyro ของ BMI160 / MPU6050 ได้'],
  'phone.timeout': ['Tap BOOT to change modes. Wi-Fi turns off after 3 minutes.', 'กด BOOT สั้น ๆ เพื่อเปลี่ยนโหมด · Wi-Fi ปิดเองใน 3 นาที']
};

let language = 'en';
const listeners = new Set();
export const getLanguage = () => language;
export function t(key, values = {}) {
  const template = messages[key]?.[language === 'th' ? 1 : 0] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name) => values[name] ?? match);
}
export function localizedError(key) {
  const error = new Error(t(key));
  error.translationKey = key;
  return error;
}
export function onLanguageChange(listener) { listeners.add(listener); return () => listeners.delete(listener); }
export function setLanguage(value) {
  language = value === 'th' ? 'th' : 'en';
  try { localStorage.setItem('tilt-toy-language', language); } catch {}
  for (const listener of listeners) listener(language);
}
export function translatePage(root = document) {
  root.documentElement.lang = language;
  for (const attribute of ['text', 'aria-label', 'content']) {
    const marker = attribute === 'text' ? 'data-i18n' : `data-i18n-${attribute}`;
    root.querySelectorAll(`[${marker}]`).forEach(element => {
      const value = t(element.getAttribute(marker));
      if (attribute === 'text') element.textContent = value;
      else element.setAttribute(attribute, value);
    });
  }
  const button = root.getElementById('language-toggle');
  button.textContent = language === 'en' ? 'ภาษาไทย' : 'English';
  button.lang = language === 'en' ? 'th' : 'en';
  button.setAttribute('aria-label', language === 'en' ? 'Switch to Thai' : 'เปลี่ยนเป็นภาษาอังกฤษ');
}
export function initLanguage() {
  try { language = localStorage.getItem('tilt-toy-language') === 'th' ? 'th' : 'en'; } catch {}
  translatePage();
  onLanguageChange(() => translatePage());
  document.getElementById('language-toggle').addEventListener('click', () => setLanguage(language === 'en' ? 'th' : 'en'));
}
