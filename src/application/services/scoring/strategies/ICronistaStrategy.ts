// ─────────────────────────────────────────────────────────────────────────────
// services/scoring/strategies/ICronistaStrategy.ts
// Interfaz del patrón Strategy para los cronistas virtuales.
// ─────────────────────────────────────────────────────────────────────────────

import { CronistaType, Picas } from '../../../../domain/models/scoring.models';

export interface ICronistaStrategy {
    readonly tipo: CronistaType;

    /**
     * Dado una puntuación base (Fase A), devuelve las Picas
     * que el cronista asigna aplicando sus reglas de probabilidad.
     * @param puntuacionBase - Puntos obtenidos en la Fase A
     */
    calcularPicas(puntuacionBase: number): Picas;
}

/**
 * Selecciona un resultado ponderado aleatoriamente dado un array de
 * pares [probabilidad, resultado]. Las probabilidades deben sumar 1.
 */
export function seleccionarPorProbabilidad<T>(opciones: [number, T][]): T {
    const r = Math.random();
    let acumulado = 0;
    for (const [prob, valor] of opciones) {
        acumulado += prob;
        if (r < acumulado) return valor;
    }
    // Fallback al último por si hay error de redondeo
    return opciones[opciones.length - 1][1];
}
