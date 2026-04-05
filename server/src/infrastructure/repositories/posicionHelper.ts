import { supabaseAdmin } from '../supabase.client';

/**
 * Infiere la posición de cada jugador usando la función SQL get_player_avg_y
 * que calcula la Y media táctica del jugador en la tabla Match de Kaggle.
 *
 * Y = 1        → PT
 * Y = 2..4     → DF
 * Y = 5..8     → MC
 * Y = 9..11    → DL
 */
export async function inferirPosicionesDesdeMatch(
    playerIds: number[]
): Promise<Map<number, string>> {
    const result = new Map<number, string>();
    if (!playerIds.length) return result;

    const promises = playerIds.map(async (playerId) => {
        const { data, error } = await supabaseAdmin
            .rpc('get_player_avg_y', { p_player_id: playerId });

        if (error) {
            console.error(`[Posicion] RPC error para ${playerId}:`, error.message, error.code);
            result.set(playerId, 'MC');
        } else if (data === null || data === undefined) {
            console.warn(`[Posicion] Sin datos Y para jugador ${playerId}, usando MC`);
            result.set(playerId, 'MC');
        } else {
            const pos = yMediaAPosicion(Number(data));
            console.log(`[Posicion] Jugador ${playerId}: Y=${Number(data).toFixed(2)} → ${pos}`);
            result.set(playerId, pos);
        }
    });

    await Promise.all(promises);
    return result;
}

function yMediaAPosicion(y: number): string {
    if (y <= 1.5)             return 'PT';
    if (y >= 2 && y <= 4.5)   return 'DF';
    if (y >= 4.5 && y <= 8.5) return 'MC';
    return 'DL';
}