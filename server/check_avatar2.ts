import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(url, key);

async function run() {
    console.log('Checking profiles table...');
    const { data, error } = await supabase.from('profiles').select('avatar_url').limit(1);
    
    if (error && error.code === '42703') {
        console.log('avatar_url does not exist. Please run this in SQL Editor:');
        console.log('ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;');
    } else if (error) {
        console.log('Other error:', error);
    } else {
        console.log('avatar_url exists!');
    }
}

run();
