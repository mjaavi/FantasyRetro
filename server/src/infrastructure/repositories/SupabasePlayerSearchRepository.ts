// ─────────────────────────────────────────────────────────────────────────────
// SupabasePlayerSearchRepository
// Busca jugadores del dataset Kaggle por nombre/posición.
// Reutiliza la tabla Player y Match para resolver jugadores de la temporada.
// ─────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../domain/errors/AppError';
import { IPlayerSearchRepository, PlayerSearchFilters, PlayerSearchPage } from '../../domain/ports/IPlayerSearchRepository';
import { supabaseAdmin } from '../supabase.client';
import { inferirPosicionesDesdeMatch } from './posicionHelper';

const DEFAULT_PAGE_SIZE = 20;

const MATCH_PLAYER_COLUMNS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4',
    'home_player_5', 'home_player_6', 'home_player_7', 'home_player_8',
    'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4',
    'away_player_5', 'away_player_6', 'away_player_7', 'away_player_8',
    'away_player_9', 'away_player_10', 'away_player_11',
] as const;

/**
 * Cache de IDs de jugadores por liga+temporada para evitar recalcular
 * la lista completa de jugadores del dataset en cada búsqueda.
 */
const seasonPlayerIdsCache = new Map<string, number[]>();
const seasonPlayerPositionsCache = new Map<string, Map<number, string>>();

export class SupabasePlayerSearchRepository implements IPlayerSearchRepository {

    async searchPlayers(
        kaggleLeagueId: number,
        season: string,
        filters: PlayerSearchFilters,
    ): Promise<PlayerSearchPage> {
        const page = Math.max(0, filters.page ?? 0);
        const pageSize = Math.min(50, Math.max(1, filters.pageSize ?? DEFAULT_PAGE_SIZE));
        const query = filters.query?.trim() ?? '';
        const positionFilter = filters.position?.toUpperCase() ?? '';

        // 1. Obtener todos los IDs de jugadores de la temporada (con cache)
        const allPlayerIds = await this.getAllSeasonPlayerIds(kaggleLeagueId, season);

        if (!allPlayerIds.length) {
            return { playerApiIds: [], totalCount: 0, page, pageSize };
        }

        // 2. Si hay filtro de posición, resolver posiciones y filtrar
        let filteredIds = allPlayerIds;

        if (positionFilter && ['PT', 'DF', 'MC', 'DL'].includes(positionFilter)) {
            const positions = await this.getSeasonPlayerPositions(kaggleLeagueId, season, allPlayerIds);
            filteredIds = filteredIds.filter(id => positions.get(id) === positionFilter);
        }

        // 3. Si hay filtro por nombre, buscar en la tabla Player
        if (query.length >= 2) {
            const matchingIds = await this.filterByName(filteredIds, query);
            filteredIds = matchingIds;
        }

        const totalCount = filteredIds.length;

        // 4. Paginar
        const from = page * pageSize;
        const playerApiIds = filteredIds.slice(from, from + pageSize);

        return { playerApiIds, totalCount, page, pageSize };
    }

    // ── Helpers privados ─────────────────────────────────────────────────

    private async getAllSeasonPlayerIds(
        kaggleLeagueId: number,
        season: string,
    ): Promise<number[]> {
        const cacheKey = `${kaggleLeagueId}:${season}`;
        const cached = seasonPlayerIdsCache.get(cacheKey);
        if (cached) return cached;

        const { data: matches, error } = await supabaseAdmin
            .from('Match')
            .select(MATCH_PLAYER_COLUMNS.join(', '))
            .eq('season', season)
            .eq('league_id', kaggleLeagueId);

        if (error) {
            throw new AppError(`Error al buscar jugadores de la temporada: ${error.message}`, 500);
        }

        const playerIdSet = new Set<number>();

        for (const match of matches ?? []) {
            for (const col of MATCH_PLAYER_COLUMNS) {
                const val = (match as unknown as Record<string, unknown>)[col];
                const num = Number(val);
                if (Number.isFinite(num) && num > 0) {
                    playerIdSet.add(num);
                }
            }
        }

        const result = Array.from(playerIdSet).sort((a, b) => a - b);
        seasonPlayerIdsCache.set(cacheKey, result);
        return result;
    }

    private async getSeasonPlayerPositions(
        kaggleLeagueId: number,
        season: string,
        playerIds: number[],
    ): Promise<Map<number, string>> {
        const cacheKey = `${kaggleLeagueId}:${season}`;
        const cached = seasonPlayerPositionsCache.get(cacheKey);
        if (cached) return cached;

        const positions = await inferirPosicionesDesdeMatch(playerIds);
        seasonPlayerPositionsCache.set(cacheKey, positions);
        return positions;
    }

    private async filterByName(
        candidateIds: number[],
        query: string,
    ): Promise<number[]> {
        if (!candidateIds.length) return [];

        // Buscar en la tabla Player con ilike para coincidencia parcial
        const CHUNK_SIZE = 200;
        const matchingIds: number[] = [];

        for (let i = 0; i < candidateIds.length; i += CHUNK_SIZE) {
            const chunk = candidateIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = await supabaseAdmin
                .from('Player')
                .select('player_api_id')
                .in('player_api_id', chunk)
                .ilike('player_name', `%${query}%`);

            if (error) {
                throw new AppError(`Error al buscar jugadores por nombre: ${error.message}`, 500);
            }

            for (const row of data ?? []) {
                matchingIds.push(Number(row.player_api_id));
            }
        }

        return matchingIds;
    }
}
