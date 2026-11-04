/** Full-screen menu overlay + smooth in-page anchor scrolling. */
export function initMenu() {
  const btn = document.getElementById('menuBtn');
  const menu = document.getElementById('menu');
  const label = btn.querySelector('.btn__label');

  const set = (open) => {
    document.body.classList.toggle('menu-open', open);
    btn.setAttribute('aria-expanded', String(open));
    menu.setAttribute('aria-hidden', String(!open));
    label.textContent = open ? label.dataset.close : label.dataset.open;
  };

  btn.addEventListener('click', () => set(!document.body.classList.contains('menu-open')));
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') set(false);
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href').slice(1);
    const target = id ? document.getElementById(id) : null;
    if (!target && id !== 'top') return;
    e.preventDefault();
    set(false);
    let top = 0;
    if (target && id !== 'top') {
      // land on the section's centred "resting" position used by the 3D timeline
      top = Math.max(0, target.offsetTop + target.offsetHeight / 2 - window.innerHeight / 2);
    }
    window.scrollTo({ top, behavior: 'smooth' });
  });
}
