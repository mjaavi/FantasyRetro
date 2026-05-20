import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL || '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || '';
const supabase = createClient(url, key);

async function run() {
    console.log('Creating avatars bucket...');
    const { data, error } = await supabase.storage.createBucket('avatars', {
        public: true,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif'],
        fileSizeLimit: 5242880 // 5MB
    });
    
    if (error) {
        console.error('Error creating bucket:', error);
    } else {
        console.log('Bucket created:', data);
    }
}
run();
