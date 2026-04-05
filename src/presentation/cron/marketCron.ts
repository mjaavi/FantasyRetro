// infrastructure/cron/marketCron.ts
// Responsabilidad única: programar el ciclo del mercado diario.

import cron from 'node-cron';
import { LeagueMarketService } from '../../application/services/leagueMarket.service';

const MARKET_CRON_SCHEDULE = process.env.MARKET_CRON_SCHEDULE ?? '0 * * * *';

export class MarketCron {
    constructor(private readonly leagueMarketService: LeagueMarketService) {}

    iniciar(): void {
        if (!cron.validate(MARKET_CRON_SCHEDULE)) {
            console.error(`[Cron] Schedule inválido: "${MARKET_CRON_SCHEDULE}"`);
            return;
        }
        cron.schedule(MARKET_CRON_SCHEDULE, async () => {
            console.log(`[Cron] Procesando mercados expirados — ${new Date().toISOString()}`);
            try {
                await this.leagueMarketService.processExpiredMarkets();
            } catch (err) {
                console.error('[Cron] Error:', (err as Error).message);
            }
        });
        console.log(`[Cron] Mercado programado: "${MARKET_CRON_SCHEDULE}"`);
    }
}