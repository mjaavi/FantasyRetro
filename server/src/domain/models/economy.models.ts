// ─────────────────────────────────────────────────────────────────────────────
// domain/models/economy.models.ts
//
// Modelos del Motor Económico (precio inicial + fluctuación de mercado).
// PlayerPosition se importa desde player.models.ts — no se redefine aquí.
// ─────────────────────────────────────────────────────────────────────────────

import { PlayerPosition } from './player.models';

export { PlayerPosition };

/**
 * Input para calcular el precio inicial de un jugador.
 * Usado por InitialPricingService.
 */
export interface InitialPricingInput {
    readonly ovr:      number;
    readonly position: PlayerPosition;
}

/**
 * Input para recalcular el precio tras una jornada.
 * Usado por MarketFluctuationService.
 */
export interface MarketFluctuationInput {
    readonly currentPrice: number;
    readonly points:       number;
}

/**
 * Resultado del cálculo de precio inicial.
 * rawPrice permite auditar el valor antes del redondeo.
 */
export interface PriceResult {
    readonly price:    number; // precio final redondeado
    readonly rawPrice: number; // precio bruto pre-redondeo
}

/**
 * Resultado de la fluctuación post-jornada.
 * rawVariation permite auditar el % antes del clipping de seguridad.
 */
export interface FluctuationResult {
    readonly newPrice:      number;  // precio final redondeado
    readonly variation:     number;  // % aplicado (después del clip ±8%)
    readonly rawVariation:  number;  // % bruto antes del clip
}