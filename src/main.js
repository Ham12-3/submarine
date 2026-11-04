import { World } from './gl/World.js';
import { measure, buildKeys, sample } from './timeline.js';
import { initReveals } from './ui/reveal.js';
import { initCarousel } from './ui/carousel.js';
import { initHud } from './ui/hud.js';
import { initSound } from './ui/sound.js';
import { initMenu } from './ui/menu.js';
import { initHotspots } from './ui/hotspots.js';
import { scramble, fitText } from './ui/text.js';
import { HERITAGE } from './ui/art.js';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const $ = (id) => document.getElementById(id);
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ── WebGL world ──────────────────────────────────────────────
let world = null;
try {
  world = new World($('gl'));
} catch (err) {
  console.error('WebGL unavailable', err);
  document.body.classList.add('no-webgl');
}

// ── static UI ────────────────────────────────────────────────
const heritageCards = buildHeritage();
initMenu();
initReveals();
initCarousel();
initSound($('soundBtn'));
const hud = initHud();
const hotspots = world ? initHotspots(world.sub.hotspots) : null;
const footerWord = document.querySelector('.footer__word');

let m = measure();
let keys = buildKeys(m);

if (import.meta.env.DEV) {
  window.__abyssal = { world, get m() { return m; }, get keys() { return keys; } };
}

function relayout() {
  m = measure();
  keys = buildKeys(m);
  fitText(footerWord, 0.97);
}

let resizeTimer;
window.addEventListener('resize', () => {
  world?.resize();
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(relayout, 150);
});

// ── pointer parallax ─────────────────────────────────────────
const ptrTarget = { x: 0, y: 0 };
const ptr = { x: 0, y: 0 };
window.addEventListener('pointermove', (e) => {
  if (e.pointerType !== 'mouse') return;
  ptrTarget.x = (e.clientX / window.innerWidth) * 2 - 1;
  ptrTarget.y = (e.clientY / window.innerHeight) * 2 - 1;
});

// ── loader ──────────────────────────────────────────────────
let ready = false;
let warmed = false; // don't render until shaders are compiled — the opaque loader hides the canvas meanwhile

async function boot() {
  const countEl = $('loadCount');
  const statusEl = $('loadStatus');
  const ring = $('ringProgress');
  const CIRC = 1218.9;
  const STATUS = ['PRESSURISING HULL', 'CALIBRATING SONAR', 'LOADING COORDINATES', 'SYSTEMS NOMINAL'];
  let shown = 0;
  let target = 0;
  let si = -1;
  let done = false;

  const tick = () => {
    shown += (target - shown) * 0.07;
    if (target === 100 && 100 - shown < 0.6) shown = 100;
    countEl.textContent = String(Math.round(shown)).padStart(2, '0');
    ring.style.strokeDashoffset = CIRC * (1 - shown / 100);
    const i = Math.min(STATUS.length - 1, Math.floor(shown / 26));
    if (i !== si) {
      si = i;
      statusEl.dataset.text = STATUS[i];
      scramble(statusEl, 500);
    }
    if (!done) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);

  const t0 = performance.now();
  target = 38;
  await Promise.race([
    Promise.all([
      document.fonts.load('300 100px "Clash Display"'),
      document.fonts.load('300 16px "JetBrains Mono"'),
      document.fonts.load('300 16px "DM Sans"'),
    ]).then(() => document.fonts.ready),
    wait(3000),
  ]).catch(() => {});
  world?.refreshText();
  relayout();

  target = 72;
  await world?.warmup().catch((err) => console.warn('Shader warm-up failed', err));
  warmed = true;

  target = 94;
  await wait(Math.max(0, 2300 - (performance.now() - t0)));
  target = 100;
  while (shown < 100) await wait(30);
  done = true;

  window.scrollTo(0, 0);
  document.body.classList.remove('is-loading');
  document.body.classList.add('is-ready');
  ready = true;
  document.querySelectorAll('.hero__meta [data-scramble]').forEach((el, i) => {
    setTimeout(() => scramble(el, 1100), 700 + i * 150);
  });
}

// ── per-frame DOM overlays tied to scroll ───────────────────
const intro = $('intro');
const dial = intro.querySelector('.intro__dial');
const heroMeta = document.querySelector('.hero__meta');
const caption = $('heroCaption');
const heritageEl = $('heritage');

function overlays(y) {
  const hp = y / m.heroRange;
  if (ready) {
    const k = smooth(0, 0.07, hp);
    intro.style.opacity = (1 - k).toFixed(3);
    dial.style.transform = `scale(${(1 + k * 0.6).toFixed(3)})`;
    intro.classList.toggle('is-gone', k >= 1);
  }
  heroMeta.style.setProperty('--meta-o', (1 - smooth(0.02, 0.1, hp)).toFixed(3));
  const c = smooth(0.56, 0.63, hp) * (1 - smooth(0.84, 0.94, hp));
  caption.style.opacity = c.toFixed(3);
  caption.style.transform = `translate(-50%, ${((1 - c) * 20).toFixed(1)}px)`;
  // instruments on during the dive, off once the footer takes over the bottom of the screen
  hud.show(ready && hp > 0.1 && y < m.contact + m.vh * 0.35);
}

function parallaxHeritage() {
  const r = heritageEl.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.bottom < 0 || r.top > vh) return;
  const p = (vh - r.top) / (vh + r.height);
  for (const c of heritageCards) {
    c.el.style.transform = `translate3d(0, ${((0.5 - p) * c.depth * 340).toFixed(1)}px, 0) rotate(${c.rot}deg)`;
  }
}

// ── main loop ───────────────────────────────────────────────
let last = performance.now();
let elapsed = 0;
let current = 0;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  elapsed += dt;

  const target = window.scrollY;
  current += (target - current) * (1 - Math.exp(-dt * 5.5));
  if (Math.abs(target - current) < 0.05) current = target;
  const pk = 1 - Math.exp(-dt * 2.5);
  ptr.x += (ptrTarget.x - ptr.x) * pk;
  ptr.y += (ptrTarget.y - ptr.y) * pk;

  const s = sample(keys, current);
  s.globeSpin = ((current - m.expeditions) / m.vh) * 0.6;

  if (world && warmed) {
    world.render(s, elapsed, dt, ptr);
    hotspots.update(world, s.hot);
  }
  hud.update(s.depth);
  overlays(current);
  parallaxHeritage();

  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
boot();

// ── heritage cards ──────────────────────────────────────────
function buildHeritage() {
  const wrap = $('heritageCards');
  return HERITAGE.map((h, i) => {
    const fig = document.createElement('figure');
    fig.className = 'hcard';
    fig.style.left = `${h.pos[0]}%`;
    fig.style.top = `${h.pos[1]}%`;
    fig.innerHTML = `${h.art(i)}<figcaption><b>${h.year} · ${h.title}</b>${h.note}</figcaption>`;
    wrap.appendChild(fig);
    return { el: fig, depth: h.depth, rot: ((i % 2 ? 1 : -1) * (1.5 + i * 0.5)).toFixed(1) };
  });
}
