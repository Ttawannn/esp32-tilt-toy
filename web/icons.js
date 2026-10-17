// Static mode icons: a small dark screen showing what each mode draws.
const screen = inner => `<svg viewBox="0 0 40 40" aria-hidden="true"><rect x="1" y="1" width="38" height="38" rx="9" fill="#06080c" stroke="#252c3b"/>${inner}</svg>`;
const pixels = (rows, color) => rows.flatMap(([y, from, to, fill = color]) => {
  const out = [];
  for (let x = from; x <= to; x += 4) out.push(`<rect x="${x}" y="${y}" width="3" height="3" rx=".6" fill="${fill}"/>`);
  return out;
}).join('');
export const modeIcons = {
  'water-slosh': screen(`<path d="M5 16 35 27V34a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z" fill="#1fa2e0"/><path d="M5 16 35 27" stroke="#9ee6fb" stroke-width="2.2" stroke-linecap="round"/><path d="M11 9q9-5 18 0" fill="none" stroke="#8b94a8" stroke-width="1.8" stroke-linecap="round"/><path d="m26 6.5 3 2.5-3.6 1.5" fill="none" stroke="#8b94a8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`),
  'pixel-flow': screen(pixels([[18, 6, 34, '#8ee8ff'], [22, 6, 34, '#2bb8f0'], [26, 6, 34, '#1a9fe0'], [30, 6, 34, '#1288cc'], [34, 10, 30, '#0c70b4'], [14, 22, 26, '#c8f4ff']])),
  heart: screen(`<path d="M20 31 9.5 20.5a6.2 6.2 0 0 1 8.8-8.8L20 13.4l1.7-1.7a6.2 6.2 0 0 1 8.8 8.8z" fill="#ff4f8b"/><path d="M13.4 14.6a3 3 0 0 1 3.6-.4" fill="none" stroke="#ffb3cf" stroke-width="1.8" stroke-linecap="round"/><path d="M30.5 8.5a1.6 1.6 0 0 1 2.3 2.3L31.6 12l-1.1-1.1-1.2-1.2a1.6 1.6 0 0 1 2.3-2.3z" fill="#ff4f8b" opacity=".7"/>`),
  message: screen(pixels([[14, 6, 10, '#3cdcff'], [18, 6, 6, '#3cdcff'], [18, 10, 10, '#3cdcff'], [22, 6, 10, '#3cdcff'], [26, 6, 6, '#3cdcff'], [26, 10, 10, '#3cdcff'], [14, 18, 18, '#3cdcff'], [18, 18, 18, '#3cdcff'], [22, 18, 18, '#3cdcff'], [26, 18, 22, '#3cdcff'], [14, 30, 34, '#3cdcff'], [18, 30, 30, '#3cdcff'], [22, 30, 34, '#3cdcff'], [26, 34, 34, '#3cdcff'], [26, 30, 30, '#3cdcff']]) + pixels([[30, 6, 34, '#1a2030']])),
  robot: screen(`<rect x="7" y="14" width="11" height="12" rx="3" fill="#3cdcff"/><rect x="22" y="14" width="11" height="12" rx="3" fill="#3cdcff"/><rect x="7" y="14" width="11" height="12" rx="3" fill="none" stroke="#3cdcff" stroke-opacity=".35" stroke-width="4"/><rect x="22" y="14" width="11" height="12" rx="3" fill="none" stroke="#3cdcff" stroke-opacity=".35" stroke-width="4"/>`)
};
