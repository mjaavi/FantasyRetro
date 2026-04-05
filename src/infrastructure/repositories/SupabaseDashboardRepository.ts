// ─────────────────────────────────────────────────────────────────────────────
// repositories/SupabaseDashboardRepository.ts
// Implementación Supabase del IDashboardRepository.
// Responsabilidad única: acceso a datos del dashboard. Sin lógica de negocio.
// ─────────────────────────────────────────────────────────────────────────────

import { supabaseAdmin } from '../supabase.client';
import {
    DashboardPlayerVisual,
    DashboardScoreRow,
    FixtureMatch,
    GlobalTopPlayer,
    IDashboardRepository,
} from '../../domain/ports/IDashboardRepository';
import { loadLeaguePlayerData } from './leaguePlayerDataHelper';
import { buildClubLogoUrl } from './assetUrlHelper';

export class SupabaseDashboardRepository implements IDashboardRepository {

    async getScoresLiga(leagueId: number): Promise<DashboardScoreRow[]> {
        const { data, error } = await supabaseAdmin
            .from('fantasy_scores')
            .select('user_id, player_api_id, jornada, puntos_base, puntos_cronista, puntos_total, picas, cronista_type')
            .eq('league_id', leagueId);

        if (error) { console.error('[DashboardRepo] getScoresLiga:', error.message); return []; }
        return (data ?? []) as DashboardScoreRow[];
    }

    async getTopJugadoresGlobales(leagueId: number, limit = 5): Promise<GlobalTopPlayer[]> {
        // Sumar puntos totales por jugador desde player_global_scores
        const { data: scores, error } = await supabaseAdmin
            .from('player_global_scores')
            .select('player_api_id, puntos_total')
            .eq('league_id', leagueId);

        if (error) { console.error('[DashboardRepo] getTopGlobales:', error.message); return []; }

        // Agregar por jugador
        const totales = new Map<number, number>();
        for (const row of scores ?? []) {
            const id = row.player_api_id as number;
            totales.set(id, (totales.get(id) ?? 0) + Number(row.puntos_total));
        }

        const topIds = [...totales.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([id]) => id);

        if (!topIds.length) return [];

        const visuals = await this.getPlayerVisuals(leagueId, topIds);
        const visualMap = new Map(visuals.map(player => [player.player_api_id, player]));

        return topIds.map(id => ({
            player_api_id: id,
            player_name:   visualMap.get(id)?.player_name ?? `Jugador ${id}`,
            position:      visualMap.get(id)?.position ?? 'MC',
            playerFifaApiId: visualMap.get(id)?.playerFifaApiId ?? null,
            faceUrl:       visualMap.get(id)?.faceUrl ?? null,
            clubLogoUrl:   visualMap.get(id)?.clubLogoUrl ?? null,
            puntos_total:  totales.get(id) ?? 0,
        }));
    }

    async getPlayerVisuals(leagueId: number, playerIds: number[]): Promise<DashboardPlayerVisual[]> {
        const playerData = await loadLeaguePlayerData(leagueId, playerIds);

        return playerIds
            .map(playerId => {
                const player = playerData.get(playerId);
                if (!player) {
                    return null;
                }

                return {
                    player_api_id: playerId,
                    player_name: player.name,
                    position: player.position,
                    playerFifaApiId: player.playerFifaApiId,
                    faceUrl: player.faceUrl,
                    clubLogoUrl: player.clubLogoUrl,
                } satisfies DashboardPlayerVisual;
            })
            .filter((player): player is DashboardPlayerVisual => Boolean(player));
    }

    async getFixtures(leagueId: number, jornada: number, userId: string): Promise<FixtureMatch[]> {
        // Obtener datos de la liga
        const { data: liga } = await supabaseAdmin
            .from('fantasy_leagues')
            .select('season, kaggle_league_id')
            .eq('id', leagueId)
            .single();

        if (!liga) return [];

        // Partidos de la jornada
        const { data: matches } = await supabaseAdmin
            .from('Match')
            .select('home_team_api_id, away_team_api_id, home_player_1, home_player_2, home_player_3, home_player_4, home_player_5, home_player_6, home_player_7, home_player_8, home_player_9, home_player_10, home_player_11, away_player_1, away_player_2, away_player_3, away_player_4, away_player_5, away_player_6, away_player_7, away_player_8, away_player_9, away_player_10, away_player_11')
            .eq('season', liga.season)
            .eq('league_id', liga.kaggle_league_id)
            .eq('stage', jornada);

        if (!matches?.length) return [];

        // Nombres de equipos
        const teamIds = [...new Set(matches.flatMap(m => [m.home_team_api_id, m.away_team_api_id]))];
        const { data: teams } = await supabaseAdmin
            .from('Team')
            .select('team_api_id, team_long_name, team_fifa_api_id')
            .in('team_api_id', teamIds);

        const teamMap = new Map((teams ?? []).map(t => [
            t.team_api_id as number,
            {
                name: t.team_long_name as string,
                clubLogoUrl: buildClubLogoUrl(t.team_fifa_api_id === null ? null : Number(t.team_fifa_api_id)),
            },
        ]));

        // Roster del usuario
        const { data: roster } = await supabaseAdmin
            .from('user_roster')
            .select('player_api_id')
            .eq('league_id', leagueId)
            .eq('user_id', userId);

        const myIds = new Set((roster ?? []).map(r => r.player_api_id as number));

        return matches.map(m => {
            const allPlayers = Array.from({ length: 11 }, (_, i) => i + 1)
                .flatMap(i => [
                    Number((m as any)[`home_player_${i}`]),
                    Number((m as any)[`away_player_${i}`]),
                ])
                .filter(id => id > 0);

            return {
                home_team:     teamMap.get(m.home_team_api_id)?.name ?? `Eq. ${m.home_team_api_id}`,
                away_team:     teamMap.get(m.away_team_api_id)?.name ?? `Eq. ${m.away_team_api_id}`,
                home_club_logo_url: teamMap.get(m.home_team_api_id)?.clubLogoUrl ?? null,
                away_club_logo_url: teamMap.get(m.away_team_api_id)?.clubLogoUrl ?? null,
                has_my_player: allPlayers.some(id => myIds.has(id)),
            };
        });
    }
}
