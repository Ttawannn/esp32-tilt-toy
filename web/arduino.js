// Arduino IDE setup for the single-file sketch of each board and display.
// scripts/build-web.mjs writes the sketches; the installer shows these settings next to the download.
export const CORE = { name: 'esp32 by Espressif Systems', version: '3.3.11', url: 'https://espressif.github.io/arduino-esp32/package_esp32_index.json' };
export const BASE_LIBRARIES = [['Adafruit GFX Library', '1.12.6'], ['Adafruit BusIO', '1.17.4']];
const DISPLAY_LIBRARIES = {
  st7735: ['Adafruit ST7735 and ST7789 Library', '1.11.0', 'Adafruit_ST7735.h'],
  st7789: ['Adafruit ST7735 and ST7789 Library', '1.11.0', 'Adafruit_ST7789.h'],
  gc9a01: ['Adafruit GC9A01A', '1.1.1', 'Adafruit_GC9A01A.h'],
  ssd1306: ['Adafruit SSD1306', '2.5.17', 'Adafruit_SSD1306.h']
};
export const DISPLAY_HEADERS = Object.values(DISPLAY_LIBRARIES).map(([, , header]) => header);
// DISPLAY_PROFILE in config.h: 0/5 ST7735 Mini, 1 GMT130 (ST7789), 3 GC9A01, 4 SSD1306.
const displayKind = profile => ({ 0: 'st7735', 5: 'st7735', 1: 'st7789', 3: 'gc9a01', 4: 'ssd1306' })[profile.firmwareId];
export function displayLibrary(profile) { const [name, version, header] = DISPLAY_LIBRARIES[displayKind(profile)]; return { name, version, header }; }
export function libraries(profile) { const display = displayLibrary(profile); return [...BASE_LIBRARIES, [display.name, display.version]]; }

// Arduino sketch names: a letter first, then letters, digits and underscores.
export function sketchName(board, profile) { return `tilt_toy_${board.id}_${profile.id}`.replace(/[^A-Za-z0-9_]/g, '_'); }
export function sketchPath(board, profile) { return `arduino/${sketchName(board, profile)}.ino`; }

const IDE_BOARDS = { esp32: 'ESP32 Dev Module', esp32c3: 'ESP32C3 Dev Module', esp32c6: 'ESP32C6 Dev Module' };
const MENU_VALUES = {
  CDCOnBoot: { cdc: 'Enabled' },
  FlashMode: { dio: 'DIO' },
  FlashSize: { '4M': '4MB (32Mb)' },
  PartitionScheme: { huge_app: 'Huge APP (3MB No OTA/1MB SPIFFS)' }
};
const MENU_KEYS = { CDCOnBoot: 'cdc', FlashSize: 'flashSize', FlashMode: 'flashMode', PartitionScheme: 'partition' };
// Tools menu rows [key, value], read from the FQBN the release firmware is built with.
export function ideSettings(board) {
  const options = Object.fromEntries(board.fqbn.split(':').slice(3).join(':').split(',').filter(Boolean).map(pair => pair.split('=')));
  const rows = [['board', IDE_BOARDS[board.target]]];
  for (const [option, key] of Object.entries(MENU_KEYS)) {
    if (!(option in options)) continue;
    const value = MENU_VALUES[option][options[option]];
    if (!value) throw Error(`No Arduino IDE label for ${option}=${options[option]}`);
    rows.push([key, value]);
  }
  rows.push(['uploadSpeed', '921600'], ['port', board.target === 'esp32' ? 'COMx (CP210x / CH340)' : 'COMx (USB JTAG/serial)']);
  return rows;
}
