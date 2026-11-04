import { scramble, splitWords, formatInt } from './text.js';

/** Scroll-triggered reveals: word-masked headings, fades, scrambles, staggered cards, counters. */
export function initReveals() {
  document.querySelectorAll('h2[data-reveal], h3[data-reveal]').forEach((h) => splitWords(h));

  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const el = e.target;
        io.unobserve(el);

        if (el.hasAttribute('data-scramble')) {
          scramble(el, 1000);
        } else if (el.classList.contains('steps__list')) {
          el.querySelectorAll('[data-step]').forEach((s, i) => {
            s.style.setProperty('--d', `${i * 0.14}s`);
            s.classList.add('is-in');
          });
        } else if (el.classList.contains('stats')) {
          el.querySelectorAll('[data-count]').forEach(countUp);
        } else {
          el.classList.add('is-in');
        }
      }
    },
    { threshold: 0.18, rootMargin: '0px 0px -8% 0px' },
  );

  document
    .querySelectorAll('main [data-reveal], main [data-scramble]:not(.hero__meta *), .steps__list, .stats')
    .forEach((el) => io.observe(el));

  // stagger siblings that reveal together
  document.querySelectorAll('.block__inner, .bubble, .safety__col, .heritage__center').forEach((group) => {
    group.querySelectorAll(':scope [data-reveal]:not(.is-split)').forEach((el, i) => {
      el.style.setProperty('--d', `${0.15 + i * 0.1}s`);
    });
  });
}

function countUp(el) {
  const to = Number(el.dataset.count);
  const suffix = el.dataset.suffix || '';
  const start = performance.now();
  const dur = 1600;
  const tick = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = formatInt(to * e) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
