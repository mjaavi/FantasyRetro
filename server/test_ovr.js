"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const dotenv = require("dotenv");
dotenv.config();

const supabase = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const nombres = ['Antoine Griezmann', 'Jese Rodriguez', 'Mathew Ryan'];

async function main() {
    const { data: players, error } = await supabase
        .from('Player')
        .select('player_api_id, player_name')
        .in('player_name', nombres);

    console.log('PLAYERS:', players);
    
    if (players && players.length > 0) {
        const ids = players.map(p => p.player_api_id);
        const { data: attr } = await supabase
           .from('Player_Attributes')
           .select('player_api_id, overall_rating, date')
           .in('player_api_id', ids);
           
        players.forEach(p => {
           const pAttrs = attr.filter(a => a.player_api_id === p.player_api_id);
           console.log(p.player_name + ' attrs: ', pAttrs.slice(0, 3));
        });
    }
}
main();
