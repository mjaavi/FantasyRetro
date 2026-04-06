"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertValidOverallRating = assertValidOverallRating;
exports.assertValidPlayerPosition = assertValidPlayerPosition;
exports.assertValidCurrentPrice = assertValidCurrentPrice;
exports.assertValidFantasyPoints = assertValidFantasyPoints;
const economy_constants_1 = require("../../../../domain/constants/economy.constants");
const EconomyErrors_1 = require("../../../../domain/errors/EconomyErrors");
function assertValidOverallRating(ovr) {
    if (!Number.isFinite(ovr)) {
        throw new EconomyErrors_1.InvalidOverallRatingError(ovr);
    }
    const normalized = Math.round(ovr);
    if (normalized < economy_constants_1.ECONOMY_ENGINE_LIMITS.minOverall || normalized > economy_constants_1.ECONOMY_ENGINE_LIMITS.maxOverall) {
        throw new EconomyErrors_1.InvalidOverallRatingError(ovr);
    }
    return normalized;
}
function assertValidPlayerPosition(position) {
    if (!(position in economy_constants_1.POSITION_PRICE_MULTIPLIERS)) {
        throw new EconomyErrors_1.InvalidPlayerPositionError(position);
    }
    return position;
}
function assertValidCurrentPrice(currentPrice) {
    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
        throw new EconomyErrors_1.InvalidPriceError(currentPrice);
    }
    return currentPrice;
}
function assertValidFantasyPoints(points) {
    if (!Number.isFinite(points)) {
        throw new EconomyErrors_1.InvalidFantasyPointsError(points);
    }
    return points;
}
