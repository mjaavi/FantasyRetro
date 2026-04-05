import { supabaseAdmin, supabaseAsUser } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { FantasyLeague, ILeagueRepository, LeagueParticipant } from '../../domain/ports/ILeagueRepository';

export class SupabaseLeagueRepository implements ILeagueRepository {

    async findById(leagueId: number): Promise<FantasyLeague | null> {
        const { data, error } = await supabaseAdmin
            .from('fantasy_leagues')
            .select('*')
            .eq('id', leagueId)
            .single();
        if (error) return null;
        return data as FantasyLeague;
    }

    async findByInviteCode(inviteCode: string): Promise<FantasyLeague | null> {
        const { data, error } = await supabaseAdmin
            .from('fantasy_leagues')
            .select('*')
            .eq('invite_code', inviteCode.toUpperCase())
            .single();
        if (error) return null;
        return data as FantasyLeague;
    }

    async create(payload: { name: string; invite_code: string; admin_id: string; season: string; kaggle_league_id: number }): Promise<FantasyLeague> {
        const { data, error } = await supabaseAdmin
            .from('fantasy_leagues')
            .insert(payload)
            .select()
            .single();
        if (error) throw new AppError(`Error al crear la liga: ${error.message}`, 500);
        return data as FantasyLeague;
    }

    async findParticipantsByLeague(leagueId: number): Promise<LeagueParticipant[]> {
        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('user_id, league_id, joined_at, profiles ( username, team_name, budget )')
            .eq('league_id', leagueId);

        if (error) throw new AppError('Error al obtener participantes.', 500);

        return (data ?? []).map(row => ({
            user_id:   row.user_id,
            league_id: row.league_id,
            joined_at: row.joined_at,
            profiles:  Array.isArray(row.profiles) ? row.profiles[0] : row.profiles,
        })) as LeagueParticipant[];
    }

    async findParticipant(leagueId: number, userId: string): Promise<LeagueParticipant | null> {
        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('user_id, league_id, joined_at')
            .eq('league_id', leagueId)
            .eq('user_id', userId)
            .single();
        if (error) return null;
        return data as LeagueParticipant;
    }

    async findLeaguesByUser(userId: string): Promise<(FantasyLeague & { joined_at: string; esAdmin: boolean })[]> {
        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('joined_at, fantasy_leagues ( id, name, invite_code, season, admin_id, kaggle_league_id, created_at )')
            .eq('user_id', userId);

        if (error) throw new AppError('Error al obtener las ligas del usuario.', 500);

        return (data ?? []).map(entry => {
            const liga = entry.fantasy_leagues as any;
            return {
                ...liga,
                joined_at: entry.joined_at,
                esAdmin:   liga.admin_id === userId,
            };
        });
    }

    async addParticipant(leagueId: number, userId: string): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_participants')
            .insert({ league_id: leagueId, user_id: userId });
        if (error) throw new AppError(`Error al añadir participante: ${error.message}`, 500);
    }

    async createWithUserToken(
        payload: { name: string; invite_code: string; admin_id: string; season: string; kaggle_league_id: number },
        userToken: string
    ): Promise<FantasyLeague> {
        const db = supabaseAsUser(userToken);
        const { data, error } = await db
            .from('fantasy_leagues')
            .insert(payload)
            .select()
            .single();
        if (error) throw new AppError(`Error al crear la liga: ${error.message}`, 500);
        return data as FantasyLeague;
    }

    async addParticipantWithUserToken(leagueId: number, userId: string, userToken: string): Promise<void> {
        const db = supabaseAsUser(userToken);
        const { error } = await db
            .from('league_participants')
            .insert({ league_id: leagueId, user_id: userId });
        if (error) throw new AppError(`Error al unirse a la liga: ${error.message}`, 500);
    }
}
