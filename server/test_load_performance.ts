import { loadLeaguePlayerData } from './src/infrastructure/repositories/leaguePlayerDataHelper';
import * as dotenv from 'dotenv';

dotenv.config();

async function testPerformance() {
    console.log('=== DIAGNOSTIC RUN ===');
    
    const leagueId = 1; 
    const playerIds = [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011, 10012, 10013, 10014, 10015];
    
    console.log(`Running test against Supabase database...`);
    const startTime = Date.now();
    
    try {
        const result = await loadLeaguePlayerData(leagueId, playerIds);
        const duration = Date.now() - startTime;
        console.log(`Resolved successfully in ${duration}ms!`);
        console.log(`Result size: ${result.size}`);
        
        const firstPlayer = result.get(playerIds[0]);
        console.log('Sample player:', firstPlayer);
        
        process.exit(0);
    } catch (e: any) {
        console.error('TEST FAILED with error:', e);
        process.exit(1);
    }
}

testPerformance();
