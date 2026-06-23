import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://prgohtemkyxogijpwovh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InByZ29odGVta3l4b2dpanB3b3ZoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIxNzYzNDgsImV4cCI6MjA5Nzc1MjM0OH0.nuCR5svszoT96_GkGpdv5D_-50PeD-_7_4ReCVQD3Ns';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
