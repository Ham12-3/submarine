/**
 * Scroll → 3D state. Each keyframe sits at the scroll position where its section is
 * centred on screen; between keys the state eases, so the camera "settles" on every
 * section and glides between them — a continuous dive from the surface to the Challenger Deep.
 *
 * rot = [yaw, pitch, roll] in radians. The submarine's nose points along +X.
 */

const DEFAULT = {
  cam: [0, 0, 20],
  look: [0, 0, 0],
  sub: [0, 0, 0],
  rot: [0, 0, 0],
  scale: 1,
  depth: 0,
  beams: 0,
  title: 0,
  hot: 0,
  globe: 0,
  ping: 0,
};

const center = (el, vh) => el.offsetTop + el.offsetHeight / 2 - vh / 2;

export function measure() {
  const vh = window.innerHeight;
  const $ = (id) => document.getElementById(id);
  const hero = $('hero');
  return {
    vh,
    portrait: window.innerWidth / vh < 0.9,
    heroRange: hero.offsetHeight - vh,
    descent: center($('descent'), vh),
    engineering: center($('engineering'), vh),
    principles: center($('principles'), vh),
    fleet: center($('fleet'), vh),
    expeditions: center($('expeditions'), vh),
    safety: center($('safety'), vh),
    heritage: center($('heritage'), vh),
    contact: center($('contact'), vh),
    max: document.documentElement.scrollHeight - vh,
  };
}

export function buildKeys(m) {
  const H = (f) => m.heroRange * f;
  const P = m.portrait;

  const keys = [
    // ── surface: sub idling in front of the wordmark at dusk
    { at: 0, lin: true, cam: [0, 1.9, P ? 26 : 19], look: [0, 2.6, 0], sub: [0.4, -0.62, 0], rot: [-0.32, 0, 0], title: 1 },
    { at: H(0.14), lin: true, cam: [0, 1.5, P ? 22 : 16.5], look: [0.3, 1.6, 0], sub: [0.8, -0.6, 0], rot: [-0.12, 0, 0], title: 1 },
    // ── dive (linear segments so the descent never stalls mid-hero)
    { at: H(0.3), lin: true, cam: [0, 1.1, 14], look: [1.2, -1.2, -1], sub: [2, -2.6, -2.4], rot: [0.3, -0.3, 0.04], title: 0.3 },
    { at: H(0.4), lin: true, cam: [-0.3, -2.6, 13], look: [1.8, -5.6, -2], sub: [2.6, -6.4, -4], rot: [0.45, -0.36, 0.05], depth: 6 },
    { at: H(0.55), lin: true, cam: [-1.2, -9, 13.5], look: [1.8, -14, -2.5], sub: [2.6, -14.5, -5], rot: [0.5, -0.34, 0.03], depth: 30 },
    { at: H(0.78), cam: [-3, -24, 14.5], look: [1, -29, -2], sub: [2.2, -29.5, -4], rot: [0.3, -0.22, 0], depth: 90, beams: 0.1 },
    { at: H(1), cam: [0, -44, 18], look: [0, -46, 0], sub: [3.5, -48.5, -4], rot: [0.1, -0.1, 0], depth: 200, beams: 0.15 },

    // ── 01 descent: sub cruises in the background, lower right
    {
      at: m.descent,
      cam: [0, -78, 20],
      look: [0, -78, 0],
      sub: P ? [2, -86, -14] : [8.5, -82, -11],
      rot: [-0.95, -0.04, 0],
      depth: 650,
      beams: 0.3,
    },
    // ── 02 engineering: profile view on the right with hotspots
    {
      at: m.engineering,
      cam: [0, -110, 16],
      look: [0, -110, 0],
      sub: P ? [0, -111.2, 0] : [4.0, -110.3, 0],
      rot: [-0.22, 0, 0],
      scale: P ? 0.5 : 0.56,
      depth: 1400,
      beams: 0.55,
      hot: 1,
    },
    // ── 03 principles
    { at: m.principles, cam: [0, -142, 20], look: [0, -145, 0], sub: [-10, -152, -20], rot: [0.55, -0.05, 0], depth: 2600, beams: 0.7 },
    // ── 04 fleet
    { at: m.fleet, cam: [0, -176, 20], look: [0, -176, 0], sub: [14, -183, -42], rot: [2.75, 0, 0], depth: 3900, beams: 0.7 },
    // ── 05 expeditions: globe takes over
    { at: m.expeditions, cam: [0, -212, 20], look: [0, -212, 0], sub: [0, -236, -24], rot: [0.2, 0, 0], depth: 5300, beams: 0.7, globe: 1 },
    // ── 06 safety: floodlights toward the viewer
    {
      at: m.safety,
      cam: [0, -250, 16],
      look: [0, -250, 0],
      sub: P ? [0, -253, -6] : [5.6, -250.8, -1.5],
      rot: [-2.3, 0.02, 0],
      scale: P ? 0.7 : 0.9,
      depth: 6800,
      beams: 1,
    },
    // ── 07 heritage
    { at: m.heritage, cam: [0, -292, 22], look: [0, -292, 0], sub: [0, -300.5, -20], rot: [0.12, 0, 0], depth: 8400, beams: 1 },
    // ── 08 contact: the seabed and sonar contours appear
    { at: m.contact, cam: [0, -386, 26], look: [0, -404, 0], sub: [-7, -399, -4], rot: [0.6, 0.08, 0], depth: 9800, beams: 1, ping: 1 },
    // ── footer: touchdown
    { at: m.max, cam: [0, -394, 22], look: [0, -410, -12], sub: [3, -403.5, -7], rot: [-0.3, 0.04, 0], depth: 10935, beams: 1, ping: 1 },
  ];

  return keys.map((k) => ({ ...DEFAULT, ...k })).sort((a, b) => a.at - b.at);
}

const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const out = structuredClone(DEFAULT);

export function sample(keys, y) {
  let i = 0;
  while (i < keys.length - 2 && y > keys[i + 1].at) i++;
  const a = keys[i];
  const b = keys[i + 1];
  const span = Math.max(1, b.at - a.at);
  const raw = Math.min(1, Math.max(0, (y - a.at) / span));
  const t = a.lin ? raw : ease(raw);
  for (const k in DEFAULT) {
    const va = a[k];
    const vb = b[k];
    if (Array.isArray(va)) {
      for (let j = 0; j < va.length; j++) out[k][j] = va[j] + (vb[j] - va[j]) * t;
    } else {
      out[k] = va + (vb - va) * t;
    }
  }
  return out;
}
