"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InitialPricingService = void 0;
var economy_constants_1 = require("../../../domain/constants/economy.constants");
var EconomyPriceNormalizer_1 = require("./shared/EconomyPriceNormalizer");
var EconomyInputValidator_1 = require("./shared/EconomyInputValidator");
var InitialPricingService = /** @class */ (function () {
    function InitialPricingService() {
    }
    InitialPricingService.prototype.calculate = function (input) {
        var ovr = (0, EconomyInputValidator_1.assertValidOverallRating)(input.ovr);
        var position = (0, EconomyInputValidator_1.assertValidPlayerPosition)(input.position);
        var positionMultiplier = economy_constants_1.POSITION_PRICE_MULTIPLIERS[position];
        var ovrDelta = ovr - economy_constants_1.INITIAL_PRICING_CONFIG.baseOverallThreshold;
        var rawPrice = Math.pow(ovrDelta, economy_constants_1.INITIAL_PRICING_CONFIG.exponent) *
            economy_constants_1.INITIAL_PRICING_CONFIG.cubicFactorK *
            positionMultiplier;
        var price = (0, EconomyPriceNormalizer_1.normalizeMarketPrice)(rawPrice);
        return { price: price, rawPrice: rawPrice };
    };
    return InitialPricingService;
}());
exports.InitialPricingService = InitialPricingService;
