// js/supabase-client.js
// Single Supabase client instance — import from here everywhere, never call createClient elsewhere.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm';

// Prefer runtime configuration. For local/dev, create an untracked shared/supabase-keys.js
// that sets window.SUPABASE_URL and window.SUPABASE_KEY before this module loads.
// Example: see shared/supabase-keys.example.js
const SUPABASE_URL = window.SUPABASE_URL || 'https://fscgyzqjjdwfzauzttek.supabase.co';
const SUPABASE_KEY = window.SUPABASE_KEY || ''; // Should be the publishable key (sb_publishable_...)

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
