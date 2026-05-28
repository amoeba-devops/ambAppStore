/* "Open in app" CTA handler — runs on every guide page.
 *
 * Each page injects an <a class="app-link-cta" href="/route"> link. Click
 * behaviour:
 *   1. Derive the app basePath from the doc URL: strip "/docs/user-guide/..."
 *      to get whatever prefix the deploy lives under (empty on dev,
 *      "/app-car-manager-v2" on staging when mounted as a sub-app, etc.).
 *   2. Compute the destination as `${basePath}${route}`.
 *   3. Navigate `window.parent` (the car-v2 page that hosts this guide
 *      iframe) — NOT `window.top`. Frame nesting:
 *        standalone drawer:  [car-v2] > [guide iframe]
 *                            → parent = car-v2 ✓
 *        AMA embed:          [AMA] > [car-v2] > [guide iframe]
 *                            → parent = car-v2 ✓ (top = AMA, cross-origin,
 *                              would throw or hijack the whole AMA shell)
 *        standalone new tab: guide IS the top window
 *                            → parent === window → navigate self ✓
 *      Using `window.top` broke the AMA-embed case (cross-origin SecurityError
 *      → silently fell through and reloaded car-v2 INTO the tiny guide iframe).
 *
 * Robust to:
 *   - arbitrary basePath (dev /, staging /app-car-manager-v2/)
 *   - standalone tab, in-app drawer, AND triple-nested AMA embed
 *   - cross-origin ancestors (try/catch guards the parent access)
 */
(function () {
  function resolveBasePath() {
    return location.pathname.replace(/\/docs\/user-guide\/.*$/, '');
  }

  function navigateParentOrSelf(href) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.location.href = href;
        return;
      }
    } catch (_e) {
      /* cross-origin parent (shouldn't happen — guide + car-v2 share an
       * origin — but guard anyway) → fall through to self navigation */
    }
    window.location.href = href;
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    /* `closest()` walks up so the click works whether the user hits the
     * <a>, an inline <span> inside it, or any nested decoration. */
    var anchor = target.closest && target.closest('a.app-link-cta');
    if (!anchor) return;
    event.preventDefault();
    var route = anchor.getAttribute('href') || '/';
    var dest = resolveBasePath() + route;
    navigateParentOrSelf(dest);
  });
})();
