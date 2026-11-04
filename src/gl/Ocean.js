import * as THREE from 'three';

const skyChunk = /* glsl */ `
  uniform vec3 uSkyTop;
  uniform vec3 uSkyMid;
  uniform vec3 uSkyHorizon;
  uniform vec3 uSunDir;
  uniform vec3 uSunColor;

  vec3 skyColor(vec3 d) {
    float h = d.y;
    vec3 col = mix(uSkyHorizon, uSkyMid, smoothstep(0.0, 0.16, h));
    col = mix(col, uSkyTop, smoothstep(0.12, 0.65, h));
    float s = max(dot(d, uSunDir), 0.0);
    col += uSunColor * (pow(s, 1400.0) * 2.2 + pow(s, 60.0) * 0.16 + pow(s, 6.0) * 0.07 * (1.0 - smoothstep(0.0, 0.4, h)));
    return col;
  }
`;

const waveChunk = /* glsl */ `
  uniform float uTime;
  // xy = direction, z = wavelength, w = amplitude
  const vec4 W[4] = vec4[4](
    vec4( 1.0,  0.3, 26.0, 0.34),
    vec4(-0.4,  1.0, 15.0, 0.18),
    vec4( 0.7, -0.6,  8.5, 0.09),
    vec4(-0.9, -0.2,  5.0, 0.045)
  );
  const vec4 D[3] = vec4[3](
    vec4( 0.2,  1.0, 2.2, 0.022),
    vec4( 1.0, -0.5, 1.3, 0.012),
    vec4(-0.7, -1.0, 0.8, 0.007)
  );

  float waveSum(vec2 p, float atten, inout vec2 grad) {
    float h = 0.0;
    for (int i = 0; i < 4; i++) {
      vec2 d = normalize(W[i].xy);
      float k = 6.2831853 / W[i].z;
      float w = sqrt(9.8 * k) * 0.75;
      float ph = dot(d, p) * k - w * uTime;
      float a = W[i].w * atten;
      h += a * sin(ph);
      grad += a * k * cos(ph) * d;
    }
    return h;
  }

  void detail(vec2 p, inout vec2 grad) {
    for (int i = 0; i < 3; i++) {
      vec2 d = normalize(D[i].xy);
      float k = 6.2831853 / D[i].z;
      float w = sqrt(9.8 * k) * 0.75;
      float ph = dot(d, p) * k - w * uTime;
      grad += D[i].w * k * cos(ph) * d;
    }
  }
`;

const surfaceVert = /* glsl */ `
  ${waveChunk}
  varying vec3 vWorld;
  varying float vH;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    float dist = length(wp.xz - cameraPosition.xz);
    float atten = 1.0 - smoothstep(120.0, 600.0, dist);
    vec2 g = vec2(0.0);
    float h = waveSum(wp.xz, atten, g);
    wp.y += h;
    vH = h;
    vWorld = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const surfaceFrag = /* glsl */ `
  ${waveChunk}
  ${skyChunk}
  uniform vec3 uDeep;
  uniform vec3 uScatter;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  uniform vec3 uWindow;
  uniform vec3 uTIR;
  varying vec3 vWorld;
  varying float vH;

  void main() {
    float dist = length(cameraPosition - vWorld);
    float atten = 1.0 - smoothstep(120.0, 600.0, length(vWorld.xz - cameraPosition.xz));
    vec2 g = vec2(0.0);
    waveSum(vWorld.xz, atten, g);
    detail(vWorld.xz, g);
    g *= mix(0.25, 1.0, atten);
    vec3 n = normalize(vec3(-g.x, 1.0, -g.y));
    vec3 col;

    if (gl_FrontFacing) {
      // ── seen from above
      vec3 V = normalize(cameraPosition - vWorld);
      float NdV = max(dot(n, V), 0.0);
      float F = 0.02 + 0.98 * pow(1.0 - NdV, 5.0);
      vec3 R = reflect(-V, n);
      R.y = abs(R.y);
      vec3 refl = skyColor(R);
      float crest = clamp(vH * 1.4 + 0.45, 0.0, 1.0);
      vec3 body = mix(uDeep, uScatter, crest * 0.55);
      col = mix(body, refl, F);
      float glint = pow(max(dot(R, uSunDir), 0.0), 900.0);
      col += uSunColor * glint * 2.4;
    } else {
      // ── seen from below: Snell's window + total internal reflection
      vec3 I = normalize(vWorld - cameraPosition);
      vec3 N = -n;
      float eta = 1.333;
      float cosi = dot(N, I);
      float k = 1.0 - eta * eta * (1.0 - cosi * cosi);
      float win = smoothstep(0.0, 0.3, k);
      vec3 T = refract(I, N, eta);
      vec3 through = mix(uWindow, skyColor(normalize(T + vec3(0.0, 0.001, 0.0))) * 1.6 + uWindow * 0.4, 0.45);
      float sunT = pow(max(dot(normalize(T), uSunDir), 0.0), 80.0);
      through += uSunColor * sunT * 2.5;
      col = mix(uTIR * (0.85 + vH * 0.6), through, win);
    }

    float fog = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
    col = mix(col, uFogColor, fog);
    gl_FragColor = vec4(col, 1.0);
  }
`;

const skyVert = /* glsl */ `
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww;
  }
`;

const skyFrag = /* glsl */ `
  ${skyChunk}
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    vec3 col = skyColor(vec3(d.x, max(d.y, 0.0), d.z));
    col = mix(col, uSkyHorizon * 0.6, smoothstep(0.0, -0.08, d.y));
    gl_FragColor = vec4(col, 1.0);
  }
`;

const rayVert = /* glsl */ `
  uniform float uHeight;
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    vY = position.y / uHeight + 0.5;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vN = normalize(mat3(modelMatrix) * normal);
    vV = normalize(cameraPosition - wp.xyz);
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const rayFrag = /* glsl */ `
  uniform float uOpacity;
  uniform float uTime;
  uniform float uPhase;
  uniform vec3 uColor;
  varying float vY;
  varying vec3 vN;
  varying vec3 vV;
  void main() {
    float facing = abs(dot(normalize(vN), normalize(vV)));
    float soft = pow(facing, 3.0);
    float fade = pow(clamp(vY, 0.0, 1.0), 1.6) * smoothstep(1.0, 0.97, vY);
    float flicker = 0.55 + 0.45 * sin(uTime * 0.6 + uPhase) * sin(uTime * 0.23 + uPhase * 2.0);
    float a = soft * fade * flicker * uOpacity;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

// Same swell as the `W` table in the shader, so JS can tell which side of the surface the camera is on.
const SWELL = [
  [1.0, 0.3, 26.0, 0.34],
  [-0.4, 1.0, 15.0, 0.18],
  [0.7, -0.6, 8.5, 0.09],
  [-0.9, -0.2, 5.0, 0.045],
].map(([dx, dz, L, a]) => {
  const len = Math.hypot(dx, dz);
  const k = (Math.PI * 2) / L;
  return { dx: dx / len, dz: dz / len, k, w: Math.sqrt(9.8 * k) * 0.75, a };
});

export function waveHeight(x, z, t) {
  let h = 0;
  for (const s of SWELL) h += s.a * Math.sin((s.dx * x + s.dz * z) * s.k - s.w * t);
  return h;
}

/** Polar grid: dense near the centre, sparse toward the horizon. */
function polarPlane(radius, rings, segments) {
  const k = 6.0;
  const positions = [0, 0, 0];
  for (let i = 1; i <= rings; i++) {
    const r = (radius * (Math.exp((k * i) / rings) - 1)) / (Math.exp(k) - 1);
    for (let j = 0; j < segments; j++) {
      const a = (j / segments) * Math.PI * 2;
      positions.push(Math.cos(a) * r, 0, Math.sin(a) * r);
    }
  }
  const index = [];
  for (let j = 0; j < segments; j++) {
    index.push(0, 1 + ((j + 1) % segments), 1 + j);
  }
  for (let i = 0; i < rings - 1; i++) {
    const a0 = 1 + i * segments;
    const b0 = 1 + (i + 1) * segments;
    for (let j = 0; j < segments; j++) {
      const j1 = (j + 1) % segments;
      index.push(a0 + j, a0 + j1, b0 + j);
      index.push(a0 + j1, b0 + j1, b0 + j);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  g.setIndex(index);
  g.computeBoundingSphere();
  return g;
}

export class Ocean {
  constructor() {
    this.group = new THREE.Group();

    const sunDir = new THREE.Vector3(0.05, 0.055, -1).normalize();
    this.skyUniforms = {
      uSkyTop: { value: new THREE.Color('#020a16') },
      uSkyMid: { value: new THREE.Color('#081d33') },
      uSkyHorizon: { value: new THREE.Color('#5e3436') },
      uSunDir: { value: sunDir },
      uSunColor: { value: new THREE.Color(1.0, 0.42, 0.28) },
    };

    // ── sky dome (follows the camera)
    this.sky = new THREE.Mesh(
      new THREE.SphereGeometry(900, 48, 24),
      new THREE.ShaderMaterial({
        uniforms: this.skyUniforms,
        vertexShader: skyVert,
        fragmentShader: skyFrag,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    );
    this.sky.renderOrder = -10;
    this.sky.frustumCulled = false;
    this.group.add(this.sky);

    // ── water surface
    this.surfaceUniforms = {
      ...this.skyUniforms,
      uTime: { value: 0 },
      uDeep: { value: new THREE.Color('#031726') },
      uScatter: { value: new THREE.Color('#0d4258') },
      uFogColor: { value: new THREE.Color() },
      uFogDensity: { value: 0.003 },
      uWindow: { value: new THREE.Color('#2f7d96') },
      uTIR: { value: new THREE.Color('#0a3a52') },
    };
    this.surface = new THREE.Mesh(
      polarPlane(1400, 170, 160),
      new THREE.ShaderMaterial({
        uniforms: this.surfaceUniforms,
        vertexShader: surfaceVert,
        fragmentShader: surfaceFrag,
        side: THREE.DoubleSide,
      }),
    );
    this.surface.frustumCulled = false;
    this.group.add(this.surface);

    // ── god rays (only near the surface)
    this.rays = new THREE.Group();
    this.rayMats = [];
    const H = 150;
    const rayGeo = new THREE.CylinderGeometry(1.1, 4.8, H, 24, 1, true);
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 16; i++) {
      const mat = new THREE.ShaderMaterial({
        uniforms: {
          uOpacity: { value: 0 },
          uTime: { value: 0 },
          uPhase: { value: rnd() * 10 },
          uHeight: { value: H },
          uColor: { value: new THREE.Color(0.45, 0.8, 1.0) },
        },
        vertexShader: rayVert,
        fragmentShader: rayFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
      });
      this.rayMats.push(mat);
      const m = new THREE.Mesh(rayGeo, mat);
      m.position.set((rnd() - 0.5) * 80, -H / 2 + 0.5, -rnd() * 70 + 6);
      m.rotation.z = (rnd() - 0.5) * 0.25 + 0.08;
      m.rotation.x = 0.18 + rnd() * 0.12;
      m.scale.setScalar(0.6 + rnd() * 0.9);
      m.renderOrder = 4;
      this.rays.add(m);
    }
    this.group.add(this.rays);
  }

  update(t, camera, { fogColor, fogDensity, underwater, rayStrength }) {
    this.surfaceUniforms.uTime.value = t;
    this.surfaceUniforms.uFogColor.value.copy(fogColor);
    this.surfaceUniforms.uFogDensity.value = fogDensity;

    this.sky.position.copy(camera.position);
    this.sky.visible = !underwater;

    // surface is pointless far below — skip it
    this.surface.visible = camera.position.y > -260;

    this.rays.visible = rayStrength > 0.001;
    for (const m of this.rayMats) {
      m.uniforms.uTime.value = t;
      m.uniforms.uOpacity.value = rayStrength * 0.16;
    }
  }
}
