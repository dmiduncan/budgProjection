// Local config loader (safe default). This file is intentionally tracked so pages that expect
// a local config script won't 404. If you want local Supabase keys for dev, create
// shared/supabase-keys.js (untracked) by copying shared/supabase-keys.example.js.

// Attempt to load common relative paths for a local supabase-keys.js file. Loading
// multiple tags is harmless; the correct one for the page depth will succeed.
(function() {
  try {
    document.write('<script src="./shared/supabase-keys.js"><\/script>');
    document.write('<script src="../shared/supabase-keys.js"><\/script>');
    document.write('<script src="../../shared/supabase-keys.js"><\/script>');
  } catch (e) {
    // document.write can throw in some CSP contexts; fail silently.
    console.warn('config.local loader: could not inject supabase-keys.js', e);
  }
})();
