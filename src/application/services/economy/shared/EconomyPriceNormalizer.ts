import { ECONOMY_ENGINE_LIMITS } from '../../../../domain/constants/economy.constants';
import { InvalidPriceError } from '../../../../domain/errors/EconomyErrors';

export function normalizeMarketPrice(rawPrice: number): number {
    if (!Number.isFinite(rawPrice)) {
        throw new InvalidPriceError(rawPrice);
    }

    const roundedPrice =
        Math.round(rawPrice / ECONOMY_ENGINE_LIMITS.priceRoundingStep) * ECONOMY_ENGINE_LIMITS.priceRoundingStep;

    return Math.max(ECONOMY_ENGINE_LIMITS.minPrice, roundedPrice);
}
