// ─────────────────────────────────────────────────────────────────────────────
// services/scoring/StatisticalCalculator.ts
// Responsabilidad Única: calcular la Fase A (puntuación base estadística).
// ─────────────────────────────────────────────────────────────────────────────

import { SCORING_MATRIX } from '../../../domain/constants/scoring.constants';
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
        if (stats.porteriaACero)
            puntos += SCORING_MATRIX.porteriaCero[pos];
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
