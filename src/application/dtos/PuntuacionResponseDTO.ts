import { PuntuacionFinal } from '../../domain/interfaces/ICronistaStrategy';

// DTO de respuesta para la puntuación de un jugador individual
export interface PuntuacionJugadorDTO {
    playerId:    number;
    playerName:  string;
    puntuacion:  PuntuacionFinal;
}

// DTO de respuesta para el endpoint GET /api/scoring/:leagueId
export interface PuntuacionResponseDTO {
    leagueId:   string;
    temporada:  string;
    jugadores:  PuntuacionJugadorDTO[];
    calculadoEn: string; // ISO timestamp
}
