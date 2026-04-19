import { supabaseAdmin } from '../supabase.client';

const DEFAULT_POSITION = 'MC';
const positionCache = new Map<number, string>();

/**
 * Infiere la posicion media del jugador a partir de la RPC `get_player_avg_y`.
 * Como la posicion historica no cambia entre llamadas, cacheamos el resultado
 * para evitar repetir decenas de RPCs en mercado, roster y dashboard.
 */
export async function inferirPosicionesDesdeMatch(playerIds: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    if (!playerIds.length) return result;

    const uniqueIds = [...new Set(playerIds.filter(playerId => Number.isInteger(playerId) && playerId > 0))];
    const uncachedIds: number[] = [];

    for (const playerId of uniqueIds) {
        const cachedPosition = positionCache.get(playerId);
        if (cachedPosition) {
            result.set(playerId, cachedPosition);
            continue;
        }

        uncachedIds.push(playerId);
    }

    const CHUNK_SIZE = 50;
    for (let i = 0; i < uncachedIds.length; i += CHUNK_SIZE) {
        const chunk = uncachedIds.slice(i, i + CHUNK_SIZE);
        const resolvedChunk = await Promise.all(chunk.map(resolvePlayerPosition));

        for (const [playerId, position] of resolvedChunk) {
            positionCache.set(playerId, position);
            result.set(playerId, position);
        }
    }

    for (const playerId of uniqueIds) {
        if (!result.has(playerId)) {
            result.set(playerId, positionCache.get(playerId) ?? DEFAULT_POSITION);
        }
    }

    return result;
}

async function resolvePlayerPosition(playerId: number): Promise<[number, string]> {
    const { data, error } = await supabaseAdmin.rpc('get_player_avg_y', { p_player_id: playerId });

    if (error) {
        console.error(`[Posicion] RPC error para ${playerId}:`, error.message, error.code);
        return [playerId, DEFAULT_POSITION];
    }

    if (data === null || data === undefined) {
        return [playerId, DEFAULT_POSITION];
    }

    return [playerId, yMediaAPosicion(Number(data))];
}

function yMediaAPosicion(y: number): string {
    if (y <= 1.5) return 'PT';
    if (y >= 2 && y <= 4.5) return 'DF';
    if (y >= 4.5 && y <= 8.5) return 'MC';
    return 'DL';
}
