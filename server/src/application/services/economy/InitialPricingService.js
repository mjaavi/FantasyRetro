"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialPricingService = void 0;
const economy_constants_1 = require("../../../domain/constants/economy.constants");
const EconomyPriceNormalizer_1 = require("./shared/EconomyPriceNormalizer");
const EconomyInputValidator_1 = require("./shared/EconomyInputValidator");
class InitialPricingService {
    calculate(input) {
        const ovr = (0, EconomyInputValidator_1.assertValidOverallRating)(input.ovr);
        const position = (0, EconomyInputValidator_1.assertValidPlayerPosition)(input.position);
        const positionMultiplier = economy_constants_1.POSITION_PRICE_MULTIPLIERS[position];
        const ovrDelta = ovr - economy_constants_1.INITIAL_PRICING_CONFIG.baseOverallThreshold;
        const rawPrice = Math.pow(ovrDelta, economy_constants_1.INITIAL_PRICING_CONFIG.exponent) *
            economy_constants_1.INITIAL_PRICING_CONFIG.cubicFactorK *
            positionMultiplier;
        const price = (0, EconomyPriceNormalizer_1.normalizeMarketPrice)(rawPrice);
        return { price, rawPrice };
    }
}
exports.InitialPricingService = InitialPricingService;
