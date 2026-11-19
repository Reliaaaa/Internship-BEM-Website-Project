const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

test('smooth scroll respects reduced motion and pauses for dialogs', () => {
  const motion = { matches: false, addEventListener: (_, callback) => { motion.change = callback; } };
  const dialog = { open: false, setAttribute() {} };
  let instance, dialogChange;
  class Lenis {
    constructor() { instance = this; }
    stop() { this.stopped = true; }
    start() { this.stopped = false; }
    destroy() { this.destroyed = true; }
  }
  class MutationObserver { constructor(callback) { dialogChange = callback; } observe() {} }
  const document = { querySelectorAll: () => [dialog] };
  vm.runInNewContext(fs.readFileSync('smooth-scroll.js', 'utf8'), { window: { matchMedia: () => motion }, document, Lenis, MutationObserver });
  assert.equal(instance.stopped, false);
  dialog.open = true; dialogChange();
  assert.equal(instance.stopped, true);
  dialog.open = false; dialogChange();
  assert.equal(instance.stopped, false);
  motion.matches = true; motion.change();
  assert.equal(instance.destroyed, true);
});
