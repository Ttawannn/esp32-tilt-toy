import { findSensor, wiringConnections, wireSignals } from './profiles.js';
import { defaultBoard } from './boards.js';
import { boardLayout, displayLayout, sensorLayout, wirePath } from './wiring-layout.js';

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
function boardArt(board, layout) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const classic = board.target === 'esp32';
  const { x, y, width, height } = layout.bounds;
  group.append(svgElement('rect', { x, y, width, height, rx: classic ? 12 : 5, fill: '#222a2b', stroke: '#111b1d', 'stroke-width': 3 }));
  const chipY = classic ? y + 73 : y + 122;
  group.innerHTML += `<path d="M185 ${y + 16}v20h14v-20h14v20h14v-20h17" fill="none" stroke="#8b937c" stroke-width="3"/>
    <rect x="184" y="${chipY}" width="62" height="${classic ? 116 : 56}" rx="3" fill="${classic ? '#c9ccca' : '#363b3b'}" stroke="#7c8984"/>
    <text x="215" y="${chipY + 28}" text-anchor="middle" fill="${classic ? '#56605c' : '#d1d9d2'}" font-size="${classic ? 8 : 10}">${classic ? 'ESP-WROOM-32' : board.chipFamily}</text>
    <text x="215" y="${chipY + 43}" text-anchor="middle" fill="#889b87" font-size="7">${classic ? 'WiFi · BT' : 'SuperMini'}</text>`;
  for (let i = 0; i < 5; i++) group.append(svgElement('rect', { x: 188 + (i % 2) * 31, y: chipY + (classic ? 143 : 71) + Math.floor(i / 2) * 13, width: 12, height: 6, fill: i % 2 ? '#c8bb83' : '#7e8984', rx: 1 }));
  const buttonY = classic ? y + height - 65 : y + 71;
  for (const [bx, label] of [[185, 'BOOT'], [228, 'RST']]) {
    group.append(svgElement('rect', { x: bx, y: buttonY, width: 18, height: 18, rx: 2, fill: '#adb8b3' }), svgElement('circle', { cx: bx + 9, cy: buttonY + 9, r: 6, fill: label === 'BOOT' ? '#93b971' : '#343d37' }), svgElement('text', { x: bx + 9, y: buttonY + 29, 'text-anchor': 'middle', fill: '#c6d5c9', 'font-size': 7 }, label));
  }
  const usbY = classic ? y + height - 21 : y - 7;
  group.append(svgElement('rect', { x: 189, y: usbY, width: 52, height: 35, rx: 5, fill: '#bcc5c0', stroke: '#7c8984', 'stroke-width': 2 }), svgElement('rect', { x: 196, y: classic ? usbY + 23 : usbY + 2, width: 38, height: 7, rx: 3, fill: '#293633' }));
  if (classic) for (const cx of [151, 279]) for (const cy of [y + 12, y + height - 12]) group.append(svgElement('circle', { cx, cy, r: 6, fill: '#f7faf2', stroke: '#bdc6ba', 'stroke-width': 2 }));
  return group;
}
function displayArt(profile, layout) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const { x, y, width, height } = layout.bounds;
  if (profile.shape === 'round') {
    group.append(svgElement('rect', { x: 691, y: 309, width: 156, height: 61, rx: 4, fill: '#276187', stroke: '#173f57', 'stroke-width': 2 }), svgElement('circle', { cx: 770, cy: 229, r: 112, fill: '#1c212b', stroke: '#376c8b', 'stroke-width': 5 }));
  } else {
    group.append(svgElement('rect', { x, y, width, height, rx: 4, fill: profile.mono ? '#272c30' : '#276187', stroke: '#173f57', 'stroke-width': 2 }), svgElement('rect', { x: x + 8, y: y + 43, width: width - 16, height: height - 66, rx: 3, fill: '#1c212b', stroke: '#8e9a9c', 'stroke-width': 2 }));
    for (const cx of [x + 15, x + width - 15]) for (const cy of [y + 16, y + height - 16]) group.append(svgElement('circle', { cx, cy, r: 8, fill: '#f7faf2', stroke: '#b5c2bb', 'stroke-width': 3 }));
  }
  group.append(svgElement('text', { x: x + width / 2, y: profile.shape === 'round' ? 269 : y + height - 10, 'text-anchor': 'middle', fill: '#b8d1dd', 'font-size': 10 }, `${profile.driver} · ${profile.width} × ${profile.height}`));
  return group;
}
function sensorArt(sensor, layout) {
  const group = svgElement('g', { 'aria-hidden': 'true' });
  const { x, y, width, height } = layout.bounds;
  group.innerHTML = `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="4" fill="${sensor.id === 'bmi160' ? '#6b347e' : '#276187'}" stroke="#274d63" stroke-width="2"/>
    <circle cx="${x + width - 23}" cy="${y + 22}" r="13" fill="#f7faf2" stroke="#e1c77d" stroke-width="3"/>
    <circle cx="${x + width - 23}" cy="${y + height - 22}" r="13" fill="#f7faf2" stroke="#e1c77d" stroke-width="3"/>
    <rect x="${x + 72}" y="${y + 76}" width="35" height="35" fill="#222c32" stroke="#8f9b9a"/>
    <text x="${x + 90}" y="${y + 96}" text-anchor="middle" font-size="6" fill="#c5d2d1">${sensor.name}</text>
    <path d="M${x + 66} ${y + 80}h-9m9 8h-9m9 8h-9m9 8h-9m56-24h9m-9 8h9m-9 8h9m-9 8h9" stroke="#d4d9cc" stroke-width="2"/>
    <rect x="${x + 65}" y="${y + 28}" width="22" height="12" rx="1" fill="#253238"/>
    <rect x="${x + 91}" y="${y + 29}" width="10" height="8" fill="#e8d7a2"/>
    <rect x="${x + 64}" y="${y + 53}" width="12" height="6" fill="#e8d7a2"/>
    <path d="M${x + 94} ${y + height - 20}v-25m0 25h20" fill="none" stroke="#c3dee5" stroke-width="1.5"/>
    <text x="${x + 99}" y="${y + height - 39}" font-size="8" fill="#c3dee5">Y</text><text x="${x + 108}" y="${y + height - 23}" font-size="8" fill="#c3dee5">X</text>`;
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
    this.svg.append(defs, svgElement('rect', { width: 1000, height: 790, fill: 'url(#wiring-dots)' }));
    const boardGeometry = boardLayout(board), displayGeometry = displayLayout(profile), sensorGeometry = sensorLayout(this.sensor);
    const boardCard = componentCard(30, 75, 340, 625, board.name, `${board.target === 'esp32' ? 'DevKit V1' : 'SuperMini'} · Flash 4 MB`);
    const display = componentCard(545, 55, 415, 355, profile.short, `${profile.driver} · ${profile.bus}`);
    const sensor = componentCard(545, 440, 415, 285, this.sensor.name, `${this.sensor.module} · I²C`);
    this.svg.append(boardCard, display, sensor, boardArt(board, boardGeometry), displayArt(profile, displayGeometry), sensorArt(this.sensor, sensorGeometry));
    boardCard.append(svgElement('text', { x: 48, y: 651, class: 'component-subtitle' }, `BOOT · GPIO${pins.BUTTON} · ไม่ต้องต่อสายเพิ่ม`), svgElement('text', { x: 48, y: 674, class: 'component-subtitle' }, 'กดสั้นเปลี่ยนโหมด · ค้าง 2 วิเปิด Wi-Fi'));
    this.wireLayer = svgElement('g', { class: 'wire-layer' });
    this.pinLayer = svgElement('g');
    this.svg.append(this.wireLayer, this.pinLayer);
    for (const [geometry, name] of [[boardGeometry, board.name], [displayGeometry, profile.short], [sensorGeometry, this.sensor.name]]) {
      for (const port of geometry.pins) this.addPin(port, `${name} ${port.id === 'board:GND-L' ? 'GND (ซ้าย)' : port.label}`);
    }
    this.ghost = svgElement('path', { class: 'wire-ghost', hidden: '' });
    this.svg.append(this.ghost);
    this.list.replaceChildren();
    for (const connection of this.connections) {
      this.addWire(connection);
      this.addRow(connection);
    }
    this.reset();
  }
  addPin(port, accessibleLabel) {
    const { id, label, x, y, dx, dy } = port;
    const group = svgElement('g', { class: 'graph-pin', 'data-pin': id, tabindex: 0, role: 'button', 'aria-label': accessibleLabel });
    const signal = this.connections.find(c => c.from === id || c.to === id)?.signal;
    group.style.setProperty('--wire-color', wireSignals[signal]?.color || '#88998c');
    group.append(svgElement('title', {}, accessibleLabel), svgElement('rect', { x: x - 10, y: y - 10, width: 20, height: 20, rx: 5, class: 'pin-hit' }), svgElement('circle', { cx: x, cy: y, r: 6, class: 'pin-ring' }), svgElement('circle', { cx: x, cy: y, r: 3, class: 'pin-dot' }));
    const text = svgElement('text', { x: dx ? x - dx * 11 : x, y: dy ? y - dy * 14 : y + 3, 'text-anchor': dx < 0 ? 'start' : dx > 0 ? 'end' : 'middle', class: 'pin-label', 'pointer-events': 'none' }, label);
    if (id.startsWith('board:') && dy) {
      text.setAttribute('y', y + 23);
      text.textContent = label.replace('GPIO', '');
    }
    group.append(text);
    group.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); this.activatePin(id); }
    });
    this.ports.set(id, { ...port, element: group, label: accessibleLabel, pinLabel: label });
    this.pinLayer.append(group);
  }
  wirePath(first, second) {
    const lane = this.connections.findIndex(c => c.from === first && c.to === second);
    return wirePath(this.ports.get(first), this.ports.get(second), Math.max(0, lane));
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
    return `${this.ports.get(connection.to).label} ↔ ${this.board.name} ${connection.boardPin === 'GND-L' ? 'GND (ซ้าย)' : connection.boardPin}`;
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
      const signal = this.connections.find(c => c.from === id || c.to === id)?.signal;
      port.element.style.setProperty('--wire-color', wireSignals[signal]?.color || '#88998c');
      port.element.classList.toggle('is-unused', !signal);
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
    this.root.querySelector('#wiring-help').textContent = this.practice ? 'ลากจากรู pin ไปยังขาที่ไฮไลต์ · แตะทีละขาหรือใช้ Enter / Space ได้' : 'สายต่อจากรู pin บนอุปกรณ์ตามเฟิร์มแวร์ · กดที่สายหรือรายการเพื่อดูคู่ pin · เลื่อนผังซ้าย–ขวาได้บนมือถือ';
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
