// DTO de respuesta para el endpoint GET /api/ranking/:leagueId

export interface RankingEntryDTO {
    posicion:          number;
    userId:            string;
    username:          string;
    teamName:          string;
    puntosTotales:     number;
    jugadoresPuntuados: number;
    valorPlantilla:    number; // Suma del precio de compra de los jugadores del roster
    presupuestoRestante: number;
}

export interface RankingResponseDTO {
    leagueId:    number;
    temporada:   string;
    jornada:     number | 'general';
    jornadasDisponibles: number[];
    ranking:     RankingEntryDTO[];
    calculadoEn: string;
}
