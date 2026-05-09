// ─────────────────────────────────────────────────────────────────────────────
// application/services/economy/PlayerMarketValueHistoryService.ts
//
// Responsabilidad única: reconstruir la evolución histórica del precio de
// mercado de un jugador a partir de sus puntuaciones globales por jornada.
//
// Reutiliza InitialPricingService y MarketFluctuationService para calcular
// cada paso, aplicando DRY respecto a LeagueMarketValueRecalculationService.
// ─────────────────────────────────────────────────────────────────────────────

import { IPlayerMarketValueRepository, PlayerGlobalScoreSnapshot } from '../../../domain/ports/IPlayerMarketValueRepository';
import { InitialPricingService } from './InitialPricingService';
import { MarketFluctuationService } from './MarketFluctuationService';

const MOVING_AVERAGE_WINDOW = 3;

export interface MarketValueHistoryPoint {
    readonly jornada: number;
    readonly price:   number;
}

export interface PlayerMarketValueHistoryResult {
    readonly playerApiId:   number;
    readonly leagueId:      number;
    readonly initialPrice:  number;
    readonly currentPrice:  number;
    readonly history:       MarketValueHistoryPoint[];
}

export class PlayerMarketValueHistoryService {
    constructor(
        private readonly repo: IPlayerMarketValueRepository,
        private readonly initialPricingService: InitialPricingService = new InitialPricingService(),
        private readonly fluctuationService: MarketFluctuationService = new MarketFluctuationService(),
    ) {}

    async getHistory(
        leagueId: number,
        playerApiId: number,
        jornadaActual: number,
    ): Promise<PlayerMarketValueHistoryResult> {
        const [scores, pricingSnapshots] = await Promise.all([
            this.repo.findGlobalScoresUntilRound(leagueId, jornadaActual),
            this.repo.findPricingSnapshots(leagueId, [playerApiId]),
        ]);

        const pricing = pricingSnapshots.find(s => s.playerApiId === playerApiId);
        const initialPrice = pricing
            ? this.initialPricingService.calculate({ ovr: pricing.overallRating, position: pricing.position }).price
            : 0;

        const playerScores = this.groupPlayerScores(scores, playerApiId);
        const history = this.buildPriceTimeline(initialPrice, playerScores, jornadaActual);

        const currentPrice = history.length > 0
            ? history[history.length - 1].price
            : initialPrice;

        return {
            playerApiId,
            leagueId,
            initialPrice,
            currentPrice,
            history,
        };
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private groupPlayerScores(
        allScores: PlayerGlobalScoreSnapshot[],
        playerApiId: number,
    ): Map<number, number> {
        const scoresByRound = new Map<number, number>();

        for (const score of allScores) {
            if (score.playerApiId !== playerApiId) continue;
            scoresByRound.set(
                score.jornada,
                (scoresByRound.get(score.jornada) ?? 0) + score.points,
            );
        }

        return scoresByRound;
    }

    private buildPriceTimeline(
        initialPrice: number,
        scoresByRound: Map<number, number>,
        jornadaActual: number,
    ): MarketValueHistoryPoint[] {
        if (!scoresByRound.size || initialPrice <= 0) return [];

        const firstJornada = Math.min(...scoresByRound.keys());
        const timeline: MarketValueHistoryPoint[] = [];
        let currentPrice = initialPrice;

        // Incluir el punto de partida (precio inicial antes de fluctuaciones)
        timeline.push({ jornada: 0, price: initialPrice });

        for (let jornada = firstJornada; jornada <= jornadaActual; jornada++) {
            const windowStart = Math.max(firstJornada, jornada - MOVING_AVERAGE_WINDOW + 1);
            let pointsTotal = 0;

            for (let current = windowStart; current <= jornada; current++) {
                pointsTotal += scoresByRound.get(current) ?? 0;
            }

            const movingAveragePoints = pointsTotal / (jornada - windowStart + 1);
            const result = this.fluctuationService.calculate({
                currentPrice,
                movingAveragePoints,
            });

            currentPrice = result.newPrice;
            timeline.push({ jornada, price: currentPrice });
        }

        return timeline;
    }
}
