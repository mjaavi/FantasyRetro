import { supabaseAdmin } from '../supabase.client';

const DEFAULT_POSITION = 'MC';
const positionCache = new Map<number, string>();
const ongoingFetches = new Map<number, Promise<string>>();

/**
 * Infiere la posicion media del jugador a partir de la RPC `get_player_avg_y`.
 * Como la posicion historica no cambia entre llamadas, cacheamos el resultado
 * para evitar repetir decenas de RPCs en mercado, roster y dashboard.
 */
export async function inferirPosicionesDesdeMatch(playerIds: number[]): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    if (!playerIds.length) return result;

    const uniqueIds = [...new Set(playerIds.filter(playerId => Number.isInteger(playerId) && playerId > 0))];
    const promisesToAwait: { playerId: number; promise: Promise<string> }[] = [];
    const uncachedIds: number[] = [];

    for (const playerId of uniqueIds) {
        // 1. Verificar si ya está resuelto en la caché
        const cachedPosition = positionCache.get(playerId);
        if (cachedPosition !== undefined) {
            result.set(playerId, cachedPosition);
            continue;
        }

        // 2. Verificar si ya hay una petición en curso para este jugador
        const ongoing = ongoingFetches.get(playerId);
        if (ongoing) {
            promisesToAwait.push({ playerId, promise: ongoing });
            continue;
        }

        uncachedIds.push(playerId);
    }

    if (uncachedIds.length > 0) {
        // Promesa compartida para la consulta en lote
        const batchPromise = (async () => {
            try {
                // Intentamos consultar las posiciones en lote
                const { data, error } = await supabaseAdmin.rpc('get_players_avg_y', { p_player_ids: uncachedIds });
                
                if (error) {
                    throw error;
                }

                const mapped = new Map<number, string>();
                if (data && Array.isArray(data)) {
                    for (const row of data) {
                        const pid = Number(row.player_api_id);
                        const avgY = Number(row.avg_y);
                        mapped.set(pid, yMediaAPosicion(avgY));
                    }
                }
                return mapped;
            } catch (err: any) {
                console.warn(`[Posicion] Falló get_players_avg_y en lote (usando fallback individual): ${err.message}`);
                
                // Fallback individual clásico si la RPC por lote no está disponible
                const mapped = new Map<number, string>();
                const CHUNK_SIZE = 50;
                for (let i = 0; i < uncachedIds.length; i += CHUNK_SIZE) {
                    const chunk = uncachedIds.slice(i, i + CHUNK_SIZE);
                    const resolvedChunk = await Promise.all(chunk.map(resolvePlayerPosition));
                    for (const [pid, pos] of resolvedChunk) {
                        mapped.set(pid, pos);
                    }
                }
                return mapped;
            }
        })();

        // Registramos promesas individuales derivadas en ongoingFetches para cada ID
        for (const playerId of uncachedIds) {
            const playerPromise = batchPromise.then(mapped => {
                const pos = mapped.get(playerId) ?? DEFAULT_POSITION;
                positionCache.set(playerId, pos);
                ongoingFetches.delete(playerId);
                return pos;
            }).catch(err => {
                ongoingFetches.delete(playerId);
                throw err;
            });

            ongoingFetches.set(playerId, playerPromise);
            promisesToAwait.push({ playerId, promise: playerPromise });
        }
    }

    // Esperar a que terminen todas las promesas en curso (tanto las nuevas como las preexistentes)
    if (promisesToAwait.length > 0) {
        const resolved = await Promise.all(promisesToAwait.map(x => x.promise));
        for (let i = 0; i < promisesToAwait.length; i++) {
            result.set(promisesToAwait[i].playerId, resolved[i]);
        }
    }

    // Rellenar cualquier jugador que falte
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
