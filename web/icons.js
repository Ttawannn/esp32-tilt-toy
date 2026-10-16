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
  robot: screen(`<rect x="7" y="14" width="11" height="12" rx="3" fill="#3cdcff"/><rect x="22" y="14" width="11" height="12" rx="3" fill="#3cdcff"/><rect x="7" y="14" width="11" height="12" rx="3" fill="none" stroke="#3cdcff" stroke-opacity=".35" stroke-width="4"/><rect x="22" y="14" width="11" height="12" rx="3" fill="none" stroke="#3cdcff" stroke-opacity=".35" stroke-width="4"/>`)
};
