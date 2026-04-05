import { ECONOMY_ENGINE_LIMITS, POSITION_PRICE_MULTIPLIERS } from '../../../../domain/constants/economy.constants';
import {
    InvalidFantasyPointsError,
    InvalidOverallRatingError,
    InvalidPlayerPositionError,
    InvalidPriceError,
} from '../../../../domain/errors/EconomyErrors';
import { PlayerPosition } from '../../../../domain/models/player.models';

export function assertValidOverallRating(ovr: number): number {
    if (!Number.isFinite(ovr)) {
        throw new InvalidOverallRatingError(ovr);
    }

    const normalized = Math.round(ovr);
    if (normalized < ECONOMY_ENGINE_LIMITS.minOverall || normalized > ECONOMY_ENGINE_LIMITS.maxOverall) {
        throw new InvalidOverallRatingError(ovr);
    }

    return normalized;
}

export function assertValidPlayerPosition(position: PlayerPosition): PlayerPosition {
    if (!(position in POSITION_PRICE_MULTIPLIERS)) {
        throw new InvalidPlayerPositionError(position);
    }

    return position;
}

export function assertValidCurrentPrice(currentPrice: number): number {
    if (!Number.isFinite(currentPrice) || currentPrice < 0) {
        throw new InvalidPriceError(currentPrice);
    }

    return currentPrice;
}

export function assertValidFantasyPoints(points: number): number {
    if (!Number.isFinite(points)) {
        throw new InvalidFantasyPointsError(points);
    }

    return points;
}
