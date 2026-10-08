import { t, localizedError } from './i18n.js';
import { defaultBoard } from './boards.js';
export const VERSION = '0.1.4';
// Module headers left to right as printed: 'SILK' or 'SILK:pin', where pin is the wiring id and an empty pin is not wired.
const st7735Header = ['GND', 'VCC', 'SCL:CLK', 'SDA:DIN', 'RES:RST', 'DC', 'CS', 'BLK:'];
export const profiles = [
  { id: 'tft-80x160', name: 'TFT 80 × 160', short: 'Pocket TFT · Portrait', driver: 'ST7735S', width: 80, height: 160, shape: 'rectangle', bus: 'SPI', firmwareId: 0, defaultRotation: 0, hasCs: true, defaultSpiMode: 0, get note() { return t('profile.tft-80x160'); }, art: 'st7735', header: st7735Header, source: 'https://www.waveshare.com/wiki/0.96inch_LCD_Module' },
  { id: 'tft-80x160-landscape', name: 'TFT 160 × 80', short: 'Pocket TFT · Landscape', driver: 'ST7735S', width: 160, height: 80, shape: 'rectangle', bus: 'SPI', firmwareId: 5, defaultRotation: 1, hasCs: true, defaultSpiMode: 0, get note() { return t('profile.tft-80x160-landscape'); }, art: 'st7735', header: st7735Header, source: 'https://www.waveshare.com/wiki/0.96inch_LCD_Module' },
  { id: 'gmt130-240x240', name: 'GMT130 240 × 240', short: 'GMT130', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 1, hasCs: false, defaultSpiMode: 3, get note() { return t('profile.gmt130-240x240'); }, art: 'gmt130', header: ['GND', 'VCC', 'SCK:CLK', 'SDA:DIN', 'RES:RST', 'DC', 'BLK:'], source: 'https://goldenmorninglcd.com/tft-display-module/1.3-inch-240x240-st7789-gmt130-v1.0/' },
  { id: 'tft-240x240-st7789', name: 'TFT 240 × 240', short: 'Square TFT', driver: 'ST7789', width: 240, height: 240, shape: 'square', bus: 'SPI', firmwareId: 2, hasCs: true, defaultSpiMode: 0, get note() { return t('profile.tft-240x240-st7789'); }, art: 'st7789', header: ['GND', 'VCC', 'SCL:CLK', 'SDA:DIN', 'RES:RST', 'DC', 'CS', 'BLK:'], source: 'https://adafruit.github.io/Adafruit-ST7735-Library/html/class_adafruit___s_t7789.html' },
  { id: 'tft-240x240-gc9a01', name: 'TFT 240 × 240', short: 'Round TFT', driver: 'GC9A01', width: 240, height: 240, shape: 'round', bus: 'SPI', firmwareId: 3, hasCs: true, defaultSpiMode: 0, get note() { return t('profile.tft-240x240-gc9a01'); }, art: 'gc9a01', header: ['RST', 'CS', 'DC', 'SDA:DIN', 'SCL:CLK', 'GND', 'VCC'], source: 'https://www.waveshare.com/wiki/1.28inch_LCD_Module' },
  { id: 'oled-128x64', name: 'OLED 128 × 64', short: 'Mono OLED', driver: 'SSD1306', width: 128, height: 64, shape: 'rectangle', bus: 'I²C', firmwareId: 4, hasCs: false, mono: true, get note() { return t('profile.oled-128x64'); }, art: 'oled', header: ['GND', 'VCC', 'SCL', 'SDA'], source: 'https://learn.adafruit.com/monochrome-oled-breakouts?view=all' }
];
export const displayChoices = [
  { id: 'tft-80x160', title: 'TFT 80 × 160', subtitle: '0.96” · ST7735S', shape: 'portrait' },
  { id: 'gmt130-240x240', title: 'GMT130 240 × 240', subtitle: '1.3” · ST7789', shape: 'square' },
  { id: 'tft-240x240', title: 'TFT 240 × 240', subtitle: 'ST7789 / GC9A01', shape: 'round' },
  { id: 'oled-128x64', title: 'OLED 128 × 64', subtitle: '0.96” · SSD1306', shape: 'wide' }
];
export const modes = [
  { id: 'water', get name() { return t('mode.water'); }, english: 'Liquid', get detail() { return t('detail.water'); }, glyph: '≈' },
  { id: 'water-inertia', get name() { return t('mode.water-inertia'); }, english: 'Inertia water', get detail() { return t('detail.water-inertia'); }, glyph: '↝' },
  { id: 'water-swirl', get name() { return t('mode.water-swirl'); }, english: 'Swirl water', get detail() { return t('detail.water-swirl'); }, glyph: '◎' },
  { id: 'water-full', get name() { return t('mode.water-full'); }, english: 'Full-motion water', get detail() { return t('detail.water-full'); }, glyph: '≋' },
  { id: 'pixel-flow', get name() { return t('mode.pixel-flow'); }, english: 'Pixel Flow', get detail() { return t('detail.pixel-flow'); }, glyph: '▦' },
  { id: 'maze', get name() { return t('mode.maze'); }, english: 'Tilt maze', get detail() { return t('detail.maze'); }, glyph: '⊙' },
  { id: 'snow', get name() { return t('mode.snow'); }, english: 'Snow globe', get detail() { return t('detail.snow'); }, glyph: '✳' },
  { id: 'pong', get name() { return t('mode.pong'); }, english: 'Orbit pong', get detail() { return t('detail.pong'); }, glyph: '◒' },
  { id: 'pet', get name() { return t('mode.pet'); }, english: 'Pocket eyes', get detail() { return t('detail.pet'); }, glyph: '••' },
  { id: 'dice', get name() { return t('mode.dice'); }, english: 'Shake & roll', get detail() { return t('detail.dice'); }, glyph: '⚄' }
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
  { id: 'mpu6050', name: 'MPU6050', module: 'GY-521 / MPU6050', gyro: true, address: '0x68 / 0x69', get note() { return t('sensor.mpu6050'); }, straps: [['AD0', 'GND', 'ground']], header: ['VCC', 'GND', 'SCL', 'SDA', 'XDA:', 'XCL:', 'AD0', 'INT:'] },
  { id: 'bmi160', name: 'BMI160', module: 'BMI160', gyro: true, address: '0x68 / 0x69', get note() { return t('sensor.bmi160'); }, straps: [['CS', '3V3', 'power'], ['SDO', 'GND', 'ground']], header: ['VIN:VCC', '3.3V:', 'GND', 'SCL', 'SDA', 'CS', 'SA0:SDO'], extraHeader: ['OCS', 'INT2', 'INT1', 'SCX', 'SDX'] }
];
export function headerSlots(header) {
  return header.map(slot => { const [label, pin = label] = slot.split(':'); return { label, pin: pin || null }; });
}
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
    connection('display', 'VCC', '3V3', 'power', `${t('wiring.display')} VCC`),
    connection('display', 'GND', 'GND', 'ground', `${t('wiring.display')} GND`),
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
  return [...display.map(c => [c.label, c.boardPin]), ...(!profile.mono ? [['BL / BLK', t('wiring.backlightSupply')]] : []), ...connections.filter(c => c.device === 'sensor' && ['SDA', 'SCL'].includes(c.pin)).map(c => [c.label, c.boardPin]), [t('wiring.grounds'), 'GND']];
}
export function validateRelease(release, profile, board = defaultBoard) {
  if (!release || release.version !== VERSION || release.board !== board.id || release.profile !== profile.id || release.controller !== profile.driver || release.chipFamily !== board.chipFamily || release.flashSize !== '4MB' || release.build?.boardProfile !== board.firmwareId || release.build?.fqbn !== board.fqbn || release.build?.bootloaderOffset !== board.bootloaderOffset || release.build?.displayProfile !== profile.firmwareId || release.build?.initialRotation !== (profile.defaultRotation || 0) || !Array.isArray(release.builds) || release.builds.length !== 1) throw localizedError('release.profileError');
  const build = release.builds[0];
  if (build.chipFamily !== board.chipFamily || !Array.isArray(build.parts) || build.parts.length !== 1 || build.parts[0].offset !== 0 || build.parts[0].path !== `./${profile.id}.bin`) throw localizedError('release.formatError');
  if (!Number.isInteger(release.size) || release.size < 65536 || release.size > 4194304 || !/^[a-f0-9]{64}$/.test(release.sha256 || '')) throw localizedError('release.metadataError');
  return release;
}
