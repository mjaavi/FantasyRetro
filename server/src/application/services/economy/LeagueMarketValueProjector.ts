import { LeagueMarketPlayer, LeagueMarketPlayerSnapshot } from '../../../domain/ports/ILeagueMarketRepository';
import { PlayerMarketValueSnapshot } from '../../../domain/ports/IPlayerMarketValueRepository';
import { InitialPricingService } from './InitialPricingService';

export class LeagueMarketValueProjector {
    constructor(
        private readonly initialPricingService: InitialPricingService = new InitialPricingService(),
    ) {}

    projectPlayers(
        players: LeagueMarketPlayerSnapshot[],
        marketValues: ReadonlyMap<number, PlayerMarketValueSnapshot> = new Map(),
    ): LeagueMarketPlayer[] {
        return players.map((player) => {
            const valuation = this.initialPricingService.calculate({
                ovr: player.overallRating,
                position: player.position,
            });
            const storedValue = marketValues.get(player.playerApiId);
            const marketValue = storedValue?.currentPrice ?? valuation.price;
            const previousMarketValue = storedValue?.previousPrice ?? null;
            const marketValueDelta = previousMarketValue === null ? 0 : marketValue - previousMarketValue;

            return {
                ...player,
                marketValue,
                previousMarketValue,
                marketValueDelta,
                marketValueChangePct: previousMarketValue && previousMarketValue > 0
                    ? marketValueDelta / previousMarketValue
                    : 0,
                lastAveragePoints: storedValue?.movingAveragePoints ?? null,
                lastJornadaProcessed: storedValue?.lastJornadaProcessed ?? null,
            };
        });
    }
}
