// Search — fetch the static index once, then filter client-side on every
// keystroke. Token-AND substring match: query "đặt xe" matches any page that
// contains both "đặt" AND "xe" anywhere in title/headings/snippet.
//
// Index lives at /docs/user-guide/assets/search-index.json. The path used to
// fetch and to build result URLs is derived from window.location to stay
// portable across local dev (no basePath) and staging (basePath
// /app-car-manager-v2). The script auto-mounts itself if a #search-mount
// element exists.

(function () {
  var INDEX_REL = 'assets/search-index.json';
  var MIN_QUERY_LEN = 2;
  var MAX_RESULTS = 12;

  function guideRoot() {
    // path is e.g. /docs/user-guide/vi/admin/05-..html (or with basePath prepended)
    var path = window.location.pathname;
    var m = path.match(/^(.*\/docs\/user-guide)\//);
    return m ? m[1] : '';
  }

  function normalize(s) {
    return (s || '').toLowerCase();
  }

  function highlightSnippet(text, tokens) {
    var lower = text.toLowerCase();
    var hit = -1;
    for (var i = 0; i < tokens.length; i++) {
      var p = lower.indexOf(tokens[i]);
      if (p >= 0) { hit = p; break; }
    }
    if (hit < 0) return text.slice(0, 120) + (text.length > 120 ? '…' : '');
    var start = Math.max(0, hit - 40);
    var end = Math.min(text.length, hit + 100);
    var slice = (start > 0 ? '…' : '') + text.slice(start, end) + (end < text.length ? '…' : '');
    // Escape then bold each token (simple, no regex shenanigans).
    var escaped = slice
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    for (var j = 0; j < tokens.length; j++) {
      var tok = tokens[j];
      if (!tok) continue;
      var re = new RegExp('(' + tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'gi');
      escaped = escaped.replace(re, '<mark>$1</mark>');
    }
    return escaped;
  }

  function rank(entry, tokens) {
    // +5 per token in title, +2 in any heading, +1 in snippet.
    var score = 0;
    var titleN = normalize(entry.title);
    var headingsN = normalize((entry.headings || []).join(' '));
    var snippetN = normalize(entry.snippet);
    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (titleN.indexOf(t) >= 0) score += 5;
      if (headingsN.indexOf(t) >= 0) score += 2;
      if (snippetN.indexOf(t) >= 0) score += 1;
    }
    return score;
  }

  function search(index, query) {
    var tokens = normalize(query).split(/\s+/).filter(function (t) { return t.length > 0; });
    if (tokens.length === 0) return [];
    var results = [];
    for (var i = 0; i < index.length; i++) {
      var entry = index[i];
      var titleN = normalize(entry.title);
      var headingsN = normalize((entry.headings || []).join(' '));
      var snippetN = normalize(entry.snippet);
      // All tokens must match SOMETHING (title, heading, or snippet) — AND logic.
      var allMatch = tokens.every(function (t) {
        return titleN.indexOf(t) >= 0 || headingsN.indexOf(t) >= 0 || snippetN.indexOf(t) >= 0;
      });
      if (!allMatch) continue;
      results.push({ entry: entry, score: rank(entry, tokens), tokens: tokens });
    }
    results.sort(function (a, b) { return b.score - a.score; });
    return results.slice(0, MAX_RESULTS);
  }

  function renderResults(results, tokens, root, query) {
    if (!results.length) {
      return '<div class="search__empty">Không tìm thấy kết quả cho "<strong>' + escapeHtml(query) + '</strong>"</div>';
    }
    return results.map(function (r) {
      var url = root + '/' + r.entry.url;
      return ''
        + '<a class="search__hit" href="' + url + '">'
        +   '<div class="search__hit-section">' + escapeHtml(r.entry.section || '') + '</div>'
        +   '<div class="search__hit-title">' + escapeHtml(r.entry.title) + '</div>'
        +   '<div class="search__hit-snippet">' + highlightSnippet(r.entry.snippet, tokens) + '</div>'
        + '</a>';
    }).join('');
  }

  function escapeHtml(s) {
    return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function debounce(fn, ms) {
    var t;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  function mount() {
    var input = document.querySelector('#guide-search-input');
    var panel = document.querySelector('#guide-search-results');
    if (!input || !panel) return;

    var root = guideRoot();
    var indexPromise = null;
    function loadIndex() {
      if (!indexPromise) {
        indexPromise = fetch(root + '/' + INDEX_REL).then(function (r) {
          if (!r.ok) throw new Error('Cannot load search index (' + r.status + ')');
          return r.json();
        });
      }
      return indexPromise;
    }

    function show() { panel.classList.add('is-open'); }
    function hide() { panel.classList.remove('is-open'); }

    var onInput = debounce(function () {
      var q = input.value.trim();
      if (q.length < MIN_QUERY_LEN) {
        panel.innerHTML = '<div class="search__empty">Gõ ít nhất ' + MIN_QUERY_LEN + ' ký tự…</div>';
        show();
        return;
      }
      loadIndex().then(function (index) {
        var results = search(index, q);
        panel.innerHTML = renderResults(results, normalize(q).split(/\s+/).filter(Boolean), root, q);
        show();
      }).catch(function (err) {
        panel.innerHTML = '<div class="search__empty">Lỗi tải chỉ mục: ' + escapeHtml(err.message) + '</div>';
        show();
      });
    }, 80);

    input.addEventListener('input', onInput);
    input.addEventListener('focus', function () {
      if (input.value.trim().length >= MIN_QUERY_LEN) show();
    });

    // Close on click outside.
    document.addEventListener('click', function (e) {
      if (!panel.contains(e.target) && e.target !== input) hide();
    });

    // ESC = clear + close
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { input.value = ''; hide(); input.blur(); }
    });

    // Global "/" shortcut focuses the search box.
    document.addEventListener('keydown', function (e) {
      if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
        e.preventDefault();
        input.focus();
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount);
  } else {
    mount();
  }
})();
