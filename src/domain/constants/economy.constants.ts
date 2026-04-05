import { PlayerPosition } from '../models/player.models';

export const ECONOMY_ENGINE_LIMITS = Object.freeze({
    minOverall: 1,
    maxOverall: 99,
    minPrice: 500_000,
    priceRoundingStep: 100_000,
});

export const INITIAL_PRICING_CONFIG = Object.freeze({
    baseOverallThreshold: 50,
    cubicFactorK: 2_000,
    exponent: 3,
});

export const POSITION_PRICE_MULTIPLIERS: Readonly<Record<PlayerPosition, number>> = Object.freeze({
    [PlayerPosition.PT]: 0.7,
    [PlayerPosition.DF]: 0.8,
    [PlayerPosition.MC]: 1.0,
    [PlayerPosition.DL]: 1.2,
});

export const MARKET_FLUCTUATION_CONFIG = Object.freeze({
    demandLevel: 4,
    volatilityFactor: 0.01,
    minVariation: -0.08,
    maxVariation: 0.08,
});
