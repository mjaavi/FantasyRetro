// ─────────────────────────────────────────────────────────────────────────────
// domain/constants/scoring.constants.ts
// Matriz de puntos de la Fase A y conversión de Picas. Sin números mágicos.
// ─────────────────────────────────────────────────────────────────────────────

import { PlayerPosition } from '../models/player.models';
import { Picas } from '../models/scoring.models';

/** Puntos por acción según posición — Fase A */
export const SCORING_MATRIX: Record<string, Record<PlayerPosition, number>> = {
    gol: {
        [PlayerPosition.PT]: 6,
        [PlayerPosition.DF]: 5,
        [PlayerPosition.MC]: 4,
        [PlayerPosition.DL]: 3,
    },
    asistencia: {
        [PlayerPosition.PT]: 2,
        [PlayerPosition.DF]: 2,
        [PlayerPosition.MC]: 2,
        [PlayerPosition.DL]: 2,
    },
    tiroAPuerta: {
        [PlayerPosition.PT]: 0.5,
        [PlayerPosition.DF]: 0.5,
        [PlayerPosition.MC]: 0.5,
        [PlayerPosition.DL]: 0.5,
    },
    tiroAlPalo: {
        [PlayerPosition.PT]: 1,
        [PlayerPosition.DF]: 1,
        [PlayerPosition.MC]: 1,
        [PlayerPosition.DL]: 1,
    },
    centroAlArea: {
        [PlayerPosition.PT]: 0,
        [PlayerPosition.DF]: 0.5,
        [PlayerPosition.MC]: 0.5,
        [PlayerPosition.DL]: 0,
    },
    posesionSuperior60: {
        [PlayerPosition.PT]: 0,
        [PlayerPosition.DF]: 0,
        [PlayerPosition.MC]: 1,
        [PlayerPosition.DL]: 0,
    },
    faltaCometida: {
        [PlayerPosition.PT]: -0.2,
        [PlayerPosition.DF]: -0.2,
        [PlayerPosition.MC]: -0.2,
        [PlayerPosition.DL]: -0.2,
    },
    tarjetaAmarilla: {
        [PlayerPosition.PT]: -1,
        [PlayerPosition.DF]: -1,
        [PlayerPosition.MC]: -1,
        [PlayerPosition.DL]: -1,
    },
    tarjetaRoja: {
        [PlayerPosition.PT]: -3,
        [PlayerPosition.DF]: -3,
        [PlayerPosition.MC]: -3,
        [PlayerPosition.DL]: -3,
    },
    porteriaCero: {
        [PlayerPosition.PT]: 4,
        [PlayerPosition.DF]: 3,
        [PlayerPosition.MC]: 0,
        [PlayerPosition.DL]: 0,
    },
    paradaDeducida: {
        [PlayerPosition.PT]: 0.5,
        [PlayerPosition.DF]: 0,
        [PlayerPosition.MC]: 0,
        [PlayerPosition.DL]: 0,
    },
    tiroRivalBloqueado: {
        [PlayerPosition.PT]: 0,
        [PlayerPosition.DF]: 0.5,
        [PlayerPosition.MC]: 0,
        [PlayerPosition.DL]: 0,
    },
    victoria: {
        [PlayerPosition.PT]: 1,
        [PlayerPosition.DF]: 1,
        [PlayerPosition.MC]: 1,
        [PlayerPosition.DL]: 1,
    },
    derrota: {
        [PlayerPosition.PT]: -1,
        [PlayerPosition.DF]: -1,
        [PlayerPosition.MC]: -1,
        [PlayerPosition.DL]: -1,
    },
};

/** Conversión de Picas a puntos adicionales — Fase B */
export const PICAS_A_PUNTOS: Record<Picas, number> = {
    [Picas.NEG]: -3,
    [Picas.SC]:   0,
    [Picas.P1]:   1,
    [Picas.P2]:   4,
    [Picas.P3]:   8,
    [Picas.P4]:  12,
};
