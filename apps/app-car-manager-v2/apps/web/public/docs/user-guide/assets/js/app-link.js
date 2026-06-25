/* "Open in app" CTA handler — runs on every guide page.
 *
 * Each page injects an <a class="app-link-cta" href="/route"> link. Clicking
 * one should leave the guide and take the *running app* to that route.
 *
 * The in-app guide renders inside a SANDBOXED same-origin iframe
 * (sandbox="allow-same-origin allow-scripts …" — note: NO allow-top-navigation).
 * That means this iframe is NOT allowed to navigate its parent directly:
 * `window.parent.location.href = …` is blocked by the browser (and a silent
 * fall-through would reload the app *inside* the tiny guide iframe — wrong).
 *
 * So instead we postMessage the route to the host app. The host
 * (UserGuideDrawer) closes the guide drawer and SPA-routes there via the
 * Next router (basePath handled by the app, so we send the raw route).
 *
 * Frame cases:
 *   in-app drawer:      [car-v2] > [guide iframe]  → postMessage to car-v2 ✓
 *   AMA embed:          [AMA] > [car-v2] > [guide] → postMessage to car-v2 ✓
 *                       (parent === car-v2, same origin as the guide)
 *   standalone new tab: guide IS the top window    → no host; navigate self ✓
 */
(function () {
  function resolveBasePath() {
    return location.pathname.replace(/\/docs\/user-guide\/.*$/, '');
  }

  function go(route) {
    /* In an iframe → ask the host app to navigate (works under sandbox; the
     * host closes the drawer + SPA-routes). */
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage(
          { type: 'car-v2:guide-navigate', route: route },
          location.origin,
        );
        return;
      }
    } catch (_e) {
      /* defensive — fall through to self navigation */
    }
    /* Standalone tab (guide is the top window): no host app to route, so just
     * navigate this tab to the full path (basePath + route). */
    window.location.href = resolveBasePath() + route;
  }

  document.addEventListener('click', function (event) {
    var target = event.target;
    if (!target) return;
    /* `closest()` walks up so the click works whether the user hits the
     * <a>, an inline <span> inside it, or any nested decoration. */
    var anchor = target.closest && target.closest('a.app-link-cta');
    if (!anchor) return;
    event.preventDefault();
    go(anchor.getAttribute('href') || '/');
  });
})();
