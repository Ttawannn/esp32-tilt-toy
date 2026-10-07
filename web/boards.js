export const boards = [
  {
    id: 'esp32-30pin', name: 'ESP32 30-pin', chipFamily: 'ESP32', module: 'ESP-WROOM-32 / DevKit V1', firmwareId: 0,
    chipId: 0, target: 'esp32', bootloaderOffset: 0x1000,
    fqbn: 'esp32:esp32:esp32:FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 21, SCL: 22, SCK: 18, MOSI: 23, CS: 27, DC: 26, RST: 25, BUTTON: 0 },
    note: 'รุ่น 30 ขา ESP-WROOM-32 / DevKit V1 · Flash 4 MB · USB ผ่านชิป USB-to-Serial',
    reserved: [0, 2, 5, 6, 7, 8, 9, 10, 11, 12, 15, 34, 35, 36, 39]
  },
  {
    id: 'esp32-c3-supermini', name: 'ESP32-C3 SuperMini', chipFamily: 'ESP32-C3', module: 'SuperMini', firmwareId: 1,
    chipId: 5, target: 'esp32c3', bootloaderOffset: 0,
    fqbn: 'esp32:esp32:esp32c3:CDCOnBoot=cdc,FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 4, SCL: 5, SCK: 6, MOSI: 7, CS: 10, DC: 3, RST: 1, BUTTON: 9 },
    note: 'ESP32-C3 SuperMini · Flash 4 MB · USB Serial/JTAG · ใช้สาย USB data',
    reserved: [2, 8, 9, 12, 13, 14, 15, 16, 17, 18, 19]
  },
  {
    id: 'esp32-c6-supermini', name: 'ESP32-C6 SuperMini', chipFamily: 'ESP32-C6', module: 'SuperMini', firmwareId: 2,
    chipId: 13, target: 'esp32c6', bootloaderOffset: 0,
    fqbn: 'esp32:esp32:esp32c6:CDCOnBoot=cdc,FlashMode=dio,FlashSize=4M,PartitionScheme=huge_app',
    pins: { SDA: 0, SCL: 1, SCK: 6, MOSI: 7, CS: 18, DC: 19, RST: 20, BUTTON: 9 },
    note: 'ESP32-C6 SuperMini · Flash 4 MB · USB Serial/JTAG · ใช้สาย USB data',
    reserved: [4, 5, 8, 9, 10, 11, 12, 13, 14, 15, 24, 25, 26, 27, 28, 29, 30]
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
  if (data.byteLength < 0x10000 + 24) throw new Error('ไฟล์เฟิร์มแวร์ไม่ครบ');
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  for (const offset of [board.bootloaderOffset, 0x10000]) {
    if (view.getUint8(offset) !== 0xE9 || view.getUint16(offset + 12, true) !== board.chipId) throw new Error('ชิปในไฟล์เฟิร์มแวร์ไม่ตรงกับบอร์ดที่เลือก');
  }
}
