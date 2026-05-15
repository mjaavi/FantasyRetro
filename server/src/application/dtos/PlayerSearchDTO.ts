// ─────────────────────────────────────────────────────────────────────────────
// PlayerSearchDTO — DTOs para la funcionalidad de búsqueda de jugadores
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerSearchResultDTO {
    playerApiId: number;
    name: string;
    position: string;
    realTeam: string;
    overall: number;
    playerFifaApiId: number | null;
    faceUrl: string | null;
    clubLogoUrl: string | null;
    /** Valor de mercado actual (si está en el mercado activo) */
    marketValue: number | null;
    /** Valor de mercado previo (si aplica) */
    previousMarketValue: number | null;
    /** Variación del valor de mercado */
    marketValueDelta: number;
    /** Porcentaje de variación del valor de mercado */
    marketValueChangePct: number;
    /** Media de puntos en la última jornada procesada */
    lastAveragePoints: number | null;
    /** Última jornada procesada */
    lastJornadaProcessed: number | null;
    /** true si el jugador está disponible para pujar en el mercado activo */
    isInMarket: boolean;
}

export interface PlayerSearchResponseDTO {
    players: PlayerSearchResultDTO[];
    totalCount: number;
    page: number;
    pageSize: number;
}
