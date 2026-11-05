import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

import { Submarine } from './Submarine.js';
import { Ocean, waveHeight } from './Ocean.js';
import { MarineSnow, Bubbles } from './Particles.js';
import { Seabed } from './Seabed.js';
import { Globe } from './Globe.js';
import { TitleSign } from './TitleSign.js';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Underwater fog by camera height: [y, colour, density]
const FOG_STOPS = [
  [0, new THREE.Color('#0f3f45'), 0.019],
  [-40, new THREE.Color('#0b2f34'), 0.02],
  [-110, new THREE.Color('#082227'), 0.021],
  [-200, new THREE.Color('#06171b'), 0.022],
  [-300, new THREE.Color('#050f12'), 0.023],
  [-430, new THREE.Color('#04090b'), 0.024],
];
const ABOVE_FOG = new THREE.Color('#3a3835');
const WARM = new THREE.Color('#ffc890');
const COOL = new THREE.Color('#86b9b4');

export const SEABED_Y = -412;

export class World {
  constructor(canvas) {
    this.canvas = canvas;
    this.mobile = window.matchMedia('(max-width: 760px)').matches;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
      stencil: false,
    });
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(ABOVE_FOG.clone(), 0.004);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 2600);

    const pmrem = new THREE.PMREMGenerator(renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // ── lights
    this.hemi = new THREE.HemisphereLight(0xa9c6c2, 0x0a1113, 1);
    this.key = new THREE.DirectionalLight(0xffc890, 2);
    this.key.position.set(-10, 30, -25);
    this.rim = new THREE.DirectionalLight(0xd9b07a, 1.3);
    this.rim.position.set(-30, 6, -28);
    this.fill = new THREE.DirectionalLight(0x8fb7c0, 0.5);
    this.fill.position.set(22, 8, 30);
    this.scene.add(this.hemi, this.key, this.rim, this.fill);

    // ── content
    this.ocean = new Ocean();
    this.scene.add(this.ocean.group);

    this.title = new TitleSign('ABYSSAL');
    this.scene.add(this.title.mesh);

    this.sub = new Submarine();
    this.scene.add(this.sub.group);

    this.snow = new MarineSnow(this.mobile ? 1400 : 2600);
    this.scene.add(this.snow.points);

    this.bubbles = new Bubbles(this.mobile ? 160 : 280);
    this.scene.add(this.bubbles.points);

    this.seabed = new Seabed(SEABED_Y);
    this.scene.add(this.seabed.mesh);

    this.globe = new Globe();

    // ── post
    const size = new THREE.Vector2(window.innerWidth, window.innerHeight);
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, {
      type: THREE.HalfFloatType,
      samples: this.mobile ? 0 : 4,
    });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.globePass = new RenderPass(this.globe.scene, this.globe.camera);
    this.globePass.clear = false;
    this.globePass.clearDepth = true;
    this.bloom = new UnrealBloomPass(size, 0.7, 0.55, 0.86);
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.globePass);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this._look = new THREE.Vector3();
    this._v = new THREE.Vector3();
    this._fog = new THREE.Color();
    this._origins = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    this._ventL = new THREE.Vector3(0.2, 0.66, 0.3);
    this._ventR = new THREE.Vector3(3.6, 0.66, -0.3);
    this._wl = {};
    this.prevSubY = 0;

    this.resize();
  }

  get pixelRatio() {
    return Math.min(window.devicePixelRatio || 1, this.mobile ? 1.3 : 1.6);
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.width = w;
    this.height = h;
    const pr = this.pixelRatio;
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(w, h);
    this.bloom.resolution.set(w, h);

    this.camera.aspect = w / h;
    // keep the subject framed on portrait screens
    this.camera.fov = w / h < 0.9 ? 52 : 35;
    this.camera.updateProjectionMatrix();
    this.globe.resize(w, h);

    const dist = 118;
    this.title.layout(this.camera, dist, w / h < 0.9 ? 0.95 : 0.84);
    const tw = this.title.mesh.scale.x;
    // baseline sits just above the swell on the horizon
    this.title.mesh.position.set(0, 0.09 * tw + 0.9, -95);
  }

  /** Redraw text textures once web fonts are available. */
  refreshText() {
    this.title.draw();
  }

  /** Compile shaders in parallel (KHR_parallel_shader_compile) so neither the loader nor the first scroll stalls. */
  warmup() {
    return Promise.all([
      this.renderer.compileAsync(this.scene, this.camera),
      this.renderer.compileAsync(this.globe.scene, this.globe.camera),
    ]);
  }

  fogAt(y, underwater, out) {
    if (!underwater) return { color: out.copy(ABOVE_FOG), density: 0.0042 };
    for (let i = 0; i < FOG_STOPS.length - 1; i++) {
      const [y0, c0, d0] = FOG_STOPS[i];
      const [y1, c1, d1] = FOG_STOPS[i + 1];
      if (y <= y0 && y >= y1) {
        const t = (y0 - y) / (y0 - y1);
        return { color: out.copy(c0).lerp(c1, t), density: lerp(d0, d1, t) };
      }
    }
    const last = FOG_STOPS[FOG_STOPS.length - 1];
    return { color: out.copy(last[1]), density: last[2] };
  }

  /**
   * @param s     interpolated scroll state (see timeline in main.js)
   * @param t     elapsed seconds
   * @param dt    frame delta
   * @param ptr   smoothed pointer (-1..1)
   */
  render(s, t, dt, ptr) {
    const cam = this.camera;
    cam.position.set(s.cam[0] + ptr.x * 0.6, s.cam[1] - ptr.y * 0.35, s.cam[2]);
    this._look.set(s.look[0] + ptr.x * 0.25, s.look[1] - ptr.y * 0.15, s.look[2]);
    cam.lookAt(this._look);

    const g = this.sub.group;
    g.position.set(s.sub[0], s.sub[1], s.sub[2]);
    g.rotation.set(s.rot[2], s.rot[0], s.rot[1]);
    g.scale.setScalar(s.scale);

    const y = cam.position.y;
    const underwater = y < waveHeight(cam.position.x, cam.position.z, t) - 0.04;
    const depth01 = clamp(-y / 410);

    // ── fog & background
    const fog = this.fogAt(Math.min(y, 0), underwater, this._fog);
    this.scene.fog.color.copy(fog.color);
    this.scene.fog.density = fog.density;
    this.scene.background = underwater ? this.scene.fog.color : null;

    // ── light falloff with depth
    if (underwater) {
      const sunFade = Math.exp(y / 40);
      this.hemi.intensity = lerp(0.9, 0.05, smooth(0, 220, -y));
      this.key.intensity = 2.2 * sunFade;
      this.key.color.copy(WARM).lerp(COOL, smooth(0, 60, -y));
      this.rim.intensity = lerp(1.5, 0.8, depth01);
      this.fill.intensity = lerp(0.55, 0.4, depth01);
      this.scene.environmentIntensity = lerp(0.55, 0.09, smooth(0, 260, -y));
    } else {
      this.hemi.intensity = 0.55;
      this.key.intensity = 2.2;
      this.key.color.copy(WARM);
      this.rim.intensity = 1.6;
      this.fill.intensity = 0.45;
      this.scene.environmentIntensity = 0.16;
    }

    // ── ocean
    const rays = underwater ? smooth(0, 4, -y) * (1 - smooth(40, 130, -y)) : 0;
    this.ocean.update(t, cam, {
      fogColor: fog.color,
      fogDensity: fog.density,
      underwater,
      rayStrength: rays,
    });

    // ── title: stays centred on the line of sight even when the shot is biased toward the bow
    const tz = this.title.mesh.position.z;
    this.title.mesh.position.x = s.cam[0] + ((s.look[0] - s.cam[0]) * (s.cam[2] - tz)) / Math.max(s.cam[2], 1);
    this.title.material.opacity = underwater ? 0 : s.title;
    this.title.mesh.visible = this.title.material.opacity > 0.002;

    // ── submarine
    const subDy = (g.position.y - this.prevSubY) / Math.max(dt, 1e-3);
    this.prevSubY = g.position.y;
    this.sub.update(t, dt, {
      beams: s.beams,
      envDim: 1 - depth01,
      speed: clamp(Math.abs(subDy) / 8),
      surfaced: smooth(-1.4, -0.5, g.position.y),
    });
    this.ocean.setFoam(this.ocean.surface.visible && this.sub.waterline(this._wl) ? this._wl : null);

    // ── particles
    const pr = this.pixelRatio;
    this.snow.update(t, cam, underwater ? smooth(0, 6, -y) : 0, pr);

    const subSubmerged = g.position.y < -1.6;
    this.sub.sternWorld(this._origins[0]);
    g.localToWorld(this._origins[1].copy(this._ventL));
    g.localToWorld(this._origins[2].copy(this._ventR));
    const rate = subSubmerged ? 14 + clamp(Math.abs(subDy) / 3) * 60 : 0;
    this.bubbles.update(t, dt, this._origins, rate, underwater ? 1 : 0, pr);

    // ── seabed
    this.seabed.mesh.visible = y < -290;
    if (this.seabed.mesh.visible) this.seabed.update(t, g.position, s.ping);

    // ── globe overlay
    this.globePass.enabled = s.globe > 0.003;
    if (this.globePass.enabled) this.globe.update(t, s.globe, s.globeSpin, pr);

    // ── post
    // bloom only for real light sources (floodlights, strobe), never as a decorative haze
    this.bloom.strength = underwater ? lerp(0.4, 0.62, depth01) : 0.25;
    this.bloom.threshold = underwater ? 0.85 : 0.95;

    this.composer.render(dt);
  }

  /** Project hotspot anchors to screen space. */
  projectHotspots(out) {
    const w = this.width;
    const h = this.height;
    this.sub.hotspots.forEach((o, i) => {
      o.getWorldPosition(this._v);
      this._v.project(this.camera);
      out[i] = out[i] || {};
      out[i].x = (this._v.x * 0.5 + 0.5) * w;
      out[i].y = (-this._v.y * 0.5 + 0.5) * h;
      out[i].visible = this._v.z < 1;
    });
    return out;
  }
}
