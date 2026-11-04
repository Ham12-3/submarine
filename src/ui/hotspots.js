// [title, detail, leader direction, text alignment relative to the leader, minor (dot only on phones)]
const LABELS = {
  hull: ['TITANIUM PRESSURE HULL', '90 MM FORGED Ti-6Al-4V', 'down', 'end', false],
  sail: ['SAIL & MAST ARRAY', 'SONAR · COMMS · NAV', 'up', 'start', false],
  lights: ['LED FLOODLIGHTS', '2 × 60,000 LUMENS', 'down', 'end', false],
  stern: ['X-FORM STERN PLANES', '6-AXIS ATTITUDE CONTROL', 'down', 'end', true],
  pumpjet: ['PUMP-JET PROPULSOR', 'ACOUSTICALLY QUIET', 'up', 'start', true],
};

/** HTML labels pinned to points on the 3D submarine. */
export function initHotspots(anchors) {
  const root = document.getElementById('hotspots');
  const els = anchors.map((a) => {
    const [title, sub, dir, align, minor] = LABELS[a.userData.key];
    const el = document.createElement('div');
    el.className = `hs hs--${dir} hs--${align}${minor ? ' hs--minor' : ''}`;
    el.innerHTML = `<span class="hs__dot"></span><span class="hs__line"></span><span class="hs__label"><b>${title}</b><span>${sub}</span></span>`;
    root.appendChild(el);
    return el;
  });
  const pts = [];

  return {
    update(world, amount) {
      const o = Math.max(0, Math.min(1, (amount - 0.55) / 0.4));
      root.style.opacity = o.toFixed(3);
      if (o <= 0) return;
      world.projectHotspots(pts);
      pts.forEach((p, i) => {
        els[i].style.transform = `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, 0)`;
        els[i].style.visibility = p.visible ? 'visible' : 'hidden';
      });
    },
  };
}
