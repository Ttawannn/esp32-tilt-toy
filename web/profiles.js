export const VERSION = '0.1.0';
export const profiles = [
  { id: 'tft-80x160', name: 'TFT 80 × 160', short: 'Pocket TFT', driver: 'ST7735S', width: 80, height: 160, shape: 'rectangle', bus: 'SPI', firmwareId: 0, cs: 18, defaultSpiMode: 0, note: 'จอเล็กแนวตั้ง • โปรไฟล์ ST7735S Mini 160×80', source: 'https://www.waveshare.com/wiki/0.96inch_LCD_Module' },
  { id: 'gmt130-240x240', name: 'GMT130 240 × 240', short: 'GMT130', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 1, cs: -1, defaultSpiMode: 3, note: 'GMT130-V1.0 • รุ่น 7 ขา ไม่มี CS • SPI Mode 3', source: 'https://goldenmorninglcd.com/tft-display-module/1.3-inch-240x240-st7789-gmt130-v1.0/' },
  { id: 'tft-240x240-st7789', name: 'TFT 240 × 240', short: 'Square TFT', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 2, cs: 18, defaultSpiMode: 0, note: 'จอเหลี่ยม ST7789 • รุ่นที่มีขา CS', source: 'https://adafruit.github.io/Adafruit-ST7735-Library/html/class_adafruit___s_t7789.html' },
  { id: 'tft-240x240-gc9a01', name: 'TFT 240 × 240', short: 'Round TFT', driver: 'GC9A01', width: 240, height: 240, shape: 'round', bus: 'SPI', firmwareId: 3, cs: 18, defaultSpiMode: 0, note: 'จอกลม GC9A01 • พื้นที่แสดงผลทรงวงกลม', source: 'https://www.waveshare.com/wiki/1.28inch_LCD_Module' },
  { id: 'oled-128x64', name: 'OLED 128 × 64', short: 'Mono OLED', driver: 'SSD1306', width: 128, height: 64, shape: 'rectangle', bus: 'I²C', firmwareId: 4, cs: -1, mono: true, note: 'OLED 0.96 นิ้ว • สีเดียว • address 0x3C / 0x3D', source: 'https://learn.adafruit.com/monochrome-oled-breakouts?view=all' }
];
export const displayChoices = [
  { id: 'tft-80x160', title: 'TFT 80 × 160', subtitle: '0.96” · ST7735S', shape: 'portrait' },
  { id: 'gmt130-240x240', title: 'GMT130 240 × 240', subtitle: '1.3” · ST7789', shape: 'square' },
  { id: 'tft-240x240', title: 'TFT 240 × 240', subtitle: 'ST7789 / GC9A01', shape: 'round' },
  { id: 'oled-128x64', title: 'OLED 128 × 64', subtitle: '0.96” · SSD1306', shape: 'wide' }
];
export const modes = [
  { id: 'water', name: 'น้ำในลูกแก้ว', english: 'Liquid', detail: 'เอียงให้น้ำไหล เขย่าให้เกิดคลื่น', glyph: '≈' },
  { id: 'maze', name: 'เขาวงกต', english: 'Tilt maze', detail: 'กลิ้งลูกบอลไปยังเป้าหมาย', glyph: '⊙' },
  { id: 'snow', name: 'ลูกแก้วหิมะ', english: 'Snow globe', detail: 'เขย่าให้หิมะฟุ้ง แล้วค่อย ๆ ตก', glyph: '✳' },
  { id: 'pong', name: 'Pong', english: 'Orbit pong', detail: 'เอียงเพื่อเลื่อนแป้นรับลูกบอล', glyph: '◒' },
  { id: 'pet', name: 'ตาการ์ตูน', english: 'Pocket eyes', detail: 'ดวงตาขยับตามการเอียง', glyph: '••' },
  { id: 'dice', name: 'ลูกเต๋า', english: 'Shake & roll', detail: 'เขย่าเพื่อทอยลูกเต๋า', glyph: '⚄' }
];
export function findProfile(choice, driver = 'GC9A01') {
  const id = choice === 'tft-240x240' ? (driver === 'ST7789' ? 'tft-240x240-st7789' : 'tft-240x240-gc9a01') : choice;
  return profiles.find(p => p.id === id) || profiles[0];
}
export function wiringFor(profile) {
  const rows = profile.mono ? [['OLED SDA', 'GPIO0'], ['OLED SCL', 'GPIO1']] : [['SCK / CLK', 'GPIO6'], ['SDA / DIN / MOSI', 'GPIO7'], ['DC', 'GPIO19'], ['RES / RST', 'GPIO20'], ...(profile.cs >= 0 ? [['CS', 'GPIO18']] : []), ['BL / BLK', '3V3 / วงจรควบคุมไฟจอ']];
  return [...rows, ['GY-521 SDA', 'GPIO0'], ['GY-521 SCL', 'GPIO1'], ['ปุ่มกด → GND', 'GPIO2'], ['GND ทุกอุปกรณ์', 'GND']];
}
export function validateRelease(release, profile) {
  if (!release || release.version !== VERSION || release.profile !== profile.id || release.controller !== profile.driver || release.chipFamily !== 'ESP32-C6' || release.flashSize !== '4MB' || release.build?.displayProfile !== profile.firmwareId || !Array.isArray(release.builds) || release.builds.length !== 1) throw new Error('ข้อมูลเฟิร์มแวร์ไม่ตรงกับบอร์ดหรือจอที่เลือก');
  const build = release.builds[0];
  if (build.chipFamily !== 'ESP32-C6' || !Array.isArray(build.parts) || build.parts.length !== 1 || build.parts[0].offset !== 0 || build.parts[0].path !== `./${profile.id}.bin`) throw new Error('รูปแบบไฟล์ merged firmware ไม่ถูกต้อง');
  if (!Number.isInteger(release.size) || release.size < 65536 || release.size > 4194304 || !/^[a-f0-9]{64}$/.test(release.sha256 || '')) throw new Error('ข้อมูลขนาดหรือ checksum ไม่ถูกต้อง');
  return release;
}
