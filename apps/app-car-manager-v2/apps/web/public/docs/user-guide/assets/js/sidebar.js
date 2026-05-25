// Sidebar — mark the link matching window.location as active.
// All sidebar items live in the same HTML partial across pages; we just
// highlight whichever <a href> matches the current pathname (last segment).
(function () {
  function activateCurrent() {
    var here = window.location.pathname.split('/').pop() || 'index.html';
    var links = document.querySelectorAll('.sidebar__link');
    links.forEach(function (a) {
      var href = (a.getAttribute('href') || '').split('/').pop();
      if (href === here) {
        a.classList.add('is-active');
      } else {
        a.classList.remove('is-active');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', activateCurrent);
  } else {
    activateCurrent();
  }
})();
