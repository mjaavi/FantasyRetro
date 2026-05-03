import { IAdminRepository, AdminFantasyScoreRow, AdminGlobalScoreRow, AdminLeagueSnapshot, AdminLeagueStatus, AdminRosterEntry, FantasyScoreWriteModel, GlobalScoreWriteModel } from '../../domain/ports/IAdminRepository';
import { AppError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../supabase.client';

type SupabaseClientLike = typeof supabaseAdmin;

const LEAGUE_PROCESS_FIELDS = 'id, admin_id, season, jornada_actual, kaggle_league_id';
const LEAGUE_STATUS_FIELDS = 'id, name, admin_id, season, jornada_actual, kaggle_league_id';
const FANTASY_SCORE_FIELDS = 'user_id, player_api_id, jornada, puntos_base, puntos_cronista, puntos_total, picas, cronista_type, raw_stats';
const GLOBAL_SCORE_FIELDS = 'player_api_id, jornada, puntos_base, puntos_total, picas, cronista_type, raw_stats';

export class SupabaseAdminRepository implements IAdminRepository {
    constructor(private readonly db: SupabaseClientLike = supabaseAdmin) {}

    async getLeagueForProcessing(leagueId: number): Promise<AdminLeagueSnapshot | null> {
        const { data, error } = await this.db
            .from('fantasy_leagues')
            .select(LEAGUE_PROCESS_FIELDS)
            .eq('id', leagueId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener la liga para procesamiento: ${error.message}`, 500);
        }

        return (data as AdminLeagueSnapshot | null) ?? null;
    }

    async getEstadoLigas(adminUserId: string): Promise<AdminLeagueStatus[]> {
        const { data, error } = await this.db
            .from('fantasy_leagues')
            .select(LEAGUE_STATUS_FIELDS)
            .eq('admin_id', adminUserId)
            .order('id', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener el estado de las ligas: ${error.message}`, 500);
        }

        return (data ?? []) as AdminLeagueStatus[];
    }

    async getLeagueRosterEntries(leagueId: number): Promise<AdminRosterEntry[]> {
        const { data, error } = await this.db
            .from('user_roster')
            .select('user_id, player_api_id, is_starter')
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError(`Error al obtener el roster de la liga: ${error.message}`, 500);
        }

        return (data ?? []) as AdminRosterEntry[];
    }

    async saveFantasyScores(rows: FantasyScoreWriteModel[]): Promise<void> {
        if (!rows.length) return;

        const { error } = await this.db
            .from('fantasy_scores')
            .upsert(rows, { onConflict: 'league_id,user_id,player_api_id,jornada' });

        if (error) {
            throw new AppError(`Error al persistir fantasy_scores: ${error.message}`, 500);
        }
    }

    async saveGlobalScores(rows: GlobalScoreWriteModel[]): Promise<void> {
        if (!rows.length) return;

        const { error } = await this.db
            .from('player_global_scores')
            .upsert(rows, { onConflict: 'player_api_id,league_id,jornada' });

        if (error) {
            throw new AppError(`Error al persistir player_global_scores: ${error.message}`, 500);
        }
    }

    async updateLeagueCurrentRound(leagueId: number, jornada: number): Promise<void> {
        const { error } = await this.db
            .from('fantasy_leagues')
            .update({ jornada_actual: jornada })
            .eq('id', leagueId);

        if (error) {
            throw new AppError(`Error al actualizar la jornada actual de la liga: ${error.message}`, 500);
        }
    }

    async getPuntosJornada(leagueId: number, jornada: number): Promise<AdminFantasyScoreRow[]> {
        const { data, error } = await this.db
            .from('fantasy_scores')
            .select(FANTASY_SCORE_FIELDS)
            .eq('league_id', leagueId)
            .eq('jornada', jornada)
            .order('user_id', { ascending: true })
            .order('player_api_id', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener los puntos de la jornada: ${error.message}`, 500);
        }

        return (data ?? []) as AdminFantasyScoreRow[];
    }

    async getScoresLiga(leagueId: number): Promise<AdminFantasyScoreRow[]> {
        const { data, error } = await this.db
            .from('fantasy_scores')
            .select(FANTASY_SCORE_FIELDS)
            .eq('league_id', leagueId)
            .order('jornada', { ascending: true })
            .order('user_id', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener los scores de la liga: ${error.message}`, 500);
        }

        return (data ?? []) as AdminFantasyScoreRow[];
    }

    async getGlobalScores(leagueId: number): Promise<AdminGlobalScoreRow[]> {
        const { data, error } = await this.db
            .from('player_global_scores')
            .select(GLOBAL_SCORE_FIELDS)
            .eq('league_id', leagueId)
            .order('jornada', { ascending: true })
            .order('player_api_id', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener los global scores de la liga: ${error.message}`, 500);
        }

        return (data ?? []) as AdminGlobalScoreRow[];
    }

    async getLeagueCurrentRound(leagueId: number): Promise<number> {
        const { data, error } = await this.db
            .from('fantasy_leagues')
            .select('jornada_actual')
            .eq('id', leagueId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener la jornada actual de la liga: ${error.message}`, 500);
        }

        return Number(data?.jornada_actual ?? 0);
    }

    async getPlayerGlobalScoreHistory(leagueId: number, playerApiId: number): Promise<AdminGlobalScoreRow[]> {
        const { data, error } = await this.db
            .from('player_global_scores')
            .select(GLOBAL_SCORE_FIELDS)
            .eq('league_id', leagueId)
            .eq('player_api_id', playerApiId)
            .order('jornada', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener el historial global del jugador: ${error.message}`, 500);
        }

        return (data ?? []) as AdminGlobalScoreRow[];
    }
}
