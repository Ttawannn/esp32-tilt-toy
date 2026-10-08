import { defaultBoard } from './boards.js';
export const VERSION = '0.1.4';
export const profiles = [
  { id: 'tft-80x160', name: 'TFT 80 × 160', short: 'Pocket TFT · Portrait', driver: 'ST7735S', width: 80, height: 160, shape: 'rectangle', bus: 'SPI', firmwareId: 0, defaultRotation: 0, hasCs: true, defaultSpiMode: 0, note: 'แนวตั้ง 80×160 • เปลี่ยนแนวเพิ่มเติมจากมือถือได้', source: 'https://www.waveshare.com/wiki/0.96inch_LCD_Module' },
  { id: 'tft-80x160-landscape', name: 'TFT 160 × 80', short: 'Pocket TFT · Landscape', driver: 'ST7735S', width: 160, height: 80, shape: 'rectangle', bus: 'SPI', firmwareId: 5, defaultRotation: 1, hasCs: true, defaultSpiMode: 0, note: 'แนวนอน 160×80 • ใช้จอ 80×160 และสายต่อชุดเดิม', source: 'https://www.waveshare.com/wiki/0.96inch_LCD_Module' },
  { id: 'gmt130-240x240', name: 'GMT130 240 × 240', short: 'GMT130', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 1, hasCs: false, defaultSpiMode: 3, note: 'GMT130-V1.0 • รุ่น 7 ขา ไม่มี CS • SPI Mode 3', source: 'https://goldenmorninglcd.com/tft-display-module/1.3-inch-240x240-st7789-gmt130-v1.0/' },
  { id: 'tft-240x240-st7789', name: 'TFT 240 × 240', short: 'Square TFT', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 2, hasCs: true, defaultSpiMode: 0, note: 'จอเหลี่ยม ST7789 • รุ่นที่มีขา CS', source: 'https://adafruit.github.io/Adafruit-ST7735-Library/html/class_adafruit___s_t7789.html' },
  { id: 'tft-240x240-gc9a01', name: 'TFT 240 × 240', short: 'Round TFT', driver: 'GC9A01', width: 240, height: 240, shape: 'round', bus: 'SPI', firmwareId: 3, hasCs: true, defaultSpiMode: 0, note: 'จอกลม GC9A01 • พื้นที่แสดงผลทรงวงกลม', source: 'https://www.waveshare.com/wiki/1.28inch_LCD_Module' },
  { id: 'oled-128x64', name: 'OLED 128 × 64', short: 'Mono OLED', driver: 'SSD1306', width: 128, height: 64, shape: 'rectangle', bus: 'I²C', firmwareId: 4, hasCs: false, mono: true, note: 'OLED 0.96 นิ้ว • สีเดียว • address 0x3C / 0x3D', source: 'https://learn.adafruit.com/monochrome-oled-breakouts?view=all' }
];
export const displayChoices = [
  { id: 'tft-80x160', title: 'TFT 80 × 160', subtitle: '0.96” · ST7735S', shape: 'portrait' },
  { id: 'gmt130-240x240', title: 'GMT130 240 × 240', subtitle: '1.3” · ST7789', shape: 'square' },
  { id: 'tft-240x240', title: 'TFT 240 × 240', subtitle: 'ST7789 / GC9A01', shape: 'round' },
  { id: 'oled-128x64', title: 'OLED 128 × 64', subtitle: '0.96” · SSD1306', shape: 'wide' }
];
export const modes = [
  { id: 'water', name: 'น้ำปกติ', english: 'Liquid', detail: 'น้ำแบบเดิม ไหลตามการเอียงและเขย่าให้เกิดคลื่น', glyph: '≈' },
  { id: 'water-inertia', name: 'น้ำมีแรงเฉื่อย', english: 'Inertia water', detail: 'กระตุกเครื่องให้น้ำซัดสวนทิศ แล้วไหลกลับ', glyph: '↝' },
  { id: 'water-swirl', name: 'น้ำวน', english: 'Swirl water', detail: 'หมุนรอบจอให้น้ำวน หยุดหมุนแล้วน้ำยังเคลื่อนต่อ', glyph: '◎' },
  { id: 'water-full', name: 'น้ำสมจริง', english: 'Full-motion water', detail: 'เอียง กระตุก หรือหมุนเครื่อง น้ำตอบสนองครบทุกแรง', glyph: '≋' },
  { id: 'pixel-flow', name: 'น้ำพิกเซล', english: 'Pixel Flow', detail: 'น้ำเม็ดละเอียดแบบจอ LED เอียงให้ไหล เขย่าให้กระเซ็น', glyph: '▦' },
  { id: 'maze', name: 'เขาวงกต', english: 'Tilt maze', detail: 'กลิ้งลูกบอลไปยังเป้าหมาย', glyph: '⊙' },
  { id: 'snow', name: 'ลูกแก้วหิมะ', english: 'Snow globe', detail: 'เขย่าให้หิมะฟุ้ง แล้วค่อย ๆ ตก', glyph: '✳' },
  { id: 'pong', name: 'Pong', english: 'Orbit pong', detail: 'เอียงเพื่อเลื่อนแป้นรับลูกบอล', glyph: '◒' },
  { id: 'pet', name: 'ตาการ์ตูน', english: 'Pocket eyes', detail: 'ดวงตาขยับตามการเอียง', glyph: '••' },
  { id: 'dice', name: 'ลูกเต๋า', english: 'Shake & roll', detail: 'เขย่าเพื่อทอยลูกเต๋า', glyph: '⚄' }
];
export function findProfile(choice, driver = 'GC9A01', orientation = 'portrait') {
  const id = choice === 'tft-240x240' ? (driver === 'ST7789' ? 'tft-240x240-st7789' : 'tft-240x240-gc9a01') : choice === 'tft-80x160' && orientation === 'landscape' ? 'tft-80x160-landscape' : choice;
  return profiles.find(p => p.id === id) || profiles[0];
}
export const wireSignals = {
  power: { color: '#c25d4a', label: '3.3V' },
  ground: { color: '#66736b', label: 'GND' },
  clock: { color: '#c08a29', label: 'Clock' },
  data: { color: '#448b98', label: 'Data' },
  control: { color: '#9274ac', label: 'Control' }
};
export const sensors = [
  { id: 'mpu6050', name: 'MPU6050', module: 'GY-521 / MPU6050', gyro: true, address: '0x68 / 0x69', note: 'AD0 → GND เลือก 0x68; ต่อ 3V3 เลือก 0x69 · มี accelerometer และ gyro', straps: [['AD0', 'GND', 'ground']] },
  { id: 'bmi160', name: 'BMI160', module: 'BMI160', gyro: true, address: '0x68 / 0x69', note: 'CS / CSB → 3V3 เพื่อใช้ I²C · SDO / SA0 → GND เลือก 0x68; ต่อ 3V3 เลือก 0x69 · มี accelerometer และ gyro', straps: [['CS', '3V3', 'power'], ['SDO', 'GND', 'ground']] }
];
export function findSensor(id = 'mpu6050') { return sensors.find(sensor => sensor.id === id) || sensors[0]; }
export function wiringConnections(profile, sensorId = 'mpu6050', board = defaultBoard) {
  const sensor = findSensor(sensorId);
  const gpio = name => `GPIO${board.pins[name]}`;
  const connection = (device, pin, boardPin, signal, label = pin) => ({
    id: `${device}:${pin}`, device, pin, boardPin, signal, label,
    from: `board:${boardPin}`, to: `${device}:${pin}`
  });
  const display = profile.mono
    ? [connection('display', 'SDA', gpio('SDA'), 'data', 'OLED SDA'), connection('display', 'SCL', gpio('SCL'), 'clock', 'OLED SCL')]
    : [connection('display', 'CLK', gpio('SCK'), 'clock', 'SCK / CLK'), connection('display', 'DIN', gpio('MOSI'), 'data', 'SDA / DIN / MOSI'), connection('display', 'DC', gpio('DC'), 'control'), connection('display', 'RST', gpio('RST'), 'control', 'RES / RST'), ...(profile.hasCs ? [connection('display', 'CS', gpio('CS'), 'control')] : [])];
  return [
    ...display,
    connection('display', 'VCC', '3V3', 'power', 'จอ VCC'),
    connection('display', 'GND', 'GND', 'ground', 'จอ GND'),
    connection('sensor', 'SDA', gpio('SDA'), 'data', `${sensor.module} SDA`),
    connection('sensor', 'SCL', gpio('SCL'), 'clock', `${sensor.module} SCL`),
    connection('sensor', 'VCC', '3V3', 'power', `${sensor.module} VCC`),
    connection('sensor', 'GND', 'GND', 'ground', `${sensor.module} GND`),
    ...sensor.straps.map(([pin, boardPin, signal]) => connection('sensor', pin, boardPin, signal, `${sensor.module} ${pin}`))
  ];
}
export function wiringFor(profile, sensorId = 'mpu6050', board = defaultBoard) {
  const connections = wiringConnections(profile, sensorId, board);
  const display = connections.filter(c => c.device === 'display' && !['power', 'ground'].includes(c.signal));
  return [...display.map(c => [c.label, c.boardPin]), ...(!profile.mono ? [['BL / BLK', 'ไฟ / วงจรควบคุมตามสเปกจอ']] : []), ...connections.filter(c => c.device === 'sensor' && ['SDA', 'SCL'].includes(c.pin)).map(c => [c.label, c.boardPin]), ['GND ทุกอุปกรณ์', 'GND']];
}
export function validateRelease(release, profile, board = defaultBoard) {
  if (!release || release.version !== VERSION || release.board !== board.id || release.profile !== profile.id || release.controller !== profile.driver || release.chipFamily !== board.chipFamily || release.flashSize !== '4MB' || release.build?.boardProfile !== board.firmwareId || release.build?.fqbn !== board.fqbn || release.build?.bootloaderOffset !== board.bootloaderOffset || release.build?.displayProfile !== profile.firmwareId || release.build?.initialRotation !== (profile.defaultRotation || 0) || !Array.isArray(release.builds) || release.builds.length !== 1) throw new Error('ข้อมูลเฟิร์มแวร์ไม่ตรงกับบอร์ดหรือจอที่เลือก');
  const build = release.builds[0];
  if (build.chipFamily !== board.chipFamily || !Array.isArray(build.parts) || build.parts.length !== 1 || build.parts[0].offset !== 0 || build.parts[0].path !== `./${profile.id}.bin`) throw new Error('รูปแบบไฟล์ merged firmware ไม่ถูกต้อง');
  if (!Number.isInteger(release.size) || release.size < 65536 || release.size > 4194304 || !/^[a-f0-9]{64}$/.test(release.sha256 || '')) throw new Error('ข้อมูลขนาดหรือ checksum ไม่ถูกต้อง');
  return release;
}
