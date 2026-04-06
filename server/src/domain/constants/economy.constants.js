"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MARKET_FLUCTUATION_CONFIG = exports.POSITION_PRICE_MULTIPLIERS = exports.INITIAL_PRICING_CONFIG = exports.ECONOMY_ENGINE_LIMITS = void 0;
var player_models_1 = require("../models/player.models");
exports.ECONOMY_ENGINE_LIMITS = Object.freeze({
    minOverall: 1,
    maxOverall: 99,
    minPrice: 500000,
    priceRoundingStep: 100000,
});
exports.INITIAL_PRICING_CONFIG = Object.freeze({
    baseOverallThreshold: 50,
    cubicFactorK: 2000,
    exponent: 3,
});
exports.POSITION_PRICE_MULTIPLIERS = Object.freeze((_a = {},
    _a[player_models_1.PlayerPosition.PT] = 0.7,
    _a[player_models_1.PlayerPosition.DF] = 0.8,
    _a[player_models_1.PlayerPosition.MC] = 1.0,
    _a[player_models_1.PlayerPosition.DL] = 1.2,
    _a));
exports.MARKET_FLUCTUATION_CONFIG = Object.freeze({
    demandLevel: 4,
    volatilityFactor: 0.01,
    minVariation: -0.08,
    maxVariation: 0.08,
});
