(function () {
  'use strict';

  var userMoved = false;

  function hashTarget() {
    if (!window.location.hash) return null;

    try {
      return document.getElementById(decodeURIComponent(window.location.hash.slice(1)));
    } catch (error) {
      return null;
    }
  }

  function alignWithTarget() {
    var target = hashTarget();
    if (!target || userMoved) return;

    target.scrollIntoView({ block: 'start' });
  }

  function alignAfterLayoutChange() {
    window.requestAnimationFrame(function () {
      window.requestAnimationFrame(alignWithTarget);
    });
  }

  function noteUserMovement() {
    userMoved = true;
  }

  ['wheel', 'touchstart', 'pointerdown', 'keydown'].forEach(function (eventName) {
    window.addEventListener(eventName, noteUserMovement, { once: true, passive: true });
  });

  window.addEventListener('hashchange', function () {
    userMoved = false;
    alignAfterLayoutChange();
  });

  if (!hashTarget()) return;

  alignAfterLayoutChange();
  window.addEventListener('load', alignAfterLayoutChange, { once: true });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(alignAfterLayoutChange);
  }

  var target = hashTarget();
  document.querySelectorAll('img').forEach(function (image) {
    if (image.complete || !(image.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      return;
    }

    image.addEventListener('load', alignAfterLayoutChange, { once: true });
    image.addEventListener('error', alignAfterLayoutChange, { once: true });
  });
})();
