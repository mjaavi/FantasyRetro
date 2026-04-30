import { supabaseAdmin, supabaseAsUser } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { IRosterRepository, LineupPreference, RosterPlayer, RosterScoreRow, RosterScoreSummary } from '../../domain/ports/IRosterRepository';
import { loadLeaguePlayerData } from './leaguePlayerDataHelper';

export class SupabaseRosterRepository implements IRosterRepository {

    async findByUserAndLeague(userId: string, leagueId: number): Promise<RosterPlayer[]> {
        const { data: rosterData, error: rosterError } = await supabaseAdmin
            .from('user_roster')
            .select('player_api_id, is_starter, purchase_price')
            .eq('user_id', userId)
            .eq('league_id', leagueId);

        if (rosterError) {
            throw new AppError(`Error al obtener la plantilla: ${rosterError.message}`, 500);
        }

        if (!rosterData?.length) {
            return [];
        }

        const playerIds = rosterData.map(row => Number(row.player_api_id));
        const playerData = await loadLeaguePlayerData(leagueId, playerIds);

        return rosterData.map(row => {
            const playerId = Number(row.player_api_id);
            const player = playerData.get(playerId);

            return {
                id:             playerId,
                name:           player?.name ?? 'Desconocido',
                position:       player?.position ?? 'MC',
                real_team:      player?.realTeam ?? 'Sin equipo',
                overall:        player?.overall ?? 50,
                is_starter:     Boolean(row.is_starter),
                purchase_price: Number(row.purchase_price ?? 0),
                playerFifaApiId: player?.playerFifaApiId ?? null,
                faceUrl:        player?.faceUrl ?? null,
                clubLogoUrl:    player?.clubLogoUrl ?? null,
            };
        });
    }

    async findScoresByUserAndLeague(userId: string, leagueId: number): Promise<RosterScoreSummary> {
        const [{ data: leagueData, error: leagueError }, { data: scoreData, error: scoreError }] = await Promise.all([
            supabaseAdmin
                .from('fantasy_leagues')
                .select('jornada_actual')
                .eq('id', leagueId)
                .maybeSingle(),
            supabaseAdmin
                .from('fantasy_scores')
                .select('player_api_id, jornada, puntos_base, puntos_cronista, puntos_total, picas, cronista_type, is_starter')
                .eq('league_id', leagueId)
                .eq('user_id', userId)
                .order('jornada', { ascending: true })
                .order('player_api_id', { ascending: true }),
        ]);

        if (leagueError) {
            throw new AppError(`Error al obtener la jornada actual de la liga: ${leagueError.message}`, 500);
        }

        if (scoreError) {
            throw new AppError(`Error al obtener los puntos de la plantilla: ${scoreError.message}`, 500);
        }

        const playerIds = Array.from(new Set((scoreData ?? []).map(row => Number(row.player_api_id))));
        const playerData = await loadLeaguePlayerData(leagueId, playerIds);

        return {
            jornadaActual: Number(leagueData?.jornada_actual ?? 0),
            scores: (scoreData ?? []).map(row => {
                const apiId = Number(row.player_api_id);
                const player = playerData.get(apiId);
                return {
                    player_api_id: apiId,
                    jornada: Number(row.jornada),
                    puntos_base: Number(row.puntos_base ?? 0),
                    puntos_cronista: Number(row.puntos_cronista ?? 0),
                    puntos_total: Number(row.puntos_total ?? 0),
                    picas: String(row.picas ?? 'SC'),
                    cronista_type: String(row.cronista_type ?? 'analitico'),
                    is_starter: Boolean(row.is_starter),
                    name: player?.name ?? 'Desconocido',
                    position: player?.position ?? 'MC',
                    faceUrl: player?.faceUrl ?? null,
                    clubLogoUrl: player?.clubLogoUrl ?? null,
                    real_team: player?.realTeam ?? null,
                };
            }) satisfies RosterScoreRow[],
        };
    }

    async findLeagueCurrentRound(leagueId: number): Promise<number> {
        const { data, error } = await supabaseAdmin
            .from('fantasy_leagues')
            .select('jornada_actual')
            .eq('id', leagueId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener la jornada actual de la liga: ${error.message}`, 500);
        }

        return Number(data?.jornada_actual ?? 0);
    }

    async findLineupPreferencesByUserAndLeague(userId: string, leagueId: number, maxJornada: number): Promise<LineupPreference[]> {
        const { data, error } = await supabaseAdmin
            .from('user_lineup_preferences')
            .select('jornada, formation_key, updated_at')
            .eq('user_id', userId)
            .eq('league_id', leagueId)
            .lte('jornada', maxJornada)
            .order('jornada', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener las alineaciones guardadas: ${error.message}`, 500);
        }

        return (data ?? []).map(row => ({
            jornada: Number(row.jornada),
            formation_key: String(row.formation_key),
            updated_at: row.updated_at ? String(row.updated_at) : null,
        }));
    }

    async upsertLineupPreference(userId: string, leagueId: number, jornada: number, formationKey: string): Promise<LineupPreference> {
        const { data, error } = await supabaseAdmin
            .from('user_lineup_preferences')
            .upsert({
                user_id: userId,
                league_id: leagueId,
                jornada,
                formation_key: formationKey,
                updated_at: new Date().toISOString(),
            }, { onConflict: 'league_id,user_id,jornada' })
            .select('jornada, formation_key, updated_at')
            .single();

        if (error) {
            throw new AppError(`Error al guardar la alineacion: ${error.message}`, 500);
        }

        return {
            jornada: Number(data.jornada),
            formation_key: String(data.formation_key),
            updated_at: data.updated_at ? String(data.updated_at) : null,
        };
    }

    async updateStarter(userId: string, leagueId: number, playerApiId: number, isStarter: boolean): Promise<void> {
        const { error } = await supabaseAdmin
            .from('user_roster')
            .update({ is_starter: isStarter })
            .eq('user_id', userId)
            .eq('league_id', leagueId)
            .eq('player_api_id', playerApiId);

        if (error) {
            throw new AppError('Error al actualizar el once inicial.', 500);
        }
    }

    async addPlayer(userId: string, leagueId: number, playerApiId: number, purchasePrice: number, userToken: string): Promise<void> {
        const db = supabaseAsUser(userToken);
        const { error } = await db
            .from('user_roster')
            .insert({
                user_id: userId,
                league_id: leagueId,
                player_api_id: playerApiId,
                purchase_price: purchasePrice,
                is_starter: false,
            });

        if (error) {
            throw new AppError(`Error al anadir jugador: ${error.message}`, 500);
        }
    }
}
