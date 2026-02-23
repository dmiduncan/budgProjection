// js/supabase-client.js
// Single Supabase client instance — import from here everywhere.

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.86.0/+esm';

const supabaseUrl = 'https://ljisujkxmbijleyhmxab.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxqaXN1amt4bWJpamxleWhteGFiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ1MzMyOTYsImV4cCI6MjA3MDEwOTI5Nn0.9CbNfvI5VlUUQ4bbHd18pGR9ft-tHz2FLKAF_4yQJsg';

export const supabase = createClient(supabaseUrl, supabaseKey);
