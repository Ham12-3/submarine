import * as THREE from 'three';

/*
 * Procedural attack submarine, proportioned after a modern SSN (length ≈ 7.7 × beam):
 * long parallel mid-body with a flattened casing on top, blunt bow, tall fin set well
 * forward and flared into the hull, bow hydroplanes, cruciform stern with end-plates and
 * a shrouded pump-jet. The hull is covered in weathered anechoic (rubber) tiles.
 * 1 unit ≈ 7 m, so the crew on the bridge are to scale.
 */

const R = 0.8;
const TAIL = 3.6;
const BODY = 6.8;
const NOSE = 2.0;
const Y_MIN = -(BODY / 2 + TAIL);
const Y_MAX = BODY / 2 + NOSE;
const LENGTH = Y_MAX - Y_MIN; // 12.4
const SHIFT = -(Y_MIN + Y_MAX) / 2;
const DECK = R * 0.75; // the casing: hull top is flattened above this height

// fin (sail) dimensions
const FIN_FRONT = 3.2;
const FIN_CHORD = 1.9;
const FIN_HALF_T = 0.22;
const FIN_BASE = 0.4;
const FIN_TOP = 1.85;

const smoothstep = (a, b, v) => {
  const t = Math.min(1, Math.max(0, (v - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

function tailRadius(y) {
  const t = (y - Y_MIN) / TAIL;
  return Math.max(0.2 * R, R * Math.pow(1 - Math.pow(1 - t, 2.2), 0.75));
}

function noseRadius(t) {
  return R * Math.pow(Math.max(0, 1 - Math.pow(t, 2.4)), 1 / 2.4);
}

/** Hull radius at a station X in final (laid-down, centred) coordinates. */
export function hullRadiusAtX(x) {
  const y = x - SHIFT;
  if (y < -BODY / 2) return tailRadius(y);
  if (y <= BODY / 2) return R;
  return noseRadius(Math.min(1, (y - BODY / 2) / NOSE));
}

const flatten = (y) => (y > DECK ? DECK + (y - DECK) * 0.45 : y);
const hullTopAtX = (x) => flatten(hullRadiusAtX(x));

// NACA 4-digit thickness distribution, normalised to a max of 1
const naca = (s) => (0.2969 * Math.sqrt(s) - 0.126 * s - 0.3516 * s * s + 0.2843 * s ** 3 - 0.1036 * s ** 4) / 0.1;

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function rng(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function toTextures(colorCanvas, roughCanvas, bumpCanvas, wrap) {
  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  const roughnessMap = new THREE.CanvasTexture(roughCanvas);
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  for (const t of [map, roughnessMap, bumpMap]) {
    t.anisotropy = 8;
    if (wrap) t.wrapS = THREE.RepeatWrapping;
  }
  return { map, roughnessMap, bumpMap };
}

/**
 * Hull maps. U runs around the hull (u = 0 is the +Z side at the axis, 0.75 the top, 0.25 the
 * keel, 0.5 the −Z side); V runs tail → nose. Canvas Y is flipped (V = 1 at the top row).
 */
function makeHullMaps() {
  const W = 1024;
  const H = 2048;
  const rnd = rng(11);
  const cc = makeCanvas(W, H);
  const rc = makeCanvas(W, H);
  const bc = makeCanvas(W, H);
  const c = cc.getContext('2d');
  const r = rc.getContext('2d');
  const b = bc.getContext('2d');
  const yOf = (x) => (1 - (x - SHIFT - Y_MIN) / LENGTH) * H; // canvas row for hull station x

  // tile seams are whatever shows between tiles: slightly darker, rougher and recessed — kept
  // subtle, because on a real boat the grid only shows up in raking light
  c.fillStyle = '#18191b';
  c.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(172,172,172)';
  r.fillRect(0, 0, W, H);
  b.fillStyle = 'rgb(100,100,100)';
  b.fillRect(0, 0, W, H);

  // anechoic tiles in a brick pattern, each a slightly different age
  const tile = 0.34;
  const cols = Math.round((Math.PI * 2 * R) / tile);
  const rows = Math.round(LENGTH / tile);
  const tw = W / cols;
  const th = H / rows;
  for (let j = 0; j < rows; j++) {
    const y = j * th;
    const off = j % 2 ? tw / 2 : 0;
    for (let i = -1; i <= cols; i++) {
      const x = i * tw + off;
      let s = (rnd() - 0.5) * 7;
      if (rnd() < 0.045) s += rnd() < 0.5 ? -8 : 12; // replaced or sun-faded tiles
      const v = Math.round(29 + s);
      c.fillStyle = `rgb(${v - 1},${v + 1},${v + 2})`;
      c.fillRect(x + 1.5, y + 1.5, tw - 3, th - 3);
      const rv = Math.round(150 + (rnd() - 0.5) * 60);
      r.fillStyle = `rgb(${rv},${rv},${rv})`;
      r.fillRect(x + 1.5, y + 1.5, tw - 3, th - 3);
      const bv = Math.round(128 + (rnd() - 0.5) * 10);
      b.fillStyle = `rgb(${bv},${bv},${bv})`;
      b.fillRect(x + 1.5, y + 1.5, tw - 3, th - 3);
    }
  }

  // grime speckle
  for (let i = 0; i < 9000; i++) {
    c.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.06)';
    const s = 1 + rnd() * 5;
    c.fillRect(rnd() * W, rnd() * H, s, s);
  }

  // wet patches (glossier)
  for (let i = 0; i < 70; i++) {
    const g = r.createRadialGradient(0, 0, 0, 0, 0, 1);
    g.addColorStop(0, 'rgba(40,40,40,0.35)');
    g.addColorStop(1, 'rgba(40,40,40,0)');
    r.save();
    r.translate(rnd() * W, rnd() * H);
    r.scale(30 + rnd() * 80, 60 + rnd() * 200);
    r.fillStyle = g;
    r.beginPath();
    r.arc(0, 0, 1, 0, Math.PI * 2);
    r.fill();
    r.restore();
  }

  // surfaced waterline (hull axis 0.3 below the sea): u ≈ 0.939 on +Z, 0.561 on −Z
  const wlA = 1 - Math.asin(0.3 / R) / (Math.PI * 2);
  const wlB = 0.5 + Math.asin(0.3 / R) / (Math.PI * 2);
  // below the waterline: slightly warmer anti-fouling black
  c.fillStyle = 'rgba(34,24,18,0.22)';
  c.fillRect(wlA * W, 0, (1 - wlA) * W, H);
  c.fillRect(0, 0, wlB * W, H);
  // salt stain just above it
  const saltBand = (edge, dir) => {
    const x0 = edge * W;
    const x1 = x0 + dir * 0.03 * W;
    const g = c.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, 'rgba(170,168,158,0.2)');
    g.addColorStop(1, 'rgba(170,168,158,0)');
    c.fillStyle = g;
    c.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
  };
  saltBand(wlA, -1);
  saltBand(wlB, 1);

  // salt and rust streaks running down the sides from the casing edge
  const casingA = 1 - Math.asin(DECK / R) / (Math.PI * 2); // ≈ 0.865
  const casingB = 0.5 + Math.asin(DECK / R) / (Math.PI * 2); // ≈ 0.635
  for (let i = 0; i < 70; i++) {
    const side = rnd() < 0.5;
    const y = yOf(-5 + rnd() * 10);
    const x0 = (side ? casingA : casingB) * W;
    const len = (0.02 + rnd() * 0.06) * W * (side ? 1 : -1);
    const g = c.createLinearGradient(x0, 0, x0 + len, 0);
    const col = rnd() < 0.25 ? '120,72,44' : '190,186,174';
    g.addColorStop(0, `rgba(${col},${0.06 + rnd() * 0.1})`);
    g.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = g;
    c.fillRect(Math.min(x0, x0 + len), y, Math.abs(len), 1.5 + rnd() * 3);
  }

  // draught marks at bow and stern, both sides
  c.fillStyle = 'rgba(236,233,224,0.9)';
  c.font = '500 13px "JetBrains Mono", monospace';
  for (const station of [5.15, -4.7]) {
    const y = yOf(station);
    for (let k = 0; k < 8; k++) {
      const uA = 0.978 - k * 0.0115;
      c.fillRect(uA * W - 1.5, y - 7, 3, 14);
      const uB = 0.522 + k * 0.0115;
      c.fillRect(uB * W - 1.5, y - 7, 3, 14);
      if (k % 2 === 0) {
        c.save();
        c.translate(uA * W, y + 10);
        c.rotate(-Math.PI / 2);
        c.fillText(String(4 + k), 0, 4);
        c.restore();
      }
    }
  }

  // white arrow on the casing side, pointing forward
  c.save();
  c.fillStyle = 'rgba(236,233,224,0.85)';
  const ax = 0.888 * W;
  c.fillRect(ax - 2, yOf(3.95), 4, yOf(3.25) - yOf(3.95));
  c.beginPath();
  c.moveTo(ax, yOf(4.12));
  c.lineTo(ax - 9, yOf(3.92));
  c.lineTo(ax + 9, yOf(3.92));
  c.closePath();
  c.fill();
  c.restore();

  // grilles near the waterline
  for (const station of [1.1, -0.6, -2.0]) {
    for (let k = 0; k < 6; k++) {
      c.fillStyle = 'rgba(0,0,0,0.75)';
      c.fillRect(0.905 * W, yOf(station) + k * 6, 0.022 * W, 3);
      b.fillStyle = 'rgb(60,60,60)';
      b.fillRect(0.905 * W, yOf(station) + k * 6, 0.022 * W, 3);
    }
  }

  return toTextures(cc, rc, bc, true);
}

/** Fin maps. U runs round the section (0 trailing edge → 0.5 leading edge on +Z → 1), V is height. */
function makeFinMaps() {
  const W = 1024;
  const H = 512;
  const rnd = rng(23);
  const cc = makeCanvas(W, H);
  const rc = makeCanvas(W, H);
  const bc = makeCanvas(W, H);
  const c = cc.getContext('2d');
  const r = rc.getContext('2d');
  const b = bc.getContext('2d');
  const yOf = (v) => (1 - v) * H;

  c.fillStyle = '#1a1c1e';
  c.fillRect(0, 0, W, H);
  r.fillStyle = 'rgb(150,150,150)';
  r.fillRect(0, 0, W, H);
  b.fillStyle = 'rgb(128,128,128)';
  b.fillRect(0, 0, W, H);

  // darker, glossier where spray reaches
  const g = c.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, 'rgba(255,255,255,0.025)');
  g.addColorStop(0.7, 'rgba(0,0,0,0.05)');
  g.addColorStop(1, 'rgba(0,0,0,0.35)');
  c.fillStyle = g;
  c.fillRect(0, 0, W, H);
  const gr = r.createLinearGradient(0, 0, 0, H);
  gr.addColorStop(0.6, 'rgba(0,0,0,0)');
  gr.addColorStop(1, 'rgba(0,0,0,0.4)');
  r.fillStyle = gr;
  r.fillRect(0, 0, W, H);

  // plating: horizontal seams, vertical butts, rivet rows
  const seams = [0.2, 0.42, 0.63, 0.82];
  c.strokeStyle = 'rgba(0,0,0,0.6)';
  c.lineWidth = 1.5;
  b.strokeStyle = 'rgb(80,80,80)';
  b.lineWidth = 2.5;
  for (const v of seams) {
    for (const ctx of [c, b]) {
      ctx.beginPath();
      ctx.moveTo(0, yOf(v));
      ctx.lineTo(W, yOf(v));
      ctx.stroke();
    }
  }
  for (let u = 0.03; u < 1; u += 0.062) {
    for (const ctx of [c, b]) {
      ctx.beginPath();
      ctx.moveTo(u * W, yOf(0.1));
      ctx.lineTo(u * W, yOf(0.97));
      ctx.stroke();
    }
  }
  for (const v of seams) {
    for (let x = 4; x < W; x += 9) {
      for (const dy of [-5, 5]) {
        b.fillStyle = 'rgb(180,180,180)';
        b.beginPath();
        b.arc(x, yOf(v) + dy, 1.3, 0, Math.PI * 2);
        b.fill();
        c.fillStyle = 'rgba(255,255,255,0.05)';
        c.fillRect(x - 1, yOf(v) + dy - 1, 2, 2);
      }
    }
  }

  // bridge windows near the top of the leading edge, both sides
  const windows = (u0, u1) => {
    const n = 3;
    const gap = 0.005;
    const w = (u1 - u0 - gap * (n - 1)) / n;
    for (let k = 0; k < n; k++) {
      const x = (u0 + k * (w + gap)) * W;
      const y = yOf(0.88);
      const h = (0.88 - 0.74) * H;
      const wg = c.createLinearGradient(0, y, 0, y + h);
      wg.addColorStop(0, '#2a3236');
      wg.addColorStop(0.35, '#0a0d0e');
      wg.addColorStop(1, '#050607');
      c.fillStyle = wg;
      c.fillRect(x, y, w * W, h);
      r.fillStyle = 'rgb(18,18,18)';
      r.fillRect(x, y, w * W, h);
      b.strokeStyle = 'rgb(165,165,165)';
      b.lineWidth = 3;
      b.strokeRect(x, y, w * W, h);
    }
  };
  windows(0.322, 0.402);
  windows(0.598, 0.678);

  // access door, name boards and a louvred grille
  c.fillStyle = '#101213';
  c.fillRect(0.165 * W, yOf(0.5), 0.035 * W, (0.5 - 0.18) * H);
  b.strokeStyle = 'rgb(70,70,70)';
  b.lineWidth = 3;
  b.strokeRect(0.165 * W, yOf(0.5), 0.035 * W, (0.5 - 0.18) * H);
  for (const u0 of [0.208, 0.738]) {
    c.fillStyle = '#d6d2c6';
    c.fillRect(u0 * W, yOf(0.43), 0.054 * W, 0.06 * H);
    c.fillStyle = '#16181a';
    c.font = '600 19px "DM Sans", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('ABYSS', (u0 + 0.027) * W, yOf(0.4));
    r.fillStyle = 'rgb(110,110,110)';
    r.fillRect(u0 * W, yOf(0.43), 0.054 * W, 0.06 * H);
  }
  for (let k = 0; k < 7; k++) {
    c.fillStyle = 'rgba(0,0,0,0.7)';
    c.fillRect(0.1 * W, yOf(0.62) + k * 7, 0.03 * W, 3);
    b.fillStyle = 'rgb(70,70,70)';
    b.fillRect(0.1 * W, yOf(0.62) + k * 7, 0.03 * W, 3);
  }

  // salt and rust weeping down from the top and from fittings
  for (let i = 0; i < 60; i++) {
    const x = rnd() * W;
    const y0 = yOf(0.98 - rnd() * 0.5);
    const len = (0.15 + rnd() * 0.5) * H;
    const col = rnd() < 0.3 ? '118,74,46' : '196,192,180';
    const sg = c.createLinearGradient(0, y0, 0, y0 + len);
    sg.addColorStop(0, `rgba(${col},${0.05 + rnd() * 0.12})`);
    sg.addColorStop(1, `rgba(${col},0)`);
    c.fillStyle = sg;
    c.fillRect(x, y0, 1 + rnd() * 3.5, len);
  }

  // keep the top row plain — the cap samples it
  c.fillStyle = '#1c1e20';
  c.fillRect(0, 0, W, 3);

  return toTextures(cc, rc, bc, false);
}

/** Lofted fin: NACA sections that taper toward the top and flare into the hull at the base. */
function finGeometry() {
  const N = 80;
  const K = 34;
  const height = FIN_TOP - FIN_BASE;
  const positions = [];
  const uvs = [];
  const index = [];
  const ring = (h, extra = {}) => {
    const f = Math.pow(1 - smoothstep(0, 0.3, h), 2); // base flare
    const front = FIN_FRONT + 0.32 * f + (extra.front ?? 0);
    const chord = (FIN_CHORD * (1 - 0.1 * h) + 0.82 * f) * (extra.chord ?? 1);
    const halfT = FIN_HALF_T * (1 - 0.2 * h) * (1 + 1.6 * f) * (extra.thick ?? 1);
    const y = FIN_BASE + h * height + (extra.dy ?? 0);
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const u = i / N;
      const a = u * Math.PI * 2;
      const s = (1 + Math.cos(a)) / 2; // 1 = trailing edge, 0 = leading edge
      const z = Math.sign(Math.sin(a)) * naca(s) * halfT;
      pts.push([front - s * chord, y, z, u]);
    }
    return pts;
  };

  const rings = [];
  for (let k = 0; k <= K; k++) rings.push([ring(Math.pow(k / K, 1.35)), Math.pow(k / K, 1.35)]);
  rings.push([ring(1, { front: -0.012, chord: 0.975, thick: 0.9, dy: 0.028 }), 1]); // rounded top edge

  rings.forEach(([pts, h]) => {
    for (const [x, y, z, u] of pts) {
      positions.push(x, y, z);
      uvs.push(u, Math.min(h, 0.995));
    }
  });
  const stride = N + 1;
  for (let k = 0; k < rings.length - 1; k++) {
    for (let i = 0; i < N; i++) {
      const a = k * stride + i;
      const b = a + stride;
      index.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }

  // flat cap with its own vertices so the top edge stays crisp
  const top = rings[rings.length - 1][0];
  const capStart = positions.length / 3;
  let cx = 0;
  for (const [x] of top) cx += x;
  cx /= top.length;
  positions.push(cx, top[0][1] + 0.004, 0);
  uvs.push(0.5, 0.998);
  for (const [x, y, z] of top) {
    positions.push(x, y + 0.004, z);
    uvs.push(0.5, 0.998);
  }
  for (let i = 0; i < N; i++) index.push(capStart, capStart + 1 + i, capStart + 2 + i);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return { geometry: g, top };
}

/** Control surface: trapezoid in XY (x = chord, y = span), extruded for thickness. */
function planeGeometry(span, root, tip, sweep, thickness) {
  const s = new THREE.Shape();
  s.moveTo(-root / 2, 0);
  s.lineTo(root / 2, 0);
  s.lineTo(root / 2 - sweep + tip * 0.1, span);
  s.lineTo(root / 2 - sweep - tip, span);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.4,
    bevelSize: thickness * 0.4,
    bevelSegments: 3,
  });
  g.translate(0, 0, -thickness / 2);
  return g;
}

function crewFigure(uniform, skin, cap) {
  const g = new THREE.Group();
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.11, 4, 8), uniform);
  torso.position.y = 0.09;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.028, 12, 8), skin);
  head.position.y = 0.195;
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.03, 0.014, 14), cap);
  hat.position.y = 0.222;
  g.add(torso, head, hat);
  return g;
}

// Volumetric light-cone shader (additive, soft edges, fades along its length)
const beamVert = /* glsl */ `
  uniform float uLen;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vAlong = clamp(length(position) / uLen, 0.0, 1.0);
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;
const beamFrag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  uniform float uTime;
  varying float vAlong;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float soft = pow(facing, 2.2);
    float fall = pow(1.0 - vAlong, 2.0) * smoothstep(0.0, 0.05, vAlong);
    float flicker = 0.92 + 0.08 * sin(uTime * 3.1 + vAlong * 14.0);
    float a = soft * fall * flicker * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

export class Submarine {
  constructor() {
    this.group = new THREE.Group();
    this.group.rotation.order = 'YZX';
    this.body = new THREE.Group();
    this.group.add(this.body);
    this.hotspots = [];
    this.beamUniforms = [];
    this.spots = [];
    this.surfaced = 1;
    this._build();
  }

  _build() {
    const body = this.body;

    // ── materials: rubber-tiled hull, painted steel fin, olive masts
    const hullMaps = makeHullMaps();
    this.hullMat = new THREE.MeshPhysicalMaterial({
      ...hullMaps,
      metalness: 0,
      roughness: 1,
      bumpScale: 1.4,
      clearcoat: 0.3,
      clearcoatRoughness: 0.5,
    });
    const finMaps = makeFinMaps();
    const finMat = new THREE.MeshPhysicalMaterial({
      ...finMaps,
      metalness: 0.1,
      roughness: 1,
      bumpScale: 1.2,
      clearcoat: 0.25,
      clearcoatRoughness: 0.45,
    });
    const rubberMat = new THREE.MeshPhysicalMaterial({
      color: 0x17191b,
      metalness: 0,
      roughness: 0.62,
      clearcoat: 0.25,
      clearcoatRoughness: 0.5,
    });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x0e1011, metalness: 0.5, roughness: 0.55 });
    const oliveMat = new THREE.MeshStandardMaterial({ color: 0x54574b, metalness: 0.3, roughness: 0.55 });
    this.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2) });
    this.navMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 3.6, 1.8) });

    // ── pressure hull + casing
    const pts = [new THREE.Vector2(0, Y_MIN)];
    for (let i = 0; i <= 44; i++) {
      const y = Y_MIN + (TAIL * i) / 44;
      pts.push(new THREE.Vector2(tailRadius(y), y));
    }
    for (let i = 1; i <= 30; i++) pts.push(new THREE.Vector2(R, -BODY / 2 + (BODY * i) / 30));
    for (let i = 1; i <= 40; i++) {
      const a = (i / 40) * (Math.PI / 2);
      const t = Math.sin(a);
      pts.push(new THREE.Vector2(noseRadius(t), BODY / 2 + NOSE * t));
    }
    const hullGeo = new THREE.LatheGeometry(pts, 128);
    const pos = hullGeo.attributes.position;
    const uv = hullGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - Y_MIN) / LENGTH);
    hullGeo.translate(0, SHIFT, 0);
    hullGeo.rotateZ(-Math.PI / 2);
    for (let i = 0; i < pos.count; i++) pos.setY(i, flatten(pos.getY(i)));
    hullGeo.computeVertexNormals();
    body.add(new THREE.Mesh(hullGeo, this.hullMat));

    // ── fin (sail)
    const fin = finGeometry();
    body.add(new THREE.Mesh(fin.geometry, finMat));
    const finTopY = fin.top[0][1];

    // bridge: rail posts and a top rail round the leading edge
    const railMat = new THREE.MeshStandardMaterial({ color: 0x8b8f8c, metalness: 0.6, roughness: 0.4 });
    const topFront = FIN_FRONT;
    const topChord = FIN_CHORD * 0.9 * 0.975;
    const topHalfT = FIN_HALF_T * 0.8 * 0.9;
    const railPts = [];
    for (let k = 0; k <= 16; k++) {
      const a = Math.PI * 0.62 + (k / 16) * Math.PI * 0.76; // around the leading edge
      const s = (1 + Math.cos(a)) / 2;
      railPts.push(new THREE.Vector3(topFront - s * topChord - 0.02, finTopY + 0.13, Math.sign(Math.sin(a)) * naca(s) * topHalfT * 0.92));
    }
    const rail = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts), 48, 0.006, 6), railMat);
    body.add(rail);
    const postGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.13, 6);
    railPts.forEach((p, i) => {
      if (i % 3) return;
      const post = new THREE.Mesh(postGeo, railMat);
      post.position.set(p.x, finTopY + 0.065, p.z);
      body.add(post);
    });

    // crew on the bridge (only while surfaced) — the best cue for how big the boat is
    const uniformMat = new THREE.MeshStandardMaterial({ color: 0x14171d, roughness: 0.8 });
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xb08a6e, roughness: 0.7 });
    const capMat = new THREE.MeshStandardMaterial({ color: 0xe7e4dc, roughness: 0.6 });
    this.crew = new THREE.Group();
    const c1 = crewFigure(uniformMat, skinMat, capMat);
    c1.position.set(FIN_FRONT - 0.32, finTopY - 0.07, 0.04);
    const c2 = crewFigure(uniformMat, skinMat, capMat);
    c2.position.set(FIN_FRONT - 0.58, finTopY - 0.07, -0.07);
    c2.rotation.y = 0.6;
    this.crew.add(c1, c2);
    body.add(this.crew);

    // masts: raised on the surface, retracted into the fin before a dive
    this.masts = new THREE.Group();
    body.add(this.masts);
    const optronic = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.046, 1.6, 16), oliveMat);
    optronic.position.set(FIN_FRONT - 0.9, finTopY + 0.4, 0);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 18, 12), oliveMat);
    head.scale.set(1, 2.5, 1);
    head.position.set(FIN_FRONT - 0.9, finTopY + 1.3, 0);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.034, 0.14, 12), oliveMat);
    tip.position.set(FIN_FRONT - 0.9, finTopY + 1.53, 0);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.058, 0.05, 16), oliveMat);
    collar.position.set(FIN_FRONT - 0.9, finTopY + 1.08, 0);
    const comms = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 1.1, 12), steelMat);
    comms.position.set(FIN_FRONT - 1.18, finTopY + 0.25, 0);
    const commsHead = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.1, 0.06), steelMat);
    commsHead.position.set(FIN_FRONT - 1.18, finTopY + 0.83, 0);
    const whipGeo = new THREE.CylinderGeometry(0.005, 0.007, 0.6, 6);
    const whip1 = new THREE.Mesh(whipGeo, railMat);
    whip1.position.set(FIN_FRONT - 1.42, finTopY + 0.3, 0.03);
    const whip2 = new THREE.Mesh(whipGeo, railMat);
    whip2.position.set(FIN_FRONT - 0.66, finTopY + 0.25, -0.05);
    whip2.scale.y = 0.75;
    this.masts.add(optronic, head, tip, collar, comms, commsHead, whip1, whip2);
    this.mastTravel = 1.8;

    // ── bow hydroplanes
    const bowPlaneGeo = planeGeometry(0.95, 0.72, 0.46, 0.18, 0.055);
    const bowX = 4.4;
    const bowY = 0.16;
    const bowZ = Math.sqrt(R * R - bowY * bowY) - 0.04;
    [1, -1].forEach((side) => {
      const p = new THREE.Mesh(bowPlaneGeo, rubberMat);
      p.rotation.x = side * (Math.PI / 2);
      p.position.set(bowX, bowY, side * bowZ);
      body.add(p);
    });

    // ── deck fittings: forward dome trunk, flush hatches
    const trunk = new THREE.Group();
    const flare = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.2, 0.09, 28), rubberMat);
    flare.position.y = 0.045;
    const column = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.1, 0.34, 28), rubberMat);
    column.position.y = 0.26;
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.088, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2), rubberMat);
    dome.position.y = 0.43;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.018, 8, 28), rubberMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.2;
    trunk.add(flare, column, dome, lip);
    trunk.position.set(4.55, hullTopAtX(4.55) - 0.02, 0);
    body.add(trunk);

    const hatchGeo = new THREE.TorusGeometry(0.1, 0.008, 6, 28);
    for (const x of [3.75, 0.5, -1.4, -2.3]) {
      const h = new THREE.Mesh(hatchGeo, steelMat);
      h.rotation.x = Math.PI / 2;
      h.position.set(x, hullTopAtX(x) + 0.004, 0);
      body.add(h);
    }

    // ── cruciform stern with end-plates
    const sternX = -4.95;
    const rootR = hullRadiusAtX(sternX) - 0.05;
    const upper = planeGeometry(1.0, 1.15, 0.6, 0.38, 0.07);
    const lower = planeGeometry(0.72, 1.0, 0.6, 0.25, 0.07);
    const horiz = planeGeometry(0.9, 1.0, 0.55, 0.3, 0.06);
    const endPlate = new THREE.BoxGeometry(0.5, 0.035, 0.36);
    const addPlane = (geo, angle, withPlate) => {
      const pivot = new THREE.Group();
      pivot.position.x = sternX;
      pivot.rotation.x = angle;
      const m = new THREE.Mesh(geo, rubberMat);
      m.position.y = rootR;
      pivot.add(m);
      if (withPlate) {
        const plate = new THREE.Mesh(endPlate, rubberMat);
        plate.position.set(-0.05, rootR + 0.9, 0);
        pivot.add(plate);
      }
      body.add(pivot);
    };
    addPlane(upper, 0, false);
    addPlane(lower, Math.PI, false);
    addPlane(horiz, Math.PI / 2, true);
    addPlane(horiz, -Math.PI / 2, true);

    // ── pump-jet propulsor
    const pj = new THREE.Group();
    pj.position.x = -5.95;
    body.add(pj);
    const shroudGeo = new THREE.CylinderGeometry(0.5, 0.42, 0.62, 64, 1, true);
    shroudGeo.rotateZ(-Math.PI / 2); // wide intake faces forward (+X)
    pj.add(new THREE.Mesh(shroudGeo, new THREE.MeshPhysicalMaterial({
      color: 0x17191b,
      roughness: 0.6,
      metalness: 0,
      clearcoat: 0.25,
      side: THREE.DoubleSide,
    })));
    const lipRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.028, 10, 72), rubberMat);
    lipRing.rotation.y = Math.PI / 2;
    lipRing.position.x = 0.31;
    pj.add(lipRing);
    for (let k = 0; k < 7; k++) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.26, 0.026), steelMat);
      const a = (k / 7) * Math.PI * 2;
      vane.position.set(0.1, Math.cos(a) * 0.34, Math.sin(a) * 0.34);
      vane.rotation.x = a;
      pj.add(vane);
    }
    this.rotor = new THREE.Group();
    this.rotor.position.x = -0.1;
    pj.add(this.rotor);
    const bladeGeo = new THREE.BoxGeometry(0.1, 0.3, 0.018);
    bladeGeo.translate(0, 0.22, 0);
    for (let k = 0; k < 9; k++) {
      const bl = new THREE.Mesh(bladeGeo, steelMat);
      bl.rotation.x = (k / 9) * Math.PI * 2;
      bl.rotation.y = 0.55;
      this.rotor.add(bl);
    }
    const hubGeo = new THREE.ConeGeometry(0.16, 0.42, 24);
    hubGeo.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, rubberMat);
    hub.position.x = -0.26;
    pj.add(hub);

    // ── chin floodlights + volumetric beams + spotlights
    const lightX = 5.7; // far enough forward on the bow taper for the lenses to stand proud
    const housingGeo = new THREE.CylinderGeometry(0.07, 0.08, 0.18, 18);
    housingGeo.rotateZ(Math.PI / 2);
    const lensGeo = new THREE.CircleGeometry(0.058, 20);
    lensGeo.rotateY(Math.PI / 2);
    const beamLen = 30;
    const beamGeo = new THREE.ConeGeometry(7.5, beamLen, 40, 1, true);
    beamGeo.translate(0, -beamLen / 2, 0);
    beamGeo.rotateZ(Math.PI / 2);

    [1, -1].forEach((side) => {
      const ly = -0.47;
      const lz = side * 0.32;
      const housing = new THREE.Mesh(housingGeo, steelMat);
      housing.position.set(lightX, ly, lz);
      body.add(housing);
      const lens = new THREE.Mesh(lensGeo, this.lensMat);
      lens.position.set(lightX + 0.092, ly, lz);
      body.add(lens);

      const uniforms = {
        uColor: { value: new THREE.Color(1.0, 0.93, 0.82) },
        uOpacity: { value: 0 },
        uTime: { value: 0 },
        uLen: { value: beamLen },
      };
      this.beamUniforms.push(uniforms);
      const beam = new THREE.Mesh(
        beamGeo,
        new THREE.ShaderMaterial({
          uniforms,
          vertexShader: beamVert,
          fragmentShader: beamFrag,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.DoubleSide,
        }),
      );
      beam.position.set(lightX + 0.1, ly, lz);
      beam.rotation.z = -0.24;
      beam.rotation.y = side * -0.05;
      beam.renderOrder = 5;
      body.add(beam);

      const spot = new THREE.SpotLight(0xfff0dc, 0, 70, 0.38, 0.7, 1.4);
      spot.position.set(lightX + 0.12, ly, lz);
      const target = new THREE.Object3D();
      target.position.set(lightX + 20, ly - 5.2, lz * 4);
      body.add(target);
      spot.target = target;
      body.add(spot);
      this.spots.push(spot);
    });

    // soft fill under the hull so it still reads in total darkness
    this.hullLight = new THREE.PointLight(0xffd6a6, 0, 9, 1.6);
    this.hullLight.position.set(1, -2.2, 1.5);
    body.add(this.hullLight);

    // ── navigation strobe on the fin
    this.navTop = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 8), this.navMat);
    this.navTop.position.set(FIN_FRONT - FIN_CHORD * 0.82, finTopY + 0.04, 0);
    body.add(this.navTop);

    // ── hotspot anchors (used to place HTML labels)
    const addHotspot = (key, x, y, z) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.userData.key = key;
      body.add(o);
      this.hotspots.push(o);
    };
    addHotspot('hull', -1.2, -0.42, 0.68);
    addHotspot('sail', FIN_FRONT - 0.45, finTopY - 0.2, 0.17);
    addHotspot('lights', lightX + 0.1, -0.47, 0.33);
    addHotspot('stern', sternX - 0.05, 0, rootR + 0.9);
    addHotspot('pumpjet', -6.2, 0.32, 0.3);
  }

  /** World position just behind the propulsor (for bubble trails). */
  sternWorld(target) {
    return this.rotor.getWorldPosition(target);
  }

  /**
   * Where the hull pierces a flat sea at y = 0, as a capsule in world XZ — drives the foam in
   * the ocean shader. Returns false when the boat is fully submerged.
   */
  waterline(out) {
    const g = this.group;
    const s = g.scale.x;
    const d = -g.position.y / s; // sea level above the hull axis, in hull units
    if (d >= R * 0.98 || d <= -R) return false;
    let xmin = Infinity;
    let xmax = -Infinity;
    for (let i = 0; i <= 124; i++) {
      const x = -LENGTH / 2 + (LENGTH * i) / 124;
      if (hullRadiusAtX(x) > d) {
        xmin = Math.min(xmin, x);
        xmax = Math.max(xmax, x);
      }
    }
    const w = Math.sqrt(R * R - d * d);
    const yaw = g.rotation.y;
    const dx = Math.cos(yaw);
    const dz = -Math.sin(yaw);
    const cx = (xmin + xmax) / 2;
    out.x = g.position.x + dx * cx * s;
    out.z = g.position.z + dz * cx * s;
    out.dirX = dx;
    out.dirZ = dz;
    out.halfLen = Math.max(0, (xmax - xmin) / 2 - w) * s;
    out.radius = w * s;
    out.amount = 1 - smoothstep(R * 0.7, R * 0.98, d);
    return true;
  }

  update(t, dt, { beams = 0, envDim = 1, speed = 1, surfaced = 1 } = {}) {
    // idle motion
    this.body.position.y = Math.sin(t * 0.55) * 0.05;
    this.body.rotation.x = Math.sin(t * 0.37) * 0.018;
    this.body.rotation.z = Math.sin(t * 0.43 + 1.3) * 0.008;

    this.rotor.rotation.x -= dt * (3 + speed * 6);

    // masts slide down into the fin and the crew go below as the boat leaves the surface
    this.surfaced += (surfaced - this.surfaced) * Math.min(1, dt * 2.5);
    this.masts.position.y = -(1 - this.surfaced) * this.mastTravel;
    this.crew.visible = this.surfaced > 0.6;

    const blink = Math.sin(t * 2.6) > 0.55 ? 1 : 0.12;
    this.navMat.color.setRGB(5 * blink, 3.6 * blink, 1.8 * blink);

    for (const u of this.beamUniforms) {
      u.uOpacity.value = beams * 0.16;
      u.uTime.value = t;
    }
    for (const s of this.spots) s.intensity = beams * 900;
    this.hullLight.intensity = beams * 6 * (1 - envDim * 0.6);
  }
}
