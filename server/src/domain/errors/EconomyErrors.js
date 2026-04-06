"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidPlayerPositionError = exports.InvalidFantasyPointsError = exports.InvalidPriceError = exports.InvalidOverallRatingError = exports.EconomyError = void 0;
const AppError_1 = require("./AppError");
class EconomyError extends AppError_1.AppError {
    constructor(message, code, details) {
        super(message, { statusCode: 400, code, details });
    }
}
exports.EconomyError = EconomyError;
class InvalidOverallRatingError extends EconomyError {
    constructor(ovr) {
        super('El overall del jugador esta fuera del rango permitido.', 'INVALID_OVERALL_RATING', { ovr });
    }
}
exports.InvalidOverallRatingError = InvalidOverallRatingError;
class InvalidPriceError extends EconomyError {
    constructor(price) {
        super('El precio del jugador es invalido para el motor economico.', 'INVALID_MARKET_PRICE', { price });
    }
}
exports.InvalidPriceError = InvalidPriceError;
class InvalidFantasyPointsError extends EconomyError {
    constructor(points) {
        super('La puntuacion fantasy es invalida para recalcular el mercado.', 'INVALID_FANTASY_POINTS', { points });
    }
}
exports.InvalidFantasyPointsError = InvalidFantasyPointsError;
class InvalidPlayerPositionError extends EconomyError {
    constructor(position) {
        super('La posicion del jugador es invalida para el motor economico.', 'INVALID_PLAYER_POSITION', { position });
    }
}
exports.InvalidPlayerPositionError = InvalidPlayerPositionError;
