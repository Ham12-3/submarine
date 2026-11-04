import * as THREE from 'three';

const DEG = Math.PI / 180;

export function latLonToVec(lat, lon, r = 1, target = new THREE.Vector3()) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return target.set(Math.cos(la) * Math.cos(lo) * r, Math.sin(la) * r, -Math.cos(la) * Math.sin(lo) * r);
}

// Rough continent silhouettes as [lat, lon, radius°] blobs — enough to read as Earth in dots.
const LAND = [
  // North America
  [62, -112, 20], [50, -100, 15], [41, -96, 13], [35, -84, 9], [31, -100, 9], [22, -102, 7], [16, -91, 5],
  [65, -152, 9], [70, -80, 10], [55, -73, 9], [46, -66, 5], [9, -81, 3], [48, -122, 6], [38, -120, 6],
  // Greenland
  [73, -40, 10], [66, -45, 5],
  // South America
  [-5, -62, 14], [-14, -52, 13], [-27, -61, 9], [-38, -66, 6], [-48, -70, 4], [4, -70, 8], [-8, -76, 5],
  // Europe
  [50, 10, 9], [45, 2, 6], [55, 27, 10], [62, 15, 7], [40, -4, 5], [42, 13, 3], [38, 23, 3], [54, -2, 3], [65, 27, 6],
  // Africa
  [16, 0, 14], [15, 20, 14], [4, 20, 12], [-6, 25, 11], [-18, 26, 9], [-28, 24, 7], [26, 16, 11], [28, 0, 9], [9, 40, 7], [6, -6, 6], [-20, 47, 3],
  // Asia
  [57, 62, 15], [62, 92, 19], [63, 122, 15], [66, 152, 10], [46, 82, 14], [40, 105, 14], [30, 82, 9], [22, 78, 8],
  [25, 45, 10], [16, 47, 5], [33, 115, 9], [15, 102, 6], [28, 120, 4], [36, 138, 4], [44, 142, 2], [10, 106, 4],
  // Maritime SE Asia
  [0, 112, 5], [-3, 121, 4], [-5, 140, 5], [12, 122, 3], [-7, 107, 3],
  // Australia / NZ
  [-25, 134, 13], [-19, 124, 6], [-32, 147, 5], [-17, 143, 4], [-42, 173, 3], [-38, 176, 2],
];

let landVecs = null;

function isLand(v) {
  const lat = Math.asin(v.y) / DEG;
  if (lat < -70) return true;
  landVecs ??= LAND.map(([la, lo, r]) => ({ c: latLonToVec(la, lo, 1), r }));
  const n = Math.sin(v.x * 13.1 + Math.sin(v.y * 9.7)) * Math.sin(v.z * 11.3 + v.y * 5.1);
  for (const { c, r } of landVecs) {
    const d = c.dot(v);
    if (d < 0.6) continue; // > ~53° away, can't be inside any blob
    if (Math.acos(Math.min(1, d)) / DEG < r + n * 2.4) return true;
  }
  return false;
}

const pointVert = /* glsl */ `
  uniform float uTime;
  uniform float uOpacity;
  uniform float uPixelRatio;
  uniform float uSize;
  attribute float aLand;
  attribute float aRand;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 nView = normalize(normalMatrix * normalize(position));
    float facing = dot(nView, normalize(-mv.xyz));
    float tw = 0.7 + 0.3 * sin(uTime * 1.3 + aRand * 40.0);
    vAlpha = smoothstep(-0.05, 0.45, facing) * mix(0.2, 0.95, aLand) * tw * uOpacity;
    vColor = mix(vec3(0.42, 0.56, 0.7), vec3(1.0, 0.97, 0.94), aLand);
    gl_PointSize = uSize * mix(0.75, 1.15, aLand) * uPixelRatio / -mv.z;
    gl_Position = projectionMatrix * mv;
  }
`;

const pointFrag = /* glsl */ `
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.15, d) * vAlpha;
    if (a < 0.004) discard;
    gl_FragColor = vec4(vColor * a, a);
  }
`;

const arcVert = /* glsl */ `
  attribute float aT;
  varying float vT;
  void main() {
    vT = aT;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const arcFrag = /* glsl */ `
  uniform float uHead;
  uniform float uOpacity;
  uniform vec3 uColor;
  varying float vT;
  void main() {
    float tail = smoothstep(uHead - 0.35, uHead, vT) * step(vT, uHead);
    float a = (0.16 + tail * 1.4) * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

const haloVert = /* glsl */ `
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const haloFrag = /* glsl */ `
  uniform float uOpacity;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
    vec3 col = mix(vec3(0.25, 0.45, 0.65), vec3(0.95, 0.43, 0.3), rim * 0.6);
    float a = rim * 0.35 * uOpacity;
    gl_FragColor = vec4(col * a, a);
  }
`;

export const SITES = [
  { name: 'Challenger Deep', lat: 11.35, lon: 142.2 },
  { name: 'Puerto Rico Trench', lat: 19.8, lon: -66.0 },
  { name: 'South Sandwich Trench', lat: -60.5, lon: -25.5 },
  { name: 'Java Trench', lat: -11.1, lon: 114.9 },
  { name: 'Molloy Hole', lat: 79.1, lon: 2.8 },
];
const HOME = { lat: 50.15, lon: -5.07 }; // Falmouth

export class Globe {
  constructor() {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
    this.camera.position.set(0, 0, 4.6);
    this.opacity = 0;

    this.pivot = new THREE.Group();
    this.pivot.rotation.z = 23.4 * DEG * 0.6;
    this.pivot.rotation.x = 0.28;
    this.scene.add(this.pivot);
    this.spin = new THREE.Group();
    this.pivot.add(this.spin);

    // dots
    const N = 26000;
    const pos = new Float32Array(N * 3);
    const land = new Float32Array(N);
    const rand = new Float32Array(N);
    const v = new THREE.Vector3();
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (2 * (i + 0.5)) / N;
      const r = Math.sqrt(1 - y * y);
      const phi = i * golden;
      v.set(Math.cos(phi) * r, y, Math.sin(phi) * r);
      pos.set([v.x, v.y, v.z], i * 3);
      land[i] = isLand(v) ? 1 : 0;
      rand[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aLand', new THREE.BufferAttribute(land, 1));
    g.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    this.pointUniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uPixelRatio: { value: 1 },
      uSize: { value: 11 },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.pointUniforms,
        vertexShader: pointVert,
        fragmentShader: pointFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.spin.add(this.points);

    // atmosphere halo
    this.haloUniforms = { uOpacity: { value: 0 } };
    const halo = new THREE.Mesh(
      new THREE.SphereGeometry(1.07, 64, 32),
      new THREE.ShaderMaterial({
        uniforms: this.haloUniforms,
        vertexShader: haloVert,
        fragmentShader: haloFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    );
    this.pivot.add(halo);

    // dive-site markers + arcs from home port
    this.markers = [];
    this.arcs = [];
    const coral = new THREE.Color('#f26e4e');
    const home = latLonToVec(HOME.lat, HOME.lon, 1.0);
    const dotGeo = new THREE.SphereGeometry(0.014, 12, 8);
    const ringGeo = new THREE.RingGeometry(0.03, 0.036, 48);
    this.markerMat = new THREE.MeshBasicMaterial({
      color: coral.clone().multiplyScalar(2),
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const homeDot = new THREE.Mesh(dotGeo, this.markerMat);
    homeDot.position.copy(home).multiplyScalar(1.005);
    this.spin.add(homeDot);

    SITES.forEach((s, idx) => {
      const p = latLonToVec(s.lat, s.lon, 1.0);
      const dot = new THREE.Mesh(dotGeo, this.markerMat);
      dot.position.copy(p).multiplyScalar(1.005);
      this.spin.add(dot);

      const ringMat = new THREE.MeshBasicMaterial({
        color: coral.clone().multiplyScalar(2),
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(p).multiplyScalar(1.006);
      ring.lookAt(p.clone().multiplyScalar(2));
      ring.userData.phase = idx * 0.37;
      this.spin.add(ring);
      this.markers.push(ring);

      // arc
      const mid = home.clone().add(p).multiplyScalar(0.5);
      const lift = 1 + home.distanceTo(p) * 0.28;
      mid.normalize().multiplyScalar(lift);
      const curve = new THREE.QuadraticBezierCurve3(home.clone().multiplyScalar(1.005), mid, p.clone().multiplyScalar(1.005));
      const cpts = curve.getPoints(90);
      const ag = new THREE.BufferGeometry().setFromPoints(cpts);
      ag.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(cpts.map((_, i) => i / (cpts.length - 1))), 1));
      const au = {
        uHead: { value: 0 },
        uOpacity: { value: 0 },
        uColor: { value: coral.clone().multiplyScalar(1.6) },
      };
      const arc = new THREE.Line(
        ag,
        new THREE.ShaderMaterial({
          uniforms: au,
          vertexShader: arcVert,
          fragmentShader: arcFrag,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      arc.userData = { u: au, offset: idx * 0.21 };
      this.spin.add(arc);
      this.arcs.push(arc);
    });

    // face the Pacific / Atlantic nicely on entry
    this.baseRotation = -1.2;
  }

  resize(w, h) {
    this.camera.aspect = w / h;
    const narrow = w / h < 0.9;
    this.camera.position.z = narrow ? 8.2 : 5.9;
    this.camera.updateProjectionMatrix();
  }

  update(t, opacity, scrollSpin, pixelRatio) {
    this.opacity = opacity;
    this.pointUniforms.uTime.value = t;
    this.pointUniforms.uOpacity.value = opacity;
    this.pointUniforms.uPixelRatio.value = pixelRatio;
    this.haloUniforms.uOpacity.value = opacity;
    this.markerMat.opacity = opacity;

    this.spin.rotation.y = this.baseRotation + t * 0.05 + scrollSpin;
    const s = 0.82 + opacity * 0.18;
    this.pivot.scale.setScalar(s);

    for (const r of this.markers) {
      const k = (t * 0.6 + r.userData.phase) % 1;
      r.scale.setScalar(0.6 + k * 2.2);
      r.material.opacity = (1 - k) * opacity;
    }
    for (const a of this.arcs) {
      a.userData.u.uHead.value = ((t * 0.22 + a.userData.offset) % 1.4);
      a.userData.u.uOpacity.value = opacity;
    }
  }
}
