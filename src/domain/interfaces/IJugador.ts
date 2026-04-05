import { Posicion } from './ICronistaStrategy';

// Estadísticas de un jugador extraídas del dataset de Kaggle
// Corresponden a los eventos del XML de un partido concreto
export interface EstadisticasPartido {
    // Ataque
    goles:            number;
    asistencias:      number;
    tirosAPuerta:     number;
    tirosAlPalo:      number;
    centrosAlArea:    number;
    posesionSuperior60: boolean; // Solo relevante para MC

    // Defensa
    faltasCometidas:  number;
    tarjetasAmarillas: number;
    tarjetasRojas:    number;

    // Inferencia (calculadas a partir de otros datos del partido)
    porteriaACero:    boolean;
    paradasDeducidas: number; // Solo para PT
    tirosRivalesBloqueados: number; // Solo para DF

    // Contexto
    resultado: 'victoria' | 'empate' | 'derrota';
}

// Jugador con sus datos completos para el cálculo de puntuación
export interface IJugador {
    id:       number;   // player_api_id de Kaggle
    nombre:   string;
    posicion: Posicion;
    estadisticas: EstadisticasPartido;
}
