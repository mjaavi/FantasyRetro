import { AppError } from './AppError';

export class EconomyError extends AppError {
    constructor(message: string, code: string, details?: unknown) {
        super(message, { statusCode: 400, code, details });
    }
}

export class InvalidOverallRatingError extends EconomyError {
    constructor(ovr: number) {
        super('El overall del jugador esta fuera del rango permitido.', 'INVALID_OVERALL_RATING', { ovr });
    }
}

export class InvalidPriceError extends EconomyError {
    constructor(price: number) {
        super('El precio del jugador es invalido para el motor economico.', 'INVALID_MARKET_PRICE', { price });
    }
}

export class InvalidFantasyPointsError extends EconomyError {
    constructor(points: number) {
        super('La puntuacion fantasy es invalida para recalcular el mercado.', 'INVALID_FANTASY_POINTS', { points });
    }
}

export class InvalidPlayerPositionError extends EconomyError {
    constructor(position: unknown) {
        super('La posicion del jugador es invalida para el motor economico.', 'INVALID_PLAYER_POSITION', { position });
    }
}
