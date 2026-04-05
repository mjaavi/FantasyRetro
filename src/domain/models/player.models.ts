// ─────────────────────────────────────────────────────────────────────────────
// domain/models/player.models.ts
//
// Entidad central del dominio: el Jugador.
// PlayerPosition es el único lugar donde se define la posición táctica.
// Cualquier otro modelo que la necesite importa desde aquí.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Posición táctica de un jugador en el campo.
 * Fuente única de verdad — importar desde aquí, nunca redefinir.
 */
export enum PlayerPosition {
    PT = 'PT', // Portero
    DF = 'DF', // Defensa
    MC = 'MC', // Centrocampista
    DL = 'DL', // Delantero
}

/**
 * Representación de un jugador del dataset de Kaggle
 * enriquecido con datos fantasy.
 */
export interface Player {
    /** player_api_id del dataset Kaggle */
    readonly id:       number;
    readonly name:     string;
    readonly position: PlayerPosition;
    readonly overall:  number;
}

/**
 * Jugador en el contexto del mercado.
 */
export interface MarketPlayer extends Player {
    readonly marketValue:   number;
    readonly purchasePrice: number;
}

/**
 * Jugador en el contexto del roster de un usuario.
 */
export interface RosterPlayer extends Player {
    readonly isStarter:     boolean;
    readonly purchasePrice: number;
    readonly playerApiId:   number;
}