// Physical header order, viewed from the component side as in the reference photos.
// Coordinates are shared by the artwork, interactive pins, and wire endpoints.
const pin = (id, label, x, y, dx, dy = 0) => ({ id, label, x, y, dx, dy });
export function boardLayout(board) {
  const classic = board.target === 'esp32';
  const bounds = classic ? { x: 140, y: 165, width: 150, height: 430 } : { x: 140, y: 215, width: 150, height: 280 };
  const rows = board.target === 'esp32' ? [
    ['EN', 'GPIO36', 'GPIO39', 'GPIO34', 'GPIO35', 'GPIO32', 'GPIO33', 'GPIO25', 'GPIO26', 'GPIO27', 'GPIO14', 'GPIO12', 'GPIO13', 'GND-L', 'VIN'],
    ['GPIO23', 'GPIO22', 'GPIO1', 'GPIO3', 'GPIO21', 'GPIO19', 'GPIO18', 'GPIO5', 'GPIO17', 'GPIO16', 'GPIO4', 'GPIO2', 'GPIO15', 'GND', '3V3']
  ] : board.target === 'esp32c3' ? [
    ['GPIO5', 'GPIO6', 'GPIO7', 'GPIO8', 'GPIO9', 'GPIO10', 'GPIO20', 'GPIO21'],
    ['5V', 'GND', '3V3', 'GPIO4', 'GPIO3', 'GPIO2', 'GPIO1', 'GPIO0']
  ] : [
    ['GPIO16', 'GPIO17', 'GPIO0', 'GPIO1', 'GPIO2', 'GPIO3', 'GPIO4', 'GPIO5', 'GPIO6', 'GPIO7'],
    ['5V', 'GND', '3V3', 'GPIO20', 'GPIO19', 'GPIO18', 'GPIO15', 'GPIO14', 'GPIO9', 'GPIO8']
  ];
  const start = classic ? 215 : 260, spacing = classic ? 24 : board.target === 'esp32c3' ? 29 : 22;
  const pins = rows.flatMap((row, side) => row.map((id, i) => pin(`board:${id}`, id === 'GND-L' ? 'GND' : id, side ? 282 : 148, start + i * spacing, side ? 1 : -1)));
  if (board.target === 'esp32c6') {
    pins.push(pin('board:GPIO23', 'GPIO23', 168, 480, 0, 1), pin('board:GPIO22', 'GPIO22', 188, 480, 0, 1), pin('board:GPIO21', 'GPIO21', 218, 480, 0, 1), pin('board:GPIO12', 'GPIO12', 242, 480, 0, 1), pin('board:GPIO13', 'GPIO13', 264, 480, 0, 1));
  }
  return { bounds, pins, usbTop: !classic };
}
export function displayLayout(profile) {
  const round = profile.shape === 'round';
  const bounds = round ? { x: 655, y: 118, width: 230, height: 250 } : profile.mono ? { x: 670, y: 160, width: 215, height: 175 } : profile.id === 'gmt130-240x240' || profile.driver === 'ST7789' ? { x: 675, y: 145, width: 230, height: 255 } : { x: 625, y: 155, width: 290, height: 180 };
  const ids = round ? ['RST', 'CS', 'DC', 'DIN', 'CLK', 'GND', 'VCC', 'BL'] : profile.mono ? ['GND', 'VCC', 'SCL', 'SDA'] : ['GND', 'VCC', 'CLK', 'DIN', 'RST', 'DC', ...(profile.hasCs ? ['CS'] : []), 'BL'];
  const labels = { CLK: profile.id === 'gmt130-240x240' ? 'SCK' : 'SCL', DIN: 'SDA', RST: 'RES', BL: 'BLK' };
  if (round) Object.assign(labels, { CLK: 'SCK', DIN: 'DIN', RST: 'RST', BL: 'BL' });
  const start = round ? 703 : profile.mono ? 737 : bounds.x + 40;
  const spacing = round ? 19 : profile.mono ? 27 : (bounds.width - 80) / (ids.length - 1);
  return { bounds, pins: ids.map((id, i) => pin(`display:${id}`, labels[id] || id, start + i * spacing, round ? 356 : bounds.y + 16, 0, round ? 1 : -1)) };
}
export function sensorLayout(sensor) {
  if (sensor.id === 'mpu6050') {
    return { bounds: { x: 730, y: 495, width: 160, height: 198 }, pins: ['VCC', 'GND', 'SCL', 'SDA', 'XDA', 'XCL', 'AD0', 'INT'].map((id, i) => pin(`sensor:${id}`, id, 746, 510 + i * 24, -1)) };
  }
  return { bounds: { x: 720, y: 510, width: 160, height: 183 }, pins: [
    ...['VCC', '3V3', 'GND', 'SCL', 'SDA', 'CS', 'SDO'].map((id, i) => pin(`sensor:${id}`, id === 'VCC' ? 'VIN' : id === 'SDO' ? 'SA0' : id, 735, 524 + i * 26, -1)),
    ...['OCS', 'INT2', 'INT1', 'SCX', 'SDX'].map((id, i) => pin(`sensor:${id}`, id, 865, 550 + i * 26, 1))
  ] };
}
function roundedPath(points, radius = 12) {
  points = points.filter((p, i) => !i || p.x !== points[i - 1].x || p.y !== points[i - 1].y);
  let path = `M${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1], b = points[i], c = points[i + 1];
    const incoming = Math.hypot(b.x - a.x, b.y - a.y), outgoing = Math.hypot(c.x - b.x, c.y - b.y);
    if (!incoming || !outgoing) continue;
    const r = Math.min(radius, incoming / 2, outgoing / 2);
    const before = { x: b.x + (a.x - b.x) * r / incoming, y: b.y + (a.y - b.y) * r / incoming };
    const after = { x: b.x + (c.x - b.x) * r / outgoing, y: b.y + (c.y - b.y) * r / outgoing };
    path += ` L${before.x},${before.y} Q${b.x},${b.y} ${after.x},${after.y}`;
  }
  const last = points.at(-1);
  return `${path} L${last.x},${last.y}`;
}
export function wirePath(a, b, lane = 0) {
  const corridor = 415 + lane * 8;
  const exit = { x: a.x + a.dx * 24, y: a.y + a.dy * 24 };
  const points = [a, exit];
  // Left-side and bottom headers go around the PCB before entering the shared corridor.
  if (a.dx < 0) {
    const left = 60 + lane * 4, bottom = 714 + lane * 3;
    points.push({ x: left, y: a.y }, { x: left, y: bottom }, { x: corridor, y: bottom });
  } else if (a.dy > 0) {
    const bottom = 714 + lane * 3;
    points.push({ x: a.x, y: bottom }, { x: corridor, y: bottom });
  }
  if (b.dy) {
    const approachY = b.y + b.dy * (30 + lane * (b.dy < 0 ? 3 : 4));
    points.push({ x: corridor, y: points.at(-1).y }, { x: corridor, y: approachY }, { x: b.x, y: approachY });
  } else {
    points.push({ x: corridor, y: points.at(-1).y }, { x: corridor, y: b.y }, { x: b.x + b.dx * 22, y: b.y });
  }
  points.push(b);
  return roundedPath(points);
}
