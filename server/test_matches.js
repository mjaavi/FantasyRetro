"use strict";
// test_matches.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: leagues, error } = await supabaseAdmin.from('fantasy_leagues').select('*').order('id', {ascending: false}).limit(1);
    if(error) { console.error("Error leagues:", error); return process.exit(1); }
    const liga = leagues[0];
    console.log('Liga:', liga);
    
    // check how many players in matches
    const {data: matches, error: mError} = await supabaseAdmin.from('Match').select('home_player_1, home_player_2, home_player_3, home_player_4, away_player_1, away_player_2, away_player_3, away_player_4').eq('league_id', liga.kaggle_league_id).eq('season', liga.season).limit(200);
    if(mError) { console.error("Error matches:", mError); return process.exit(1); }
    console.log('Matches fetched:', matches?.length);

    process.exit(0);
}
check();
