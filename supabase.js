import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://azddbdhnriqagvoyooqs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF6ZGRiZGhucmlxYWd2b3lvb3FzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1NzY1MTYsImV4cCI6MjA4ODE1MjUxNn0.3yBQRm2HpzBE6tr1sXngSHJSrDdF-ZexpckDL_Xj_kU';

export const supabase = createClient(supabaseUrl, supabaseKey);
