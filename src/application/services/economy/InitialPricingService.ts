import { INITIAL_PRICING_CONFIG, POSITION_PRICE_MULTIPLIERS } from '../../../domain/constants/economy.constants';
import { InitialPricingInput, PriceResult } from '../../../domain/models/economy.models';
import { normalizeMarketPrice } from './shared/EconomyPriceNormalizer';
import { assertValidOverallRating, assertValidPlayerPosition } from './shared/EconomyInputValidator';

export class InitialPricingService {
    calculate(input: InitialPricingInput): PriceResult {
        const ovr = assertValidOverallRating(input.ovr);
        const position = assertValidPlayerPosition(input.position);
        const positionMultiplier = POSITION_PRICE_MULTIPLIERS[position];
        const ovrDelta = ovr - INITIAL_PRICING_CONFIG.baseOverallThreshold;

        const rawPrice =
            Math.pow(ovrDelta, INITIAL_PRICING_CONFIG.exponent) *
            INITIAL_PRICING_CONFIG.cubicFactorK *
            positionMultiplier;

        const price = normalizeMarketPrice(rawPrice);

        return { price, rawPrice };
    }
}
