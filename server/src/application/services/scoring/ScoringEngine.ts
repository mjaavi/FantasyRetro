// ─────────────────────────────────────────────────────────────────────────────
// services/scoring/ScoringEngine.ts
// Orquestador principal del motor: ejecuta Fase A + Fase B por jugador.
// ─────────────────────────────────────────────────────────────────────────────

import { PICAS_A_PUNTOS } from '../../../domain/constants/scoring.constants';
import { PlayerStats, ScoreBreakdown } from '../../../domain/models/scoring.models';
import { StatisticalCalculator }       from './StatisticalCalculator';
import { CronistaFactory }             from './CronistaFactory';
import { ICronistaStrategy }           from './strategies/ICronistaStrategy';

export class ScoringEngine {
    private readonly calculator = new StatisticalCalculator();

    /**
     * Calcula la puntuación completa de un jugador en un partido.
     * El cronista se pasa desde fuera para que sea el mismo para todos
     * los jugadores del mismo partido (sorteo único por partido).
     *
     * @param stats    - Estadísticas del jugador en el partido
     * @param cronista - Cronista sorteado para este partido
     */
    calcularJugador(stats: PlayerStats, cronista: ICronistaStrategy): ScoreBreakdown {
        // Fase A: puntuación estadística base
        const puntosBase = this.calculator.calcular(stats);

        // Fase B: modificador del cronista
        const picas          = cronista.calcularPicas(puntosBase);
        const puntosCronista = PICAS_A_PUNTOS[picas];

        // Total redondeado al entero más cercano
        const totalPuntos = Math.round(puntosBase + puntosCronista);

        return {
            playerApiId:    stats.playerApiId,
            puntosBase,
            picas,
            puntosCronista,
            totalPuntos,
            cronistaType:   cronista.tipo,
        };
    }

    /**
     * Calcula la puntuación de todos los jugadores de un partido.
     * Sortea UN cronista para todos (mismo partido = mismo cronista).
     *
     * @param statsPartido - Array de estadísticas de todos los jugadores
     */
    calcularPartido(statsPartido: PlayerStats[]): ScoreBreakdown[] {
        const cronista = CronistaFactory.sortear();
        return statsPartido.map(stats => this.calcularJugador(stats, cronista));
    }
}
