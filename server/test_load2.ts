import { loadLeaguePlayerData } from './src/infrastructure/repositories/leaguePlayerDataHelper';
import * as dotenv from 'dotenv';
dotenv.config();

async function run() {
    console.log('Testing Griezmann...');
    const data = await loadLeaguePlayerData(1, [184138, 281085, 185644]);
    console.log(data);
}

run();
