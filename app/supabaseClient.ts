import { createClient } from '@supabase/supabase-js';

// These are safe to have in client-side code - the anon/publishable key is
// designed to be public. Access to the shipping_addresses table is controlled
// by the Row Level Security policy set on the table in Supabase itself, not by
// keeping this key secret.
const supabaseUrl = 'https://vhorvjuagjzpklrdmsmf.supabase.co';
const supabaseAnonKey = 'sb_publishable_B7KLuSeuErHEXo8PdWx0Kw_UsRGq_wQ';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
