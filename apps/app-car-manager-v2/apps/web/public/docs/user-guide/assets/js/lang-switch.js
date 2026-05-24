// Language switch — rewrite the current URL's locale segment (vi ↔ ko) so the
// reader stays on the same section/page after switching. Falls back to the
// locale's index.html if the equivalent slug is missing from the other tree.
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

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', buildSwitchLinks);
  } else {
    buildSwitchLinks();
  }
})();
