import { findSensor, wiringConnections, wireSignals } from './profiles.js';
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
function boardArt(board) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const classic = board.target === 'esp32';
  group.innerHTML = `<rect x="57" y="157" width="110" height="325" rx="10" fill="${classic ? '#3c5360' : board.target === 'esp32c3' ? '#396480' : '#367565'}" stroke="#285d50" stroke-width="2"/>
    <path d="M68 169h16v15h16v-15h16v15h16v-15h23M70 326v47h18v52M153 327v58h-18v34" fill="none" stroke="#a8cfa9" stroke-width="3"/>
    <rect x="78" y="217" width="69" height="83" rx="5" fill="#d4d8d2" stroke="#93a198"/>
    <text x="112" y="246" text-anchor="middle" fill="#4c6259" font-size="10" font-weight="600">ESP32</text><text x="112" y="263" text-anchor="middle" fill="#4c6259" font-size="${classic ? 9 : 13}">${classic ? 'WROOM-32' : board.target === 'esp32c3' ? 'C3' : 'C6'}</text>
    <rect x="83" y="324" width="21" height="30" rx="2" fill="#253e35"/><rect x="124" y="331" width="19" height="10" rx="2" fill="#e2d6ac"/>
    <rect x="80" y="391" width="23" height="24" rx="3" fill="#d2efa4" stroke="#bef365" stroke-width="2"/><circle cx="91.5" cy="403" r="7" fill="#567b3d"/>
    <rect x="124" y="391" width="23" height="24" rx="3" fill="#b9c3bb"/><circle cx="135.5" cy="403" r="7" fill="#263d34"/>
    <text x="91" y="434" text-anchor="middle" font-size="8" fill="#d8e9d9">BOOT</text><text x="135" y="434" text-anchor="middle" font-size="8" fill="#d8e9d9">RST</text>
    <rect x="87" y="460" width="50" height="27" rx="6" fill="#c5ceca" stroke="#8d9c93"/><rect x="94" y="469" width="36" height="8" rx="4" fill="#374b42"/>
    <text x="112" y="510" text-anchor="middle" class="component-subtitle">USB · ไฟและแฟลช</text>`;
  for (let index = 0; index < (classic ? 15 : 12); index++) for (const x of [65, 158]) group.append(svgElement('circle', { cx: x, cy: 199 + index * (classic ? 17 : 22), r: 3, fill: '#e1c77d' }));
  return group;
}
function displayArt(profile) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const portrait = profile.width < profile.height, wide = profile.width > profile.height;
  const x = portrait ? 717 : 686, y = wide ? 150 : 120, width = portrait ? 65 : 118, height = portrait ? 148 : wide ? 74 : 128;
  group.append(svgElement('rect', { x: x - 7, y: y - 7, width: width + 14, height: height + 18, rx: profile.shape === 'round' ? 20 : 6, fill: profile.mono ? '#3b6680' : '#3b6d64', stroke: '#284f48', 'stroke-width': 2 }));
  if (profile.shape === 'round') {
    group.append(svgElement('circle', { cx: 745, cy: 181, r: 56, fill: '#1d2c29', stroke: '#92a99a', 'stroke-width': 3 }), svgElement('path', { d: 'M697 206 Q721 182 745 205 T793 203 A56 56 0 0 1 697 206', fill: '#b5df90' }));
  } else {
    group.append(svgElement('rect', { x, y, width, height, rx: 3, fill: '#1d2c29', stroke: '#a5b5a7', 'stroke-width': 2 }));
    if (profile.mono) {
      group.append(svgElement('text', { x: x + width / 2, y: y + 34, 'text-anchor': 'middle', fill: '#b7e2e8', 'font-family': 'monospace', 'font-size': 18 }, '≈ ≈ ≈'), svgElement('text', { x: x + width / 2, y: y + 55, 'text-anchor': 'middle', fill: '#b7e2e8', 'font-family': 'monospace', 'font-size': 10 }, '128 × 64'));
    } else group.append(svgElement('path', { d: `M${x + 3} ${y + height * .64} Q${x + width * .3} ${y + height * .45} ${x + width * .5} ${y + height * .65} T${x + width - 3} ${y + height * .6} V${y + height - 3} H${x + 3} Z`, fill: '#b5df90' }));
  }
  group.append(svgElement('text', { x: 745, y: 292, 'text-anchor': 'middle', class: 'component-subtitle' }, `${profile.width} × ${profile.height}`));
  return group;
}
function sensorArt(sensor) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  group.innerHTML = `<rect x="702" y="434" width="101" height="102" rx="6" fill="#497d9f" stroke="#376382" stroke-width="2"/>
    <circle cx="713" cy="445" r="4" fill="#e3d9b1"/><circle cx="792" cy="445" r="4" fill="#e3d9b1"/>
    <rect x="735" y="460" width="34" height="34" fill="#273a46"/><path d="M729 464h-9m9 8h-9m9 8h-9m9 8h-9m55-24h9m-9 8h9m-9 8h9m-9 8h9" stroke="#d4d9cc" stroke-width="2"/>
    <rect x="715" y="506" width="14" height="7" fill="#e8d7a2"/><rect x="775" y="507" width="13" height="7" fill="#e8d7a2"/>
    <text x="752" y="528" text-anchor="middle" font-size="10" fill="#e4eff3">${sensor.name}</text><path d="M749 565v-18m0 18h18m-18-18-3 4m3-4 3 4m15 14-4-3m4 3-4 3" fill="none" stroke="#638798" stroke-width="1.5"/>
    <text x="772" y="568" class="component-subtitle">X</text><text x="747" y="543" class="component-subtitle">Y</text>`;
  return group;
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
    const boardPositions = { '3V3': 140, GND: 168, [`GPIO${pins.SCK}`]: 196, [`GPIO${pins.MOSI}`]: 224, [`GPIO${pins.DC}`]: 252, [`GPIO${pins.RST}`]: 280, [`GPIO${pins.CS}`]: 308, [`GPIO${pins.SDA}`]: 374, [`GPIO${pins.SCL}`]: 402 };
    this.drag = null;
    this.ports = new Map();
    this.wires = new Map();
    this.rows = new Map();
    this.root.querySelector('#wiring-driver').textContent = `${board.chipFamily} · ${profile.driver} · ${profile.bus}`;
    this.root.querySelector('#wiring-bus-note').textContent = profile.mono ? `OLED และ ${this.sensor.name} แชร์ I²C: SDA → GPIO${pins.SDA}, SCL → GPIO${pins.SCL} โดยมี address ต่างกัน` : `ขา SDA / DIN ของจอ SPI คือ MOSI → GPIO${pins.MOSI} ส่วน ${this.sensor.name} SDA → GPIO${pins.SDA}${!profile.hasCs ? ' · GMT130 รุ่น 7 ขาไม่มี CS' : ''}`;
    this.root.querySelector('#wiring-button-note').textContent = `ใช้ปุ่ม BOOT บน ${board.name} (GPIO${pins.BUTTON}) · ไม่ต้องต่อปุ่มเพิ่ม · กดสั้นเปลี่ยนโหมด ค้าง 2 วินาทีเปิด/ปิด Wi-Fi · ปล่อย BOOT ขณะเปิดเครื่องหรือรีเซ็ตเพื่อบูตเล่นตามปกติ`;
    this.root.querySelector('#wiring-sensor-note').textContent = this.sensor.note;
    this.root.querySelector('[data-wire-filter="sensor"]').textContent = this.sensor.name;
    this.root.querySelector('#wiring-backlight-note').hidden = !!profile.mono;
    this.root.querySelector('#wiring-backlight-note').textContent = 'BL / BLK: ต่อไฟหรือวงจรขับตามสเปกโมดูลจอ ตรวจว่าเป็นขา enable หรือไฟ LED ก่อนต่อ · ไม่ต่อ LED เปล่าเข้าขา GPIO';
    this.svg.replaceChildren();
    this.svg.setAttribute('aria-label', `ผังต่อสาย ${board.name} กับจอและเซนเซอร์ พร้อมตำแหน่งปุ่ม BOOT บนบอร์ด`);
    const defs = svgElement('defs');
    const pattern = svgElement('pattern', { id: 'wiring-dots', width: 20, height: 20, patternUnits: 'userSpaceOnUse' });
    pattern.append(svgElement('circle', { cx: 1, cy: 1, r: 1, fill: '#dce3d6' }));
    defs.append(pattern);
    this.svg.append(defs, svgElement('rect', { width: 860, height: 620, fill: 'url(#wiring-dots)' }));
    this.wireLayer = svgElement('g');
    this.svg.append(this.wireLayer);
    const boardCard = componentCard(30, 66, 230, 484, board.name, `${board.target === 'esp32' ? 'DevKit V1' : 'SuperMini'} · Flash 4 MB`);
    boardCard.append(boardArt(board));
    const display = componentCard(570, 48, 255, 292, profile.short, `${profile.driver} · ${profile.bus}`);
    display.append(displayArt(profile));
    const sensor = componentCard(570, 368, 255, 220, 'Motion sensor', `${this.sensor.module} · I²C`);
    sensor.append(sensorArt(this.sensor));
    const buttonNote = componentCard(300, 464, 230, 122, 'ใช้ปุ่ม BOOT บนบอร์ด', `GPIO${pins.BUTTON} · ไม่ต้องต่อสายเพิ่ม`);
    buttonNote.append(svgElement('text', { x: 318, y: 539, class: 'component-subtitle' }, 'กดสั้น → เปลี่ยนโหมด'), svgElement('text', { x: 318, y: 565, class: 'component-subtitle' }, 'ค้าง 2 วิ → เปิด/ปิด Wi-Fi'));
    this.svg.append(boardCard, display, sensor, buttonNote);
    const usedBoardPins = new Set(this.connections.map(c => c.boardPin));
    for (const [pin, y] of Object.entries(boardPositions)) if (usedBoardPins.has(pin)) this.addPin(`board:${pin}`, pin, 260, y, 'right', `${board.name} ${pin}`);
    const displayPins = profile.mono ? ['VCC', 'GND', 'SDA', 'SCL'] : ['VCC', 'GND', 'CLK', 'DIN', 'DC', 'RST', ...(profile.hasCs ? ['CS'] : [])];
    const labels = profile.id === 'gmt130-240x240' ? { CLK: 'SCK', DIN: 'SDA (MOSI)', RST: 'RES' } : { CLK: 'CLK / SCK', DIN: 'DIN / MOSI', RST: 'RST / RES' };
    displayPins.forEach((pin, index) => this.addPin(`display:${pin}`, labels[pin] || pin, 570, 119 + index * 28, 'left', `${profile.short} ${labels[pin] || pin}`));
    if (!profile.mono) {
      const y = 119 + displayPins.length * 28;
      display.append(svgElement('circle', { cx: 570, cy: y, r: 5, class: 'backlight-port' }), svgElement('text', { x: 585, y: y + 4, class: 'backlight-label' }, 'BL / BLK *'));
    }
    const sensorLabels = { CS: this.sensor.id === 'bmi160' ? 'CS / CSB' : 'CS', SDO: 'SDO / SA0' };
    this.sensorPins = ['VCC', 'GND', 'SDA', 'SCL', ...this.sensor.straps.map(([pin]) => pin)];
    this.sensorPins.forEach((pin, index) => this.addPin(`sensor:${pin}`, sensorLabels[pin] || pin, 570, 433 + index * 26, 'left', `${this.sensor.name} ${sensorLabels[pin] || pin}`));
    this.ghost = svgElement('path', { class: 'wire-ghost', hidden: '' });
    this.svg.append(this.ghost);
    this.list.replaceChildren();
    for (const connection of this.connections) {
      this.addWire(connection);
      this.addRow(connection);
    }
    this.reset();
  }
  addPin(id, label, x, y, side, accessibleLabel) {
    const group = svgElement('g', { class: 'graph-pin', 'data-pin': id, tabindex: 0, role: 'button', 'aria-label': accessibleLabel });
    const signal = this.connections.find(c => c.from === id || c.to === id)?.signal;
    group.style.setProperty('--wire-color', wireSignals[signal].color);
    group.append(svgElement('title', {}, accessibleLabel), svgElement('rect', { x: side === 'right' ? x - 72 : x - 17, y: y - 14, width: side === 'right' ? 90 : 119, height: 28, rx: 6, class: 'pin-hit' }), svgElement('circle', { cx: x, cy: y, r: 5, class: 'pin-dot' }), svgElement('text', { x: side === 'right' ? x - 14 : x + 15, y: y + 4, 'text-anchor': side === 'right' ? 'end' : 'start', class: 'pin-label' }, label));
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.activatePin(id); }
    });
    this.ports.set(id, { x, y, element: group, label: accessibleLabel, pinLabel: label });
    this.svg.append(group);
  }
  wirePath(first, second) {
    const a = this.ports.get(first), b = this.ports.get(second);
    if (second.startsWith('sensor:')) {
      const lane = 522 + this.sensorPins.indexOf(second.split(':')[1]) * 6;
      return `M${a.x},${a.y} H${lane - 12} Q${lane},${a.y} ${lane},${a.y + 12} V${b.y - 12} Q${lane},${b.y} ${lane + 12},${b.y} H${b.x}`;
    }
    const bend = Math.max(40, Math.abs(b.x - a.x) * .52);
    return `M${a.x},${a.y} C${a.x + bend},${a.y} ${b.x - bend},${b.y} ${b.x},${b.y}`;
  }
  addWire(connection) {
    const group = svgElement('g', { class: 'graph-wire', tabindex: 0, role: 'button', 'aria-label': this.connectionLabel(connection), 'data-wire': connection.id });
    group.style.setProperty('--wire-color', wireSignals[connection.signal].color);
    const path = this.wirePath(connection.from, connection.to);
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
