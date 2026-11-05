import * as THREE from 'three';

const snowVert = /* glsl */ `
  uniform vec3 uCam;
  uniform float uTime;
  uniform float uBox;
  uniform float uSize;
  uniform float uPixelRatio;
  uniform float uOpacity;
  attribute float aSeed;
  varying float vAlpha;
  void main() {
    vec3 p = position;
    p.y -= uTime * (0.12 + aSeed * 0.25);
    p.x += sin(uTime * 0.21 + aSeed * 40.0) * 0.6;
    p.z += cos(uTime * 0.17 + aSeed * 23.0) * 0.6;
    vec3 rel = mod(p - uCam + uBox * 0.5, uBox) - uBox * 0.5;
    vec3 world = uCam + rel;
    vec4 mv = viewMatrix * vec4(world, 1.0);
    gl_Position = projectionMatrix * mv;
    float d = length(rel);
    vAlpha = (1.0 - smoothstep(uBox * 0.25, uBox * 0.5, d)) * smoothstep(0.5, 2.5, -mv.z) * uOpacity * (0.35 + aSeed * 0.65);
    gl_PointSize = uSize * (0.4 + aSeed) * uPixelRatio / max(-mv.z, 0.5);
  }
`;

const snowFrag = /* glsl */ `
  uniform vec3 uColor;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    float a = smoothstep(0.5, 0.0, d) * vAlpha;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, a);
  }
`;

/** "Marine snow" that wraps around the camera so the water always feels full. */
export class MarineSnow {
  constructor(count = 2600, box = 60) {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * box;
      pos[i * 3 + 1] = (Math.random() - 0.5) * box;
      pos[i * 3 + 2] = (Math.random() - 0.5) * box;
      seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    this.uniforms = {
      uCam: { value: new THREE.Vector3() },
      uTime: { value: 0 },
      uBox: { value: box },
      uSize: { value: 95 },
      uPixelRatio: { value: 1 },
      uOpacity: { value: 0 },
      uColor: { value: new THREE.Color(0.82, 0.88, 0.84) },
    };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: snowVert,
        fragmentShader: snowFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 6;
  }

  update(t, camera, opacity, pixelRatio) {
    this.uniforms.uTime.value = t;
    this.uniforms.uCam.value.copy(camera.position);
    this.uniforms.uOpacity.value = opacity;
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.points.visible = opacity > 0.001;
  }
}

const bubbleVert = /* glsl */ `
  uniform float uPixelRatio;
  attribute float aLife;
  attribute float aSize;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    vAlpha = smoothstep(0.0, 0.08, aLife) * (1.0 - smoothstep(0.7, 1.0, aLife));
    gl_PointSize = aSize * (0.6 + aLife * 0.9) * 120.0 * uPixelRatio / max(-mv.z, 0.5);
  }
`;

const bubbleFrag = /* glsl */ `
  uniform float uOpacity;
  varying float vAlpha;
  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float rim = smoothstep(0.32, 0.47, d) * (1.0 - smoothstep(0.47, 0.5, d));
    float hi = smoothstep(0.16, 0.0, length(c - vec2(-0.14, -0.14)));
    float a = (rim * 0.75 + hi * 0.9 + 0.06) * vAlpha * uOpacity;
    gl_FragColor = vec4(vec3(0.85, 0.92, 0.9) * a, a);
  }
`;

/** Bubble trail emitted from the propulsor and ballast vents. */
export class Bubbles {
  constructor(count = 260) {
    this.count = count;
    this.pos = new Float32Array(count * 3);
    this.life = new Float32Array(count).fill(1);
    this.size = new Float32Array(count);
    this.vel = new Float32Array(count * 3);
    this.ttl = new Float32Array(count);
    this.cursor = 0;
    this.acc = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aLife', new THREE.BufferAttribute(this.life, 1).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geometry = g;
    this.uniforms = { uPixelRatio: { value: 1 }, uOpacity: { value: 0 } };
    this.points = new THREE.Points(
      g,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: bubbleVert,
        fragmentShader: bubbleFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.points.frustumCulled = false;
    this.points.renderOrder = 7;
  }

  emit(origin, spread = 0.35) {
    const i = this.cursor;
    this.cursor = (this.cursor + 1) % this.count;
    this.pos[i * 3] = origin.x + (Math.random() - 0.5) * spread;
    this.pos[i * 3 + 1] = origin.y + (Math.random() - 0.5) * spread;
    this.pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * spread;
    this.vel[i * 3] = (Math.random() - 0.5) * 0.6;
    this.vel[i * 3 + 1] = 0.8 + Math.random() * 1.6;
    this.vel[i * 3 + 2] = (Math.random() - 0.5) * 0.6;
    this.life[i] = 0;
    this.ttl[i] = 2.5 + Math.random() * 3;
    this.size[i] = 0.05 + Math.random() * 0.12;
  }

  update(t, dt, origins, rate, opacity, pixelRatio) {
    this.uniforms.uOpacity.value = opacity;
    this.uniforms.uPixelRatio.value = pixelRatio;
    this.points.visible = opacity > 0.001;
    if (!this.points.visible) return;

    this.acc += dt * rate;
    while (this.acc > 1) {
      this.acc -= 1;
      this.emit(origins[(Math.random() * origins.length) | 0]);
    }
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] >= 1) continue;
      this.life[i] = Math.min(1, this.life[i] + dt / this.ttl[i]);
      const k = i * 3;
      const wobble = Math.sin(t * 6 + i) * 0.4;
      this.pos[k] += (this.vel[k] + wobble) * dt;
      this.pos[k + 1] += this.vel[k + 1] * dt * (1 + this.life[i]);
      this.pos[k + 2] += (this.vel[k + 2] + Math.cos(t * 5 + i) * 0.3) * dt;
    }
    this.geometry.attributes.position.needsUpdate = true;
    this.geometry.attributes.aLife.needsUpdate = true;
    this.geometry.attributes.aSize.needsUpdate = true;
  }
}
