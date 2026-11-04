import * as THREE from 'three';

// Small deterministic value-noise + fBm for the terrain
function hash(x, y) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return s - Math.floor(s);
}
function noise(x, y) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, oct = 5) {
  let s = 0;
  let a = 0.5;
  let f = 1;
  for (let i = 0; i < oct; i++) {
    s += a * noise(x * f, y * f);
    f *= 2.03;
    a *= 0.5;
  }
  return s;
}

export function seabedHeight(x, z) {
  let h = (fbm(x * 0.018, z * 0.018) - 0.5) * 16;
  h += (fbm(x * 0.07 + 13, z * 0.07 - 7, 4) - 0.5) * 4;
  // ridged outcrops
  const r = 1 - Math.abs(fbm(x * 0.03 - 40, z * 0.03 + 9, 4) * 2 - 1);
  h += Math.pow(r, 4) * 6;
  // a trench running across the scene
  const zc = -38 + Math.sin(x * 0.021) * 12;
  h -= 22 * Math.exp(-Math.pow((z - zc) / 15, 2));
  return h;
}

export class Seabed {
  constructor(baseY = -412) {
    this.baseY = baseY;
    const size = 420;
    const seg = 240;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      p.setY(i, seabedHeight(p.getX(i), p.getZ(i)));
    }
    geo.computeVertexNormals();

    this.uniforms = {
      uTime: { value: 0 },
      uPingOrigin: { value: new THREE.Vector3() },
      uPingRadius: { value: 0 },
      uContour: { value: 0 },
      uContourColor: { value: new THREE.Color('#f26e4e') },
    };

    const mat = new THREE.MeshStandardMaterial({
      color: 0x2a3540,
      roughness: 0.95,
      metalness: 0.0,
    });
    mat.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, this.uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vSeaWorld;')
        .replace(
          '#include <begin_vertex>',
          '#include <begin_vertex>\nvSeaWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        );
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <common>',
          `#include <common>
          varying vec3 vSeaWorld;
          uniform float uTime;
          uniform vec3 uPingOrigin;
          uniform float uPingRadius;
          uniform float uContour;
          uniform vec3 uContourColor;`,
        )
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          {
            float hgt = vSeaWorld.y * 1.4;
            float f = fract(hgt);
            float d = min(f, 1.0 - f) / max(fwidth(hgt), 1e-4);
            float line = 1.0 - clamp(d - 0.6, 0.0, 1.0);
            float major = 1.0 - clamp(min(fract(hgt / 5.0), 1.0 - fract(hgt / 5.0)) / max(fwidth(hgt / 5.0), 1e-4) - 0.9, 0.0, 1.0);
            float dist = length(vSeaWorld.xz - uPingOrigin.xz);
            float ring = exp(-pow((dist - uPingRadius) / 3.5, 2.0));
            float trail = smoothstep(uPingRadius, uPingRadius - 30.0, dist) * step(dist, uPingRadius) * 0.35;
            float near = exp(-dist * 0.025);
            float glow = (near * 0.12 + ring * 1.1 + trail * 0.45) * uContour;
            totalEmissiveRadiance += uContourColor * (line * 0.35 + major * 0.55) * glow;
            totalEmissiveRadiance += uContourColor * ring * 0.05 * uContour;
          }`,
        );
    };

    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.position.y = baseY;

    // scattered rocks for scale
    const rockGeo = new THREE.IcosahedronGeometry(1, 1);
    const rp = rockGeo.attributes.position;
    for (let i = 0; i < rp.count; i++) {
      const s = 0.75 + hash(rp.getX(i) * 9.1, rp.getY(i) * 7.3 + rp.getZ(i)) * 0.5;
      rp.setXYZ(i, rp.getX(i) * s, rp.getY(i) * s * 0.7, rp.getZ(i) * s);
    }
    rockGeo.computeVertexNormals();
    const rocks = new THREE.InstancedMesh(rockGeo, mat, 90);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    for (let i = 0; i < 90; i++) {
      const x = (hash(i, 1.3) - 0.5) * 160;
      const z = (hash(i, 7.7) - 0.5) * 140 - 10;
      const s = 0.3 + Math.pow(hash(i, 3.1), 3) * 3.2;
      e.set(hash(i, 2) * 3, hash(i, 5) * 3, hash(i, 9) * 3);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, seabedHeight(x, z) + s * 0.25, z), q, new THREE.Vector3(s, s, s));
      rocks.setMatrixAt(i, m);
    }
    this.mesh.add(rocks);
  }

  update(t, origin, strength) {
    this.uniforms.uTime.value = t;
    this.uniforms.uPingOrigin.value.copy(origin);
    this.uniforms.uPingRadius.value = (t * 16) % 110;
    this.uniforms.uContour.value = strength;
  }
}
