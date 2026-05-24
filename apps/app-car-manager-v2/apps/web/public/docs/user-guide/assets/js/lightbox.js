// Lightbox — click any <figure img> to zoom; click backdrop or ESC to close.
(function () {
  function ensureOverlay() {
    var ov = document.querySelector('.lightbox');
    if (ov) return ov;
    ov = document.createElement('div');
    ov.className = 'lightbox';
    ov.innerHTML = '<img alt="">';
    ov.addEventListener('click', close);
    document.body.appendChild(ov);
    return ov;
  }

  function open(src, alt) {
    var ov = ensureOverlay();
    ov.querySelector('img').setAttribute('src', src);
    ov.querySelector('img').setAttribute('alt', alt || '');
    ov.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    var ov = document.querySelector('.lightbox');
    if (!ov) return;
    ov.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('figure img');
    if (img) {
      e.preventDefault();
      open(img.getAttribute('src'), img.getAttribute('alt'));
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') close();
  });
})();
