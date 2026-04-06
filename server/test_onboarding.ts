import * as dotenv from 'dotenv';
dotenv.config();

import { LeagueOnboardingService } from './src/application/services/leagueOnboarding.service';
import { SupabaseLeagueMarketRepository } from './src/infrastructure/repositories/SupabaseLeagueMarketRepository';
import { SupabaseRosterRepository } from './src/infrastructure/repositories/SupabaseRosterRepository';
import { supabaseAdmin } from './src/infrastructure/supabase.client';

async function test() {
    const marketRepo = new SupabaseLeagueMarketRepository();
    const leagueRepo = new (require('./src/infrastructure/repositories/SupabaseLeagueRepository').SupabaseLeagueRepository)();
    const service = new LeagueOnboardingService(marketRepo, leagueRepo);

    const { data: leagues } = await supabaseAdmin.from('fantasy_leagues').select('id, admin_id').limit(1);
    const liga = leagues[0];
    
    console.log(`Testing onboarding for league ${liga.id} and user ${liga.admin_id}`);
    
    try {
        await service.assignInitialTeam(liga.id, liga.admin_id);
        console.log("Success!");
    } catch(err) {
        console.error("Failed:", err);
    }
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
