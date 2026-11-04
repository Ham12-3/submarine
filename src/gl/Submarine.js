import * as THREE from 'three';

const CORAL = new THREE.Color('#f26e4e');

// Hull proportions (units ≈ metres / 1). The hull is lathed around Y, then laid along X (nose = +X).
const R = 1;
const TAIL = 3.8;
const BODY = 5.6;
const NOSE = 2.4;
const Y_MIN = -(BODY / 2 + TAIL);
const Y_MAX = BODY / 2 + NOSE;
const LENGTH = Y_MAX - Y_MIN;
const CENTER_SHIFT = -(Y_MIN + Y_MAX) / 2;

function tailRadius(y) {
  const t = (y - Y_MIN) / TAIL;
  return Math.max(0.2, R * Math.pow(1 - Math.pow(1 - t, 2.2), 0.75));
}

/** Hull radius at a given X in final (laid-down, centred) coordinates. */
export function hullRadiusAtX(x) {
  const y = x - CENTER_SHIFT;
  if (y < -BODY / 2) return tailRadius(y);
  if (y <= BODY / 2) return R;
  const t = Math.min(1, (y - BODY / 2) / NOSE);
  return R * Math.sqrt(Math.max(0, 1 - t * t));
}

/** Bump texture: anechoic tiles, pressure-hull ring seams and fastener rows. */
function makeHullBump() {
  const W = 1024;
  const H = 2048;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgb(128,128,128)';
  g.fillRect(0, 0, W, H);

  // fine mottling
  const img = g.getImageData(0, 0, W, H);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 128 + (Math.random() - 0.5) * 10;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = n;
  }
  g.putImageData(img, 0, 0);

  // anechoic tiles (brick pattern). u = around (2πR ≈ 6.28), v = along length (≈ 11.8)
  const tile = 0.42;
  const cols = Math.round((Math.PI * 2 * R) / tile);
  const rows = Math.round(LENGTH / tile);
  const tw = W / cols;
  const th = H / rows;
  g.strokeStyle = 'rgba(70,70,70,0.55)';
  g.lineWidth = 2;
  for (let r = 0; r <= rows; r++) {
    const y = r * th;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(W, y);
    g.stroke();
    const off = r % 2 ? tw / 2 : 0;
    for (let k = 0; k <= cols; k++) {
      const x = k * tw + off;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y + th);
      g.stroke();
    }
  }

  // major ring seams along the body
  g.strokeStyle = 'rgba(25,25,25,0.9)';
  g.lineWidth = 6;
  const seamAt = (along) => H - ((along - Y_MIN) / LENGTH) * H;
  for (let y = -BODY / 2; y <= BODY / 2 + 0.01; y += BODY / 4) {
    g.beginPath();
    g.moveTo(0, seamAt(y));
    g.lineTo(W, seamAt(y));
    g.stroke();
  }
  // sonar dome seam
  g.beginPath();
  g.moveTo(0, seamAt(BODY / 2 + NOSE * 0.55));
  g.lineTo(W, seamAt(BODY / 2 + NOSE * 0.55));
  g.stroke();

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeDecal(text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 512, 256);
  g.fillStyle = '#f26e4e';
  g.font = '500 150px "Clash Display", "DM Sans", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 140);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Fin / control-surface: trapezoid in XY (x = chord, y = span), extruded for thickness. */
function finGeometry(span, root, tip, sweep, thickness) {
  const s = new THREE.Shape();
  s.moveTo(-root / 2, 0);
  s.lineTo(root / 2, 0);
  s.lineTo(root / 2 - sweep + tip * 0.1, span);
  s.lineTo(root / 2 - sweep - tip, span);
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.35,
    bevelSize: thickness * 0.35,
    bevelSegments: 2,
  });
  g.translate(0, 0, -thickness / 2);
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
    this._build();
  }

  _build() {
    const body = this.body;

    // ── materials
    this.hullMat = new THREE.MeshPhysicalMaterial({
      color: 0x27313d,
      metalness: 0.45,
      roughness: 0.5,
      clearcoat: 0.45,
      clearcoatRoughness: 0.35,
      bumpMap: makeHullBump(),
      bumpScale: 1.6,
    });
    const darkMat = new THREE.MeshPhysicalMaterial({
      color: 0x222b36,
      metalness: 0.45,
      roughness: 0.48,
      clearcoat: 0.4,
      clearcoatRoughness: 0.35,
    });
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x0b1016, metalness: 0.6, roughness: 0.6 });
    this.coralMat = new THREE.MeshStandardMaterial({
      color: CORAL,
      emissive: CORAL,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.1,
    });
    this.lensMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 4.7, 4.2) });
    this.navMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 2.4, 1.6) });

    // ── hull
    const pts = [new THREE.Vector2(0, Y_MIN)];
    for (let i = 0; i <= 40; i++) {
      const y = Y_MIN + (TAIL * i) / 40;
      pts.push(new THREE.Vector2(tailRadius(y), y));
    }
    for (let i = 1; i <= 24; i++) {
      pts.push(new THREE.Vector2(R, -BODY / 2 + (BODY * i) / 24));
    }
    for (let i = 1; i <= 36; i++) {
      const a = (i / 36) * (Math.PI / 2);
      pts.push(new THREE.Vector2(R * Math.cos(a), BODY / 2 + NOSE * Math.sin(a)));
    }
    const hullGeo = new THREE.LatheGeometry(pts, 112);
    // length-proportional V so the tile texture isn't stretched
    const pos = hullGeo.attributes.position;
    const uv = hullGeo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setY(i, (pos.getY(i) - Y_MIN) / LENGTH);
    hullGeo.translate(0, CENTER_SHIFT, 0);
    hullGeo.rotateZ(-Math.PI / 2);
    hullGeo.computeVertexNormals();
    const hull = new THREE.Mesh(hullGeo, this.hullMat);
    body.add(hull);

    // coral accent band behind the sonar dome
    const bandX = BODY / 2 + CENTER_SHIFT + 0.35;
    const band = new THREE.Mesh(new THREE.TorusGeometry(hullRadiusAtX(bandX) + 0.005, 0.018, 8, 96), this.coralMat);
    band.rotation.y = Math.PI / 2;
    band.position.x = bandX;
    body.add(band);

    // ── sail (conning tower)
    const sail = new THREE.Shape();
    sail.moveTo(-1.4, 0);
    sail.bezierCurveTo(-0.6, 0.3, 0.35, 0.34, 0.9, 0.27);
    sail.quadraticCurveTo(1.25, 0.15, 1.25, 0);
    sail.quadraticCurveTo(1.25, -0.15, 0.9, -0.27);
    sail.bezierCurveTo(0.35, -0.34, -0.6, -0.3, -1.4, 0);
    const sailGeo = new THREE.ExtrudeGeometry(sail, {
      depth: 1.45,
      bevelEnabled: true,
      bevelThickness: 0.06,
      bevelSize: 0.06,
      bevelSegments: 4,
      curveSegments: 32,
    });
    sailGeo.rotateX(-Math.PI / 2);
    const sailMesh = new THREE.Mesh(sailGeo, darkMat);
    sailMesh.position.set(1.55, 0.85, 0);
    body.add(sailMesh);

    // coral cap line on the sail
    const capPts = sail.getSpacedPoints(80).map((p) => new THREE.Vector3(p.x, 0, -p.y));
    const capGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(capPts, true), 160, 0.014, 6, true);
    const cap = new THREE.Mesh(capGeo, this.coralMat);
    cap.position.set(1.55, 0.85 + 1.45, 0);
    cap.scale.set(1.03, 1, 1.18);
    body.add(cap);

    // masts
    const mastGeo = new THREE.CylinderGeometry(0.035, 0.045, 0.9, 10);
    [
      [2.15, 0.7],
      [1.75, 0.5],
      [1.35, 0.38],
    ].forEach(([x, h]) => {
      const m = new THREE.Mesh(mastGeo, blackMat);
      m.scale.y = h / 0.9;
      m.position.set(x, 0.85 + 1.5 + h / 2, 0);
      body.add(m);
    });

    // hull number decals
    const decalTex = makeDecal('A-11');
    const decalMat = new THREE.MeshBasicMaterial({ map: decalTex, transparent: true, depthWrite: false, toneMapped: false });
    [1, -1].forEach((side) => {
      const d = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.31), decalMat);
      d.position.set(1.55, 1.8, side * 0.415);
      if (side < 0) d.rotation.y = Math.PI;
      body.add(d);
    });

    // sail planes
    const sailPlaneGeo = finGeometry(0.8, 0.62, 0.38, 0.12, 0.06);
    [1, -1].forEach((side) => {
      const f = new THREE.Mesh(sailPlaneGeo, darkMat);
      f.rotation.x = side * (Math.PI / 2);
      f.position.set(2.0, 1.9, side * 0.24);
      body.add(f);
    });

    // ── X-form stern planes
    const sternX = -4.55;
    const rootR = hullRadiusAtX(sternX) - 0.06;
    const sternGeo = finGeometry(1.25, 1.25, 0.62, 0.42, 0.08);
    for (let k = 0; k < 4; k++) {
      const pivot = new THREE.Group();
      pivot.position.x = sternX;
      pivot.rotation.x = Math.PI / 4 + (k * Math.PI) / 2;
      const f = new THREE.Mesh(sternGeo, darkMat);
      f.position.y = rootR;
      pivot.add(f);
      body.add(pivot);
      // coral tip on the upper fins
      if (k === 0 || k === 3) {
        // tip chord runs from (root/2 - sweep - tip) to (root/2 - sweep + tip*0.1)
        const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.03, 0.11), this.coralMat);
        tip.position.set(-0.074, rootR + 1.25 + 0.01, 0);
        pivot.add(tip);
      }
    }

    // ── pump-jet propulsor
    const pj = new THREE.Group();
    pj.position.x = -5.75;
    body.add(pj);

    const shroudGeo = new THREE.CylinderGeometry(0.6, 0.52, 0.72, 64, 1, true);
    shroudGeo.rotateZ(-Math.PI / 2); // wide intake faces forward (+X)
    const shroud = new THREE.Mesh(shroudGeo, new THREE.MeshPhysicalMaterial({
      color: 0x1d2530,
      metalness: 0.5,
      roughness: 0.45,
      side: THREE.DoubleSide,
    }));
    pj.add(shroud);

    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.03, 10, 72), this.coralMat);
    lip.rotation.y = Math.PI / 2;
    lip.position.x = 0.36;
    pj.add(lip);

    // stator vanes
    for (let k = 0; k < 6; k++) {
      const vane = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.34, 0.03), blackMat);
      const a = (k / 6) * Math.PI * 2;
      vane.position.set(0.12, Math.cos(a) * 0.42, Math.sin(a) * 0.42);
      vane.rotation.x = a;
      pj.add(vane);
    }

    // rotor
    this.rotor = new THREE.Group();
    this.rotor.position.x = -0.12;
    pj.add(this.rotor);
    const bladeGeo = new THREE.BoxGeometry(0.12, 0.36, 0.02);
    bladeGeo.translate(0, 0.27, 0);
    for (let k = 0; k < 7; k++) {
      const b = new THREE.Mesh(bladeGeo, blackMat);
      b.rotation.x = (k / 7) * Math.PI * 2;
      b.rotation.y = 0.5;
      this.rotor.add(b);
    }
    const hubGeo = new THREE.ConeGeometry(0.2, 0.5, 24);
    hubGeo.rotateZ(Math.PI / 2);
    const hub = new THREE.Mesh(hubGeo, darkMat);
    hub.position.x = -0.3;
    pj.add(hub);

    // ── floodlights + volumetric beams + spotlights
    const lightX = 4.35;
    const housingGeo = new THREE.CylinderGeometry(0.13, 0.15, 0.32, 20);
    housingGeo.rotateZ(Math.PI / 2);
    const lensGeo = new THREE.CircleGeometry(0.11, 24);
    lensGeo.rotateY(Math.PI / 2);

    const beamLen = 30;
    const beamGeo = new THREE.ConeGeometry(7.5, beamLen, 40, 1, true);
    beamGeo.translate(0, -beamLen / 2, 0);
    beamGeo.rotateZ(Math.PI / 2);

    [1, -1].forEach((side) => {
      const lx = lightX;
      const ly = -0.7;
      const lz = side * 0.5;
      const housing = new THREE.Mesh(housingGeo, blackMat);
      housing.position.set(lx, ly, lz);
      body.add(housing);
      const lens = new THREE.Mesh(lensGeo, this.lensMat);
      lens.position.set(lx + 0.165, ly, lz);
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
      beam.position.set(lx + 0.17, ly, lz);
      beam.rotation.z = -0.24;
      beam.rotation.y = side * -0.05;
      beam.renderOrder = 5;
      body.add(beam);

      const spot = new THREE.SpotLight(0xfff0dc, 0, 70, 0.38, 0.7, 1.4);
      spot.position.set(lx + 0.2, ly, lz);
      const target = new THREE.Object3D();
      target.position.set(lx + 20, ly - 5.2, lz * 4);
      body.add(target);
      spot.target = target;
      body.add(spot);
      this.spots.push(spot);
    });

    // under-hull glow light so the hull reads in total darkness
    this.hullLight = new THREE.PointLight(0xffb09d, 0, 9, 1.6);
    this.hullLight.position.set(1, -2.2, 1.5);
    body.add(this.hullLight);

    // ── navigation lights
    const navGeo = new THREE.SphereGeometry(0.06, 12, 8);
    this.navTop = new THREE.Mesh(navGeo, this.navMat);
    this.navTop.position.set(2.15, 0.85 + 1.5 + 0.72, 0);
    body.add(this.navTop);
    this.navTail = new THREE.Mesh(navGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.6, 1.5) }));
    this.navTail.scale.setScalar(0.6);
    this.navTail.position.set(-3.6, hullRadiusAtX(-3.6) + 0.03, 0);
    body.add(this.navTail);

    // ── hotspot anchors (used to place HTML labels)
    const addHotspot = (key, x, y, z) => {
      const o = new THREE.Object3D();
      o.position.set(x, y, z);
      o.userData.key = key;
      body.add(o);
      this.hotspots.push(o);
    };
    addHotspot('hull', -1.2, -0.55, 0.84);
    addHotspot('sail', 1.75, 2.25, 0.3);
    addHotspot('lights', lightX + 0.2, -0.72, 0.5);
    addHotspot('stern', -4.9, -0.95, 0.75);
    addHotspot('pumpjet', -6.1, 0.35, 0.45);
  }

  /** World position just behind the propulsor (for bubble trails). */
  sternWorld(target) {
    return this.rotor.getWorldPosition(target);
  }

  update(t, dt, { beams = 0, envDim = 1, speed = 1 } = {}) {
    // idle motion
    this.body.position.y = Math.sin(t * 0.55) * 0.07;
    this.body.rotation.x = Math.sin(t * 0.37) * 0.022;
    this.body.rotation.z = Math.sin(t * 0.43 + 1.3) * 0.012;

    this.rotor.rotation.x -= dt * (3 + speed * 6);

    // nav light blink
    const blink = Math.sin(t * 2.6) > 0.55 ? 1 : 0.12;
    this.navMat.color.setRGB(6 * blink, 2.4 * blink, 1.6 * blink);

    for (const u of this.beamUniforms) {
      u.uOpacity.value = beams * 0.16;
      u.uTime.value = t;
    }
    for (const s of this.spots) s.intensity = beams * 900;
    this.hullLight.intensity = beams * 6 * (1 - envDim * 0.6);
    this.coralMat.emissiveIntensity = 0.45 + beams * 0.6;
  }
}
