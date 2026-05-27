// Sidebar — active-link highlight + mobile drawer toggle.
//
// On desktop (>900px) the sidebar is part of the page grid; on mobile the
// CSS shifts the layout to a single column and we slide the sidebar in
// from the left when the user taps a hamburger button. The hamburger +
// backdrop are injected here so the HTML files don't need to change.
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

  /* Drawer toggle — inject hamburger + backdrop, wire open/close.
   *
   * Only attaches if the page has a `.sidebar` element (inner doc pages do;
   * the landing role picker doesn't, so it gets skipped automatically). */
  function setupMobileDrawer() {
    var sidebar = document.querySelector('.sidebar');
    var header = document.querySelector('.header');
    if (!sidebar || !header) return;

    /* Hamburger button. Placed as the FIRST child of `.header` so it sits at
     * the left edge, before the brand. Hidden on desktop via CSS. */
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'header__menu-toggle';
    toggle.setAttribute('aria-label', 'Mở danh mục');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-controls', 'guide-sidebar');
    /* Inline SVG — 3-line hamburger; switches to X via CSS when [data-open]. */
    toggle.innerHTML =
      '<svg class="header__menu-icon header__menu-icon--bars" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>' +
      '<svg class="header__menu-icon header__menu-icon--close" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
    header.insertBefore(toggle, header.firstChild);

    /* Give the sidebar an id so aria-controls points somewhere. */
    sidebar.id = 'guide-sidebar';

    /* Backdrop — full-screen overlay behind the sidebar drawer. Click to
     * close. Appended to <body> so its stacking context isn't trapped under
     * the header's sticky position. */
    var backdrop = document.createElement('div');
    backdrop.className = 'sidebar-backdrop';
    backdrop.setAttribute('hidden', '');
    document.body.appendChild(backdrop);

    function openDrawer() {
      sidebar.classList.add('is-open');
      backdrop.removeAttribute('hidden');
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('data-open', 'true');
      /* Prevent body scroll under the drawer — iOS Safari requires
       * `overflow: hidden` on both <html> and <body> to fully lock. */
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    }
    function closeDrawer() {
      sidebar.classList.remove('is-open');
      backdrop.setAttribute('hidden', '');
      toggle.setAttribute('aria-expanded', 'false');
      toggle.removeAttribute('data-open');
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    function toggleDrawer() {
      if (sidebar.classList.contains('is-open')) closeDrawer();
      else openDrawer();
    }

    toggle.addEventListener('click', toggleDrawer);
    backdrop.addEventListener('click', closeDrawer);

    /* Close on Escape key — accessibility convention. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && sidebar.classList.contains('is-open')) {
        closeDrawer();
      }
    });

    /* Close after navigation — when user taps a link inside the drawer, the
     * new page loads which would close it anyway, but on same-origin link
     * Chrome occasionally caches the open state. Force-close on click. */
    sidebar.querySelectorAll('a.sidebar__link').forEach(function (a) {
      a.addEventListener('click', function () {
        /* setTimeout 0 so navigation kicks off first; close immediately would
         * cause a visible flash before the new page paints. */
        setTimeout(closeDrawer, 0);
      });
    });

    /* Auto-close when viewport grows past mobile breakpoint (rotation,
     * desktop user resizing). matchMedia is widely supported. */
    if (window.matchMedia) {
      var mq = window.matchMedia('(min-width: 901px)');
      var onChange = function (e) {
        if (e.matches) closeDrawer();
      };
      if (mq.addEventListener) mq.addEventListener('change', onChange);
      else if (mq.addListener) mq.addListener(onChange); /* legacy Safari */
    }
  }

  function init() {
    activateCurrent();
    setupMobileDrawer();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
