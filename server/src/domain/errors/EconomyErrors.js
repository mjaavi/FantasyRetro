"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvalidPlayerPositionError = exports.InvalidFantasyPointsError = exports.InvalidPriceError = exports.InvalidOverallRatingError = exports.EconomyError = void 0;
var AppError_1 = require("./AppError");
var EconomyError = /** @class */ (function (_super) {
    __extends(EconomyError, _super);
    function EconomyError(message, code, details) {
        return _super.call(this, message, { statusCode: 400, code: code, details: details }) || this;
    }
    return EconomyError;
}(AppError_1.AppError));
exports.EconomyError = EconomyError;
var InvalidOverallRatingError = /** @class */ (function (_super) {
    __extends(InvalidOverallRatingError, _super);
    function InvalidOverallRatingError(ovr) {
        return _super.call(this, 'El overall del jugador esta fuera del rango permitido.', 'INVALID_OVERALL_RATING', { ovr: ovr }) || this;
    }
    return InvalidOverallRatingError;
}(EconomyError));
exports.InvalidOverallRatingError = InvalidOverallRatingError;
var InvalidPriceError = /** @class */ (function (_super) {
    __extends(InvalidPriceError, _super);
    function InvalidPriceError(price) {
        return _super.call(this, 'El precio del jugador es invalido para el motor economico.', 'INVALID_MARKET_PRICE', { price: price }) || this;
    }
    return InvalidPriceError;
}(EconomyError));
exports.InvalidPriceError = InvalidPriceError;
var InvalidFantasyPointsError = /** @class */ (function (_super) {
    __extends(InvalidFantasyPointsError, _super);
    function InvalidFantasyPointsError(points) {
        return _super.call(this, 'La puntuacion fantasy es invalida para recalcular el mercado.', 'INVALID_FANTASY_POINTS', { points: points }) || this;
    }
    return InvalidFantasyPointsError;
}(EconomyError));
exports.InvalidFantasyPointsError = InvalidFantasyPointsError;
var InvalidPlayerPositionError = /** @class */ (function (_super) {
    __extends(InvalidPlayerPositionError, _super);
    function InvalidPlayerPositionError(position) {
        return _super.call(this, 'La posicion del jugador es invalida para el motor economico.', 'INVALID_PLAYER_POSITION', { position: position }) || this;
    }
    return InvalidPlayerPositionError;
}(EconomyError));
exports.InvalidPlayerPositionError = InvalidPlayerPositionError;
