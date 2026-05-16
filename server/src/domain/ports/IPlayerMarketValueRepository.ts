import { PlayerPosition } from '../models/player.models';

export interface PlayerMarketValueSnapshot {
    leagueId: number;
    playerApiId: number;
    currentPrice: number;
    previousPrice: number;
    lastVariation: number;
    rawVariation: number;
    movingAveragePoints: number;
    lastJornadaProcessed: number;
    updatedAt: string | null;
}

export interface PlayerMarketValueWriteModel {
    leagueId: number;
    playerApiId: number;
    currentPrice: number;
    previousPrice: number;
    lastVariation: number;
    rawVariation: number;
    movingAveragePoints: number;
    lastJornadaProcessed: number;
}

export interface MarketTrend {
    playerApiId: number;
    playerName: string;
    clubLogoUrl: string | null;
    currentPrice: number;
    rawVariation: number;
}

export interface PlayerGlobalScoreSnapshot {
    playerApiId: number;
    jornada: number;
    points: number;
}

export interface PlayerPricingSnapshot {
    playerApiId: number;
    position: PlayerPosition;
    overallRating: number;
}

export interface IPlayerMarketValueRepository {
    findMarketValues(leagueId: number, playerApiIds: number[]): Promise<PlayerMarketValueSnapshot[]>;
    findGlobalScoresUntilRound(leagueId: number, jornada: number): Promise<PlayerGlobalScoreSnapshot[]>;
    findPricingSnapshots(leagueId: number, playerApiIds: number[]): Promise<PlayerPricingSnapshot[]>;
    upsertMarketValues(rows: PlayerMarketValueWriteModel[]): Promise<void>;
    getTopMarketVariations(leagueId: number, limit: number): Promise<{ risers: MarketTrend[]; fallers: MarketTrend[] }>;
}
