// ─────────────────────────────────────────────────────────────────────────────
// domain/models/scoring.models.ts
//
// Modelos del Motor de Puntuación (Fase A + Fase B).
// PlayerPosition se importa desde player.models.ts — no se redefine aquí.
// ─────────────────────────────────────────────────────────────────────────────

import { PlayerPosition } from './player.models';

export { PlayerPosition };

/**
 * Resultado del partido para el equipo del jugador.
 */
export enum ResultadoPartido {
    VICTORIA = 'victoria',
    EMPATE   = 'empate',
    DERROTA  = 'derrota',
}

/**
 * Tipo de cronista virtual asignado a un partido (Fase B).
 */
export enum CronistaType {
    ANALITICO = 'analitico',
    EXIGENTE  = 'exigente',
    PASIONAL  = 'pasional',
}

/**
 * Modificador del cronista tras evaluar la puntuación base.
 * NEG = Negativo, SC = Sin Calificar, P1..P4 = 1 a 4 Picas.
 */
export enum Picas {
    NEG = 'NEG',
    SC  = 'SC',
    P1  = 'P1',
    P2  = 'P2',
    P3  = 'P3',
    P4  = 'P4',
}

/**
 * Estadísticas brutas de un jugador en un partido concreto.
 * Producidas por DatasetParser a partir de los XMLs del dataset Kaggle.
 */
export interface PlayerStats {
    playerApiId:            number;
    position:               PlayerPosition;

    // ── Ataque ────────────────────────────────────────────────────────────────
    goles:                  number;
    asistencias:            number;
    tirosAPuerta:           number;
    tirosAlPalo:            number;
    centrosAlArea:          number;
    posesionSuperior60:     boolean;

    // ── Defensa ───────────────────────────────────────────────────────────────
    faltasCometidas:        number;
    tarjetasAmarillas:      number;
    tarjetasRojas:          number;

    // ── Inferencia (calculadas a partir del partido) ───────────────────────
    porteriaACero:          boolean;
    paradasDeducidas:       number;
    tirosRivalesBloqueados: number;

    // ── Contexto ──────────────────────────────────────────────────────────────
    resultado:              ResultadoPartido;
}

/**
 * Desglose completo de la puntuación de un jugador en un partido.
 * Resultado final del ScoringEngine (Fase A + Fase B).
 */
export interface ScoreBreakdown {
    readonly playerApiId:    number;
    readonly puntosBase:     number;
    readonly picas:          Picas;
    readonly puntosCronista: number;
    readonly totalPuntos:    number;
    readonly cronistaType:   CronistaType;
}
