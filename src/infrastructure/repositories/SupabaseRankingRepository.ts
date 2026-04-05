import { supabaseAdmin } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { IRankingRepository, RosterEntry } from '../../domain/ports/IRankingRepository';

export class SupabaseRankingRepository implements IRankingRepository {

    async findRosterByLeague(leagueId: number): Promise<RosterEntry[]> {
        const { data, error } = await supabaseAdmin
            .from('user_roster')
            .select('user_id, player_api_id, purchase_price')
            .eq('league_id', leagueId);

        if (error) throw new AppError('Error al obtener los rosters de la liga.', 500);
        return (data ?? []) as RosterEntry[];
    }
}
