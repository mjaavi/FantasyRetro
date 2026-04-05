import { LeagueMarketPlayer, LeagueMarketPlayerSnapshot } from '../../../domain/ports/ILeagueMarketRepository';
import { InitialPricingService } from './InitialPricingService';

export class LeagueMarketValueProjector {
    constructor(
        private readonly initialPricingService: InitialPricingService = new InitialPricingService(),
    ) {}

    projectPlayers(players: LeagueMarketPlayerSnapshot[]): LeagueMarketPlayer[] {
        return players.map((player) => {
            const valuation = this.initialPricingService.calculate({
                ovr: player.overallRating,
                position: player.position,
            });

            return {
                ...player,
                marketValue: valuation.price,
            };
        });
    }
}
