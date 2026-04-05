import { InitialPricingService } from './economy/InitialPricingService';
import { ISeedRepository } from '../../domain/ports/ISeedRepository';
import { SupabaseSeedRepository } from '../../infrastructure/repositories/SupabaseSeedRepository';
import { AppError } from '../../domain/errors/AppError';
import { PlayerPosition } from '../../domain/models/player.models';

export class SeedService {
    constructor(
        private readonly repo: ISeedRepository = new SupabaseSeedRepository(),
        private readonly pricingService: InitialPricingService = new InitialPricingService(),
    ) {}

    async seedMarketPlayers(limit = 100): Promise<{ inserted: number }> {
        const kagglePlayers = await this.repo.fetchKagglePlayers(limit);
        if (!kagglePlayers.length) {
            throw new AppError('No se encontraron jugadores en el dataset.', 404);
        }

        const marketPlayers = kagglePlayers.map(player => {
            const position = this.inferirPosicion(player);
            const pricing = this.pricingService.calculate({
                ovr: player.overall_rating ?? 50,
                position,
            });

            return {
                name: player.player_name,
                position,
                real_team: 'Sin equipo',
                market_value: pricing.price,
            };
        });

        await this.repo.clearMarketPlayers();
        const inserted = await this.repo.insertMarketPlayers(marketPlayers);

        return { inserted };
    }

    private inferirPosicion(player: {
        gk_diving?: number;
        gk_reflexes?: number;
        attacking_work_rate?: string;
        defensive_work_rate?: string;
    }): PlayerPosition {
        if ((player.gk_diving ?? 0) > 60 || (player.gk_reflexes ?? 0) > 60) return PlayerPosition.PT;
        if (player.attacking_work_rate === 'high' && player.defensive_work_rate === 'low') return PlayerPosition.DL;
        if (player.attacking_work_rate === 'low' && player.defensive_work_rate === 'high') return PlayerPosition.DF;
        return PlayerPosition.MC;
    }
}
