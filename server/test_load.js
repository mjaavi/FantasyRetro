"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const { loadLeaguePlayerData } = require('./dist/infrastructure/repositories/leaguePlayerDataHelper.js');
const dotenv = require("dotenv");
dotenv.config();

async function run() {
   // Assuming league 8 exists
   const data = await loadLeaguePlayerData(8, [184138, 281085, 185644]); 
   console.log('PlayerDataMap:', data);
   process.exit(0);
}
run();
