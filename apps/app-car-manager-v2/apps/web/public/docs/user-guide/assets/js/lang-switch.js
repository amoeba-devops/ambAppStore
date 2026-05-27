// Language switch — rewrite the current URL's locale segment (vi ↔ ko) so the
// reader stays on the same section/page after switching. Falls back to the
// locale's index.html if the equivalent slug is missing from the other tree.
//
// Mobile UX: the inline pill row gets too cramped under 700px, so we turn the
// active item into a tap-to-open trigger that reveals the other option(s) as
// a dropdown below. Desktop keeps the side-by-side pills.
(function () {
  function buildSwitchLinks() {
    var path = window.location.pathname;
    // Match /docs/user-guide/<locale>/<rest...>
    var match = path.match(/^(.*\/docs\/user-guide)\/(vi|ko)\/(.*)$/);
    if (!match) {
      return; // landing page or assets — nothing to switch
    }
    var base = match[1];
    var locale = match[2];
    var rest = match[3];

    var viLink = document.querySelector('.lang-switch a[data-lang="vi"]');
    var koLink = document.querySelector('.lang-switch a[data-lang="ko"]');
    if (viLink) viLink.setAttribute('href', base + '/vi/' + rest);
    if (koLink) koLink.setAttribute('href', base + '/ko/' + rest);

    if (locale === 'vi' && viLink) viLink.classList.add('is-active');
    if (locale === 'ko' && koLink) koLink.classList.add('is-active');
  }

  /* Mobile dropdown — tap active link → toggle .is-open on the .lang-switch
   * wrapper. CSS hides inactive items by default on narrow screens, then
   * positions them as a dropdown below when .is-open is set. */
  function setupMobileDropdown() {
    var wrap = document.querySelector('.lang-switch');
    if (!wrap) return;

    /* Inject a chevron into the active item so users have a visual affordance
     * that this is a dropdown trigger on mobile. Desktop hides it via CSS. */
    var active = wrap.querySelector('a.is-active');
    if (active && !active.querySelector('.lang-chevron')) {
      var chevron = document.createElement('span');
      chevron.className = 'lang-chevron';
      chevron.setAttribute('aria-hidden', 'true');
      chevron.innerHTML =
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';
      active.appendChild(chevron);
    }

    /* Only intercept clicks on the ACTIVE link — inactive ones should navigate
     * as before. We don't gate on viewport size because the CSS handles the
     * desktop case (chevron hidden, dropdown rules dormant); blocking the
     * default navigation on desktop active-link is fine since clicking the
     * already-active language was a no-op anyway. */
    wrap.addEventListener('click', function (e) {
      var link = e.target.closest('a');
      if (!link) return;
      if (link.classList.contains('is-active')) {
        /* Mobile: prevent navigation, toggle dropdown. Desktop: also prevent
         * since clicking active language reloads same page — toggle is cheap
         * and won't be visible (no inactive items to reveal). */
        e.preventDefault();
        wrap.classList.toggle('is-open');
      } else {
        /* Inactive link tapped → close dropdown then let navigation proceed. */
        wrap.classList.remove('is-open');
      }
    });

    /* Click outside → close. */
    document.addEventListener('click', function (e) {
      if (!wrap.classList.contains('is-open')) return;
      if (!wrap.contains(e.target)) wrap.classList.remove('is-open');
    });

    /* Esc → close. */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') wrap.classList.remove('is-open');
    });
  }

  function init() {
    buildSwitchLinks();
    setupMobileDropdown();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
