// js/supabase-client.js
// Single Supabase client instance — import from here everywhere, never call createClient elsewhere.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm';

const supabaseUrl = 'https://fscgyzqjjdwfzauzttek.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzY2d5enFqamR3ZnphdXp0dGVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NDE0NjYsImV4cCI6MjA4MzMxNzQ2Nn0.lKwSixf1KK6RWSZvZvHb-BSpQx2pZirkUKIBGpGsf6s';

export const supabase = createClient(supabaseUrl, supabaseKey);
