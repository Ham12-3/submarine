const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const KEEP = /[\s[\]—·.,:/\-–()]/;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Decode-style text scramble used on mono labels (as on the reference site). */
export function scramble(el, duration = 900) {
  const final = el.dataset.text ?? (el.dataset.text = el.textContent);
  if (reduced) {
    el.textContent = final;
    return;
  }
  cancelAnimationFrame(el._scr);
  const start = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - start) / duration);
    const shown = Math.floor(p * p * final.length * 1.05);
    let s = '';
    for (let i = 0; i < final.length; i++) {
      const ch = final[i];
      s += i < shown || KEEP.test(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
    }
    el.textContent = s;
    if (p < 1) el._scr = requestAnimationFrame(step);
  };
  el._scr = requestAnimationFrame(step);
}

/** Wrap every word in a masked span so headings can rise in word by word. */
export function splitWords(el, stagger = 0.045) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(' '));
            continue;
          }
          const w = document.createElement('span');
          w.className = 'w';
          const inner = document.createElement('span');
          inner.textContent = part;
          inner.style.setProperty('--d', `${(i++ * stagger).toFixed(3)}s`);
          w.appendChild(inner);
          frag.appendChild(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
  el.classList.add('is-split');
}

/** Fit a single-line element's font-size to its container width. */
export function fitText(el, maxWidthFrac = 1) {
  const parent = el.parentElement;
  const cs = getComputedStyle(parent);
  const inner = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
  el.style.display = 'inline-block';
  el.style.fontSize = '100px';
  const w = el.getBoundingClientRect().width;
  el.style.display = '';
  el.style.fontSize = `${(100 * inner * maxWidthFrac) / w}px`;
}

export function formatInt(n) {
  return Math.round(n).toLocaleString('en-US');
}
