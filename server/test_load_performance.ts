import { loadLeaguePlayerData } from './src/infrastructure/repositories/leaguePlayerDataHelper';
import * as dotenv from 'dotenv';

dotenv.config();

async function testPerformance() {
    console.log('=== COLD vs WARM LATENCY TEST ===');
    
    const leagueId = 1; 
    const playerIds = [10001, 10002, 10003, 10004, 10005, 10006, 10007, 10008, 10009, 10010, 10011, 10012, 10013, 10014, 10015];
    
    try {
        console.log('1. First call (Cold Start)...');
        const start1 = Date.now();
        await loadLeaguePlayerData(leagueId, playerIds);
        console.log(`- Resolved in ${Date.now() - start1}ms`);

        console.log('\n2. Second call (Warm Start - Cached)...');
        const start2 = Date.now();
        await loadLeaguePlayerData(leagueId, playerIds);
        console.log(`- Resolved in ${Date.now() - start2}ms`);
        
        process.exit(0);
    } catch (e: any) {
        console.error('TEST FAILED:', e);
        process.exit(1);
    }
}

testPerformance();
