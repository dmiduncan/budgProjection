// Local config loader (safe default). This file is intentionally tracked so pages that expect
// a local config script won't 404. If you want local Supabase keys for dev, create
// shared/supabase-keys.js (untracked) by copying shared/supabase-keys.example.js.

// Resolve the keys file relative to this loader rather than the page URL. This
// works for pages at any directory depth without probing invalid URLs.
(function() {
  try {
    var loader = document.currentScript;
    if (!loader || !loader.src) {
      throw new Error('config.local.js must be loaded by a script element');
    }
    var keysUrl = new URL('supabase-keys.js', loader.src).href;
    document.write('<script src="' + keysUrl + '"><\/script>');
  } catch (e) {
    console.warn('config.local loader: could not inject supabase-keys.js', e);
  }
})();
