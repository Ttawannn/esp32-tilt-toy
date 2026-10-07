import { findSensor, headerSlots, wiringConnections, wireSignals } from './profiles.js';
import { defaultBoard } from './boards.js';

const namespace = 'http://www.w3.org/2000/svg';
const deviceNames = { display: 'จอ' };
function svgElement(tag, attributes = {}, text) {
  const element = document.createElementNS(namespace, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  if (text !== undefined) element.textContent = text;
  return element;
}
export function matchingConnection(connections, first, second) {
  return connections.find(c => (c.from === first && c.to === second) || (c.to === first && c.from === second));
}
function componentCard(x, y, width, height, title, subtitle) {
  const group = svgElement('g', { class: 'graph-component' });
  group.append(svgElement('rect', { x, y, width, height, rx: 16, class: 'component-card' }), svgElement('text', { x: x + 18, y: y + 28, class: 'component-title' }, title), svgElement('text', { x: x + 18, y: y + 47, class: 'component-subtitle' }, subtitle));
  return group;
}
const CHANNEL_GAP = 5, LANE_X = 362, LANE_GAP = 9;
const round = value => Math.round(value * 10) / 10;
// Board size in px from its real size in mm, so the 2.54 mm header pitch lines up with the holes.
export function boardGeometry(board) {
  const classic = board.target === 'esp32';
  const pitch = classic ? 21 : 26, mm = pitch / 2.54;
  const width = (classic ? 28 : 18) * mm, length = (classic ? 51 : board.target === 'esp32c3' ? 22.5 : 25.6) * mm;
  const cx = 180, top = 365 - length / 2, span = (classic ? 10 : 6) * pitch, first = top + (classic ? 8.3 : 1.4) * mm;
  return { classic, pitch, mm, width, length, cx, top, left: cx - width / 2, bottom: top + length, columns: { left: cx - span / 2, right: cx + span / 2 }, pinY: index => first + index * pitch };
}
// Where a pin id sits on the board header; duplicates (GND) prefer the side facing the modules.
export function headerSlot(board, id) {
  for (const side of ['right', 'left']) {
    const index = board.header[side].findIndex(([, pin]) => pin === id);
    if (index >= 0) return { side, index, label: board.header[side][index][0] };
  }
  return null;
}
function hole(x, y, r = .8) {
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="#d9b55c"/><circle cx="${x}" cy="${y}" r="${r * .52}" fill="#3a3328"/>`;
}
function button(x, y, label, labelY, boot) {
  return `<rect x="${x - 1.7}" y="${y - 1.7}" width="3.4" height="3.4" rx=".3" fill="#d4d8dc"${boot ? ' stroke="#bef365" stroke-width=".4"' : ''}/><circle cx="${x}" cy="${y}" r="1.05" fill="#2a2d31"/><text x="${x}" y="${labelY}" text-anchor="middle" font-size=".95" class="silk">${label}</text>`;
}
function boardArt(board, geometry) {
  const { classic, mm } = geometry, W = geometry.width / mm, L = geometry.length / mm;
  const holeX = { left: W / 2 - (classic ? 12.7 : 7.62), right: W / 2 + (classic ? 12.7 : 7.62) };
  let art = `<rect width="${W}" height="${L}" rx="${classic ? 1 : 1.2}" fill="#16181b" stroke="#30343a" stroke-width=".2"/>`;
  if (classic) {
    for (const [x, y] of [[2.2, 2.2], [W - 2.2, 2.2], [2.2, L - 2.2], [W - 2.2, L - 2.2]]) art += `<circle cx="${x}" cy="${y}" r="1.4" fill="#f3f6ee" stroke="#b39552" stroke-width=".35"/>`;
    art += `<rect x="5" y=".6" width="18" height="6.4" fill="#22262b"/><path d="M6.5 5.6V2h2v3.6h2V2h2v3.6h2V2h2v3.6h2V2h1.5" fill="none" stroke="#b39552" stroke-width=".45"/>
      <rect x="5.4" y="7" width="17.2" height="17.6" rx=".5" fill="#c9cdd2" stroke="#9aa0a8" stroke-width=".2"/>
      <text x="14" y="14.6" text-anchor="middle" font-size="1.45" fill="#5b6168" font-weight="700">ESP-WROOM-32</text><text x="14" y="17" text-anchor="middle" font-size="1.05" fill="#7a8088">Wi-Fi · Bluetooth</text>
      <rect x="15.4" y="31" width="4.4" height="4.4" fill="#26292e"/><rect x="7" y="30.4" width="3.6" height="2.6" fill="#26292e"/>
      <rect x="10" y="45.8" width="8" height="6" rx=".6" fill="#c7cbd0" stroke="#8d939b" stroke-width=".2"/><rect x="11.2" y="50.4" width="5.6" height="1.2" rx=".4" fill="#3d4148"/>
      ${button(6.5, 47, 'EN', 44.6)}${button(21.5, 47, 'BOOT', 44.6, true)}`;
  } else {
    const c6 = board.target === 'esp32c6';
    art += `<rect x="${W / 2 - 4.5}" y="-1.2" width="9" height="7.4" rx="1.4" fill="#c7cbd0" stroke="#8d939b" stroke-width=".2"/><rect x="${W / 2 - 3.4}" y="-1.2" width="6.8" height="2.3" rx="1.1" fill="#3d4148"/>
      ${button(W / 2 - 3.6, 8.4, 'BOOT', 11.3, true)}${button(W / 2 + 3.6, 8.4, 'RST', 11.3)}
      <rect x="-2.5" y="-2.5" width="5" height="5" fill="#26292e" stroke="#3b3f46" stroke-width=".2" transform="translate(${W / 2} ${c6 ? 16.4 : 14.2})${c6 ? ' rotate(45)' : ''}"/>
      <rect x="${W / 2 - 3}" y="${L - 3.3}" width="6" height="1.9" rx=".3" fill="#c8372d"/>`;
  }
  for (const side of ['left', 'right']) board.header[side].forEach(([label], index) => {
    const y = (geometry.pinY(index) - geometry.top) / mm;
    art += hole(holeX[side], y, classic ? .85 : .8) + `<text x="${holeX[side] + (side === 'left' ? 1.25 : -1.25)}" y="${y + .36}" text-anchor="${side === 'left' ? 'start' : 'end'}" font-size="${classic ? 1.05 : .95}" class="silk">${label}</text>`;
  });
  const group = svgElement('g', { 'aria-hidden': 'true', transform: `translate(${round(geometry.left)} ${round(geometry.top)}) scale(${round(mm * 100) / 100})` });
  group.innerHTML = art;
  return group;
}
// Module outlines in mm; header is the y of the pin row, bottom marks a header on the lower edge.
const moduleSpecs = {
  st7735: { width: 30, height: 24.2, header: 2.3, pcb: '#1d5aa6', mounts: [[2.8, 2.8], [27.2, 2.8], [2.8, 21.4], [27.2, 21.4]] },
  gmt130: { width: 27.5, height: 39, header: 2.3, pcb: '#1d5aa6', mounts: [[2.6, 2.6], [24.9, 2.6], [2.6, 36.4], [24.9, 36.4]] },
  st7789: { width: 27.5, height: 39, header: 2.3, pcb: '#1d5aa6', mounts: [[2.6, 2.6], [24.9, 2.6], [2.6, 36.4], [24.9, 36.4]] },
  gc9a01: { width: 36, height: 45.5, header: 43.3, bottom: true, pcb: '#1d5aa6', mounts: [[5.2, 39.4], [30.8, 39.4]] },
  oled: { width: 27.3, height: 27.8, header: 1.9, pcb: '#18191b', mounts: [[2, 2], [25.3, 2], [2, 25.8], [25.3, 25.8]] },
  mpu6050: { width: 21, height: 16, header: 1.7, pcb: '#2b63ad', mounts: [[2.2, 13.6], [18.8, 13.6]] },
  bmi160: { width: 19, height: 13.5, header: 1.7, pcb: '#5f3c96', mounts: [[2.2, 11.2], [16.8, 11.2]] }
};
function moduleGeometry(kind, count, scale, cx, anchor) {
  const spec = moduleSpecs[kind], pitch = 2.54 * scale;
  const top = spec.bottom ? anchor - spec.height * scale : anchor - spec.header * scale;
  return { spec, scale, pitch, left: cx - spec.width * scale / 2, top, hy: top + spec.header * scale, bottom: !!spec.bottom, pinX: index => cx + (index - (count - 1) / 2) * pitch };
}
function screenContent(x, y, width, height, mono) {
  if (mono) return `<text x="${x + width / 2}" y="${y + height * .62}" text-anchor="middle" font-size="${height * .42}" fill="#b7e2e8" font-family="monospace">≈ ≈ ≈</text>`;
  return `<path d="M${x} ${y + height * .62} Q${x + width * .3} ${y + height * .42} ${x + width * .5} ${y + height * .63} T${x + width} ${y + height * .58} V${y + height} H${x} Z" fill="#b5df90" opacity=".9"/>`;
}
function moduleArt(kind, slots, geometry, caption) {
  const { spec } = geometry, W = spec.width, H = spec.height, cx = W / 2;
  let art = kind === 'gc9a01'
    ? `<circle cx="18" cy="18" r="18" fill="${spec.pcb}"/><rect x="3" y="24" width="30" height="21.5" rx="1.6" fill="${spec.pcb}"/>`
    : `<rect width="${W}" height="${H}" rx=".8" fill="${spec.pcb}"/>`;
  for (const [x, y] of spec.mounts) art += `<circle cx="${x}" cy="${y}" r="${kind === 'oled' ? 1.2 : 1.45}" fill="#f6f8f3" stroke="#d9dee4" stroke-width=".35"/>`;
  if (kind === 'st7735') art += `<rect x="-.6" y="8.4" width="3.2" height="9.6" rx=".4" fill="#2f3a33"/><rect x="2.4" y="7.3" width="26.2" height="12.4" rx=".3" fill="#0f1418" stroke="#5b7896" stroke-width=".2"/><rect x="4.1" y="8.1" width="21.7" height="10.8" fill="#141b20"/>${screenContent(4.1, 8.1, 21.7, 10.8)}<text x="${cx}" y="22.9" text-anchor="middle" font-size="1.55" class="silk">0.96"80x160(RGB)IPS</text>`;
  if (kind === 'gmt130' || kind === 'st7789') art += `<rect x="1" y="5.6" width="25.5" height="27.2" rx=".3" fill="#0f1418" stroke="#5b7896" stroke-width=".2"/><rect x="2.05" y="6.6" width="23.4" height="23.4" fill="#141b20"/>${screenContent(2.05, 6.6, 23.4, 23.4)}<rect x="2" y="30.4" width="23.5" height="3.6" fill="#25282b"/><text x="${cx}" y="36.4" text-anchor="middle" font-size="1.4" class="silk">${kind === 'gmt130' ? 'GMT130-V1.0' : '1.3" ST7789'}</text><text x="${cx}" y="38.2" text-anchor="middle" font-size="1.4" class="silk">IPS 240*240</text>`;
  if (kind === 'gc9a01') art += `<circle cx="18" cy="18" r="16.6" fill="#0f1418" stroke="#5b7896" stroke-width=".2"/><clipPath id="round-screen"><circle cx="18" cy="18" r="15.8"/></clipPath><g clip-path="url(#round-screen)"><circle cx="18" cy="18" r="15.8" fill="#141b20"/>${screenContent(2.2, 2.2, 31.6, 31.6)}</g><rect x="11" y="33.2" width="14" height="2.2" rx=".4" fill="#25282b"/>`;
  if (kind === 'oled') art += `<rect x=".5" y="5" width="26.3" height="18" rx=".3" fill="#0b0d10" stroke="#3a3f46" stroke-width=".2"/><rect x="2.3" y="6.5" width="22.7" height="11.4" fill="#05070a"/>${screenContent(2.3, 6.5, 22.7, 11.4, true)}<rect x="9" y="22.6" width="9.3" height="5.2" fill="#e6b740"/>`;
  if (kind === 'mpu6050') art += `<rect x="8.5" y="6.6" width="4" height="4" fill="#1e2124"/><rect x="4.2" y="7.4" width="1.4" height=".8" fill="#d8d2b8"/><rect x="15.4" y="7.4" width="1.4" height=".8" fill="#d8d2b8"/><rect x="4.2" y="9.6" width="1.4" height=".8" fill="#d8d2b8"/><circle cx="16.4" cy="10.6" r=".5" fill="#9fe36e"/><text x="${cx}" y="14.6" text-anchor="middle" font-size="1.3" class="silk">GY-521</text>`;
  if (kind === 'bmi160') art += `<rect x="8.1" y="6.2" width="2.8" height="2.4" fill="#1e2124"/><rect x="4.4" y="6.8" width="1.4" height=".8" fill="#d8d2b8"/><rect x="13.2" y="6.8" width="1.4" height=".8" fill="#d8d2b8"/><text x="${cx}" y="12.4" text-anchor="middle" font-size="1.2" class="silk">BMI160</text>`;
  const labelY = spec.bottom ? spec.header - 1.45 : spec.header + 2.25;
  slots.forEach(({ label }, index) => {
    const x = cx + (index - (slots.length - 1) / 2) * 2.54;
    art += hole(x, spec.header, .75) + `<text x="${x}" y="${labelY}" text-anchor="middle" font-size="${kind === 'mpu6050' || kind === 'bmi160' ? .95 : 1.05}" class="silk">${label}</text>`;
  });
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const body = svgElement('g', { transform: `translate(${round(geometry.left)} ${round(geometry.top)}) scale(${geometry.scale})` });
  body.innerHTML = art;
  group.append(body);
  if (caption) group.append(svgElement('text', { x: geometry.left + W * geometry.scale / 2, y: geometry.bottom ? geometry.top - 8 : geometry.top + H * geometry.scale + 16, 'text-anchor': 'middle', class: 'component-subtitle' }, caption));
  return group;
}
// Orthogonal path through the given points with rounded corners.
function roundedPath(points, radius = 6) {
  const p = points.filter((point, index) => index === 0 || Math.hypot(point[0] - points[index - 1][0], point[1] - points[index - 1][1]) > .5);
  let d = `M${round(p[0][0])},${round(p[0][1])}`;
  for (let i = 1; i < p.length - 1; i++) {
    const [ax, ay] = p[i - 1], [bx, by] = p[i], [cx, cy] = p[i + 1];
    const inLength = Math.hypot(bx - ax, by - ay), outLength = Math.hypot(cx - bx, cy - by), r = Math.min(radius, inLength / 2, outLength / 2);
    d += ` L${round(bx - (bx - ax) / inLength * r)},${round(by - (by - ay) / inLength * r)} Q${round(bx)},${round(by)} ${round(bx + (cx - bx) / outLength * r)},${round(by + (cy - by) / outLength * r)}`;
  }
  const last = p[p.length - 1];
  return `${d} L${round(last[0])},${round(last[1])}`;
}
export class WiringGraph {
  constructor(root) {
    this.root = root;
    this.svg = root.querySelector('#wiring-canvas');
    this.list = root.querySelector('#wiring-connections');
    this.feedback = root.querySelector('#wiring-feedback');
    this.filter = 'all';
    this.practice = false;
    this.completed = new Set();
    root.querySelectorAll('[data-wire-filter]').forEach(button => button.addEventListener('click', () => {
      this.filter = button.dataset.wireFilter;
      this.selected = null;
      this.cancel();
      this.refresh();
    }));
    root.querySelector('#wiring-practice').addEventListener('click', () => {
      this.practice = !this.practice;
      this.reset();
    });
    root.querySelector('#wiring-reset').addEventListener('click', () => this.reset());
    this.svg.addEventListener('pointerdown', event => this.pointerDown(event));
    this.svg.addEventListener('pointermove', event => this.pointerMove(event));
    this.svg.addEventListener('pointerup', event => this.pointerUp(event));
    this.svg.addEventListener('pointercancel', () => { this.drag = null; this.cancel(); });
    root.addEventListener('keydown', event => {
      if (event.key === 'Escape') { this.drag = null; this.cancel(); this.message('ยกเลิกการลากสายแล้ว'); }
    });
    const legend = root.querySelector('#wire-legend');
    for (const signal of Object.values(wireSignals)) {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.style.background = signal.color;
      item.append(swatch, document.createTextNode(signal.label));
      legend.append(item);
    }
  }
  setProfile(profile, sensorId = 'mpu6050', board = defaultBoard) {
    this.profile = profile;
    this.board = board;
    this.sensor = findSensor(sensorId);
    this.connections = wiringConnections(profile, this.sensor.id, board);
    const { pins } = board;
    const displaySlots = headerSlots(profile.header), sensorSlots = headerSlots(this.sensor.header);
    this.drag = null;
    this.ports = new Map();
    this.wires = new Map();
    this.rows = new Map();
    this.root.querySelector('#wiring-driver').textContent = `${board.chipFamily} · ${profile.driver} · ${profile.bus}`;
    this.root.querySelector('#wiring-bus-note').textContent = profile.mono ? `OLED และ ${this.sensor.name} แชร์ I²C: SDA → GPIO${pins.SDA}, SCL → GPIO${pins.SCL} โดยมี address ต่างกัน` : `ขา SDA / DIN ของจอ SPI คือ MOSI → GPIO${pins.MOSI} ส่วน ${this.sensor.name} SDA → GPIO${pins.SDA}${!profile.hasCs ? ' · GMT130 รุ่น 7 ขาไม่มี CS' : ''}`;
    this.root.querySelector('#wiring-button-note').textContent = `ใช้ปุ่ม BOOT บน ${board.name} (GPIO${pins.BUTTON}) · ไม่ต้องต่อปุ่มเพิ่ม · กดสั้นเปลี่ยนโหมด ค้าง 2 วินาทีเปิด/ปิด Wi-Fi · ปล่อย BOOT ขณะเปิดเครื่องหรือรีเซ็ตเพื่อบูตเล่นตามปกติ`;
    this.root.querySelector('#wiring-sensor-note').textContent = this.sensor.note;
    this.root.querySelector('[data-wire-filter="sensor"]').textContent = this.sensor.name;
    this.root.querySelector('#wiring-backlight-note').hidden = !displaySlots.some(slot => slot.label === 'BLK');
    this.root.querySelector('#wiring-backlight-note').textContent = 'BLK: ต่อไฟหรือวงจรขับตามสเปกโมดูลจอ ตรวจว่าเป็นขา enable หรือไฟ LED ก่อนต่อ · ไม่ต่อ LED เปล่าเข้าขา GPIO';
    this.svg.replaceChildren();
    this.svg.setAttribute('aria-label', `ผังต่อสาย ${board.name} กับจอและเซนเซอร์ ตามตำแหน่งขาจริงบนโมดูล`);
    const defs = svgElement('defs');
    const pattern = svgElement('pattern', { id: 'wiring-dots', width: 20, height: 20, patternUnits: 'userSpaceOnUse' });
    pattern.append(svgElement('circle', { cx: 1, cy: 1, r: 1, fill: '#dce3d6' }));
    defs.append(pattern);
    this.svg.append(defs, svgElement('rect', { width: 920, height: 720, fill: 'url(#wiring-dots)' }));
    const boardGeo = boardGeometry(board);
    const boardCard = componentCard(20, 20, 320, 680, board.name, `${board.target === 'esp32' ? 'DevKit V1' : 'SuperMini'} · Flash 4 MB`);
    boardCard.append(boardArt(board, boardGeo), svgElement('text', { x: 180, y: 662, 'text-anchor': 'middle', class: 'component-subtitle' }, `ปุ่ม BOOT บนบอร์ด (GPIO${pins.BUTTON}) · ไม่ต้องต่อสายเพิ่ม`), svgElement('text', { x: 180, y: 681, 'text-anchor': 'middle', class: 'component-subtitle' }, 'กดสั้น → เปลี่ยนโหมด · ค้าง 2 วิ → เปิด/ปิด Wi-Fi'));
    const displayGeo = moduleGeometry(profile.art, displaySlots.length, 7, 715, moduleSpecs[profile.art].bottom ? 375 : 132);
    const display = componentCard(530, 20, 370, 390, profile.short, `${profile.driver} · ${profile.bus}`);
    display.append(moduleArt(profile.art, displaySlots, displayGeo));
    const sensorGeo = moduleGeometry(this.sensor.id, sensorSlots.length, 7.6, 715, 528);
    const sensor = componentCard(530, 425, 370, 275, 'Motion sensor', `${this.sensor.module} · I²C`);
    sensor.append(moduleArt(this.sensor.id, sensorSlots, sensorGeo, `I²C address ${this.sensor.address}`));
    this.svg.append(boardCard, display, sensor);
    displaySlots.forEach((slot, index) => {
      if (slot.label !== 'BLK') return;
      const backlight = svgElement('circle', { cx: displayGeo.pinX(index), cy: displayGeo.hy, r: 7, class: 'backlight-port' });
      backlight.append(svgElement('title', {}, 'BLK: ต่อไฟหรือวงจรขับตามสเปกโมดูลจอ'));
      this.svg.append(backlight);
    });
    this.wireLayer = svgElement('g');
    this.svg.append(this.wireLayer);
    for (const id of new Set(this.connections.map(c => c.boardPin))) {
      const slot = headerSlot(board, id);
      this.addPin(`board:${id}`, slot.label, boardGeo.columns[slot.side], boardGeo.pinY(slot.index), Math.min(boardGeo.pitch - 4, 22), `${board.name} ${id === slot.label ? id : `${slot.label} (${id})`}`, slot.side);
    }
    displaySlots.forEach((slot, index) => {
      if (slot.pin) this.addPin(`display:${slot.pin}`, slot.label, displayGeo.pinX(index), displayGeo.hy, displayGeo.pitch - 2, `${profile.short} ${slot.label}`);
    });
    sensorSlots.forEach((slot, index) => {
      if (slot.pin) this.addPin(`sensor:${slot.pin}`, slot.label, sensorGeo.pinX(index), sensorGeo.hy, sensorGeo.pitch - 2, `${this.sensor.name} ${slot.label}`);
    });
    this.routes = this.route(boardGeo, { display: displayGeo, sensor: sensorGeo });
    this.ghost = svgElement('path', { class: 'wire-ghost', hidden: '' });
    this.svg.append(this.ghost);
    this.list.replaceChildren();
    for (const connection of this.connections) {
      this.addWire(connection);
      this.addRow(connection);
    }
    this.reset();
  }
  addPin(id, label, x, y, size, accessibleLabel, side) {
    const group = svgElement('g', { class: 'graph-pin', 'data-pin': id, tabindex: 0, role: 'button', 'aria-label': accessibleLabel });
    const signal = this.connections.find(c => c.from === id || c.to === id)?.signal;
    group.style.setProperty('--wire-color', wireSignals[signal].color);
    group.append(svgElement('title', {}, accessibleLabel), svgElement('rect', { x: x - size / 2, y: y - size / 2, width: size, height: size, rx: 5, class: 'pin-hit' }), svgElement('circle', { cx: x, cy: y, r: Math.max(6, size * .3), class: 'pin-dot' }));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.activatePin(id); }
    });
    this.ports.set(id, { x, y, side, element: group, label: accessibleLabel, pinLabel: label });
    this.svg.append(group);
  }
  // Wires leave the board header sideways, run in their own vertical lane, then drop onto the module header from its open side.
  route(boardGeo, modules) {
    const plan = new Map(), routes = new Map();
    const source = c => this.ports.get(c.from), target = c => this.ports.get(c.to);
    let lane = 0;
    for (const device of ['display', 'sensor']) {
      const module = modules[device];
      const wires = this.connections.filter(c => c.device === device).sort((a, b) => target(a).x - target(b).x);
      wires.forEach((c, index) => plan.set(c.id, { channel: module.hy + (module.bottom ? 16 + index * CHANNEL_GAP : -16 - index * CHANNEL_GAP) }));
      for (const c of device === 'display' && !module.bottom ? [...wires].reverse() : wires) plan.get(c.id).lane = LANE_X + lane++ * LANE_GAP;
    }
    const left = this.connections.filter(c => source(c).side === 'left');
    const over = left.filter(c => c.device === 'display').sort((a, b) => source(a).y - source(b).y);
    const under = left.filter(c => c.device === 'sensor').sort((a, b) => source(b).y - source(a).y);
    over.forEach((c, index) => { plan.get(c.id).detour = { x: boardGeo.left - 12 - index * 7, y: boardGeo.top - 22 - index * 7 }; });
    under.forEach((c, index) => { plan.get(c.id).detour = { x: boardGeo.left - 12 - (over.length + index) * 7, y: boardGeo.bottom + 18 + index * 7 }; });
    for (const c of this.connections) {
      const s = source(c), t = target(c), { lane: x, channel, detour } = plan.get(c.id);
      const points = [[s.x, s.y], ...(detour ? [[detour.x, s.y], [detour.x, detour.y], [x, detour.y]] : [[x, s.y]]), [x, channel], [t.x, channel], [t.x, t.y]];
      routes.set(c.id, roundedPath(points));
    }
    return routes;
  }
  addWire(connection) {
    const group = svgElement('g', { class: 'graph-wire', tabindex: 0, role: 'button', 'aria-label': this.connectionLabel(connection), 'data-wire': connection.id });
    group.style.setProperty('--wire-color', wireSignals[connection.signal].color);
    const path = this.routes.get(connection.id);
    group.append(svgElement('title', {}, this.connectionLabel(connection)), svgElement('path', { d: path, class: 'wire-underlay' }), svgElement('path', { d: path, class: 'wire-line' }), svgElement('path', { d: path, class: 'wire-hit' }));
    group.addEventListener('click', () => this.select(connection.id));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.select(connection.id); }
    });
    this.wires.set(connection.id, group);
    this.wireLayer.append(group);
  }
  addRow(connection) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'connection-row';
    button.dataset.connection = connection.id;
    button.style.setProperty('--wire-color', wireSignals[connection.signal].color);
    const from = document.createElement('span'), to = document.createElement('strong'), mark = document.createElement('span');
    from.textContent = `${connection.device === 'sensor' ? this.sensor.name : deviceNames[connection.device]} ${this.ports.get(connection.to).pinLabel}`;
    to.textContent = `→ ${connection.boardPin}`;
    mark.className = 'connection-mark';
    mark.setAttribute('aria-hidden', 'true');
    button.append(from, to, mark);
    button.addEventListener('click', () => this.select(connection.id));
    this.rows.set(connection.id, button);
    this.list.append(button);
  }
  connectionLabel(connection) {
    return `${this.ports.get(connection.to).label} ↔ ${this.board.name} ${connection.boardPin}`;
  }
  message(text, error = false) {
    this.feedback.textContent = text;
    this.feedback.dataset.state = error ? 'error' : 'info';
  }
  reset() {
    this.completed.clear();
    this.selected = null;
    this.drag = null;
    this.cancel();
    this.refresh();
    this.message(this.practice ? 'เริ่มจากขาใดก็ได้ ลากไปยังขาที่ไฮไลต์ หรือกดเลือกขาต้นทางแล้วปลายทาง · Esc ยกเลิก' : 'เลือกสายเพื่อดูต้นทางและปลายทาง หรือกด “ลองลากต่อสาย” เพื่อฝึกต่อให้ครบ');
  }
  cancel() {
    this.pending = null;
    this.ghost?.setAttribute('hidden', '');
    if (this.ports) this.refreshPins();
  }
  select(id) {
    this.cancel();
    this.selected = id;
    this.refresh();
    const connection = this.connections.find(c => c.id === id);
    this.message(`${this.connectionLabel(connection)}${this.practice && !this.completed.has(id) ? ' · ลากระหว่างขาคู่นี้เพื่อต่อสาย' : ''}`);
  }
  activatePin(id) {
    if (!this.practice) {
      const connection = this.connections.find(c => (this.filter === 'all' || c.device === this.filter) && (c.from === id || c.to === id));
      if (connection) this.select(connection.id);
    } else if (this.pending === id) this.cancel();
    else if (this.pending) this.connect(this.pending, id);
    else this.begin(id);
  }
  begin(id) {
    this.pending = id;
    this.selected = null;
    this.refresh();
    const targets = this.connections.filter(c => c.from === id || c.to === id).map(c => this.ports.get(c.from === id ? c.to : c.from).label);
    this.message(`${this.ports.get(id).label} → ${targets.join(' / ')}`);
  }
  connect(first, second) {
    const connection = matchingConnection(this.connections, first, second);
    this.cancel();
    if (!connection) { this.message(`คู่นี้ไม่ตรงกับผัง: ${this.ports.get(first).label} ↔ ${this.ports.get(second).label} · เลือกขาใหม่แล้วต่อกับขาที่ไฮไลต์`, true); return; }
    const alreadyConnected = this.completed.has(connection.id);
    this.completed.add(connection.id);
    this.selected = connection.id;
    this.refresh();
    const done = this.completed.size === this.connections.length ? ` · ครบทุกสายแล้ว!${this.profile.mono ? '' : ' ตรวจไฟ BL / BLK ตามสเปกจอด้วย'}` : '';
    this.message(`${alreadyConnected ? 'ต่อไว้อยู่แล้ว' : 'ต่อถูกแล้ว'}: ${this.connectionLabel(connection)}${done}`);
  }
  refreshPins() {
    const selected = this.connections.find(c => c.id === this.selected);
    for (const [id, port] of this.ports) {
      port.element.classList.toggle('is-selected', selected?.from === id || selected?.to === id || this.pending === id);
      port.element.classList.toggle('is-target', !!this.pending && id !== this.pending && !!matchingConnection(this.connections, this.pending, id));
    }
  }
  refresh() {
    for (const connection of this.connections) {
      const wire = this.wires.get(connection.id), row = this.rows.get(connection.id);
      const visible = !this.practice || this.completed.has(connection.id);
      wire.style.display = visible ? '' : 'none';
      wire.classList.toggle('is-dimmed', (this.filter !== 'all' && connection.device !== this.filter) || (!!this.selected && this.selected !== connection.id));
      wire.classList.toggle('is-selected', this.selected === connection.id);
      row.hidden = this.filter !== 'all' && connection.device !== this.filter;
      row.setAttribute('aria-pressed', String(this.selected === connection.id));
      row.setAttribute('aria-label', `${this.connectionLabel(connection)}${this.practice ? this.completed.has(connection.id) ? ' ต่อแล้ว' : ' ยังไม่ต่อ' : ''}`);
      row.querySelector('.connection-mark').textContent = this.practice ? this.completed.has(connection.id) ? '✓' : '○' : '↗';
    }
    if (this.selected) this.wireLayer.append(this.wires.get(this.selected));
    this.refreshPins();
    this.root.querySelectorAll('[data-wire-filter]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.wireFilter === this.filter)));
    const practiceButton = this.root.querySelector('#wiring-practice');
    practiceButton.textContent = this.practice ? 'ดูผังสำเร็จ' : 'ลองลากต่อสาย';
    practiceButton.setAttribute('aria-pressed', String(this.practice));
    this.root.querySelector('#wiring-reset').hidden = !this.practice;
    this.root.querySelector('#wiring-count').textContent = this.practice ? `${this.completed.size} / ${this.connections.length}` : `${this.connections.length} สาย`;
    this.root.querySelector('#wiring-help').textContent = this.practice ? 'ลากจากจุด pin ไปยังขาที่ไฮไลต์ · แตะทีละขาหรือใช้ Enter / Space ได้' : 'กดที่สายหรือรายการเพื่อดูคู่ pin · เลื่อนผังซ้าย–ขวาได้บนมือถือ';
  }
  point(event) {
    const matrix = this.svg.getScreenCTM();
    return matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
  }
  pointerDown(event) {
    if (event.button !== 0 || !event.isPrimary) return;
    const pin = event.target.closest('[data-pin]')?.dataset.pin;
    if (!pin) return;
    if (!this.practice) { this.activatePin(pin); return; }
    event.preventDefault();
    this.drag = { pin, x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId };
    this.svg.setPointerCapture(event.pointerId);
  }
  pointerMove(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    if (!this.drag.moved && Math.hypot(event.clientX - this.drag.x, event.clientY - this.drag.y) < 5) return;
    if (!this.drag.moved) { this.drag.moved = true; this.begin(this.drag.pin); }
    const point = this.point(event), start = this.ports.get(this.drag.pin);
    if (!point) return;
    const bend = (point.x - start.x) * .5;
    this.ghost.removeAttribute('hidden');
    this.ghost.style.stroke = getComputedStyle(start.element).getPropertyValue('--wire-color');
    this.ghost.setAttribute('d', `M${start.x},${start.y} C${start.x + bend},${start.y} ${point.x - bend},${point.y} ${point.x},${point.y}`);
  }
  pointerUp(event) {
    if (!this.drag || this.drag.pointerId !== event.pointerId) return;
    const drag = this.drag;
    this.drag = null;
    if (this.svg.hasPointerCapture(event.pointerId)) this.svg.releasePointerCapture(event.pointerId);
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest('[data-pin]')?.dataset.pin;
    if (!drag.moved) this.activatePin(drag.pin);
    else if (target && target !== drag.pin) this.connect(drag.pin, target);
    else { this.cancel(); this.message('ปล่อยสายบนจุด pin ที่ไฮไลต์เพื่อต่อ · ลองลากใหม่ได้'); }
  }
}
