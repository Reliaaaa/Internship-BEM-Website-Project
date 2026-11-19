// Lenis 1.3.27 is hosted locally so wheel scrolling works without a CDN.
(() => {
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const dialogs = [...document.querySelectorAll('dialog')];
  let lenis;

  for (const element of document.querySelectorAll('dialog, textarea')) {
    element.setAttribute('data-lenis-prevent', '');
  }

  function syncDialog() {
    if (!lenis) return;
    if (dialogs.some((dialog) => dialog.open)) lenis.stop();
    else lenis.start();
  }

  function syncMotion() {
    if (lenis) { lenis.destroy(); lenis = undefined; }
    if (!motion.matches && typeof Lenis === 'function') {
      lenis = new Lenis({ autoRaf: true, syncTouch: false, lerp: 0.1 });
      syncDialog();
    }
  }

  const observer = new MutationObserver(syncDialog);
  for (const dialog of dialogs) observer.observe(dialog, { attributes: true, attributeFilter: ['open'] });
  motion.addEventListener('change', syncMotion);
  syncMotion();
})();
