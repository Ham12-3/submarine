import { formatInt } from './text.js';

const MAX = 11000;
const TEMP = [
  [0, 18],
  [200, 13],
  [1000, 4.5],
  [4000, 1.6],
  [8000, 1.5],
  [11000, 2.4],
];
const ZONES = [
  [1, 'SURFACE'],
  [200, 'SUNLIGHT ZONE'],
  [1000, 'TWILIGHT ZONE'],
  [4000, 'MIDNIGHT ZONE'],
  [6000, 'THE ABYSS'],
  [Infinity, 'HADAL ZONE'],
];

function tempAt(d) {
  for (let i = 0; i < TEMP.length - 1; i++) {
    const [d0, t0] = TEMP[i];
    const [d1, t1] = TEMP[i + 1];
    if (d <= d1) return t0 + ((t1 - t0) * (d - d0)) / (d1 - d0);
  }
  return TEMP[TEMP.length - 1][1];
}

/** Dive instrument read-out: depth gauge, pressure, temperature and ocean zone. */
export function initHud() {
  const root = document.getElementById('hud');
  const scale = document.getElementById('hudScale');
  const marker = document.getElementById('hudMarker');
  const markerLabel = document.getElementById('hudMarkerLabel');
  const depthEl = document.getElementById('hudDepth');
  const presEl = document.getElementById('hudPressure');
  const tempEl = document.getElementById('hudTemp');
  const zoneEl = document.getElementById('hudZone');

  for (let k = 0; k <= 11; k++) {
    const s = document.createElement('span');
    s.style.top = `${(k / 11) * 100}%`;
    if (k % 2 === 0) s.textContent = k === 0 ? '0' : `${k}K`;
    else s.className = 'minor';
    scale.appendChild(s);
  }

  let last = -1;
  let lastZone = '';
  return {
    show(on) {
      root.classList.toggle('is-on', on);
    },
    update(depth) {
      const d = Math.max(0, depth);
      if (Math.abs(d - last) < 0.5) return;
      last = d;
      marker.style.top = `${(Math.min(d, MAX) / MAX) * 100}%`;
      markerLabel.textContent = `${formatInt(d)} M`;
      depthEl.textContent = formatInt(d);
      presEl.textContent = formatInt(1 + d / 10.06);
      tempEl.textContent = tempAt(d).toFixed(1);
      const zone = ZONES.find(([lim]) => d < lim)[1];
      if (zone !== lastZone) {
        zoneEl.textContent = zone;
        lastZone = zone;
      }
    },
  };
}
