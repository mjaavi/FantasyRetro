"use strict";
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data: leagues } = await supabaseAdmin.from('fantasy_leagues').select('*').order('id', {ascending: false}).limit(1);
    const liga = leagues[0];
    
    // check how many players in matches
    const {data: matches} = await supabaseAdmin.from('Match').select('home_player_1, home_player_2, home_player_3, home_player_4, away_player_1, away_player_2, away_player_3, away_player_4').eq('league_id', liga.kaggle_league_id).eq('season', liga.season).limit(200);
    
    let playerIds = new Set();
    Object.values(matches).forEach(m => {
        Object.values(m).forEach(id => {
            if(id) playerIds.add(id);
        })
    });
    const ids = Array.from(playerIds);
    console.log('Total players:', ids.length);
    
    let PT=0, DF=0, MC=0, DL=0, Fails=0;
    
    // we'll simulate inferirPosicionesDesdeMatch concurrently
    const promises = ids.map(async (playerId) => {
        const { data, error } = await supabaseAdmin
            .rpc('get_player_avg_y', { p_player_id: playerId });

        if (error) {
            Fails++;
            MC++;
        } else if (data === null || data === undefined) {
            MC++;
        } else {
            const y = Number(data);
            if (y <= 1.5)             PT++;
            else if (y >= 2 && y <= 4.5)   DF++;
            else if (y >= 4.5 && y <= 8.5) MC++;
            else DL++;
        }
    });

    await Promise.all(promises);
    console.log({PT, DF, MC, DL, Fails});
    process.exit(0);
}
check();
