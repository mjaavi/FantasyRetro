// ─────────────────────────────────────────────────────────────────────────────
// services/scoring/StatisticalCalculator.ts
// Responsabilidad Única: calcular la Fase A (puntuación base estadística).
// ─────────────────────────────────────────────────────────────────────────────

import { SCORING_MATRIX, GOLES_ENCAJADOS_BONUS } from '../../../domain/constants/scoring.constants';
import { PlayerStats, ResultadoPartido } from '../../../domain/models/scoring.models';

export class StatisticalCalculator {

    /**
     * Calcula la puntuación base (Fase A) de un jugador a partir
     * de sus estadísticas en el partido.
     * @returns Puntuación base como número decimal
     */
    calcular(stats: PlayerStats): number {
        const pos = stats.position;
        let puntos = 0;

        // ── Ataque ────────────────────────────────────────────────────────────
        puntos += stats.goles                * SCORING_MATRIX.gol[pos];
        puntos += stats.asistencias          * SCORING_MATRIX.asistencia[pos];
        puntos += stats.tirosAPuerta         * SCORING_MATRIX.tiroAPuerta[pos];
        puntos += stats.tirosAlPalo          * SCORING_MATRIX.tiroAlPalo[pos];
        puntos += stats.centrosAlArea        * SCORING_MATRIX.centroAlArea[pos];
        if (stats.posesionSuperior60)
            puntos += SCORING_MATRIX.posesionSuperior60[pos];

        // ── Defensa ───────────────────────────────────────────────────────────
        puntos += stats.faltasCometidas      * SCORING_MATRIX.faltaCometida[pos];
        puntos += stats.tarjetasAmarillas    * SCORING_MATRIX.tarjetaAmarilla[pos];
        puntos += stats.tarjetasRojas        * SCORING_MATRIX.tarjetaRoja[pos];

        // ── Inferencia ────────────────────────────────────────────────────────
        // Sistema gradual: bonus según goles encajados (0, 1, 2). 3+ = sin bonus.
        const golesKey = Math.min(stats.golesEncajados, 2);
        const bonusTable = GOLES_ENCAJADOS_BONUS[golesKey];
        if (bonusTable) {
            puntos += bonusTable[pos];
        }

        puntos += stats.paradasDeducidas     * SCORING_MATRIX.paradaDeducida[pos];
        puntos += stats.tirosRivalesBloqueados * SCORING_MATRIX.tiroRivalBloqueado[pos];

        // ── Contexto de partido ───────────────────────────────────────────────
        if (stats.resultado === ResultadoPartido.VICTORIA)
            puntos += SCORING_MATRIX.victoria[pos];
        else if (stats.resultado === ResultadoPartido.DERROTA)
            puntos += SCORING_MATRIX.derrota[pos];

        return puntos;
    }
}
