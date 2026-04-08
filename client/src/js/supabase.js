import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { getEnv } from './env.js';

const env = await getEnv();

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
