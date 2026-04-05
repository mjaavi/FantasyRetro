import { supabaseAdmin } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { ISeedRepository, KagglePlayer, MarketPlayer } from '../../domain/ports/ISeedRepository';

export class SupabaseSeedRepository implements ISeedRepository {

    async fetchKagglePlayers(limit: number): Promise<KagglePlayer[]> {
        const { data, error } = await supabaseAdmin
            .from('Player')
            .select(`
                player_api_id,
                player_name,
                Player_Attributes (
                    overall_rating,
                    attacking_work_rate,
                    defensive_work_rate,
                    gk_diving,
                    gk_reflexes
                )
            `)
            .limit(limit);

        if (error) throw new AppError('Error al leer jugadores del dataset.', 500);

        return (data ?? [])
            .filter(row => (row.Player_Attributes as any[])?.length > 0)
            .map(row => {
                const attrs = (row.Player_Attributes as any[])[0];
                return {
                    player_api_id:       row.player_api_id as number,
                    player_name:         row.player_name as string,
                    overall_rating:      attrs?.overall_rating,
                    attacking_work_rate: attrs?.attacking_work_rate,
                    defensive_work_rate: attrs?.defensive_work_rate,
                    gk_diving:           attrs?.gk_diving,
                    gk_reflexes:         attrs?.gk_reflexes,
                };
            });
    }

    async clearMarketPlayers(): Promise<void> {
        // Borra todas las filas excepto una ficticia para evitar el error de delete sin filtro
        await supabaseAdmin.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    }

    async insertMarketPlayers(players: MarketPlayer[]): Promise<number> {
        const { error } = await supabaseAdmin.from('players').insert(players);
        if (error) throw new AppError(`Error al insertar jugadores: ${error.message}`, 500);
        return players.length;
    }
}
