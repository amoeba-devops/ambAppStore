/* "Open in app" CTA handler — runs on every guide page.
 *
 * Each page injects an <a class="app-link-cta" href="/route"> link. Click
 * behaviour:
 *   1. Derive the app basePath from the doc URL: strip "/docs/user-guide/..."
 *      to get whatever prefix the deploy lives under (empty on dev,
 *      "/app-car-manager-v2" on staging when mounted as a sub-app, etc.).
 *   2. Compute the destination as `${basePath}${route}`.
 *   3. If the guide is loaded inside an iframe (e.g. in-app drawer), navigate
 *      `window.top` so the parent app — not the iframe — moves to the new
 *      route. Standalone tabs just navigate themselves.
 *
 * Robust to:
 *   - mounted under arbitrary basePath (dev /, staging /app-car-manager-v2/)
 *   - opened standalone OR embedded in our <UserGuideDrawer> iframe
 *   - cross-origin iframe ancestors (try/catch protects against opaque-top
 *     errors when ancestor is on a different origin)
 */
(function () {
  function resolveBasePath() {
    return location.pathname.replace(/\/docs\/user-guide\/.*$/, '');
  }

  function navigateTopOrSelf(href) {
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = href;
        return;
      }
    } catch (_e) {
      /* cross-origin ancestor — fall through and navigate self instead */
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
    navigateTopOrSelf(dest);
  });
})();
