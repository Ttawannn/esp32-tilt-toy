import { t, localizedError } from './i18n.js';
// Physical header order as printed on the board, top to bottom: [silkscreen, pin id].
const gpio = (label, n = label) => [String(label), `GPIO${n}`];
export const boards = [
  {
    id: 'esp32-30pin', name: 'ESP32 30-pin', chipFamily: 'ESP32', module: 'ESP-WROOM-32 / DevKit V1', firmwareId: 0,
    chipId: 0, target: 'esp32', bootloaderOffset: 0x1000,
    fqbn: 'esp32:esp32:esp32:FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 21, SCL: 22, SCK: 18, MOSI: 23, CS: 27, DC: 26, RST: 25, BUTTON: 0 },
    get note() { return t('board.esp32-30pin'); },
    reserved: [0, 2, 5, 6, 7, 8, 9, 10, 11, 12, 15, 34, 35, 36, 39],
    // Antenna at the top, micro USB at the bottom.
    header: {
      left: [['EN', 'EN'], gpio('VP', 36), gpio('VN', 39), gpio('D34', 34), gpio('D35', 35), gpio('D32', 32), gpio('D33', 33), gpio('D25', 25), gpio('D26', 26), gpio('D27', 27), gpio('D14', 14), gpio('D12', 12), gpio('D13', 13), ['GND', 'GND'], ['VIN', 'VIN']],
      right: [gpio('D23', 23), gpio('D22', 22), gpio('TX0', 1), gpio('RX0', 3), gpio('D21', 21), gpio('D19', 19), gpio('D18', 18), gpio('D5', 5), gpio('TX2', 17), gpio('RX2', 16), gpio('D4', 4), gpio('D2', 2), gpio('D15', 15), ['GND', 'GND'], ['3V3', '3V3']]
    }
  },
  {
    id: 'esp32-c3-supermini', name: 'ESP32-C3 SuperMini', chipFamily: 'ESP32-C3', module: 'SuperMini', firmwareId: 1,
    chipId: 5, target: 'esp32c3', bootloaderOffset: 0,
    fqbn: 'esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 4, SCL: 5, SCK: 6, MOSI: 7, CS: 10, DC: 3, RST: 1, BUTTON: 9 },
    get note() { return t('board.esp32-c3-supermini'); },
    reserved: [2, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19],
    // USB-C at the top.
    header: {
      left: [gpio(5), gpio(6), gpio(7), gpio(8), gpio(9), gpio(10), gpio(20), gpio(21)],
      right: [['5V', '5V'], ['GND', 'GND'], ['3.3', '3V3'], gpio(4), gpio(3), gpio(2), gpio(1), gpio(0)]
    }
  },
  {
    id: 'esp32-c6-supermini', name: 'ESP32-C6 SuperMini', chipFamily: 'ESP32-C6', module: 'SuperMini', firmwareId: 2,
    chipId: 13, target: 'esp32c6', bootloaderOffset: 0,
    fqbn: 'esp32:esp32:esp32c6:CDCOnBoot=cdc,FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 0, SCL: 1, SCK: 6, MOSI: 7, CS: 18, DC: 19, RST: 20, BUTTON: 9 },
    get note() { return t('board.esp32-c6-supermini'); },
    reserved: [4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 26, 27, 28, 29, 30],
    // USB-C at the top.
    header: {
      left: [gpio('TX', 16), gpio('RX', 17), gpio(0), gpio(1), gpio(2), gpio(3), gpio(4), gpio(5), gpio(6), gpio(7)],
      right: [['5V', '5V'], ['GND', 'GND'], ['3V3', '3V3'], gpio(20), gpio(19), gpio(18), gpio(15), gpio(14), gpio(9), gpio(8)]
    }
  }
];

export const defaultBoard = boards[2];
export function findBoard(id) { return boards.find(board => board.id === id) || defaultBoard; }
// Keep the existing C6 download URLs; the other chips have their own directories.
export function releasePath(profile, board = defaultBoard) {
  return `${board.id === defaultBoard.id ? '' : board.id + '/'}${profile.id}`;
}

export function validateFirmwareImage(bytes, board = defaultBoard) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (data.byteLength < 0x10000 + 24) throw localizedError('release.incomplete');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (const offset of [board.bootloaderOffset, 0x10000]) {
    if (view.getUint8(offset) !== 0xE9 || view.getUint16(offset + 12, true) !== board.chipId) throw localizedError('release.chipError');
  }
}
