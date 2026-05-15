// ─────────────────────────────────────────────────────────────────────────────
// IPlayerSearchRepository — Puerto para búsqueda global de jugadores del dataset
// Permite buscar jugadores por nombre y posición dentro de la temporada/competición
// de una liga sin importar si están o no en el mercado activo.
// ─────────────────────────────────────────────────────────────────────────────

export interface PlayerSearchFilters {
    /** Búsqueda parcial por nombre (case-insensitive) */
    query?: string;
    /** Filtro por posición: PT | DF | MC | DL */
    position?: string;
    /** Página de resultados (0-indexed) */
    page?: number;
    /** Resultados por página */
    pageSize?: number;
}

export interface PlayerSearchResult {
    playerApiId: number;
}

export interface PlayerSearchPage {
    playerApiIds: number[];
    totalCount: number;
    page: number;
    pageSize: number;
}

export interface IPlayerSearchRepository {
    /**
     * Busca jugadores del dataset que participaron en la liga/temporada indicada.
     * Devuelve IDs paginados que coinciden con los filtros.
     */
    searchPlayers(
        kaggleLeagueId: number,
        season: string,
        filters: PlayerSearchFilters,
    ): Promise<PlayerSearchPage>;
}
