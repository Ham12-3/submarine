import { VEHICLES } from './art.js';
import { splitWords } from './text.js';

/** Fleet carousel: centre card in focus, neighbours dimmed at the edges, giant name overlaid. */
export function initCarousel() {
  const track = document.getElementById('fleetTrack');
  const nameEl = document.getElementById('fleetName');
  const descEl = document.getElementById('fleetDesc');
  const specsEl = document.getElementById('fleetSpecs');
  const indexEl = document.getElementById('fleetIndex');
  const stage = document.getElementById('fleetStage');
  const n = VEHICLES.length;

  const cards = VEHICLES.map((v, i) => {
    const card = document.createElement('article');
    card.className = 'card';
    card.innerHTML = `
      <div class="card__grid"></div>
      <div class="card__scan"></div>
      <p class="card__tag">${String(i + 1).padStart(2, '0')} — ${v.tag}</p>
      ${v.art}
      <div class="card__foot">
        ${v.specs.map(([k, val]) => `<span>${k}<b>${val}</b></span>`).join('')}
      </div>`;
    card.addEventListener('click', () => {
      const off = offsetOf(i);
      if (off !== 0) go(active + off);
    });
    track.appendChild(card);
    return card;
  });

  let active = 0;

  const offsetOf = (i) => {
    let off = i - active;
    if (off > n / 2) off -= n;
    if (off < -n / 2) off += n;
    return off;
  };

  function render(first = false) {
    const spread = Math.min(window.innerWidth * 0.4, 560);
    cards.forEach((c, i) => {
      const off = offsetOf(i);
      const abs = Math.abs(off);
      const x = off * spread;
      const s = abs === 0 ? 1 : 0.8;
      c.style.transform = `translateX(${x}px) scale(${s}) rotateY(${off * -8}deg)`;
      c.style.opacity = abs === 0 ? 1 : abs === 1 ? 0.42 : 0;
      c.style.filter = abs ? 'blur(1.5px) saturate(0.6)' : 'none';
      c.style.zIndex = String(10 - abs);
      c.style.pointerEvents = abs > 1 ? 'none' : 'auto';
      c.setAttribute('aria-hidden', abs ? 'true' : 'false');
    });

    const v = VEHICLES[active];
    nameEl.classList.remove('is-in');
    nameEl.textContent = v.name;
    splitWords(nameEl, 0.06);
    // next frame so the transition runs from the hidden state
    requestAnimationFrame(() => requestAnimationFrame(() => nameEl.classList.add('is-in')));

    descEl.style.opacity = 0;
    setTimeout(
      () => {
        descEl.textContent = v.desc;
        specsEl.innerHTML = v.specs.map(([k, val]) => `<div><dt>${k}</dt><dd>${val}</dd></div>`).join('');
        indexEl.textContent = `${String(active + 1).padStart(2, '0')} / ${String(n).padStart(2, '0')}`;
        descEl.style.opacity = 1;
      },
      first ? 0 : 250,
    );
  }

  function go(i) {
    active = ((i % n) + n) % n;
    render();
  }

  document.getElementById('fleetPrev').addEventListener('click', () => go(active - 1));
  document.getElementById('fleetNext').addEventListener('click', () => go(active + 1));

  // swipe / drag
  let sx = null;
  stage.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
  });
  window.addEventListener('pointerup', (e) => {
    if (sx === null) return;
    const dx = e.clientX - sx;
    sx = null;
    if (Math.abs(dx) > 50) go(active + (dx < 0 ? 1 : -1));
  });

  // arrow keys while the section is on screen
  let inView = false;
  new IntersectionObserver(([e]) => (inView = e.isIntersecting), { threshold: 0.5 }).observe(stage);
  window.addEventListener('keydown', (e) => {
    if (!inView) return;
    if (e.key === 'ArrowRight') go(active + 1);
    if (e.key === 'ArrowLeft') go(active - 1);
  });

  window.addEventListener('resize', () => render(true));
  render(true);
}
