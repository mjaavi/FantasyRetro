import { AppError } from '../../../domain/errors/AppError';
import {
    IPlayerMarketValueRepository,
    PlayerGlobalScoreSnapshot,
    PlayerMarketValueWriteModel,
} from '../../../domain/ports/IPlayerMarketValueRepository';
import { InitialPricingService } from './InitialPricingService';
import { MarketFluctuationService } from './MarketFluctuationService';

const MOVING_AVERAGE_WINDOW = 3;

export interface MarketValueRecalculationResult {
    leagueId: number;
    jornada: number;
    playersUpdated: number;
}

export class LeagueMarketValueRecalculationService {
    constructor(
        private readonly repo: IPlayerMarketValueRepository,
        private readonly initialPricingService: InitialPricingService = new InitialPricingService(),
        private readonly fluctuationService: MarketFluctuationService = new MarketFluctuationService(),
    ) {}

    async recalculateAfterRound(leagueId: number, jornada: number): Promise<MarketValueRecalculationResult> {
        if (!Number.isInteger(leagueId) || leagueId <= 0) {
            throw new AppError('ID de liga invalido para recalcular valores de mercado.', 400);
        }

        if (!Number.isInteger(jornada) || jornada < 1 || jornada > 38) {
            throw new AppError('Jornada invalida para recalcular valores de mercado.', 400);
        }

        const scores = await this.repo.findGlobalScoresUntilRound(leagueId, jornada);
        const scoresByPlayer = this.groupScoresByPlayer(scores);
        const playerApiIds = [...scoresByPlayer.keys()];

        if (!playerApiIds.length) {
            return { leagueId, jornada, playersUpdated: 0 };
        }

        const pricingSnapshots = await this.repo.findPricingSnapshots(leagueId, playerApiIds);
        const pricingByPlayer = new Map(pricingSnapshots.map(snapshot => [snapshot.playerApiId, snapshot]));
        const rows: PlayerMarketValueWriteModel[] = [];

        for (const playerApiId of playerApiIds) {
            const pricing = pricingByPlayer.get(playerApiId);
            const playerScores = scoresByPlayer.get(playerApiId);
            if (!pricing || !playerScores?.size) continue;

            const initialPrice = this.initialPricingService.calculate({
                ovr: pricing.overallRating,
                position: pricing.position,
            }).price;
            const firstJornada = Math.min(...playerScores.keys());
            const recalculated = this.recalculatePlayerValue(initialPrice, playerScores, firstJornada, jornada);

            rows.push({
                leagueId,
                playerApiId,
                currentPrice: recalculated.currentPrice,
                previousPrice: recalculated.previousPrice,
                lastVariation: recalculated.lastVariation,
                rawVariation: recalculated.rawVariation,
                movingAveragePoints: recalculated.movingAveragePoints,
                lastJornadaProcessed: jornada,
            });
        }

        await this.repo.upsertMarketValues(rows);
        return { leagueId, jornada, playersUpdated: rows.length };
    }

    private groupScoresByPlayer(scores: PlayerGlobalScoreSnapshot[]): Map<number, Map<number, number>> {
        const grouped = new Map<number, Map<number, number>>();

        for (const score of scores) {
            if (!grouped.has(score.playerApiId)) {
                grouped.set(score.playerApiId, new Map());
            }

            const playerScores = grouped.get(score.playerApiId)!;
            playerScores.set(score.jornada, (playerScores.get(score.jornada) ?? 0) + score.points);
        }

        return grouped;
    }

    private recalculatePlayerValue(
        initialPrice: number,
        scoresByRound: Map<number, number>,
        firstJornada: number,
        targetJornada: number,
    ): {
        currentPrice: number;
        previousPrice: number;
        lastVariation: number;
        rawVariation: number;
        movingAveragePoints: number;
    } {
        let currentPrice = initialPrice;
        let previousPrice = initialPrice;
        let lastVariation = 0;
        let rawVariation = 0;
        let movingAveragePoints = 0;

        for (let jornada = firstJornada; jornada <= targetJornada; jornada++) {
            const windowStart = Math.max(firstJornada, jornada - MOVING_AVERAGE_WINDOW + 1);
            let pointsTotal = 0;

            for (let current = windowStart; current <= jornada; current++) {
                pointsTotal += scoresByRound.get(current) ?? 0;
            }

            movingAveragePoints = pointsTotal / (jornada - windowStart + 1);
            previousPrice = currentPrice;

            const result = this.fluctuationService.calculate({
                currentPrice,
                movingAveragePoints,
            });

            currentPrice = result.newPrice;
            lastVariation = result.variation;
            rawVariation = result.rawVariation;
        }

        return {
            currentPrice,
            previousPrice,
            lastVariation,
            rawVariation,
            movingAveragePoints,
        };
    }
}
