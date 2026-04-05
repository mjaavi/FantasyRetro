import { MARKET_FLUCTUATION_CONFIG } from '../../../domain/constants/economy.constants';
import { FluctuationResult, MarketFluctuationInput } from '../../../domain/models/economy.models';
import { normalizeMarketPrice } from './shared/EconomyPriceNormalizer';
import { assertValidCurrentPrice, assertValidFantasyPoints } from './shared/EconomyInputValidator';

export class MarketFluctuationService {
    calculate(input: MarketFluctuationInput): FluctuationResult {
        const currentPrice = assertValidCurrentPrice(input.currentPrice);
        const points = assertValidFantasyPoints(input.points);

        const rawVariation = (points - MARKET_FLUCTUATION_CONFIG.demandLevel) * MARKET_FLUCTUATION_CONFIG.volatilityFactor;
        const variation = Math.min(
            MARKET_FLUCTUATION_CONFIG.maxVariation,
            Math.max(MARKET_FLUCTUATION_CONFIG.minVariation, rawVariation),
        );

        const rawPrice = currentPrice * (1 + variation);
        const newPrice = normalizeMarketPrice(rawPrice);

        return {
            newPrice,
            variation,
            rawVariation,
        };
    }
}
