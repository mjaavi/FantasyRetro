import dotenv from 'dotenv';
dotenv.config();
import { supabaseAdmin } from './src/infrastructure/supabase.client.js';

async function checkAndAddAvatarUrl() {
    console.log('Checking profiles schema...');
    
    // Test if we can select avatar_url
    const { error: selectError } = await supabaseAdmin
        .from('profiles')
        .select('avatar_url')
        .limit(1);

    if (selectError && selectError.code === '42703') { // column does not exist
        console.log('avatar_url column does not exist. Attempting to add via RPC if possible or via raw query.');
        // We can't easily alter table without Postgres connection, 
        // but let's log the error to be sure.
        console.error('Error selecting avatar_url:', selectError.message);
    } else if (selectError) {
        console.error('Other error:', selectError.message);
    } else {
        console.log('avatar_url column already exists!');
    }
}

checkAndAddAvatarUrl().catch(console.error);
