"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeMarketPrice = normalizeMarketPrice;
const economy_constants_1 = require("../../../../domain/constants/economy.constants");
const EconomyErrors_1 = require("../../../../domain/errors/EconomyErrors");
function normalizeMarketPrice(rawPrice) {
    if (!Number.isFinite(rawPrice)) {
        throw new EconomyErrors_1.InvalidPriceError(rawPrice);
    }
    const roundedPrice = Math.round(rawPrice / economy_constants_1.ECONOMY_ENGINE_LIMITS.priceRoundingStep) * economy_constants_1.ECONOMY_ENGINE_LIMITS.priceRoundingStep;
    return Math.max(economy_constants_1.ECONOMY_ENGINE_LIMITS.minPrice, roundedPrice);
}
