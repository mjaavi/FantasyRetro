// Posiciones de jugador — usadas para calcular puntos por posición
export type Posicion = 'PT' | 'DF' | 'MC' | 'DL';

// Resultado de la Fase A (sistema estadístico objetivo)
export interface PuntuacionFaseA {
    puntosAtaque:   number;
    puntosDefensa:  number;
    puntosInferencia: number;
    puntosContexto: number;
    total:          number;
}

// Resultado de la Fase B (cronista virtual)
export interface PuntuacionFaseB {
    picas:         'Negativo' | 'S.C.' | '1 Pica' | '2 Picas' | '3 Picas' | '4 Picas';
    puntosCronista: number;
    tipoCronista:  'Analítico' | 'Exigente' | 'Pasional';
}

// Resultado final combinando ambas fases
export interface PuntuacionFinal {
    faseA:       PuntuacionFaseA;
    faseB:       PuntuacionFaseB;
    totalPuntos: number; // Math.round(faseA.total + faseB.puntosCronista)
}

// Contrato que deben cumplir todas las estrategias de cronista
export interface ICronistaStrategy {
    readonly nombre: 'Analítico' | 'Exigente' | 'Pasional';

    /**
     * Calcula la puntuación del cronista a partir de los puntos de la Fase A.
     * Aplica probabilidades ponderadas para asignar picas.
     * @param puntosFaseA - Puntos totales de la Fase A
     */
    calcularPicas(puntosFaseA: number): PuntuacionFaseB;
}
