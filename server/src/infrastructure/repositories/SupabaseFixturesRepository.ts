import { FixtureMatch, IFixturesRepository } from '../../domain/ports/IFixturesRepository';
import { AppError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../supabase.client';
import { buildClubLogoUrl } from './assetUrlHelper';

type SupabaseClientLike = typeof supabaseAdmin;

const MATCH_PLAYER_COLUMNS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4', 'home_player_5',
    'home_player_6', 'home_player_7', 'home_player_8', 'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4', 'away_player_5',
    'away_player_6', 'away_player_7', 'away_player_8', 'away_player_9', 'away_player_10', 'away_player_11',
].join(', ');

export class SupabaseFixturesRepository implements IFixturesRepository {
    constructor(private readonly db: SupabaseClientLike = supabaseAdmin) {}

    async getFixtures(leagueId: number, jornada: number, userId: string): Promise<FixtureMatch[]> {
        const league = await this.getLeagueContext(leagueId);
        if (!league) return [];

        const matches = await this.getMatches(league.season as string, Number(league.kaggle_league_id ?? 0), jornada);
        if (!matches.length) return [];

        const [teamMap, myRosterIds] = await Promise.all([
            this.getTeams(matches),
            this.getRosterIds(leagueId, userId),
        ]);

        return matches.map(match => {
            const playerIds = this.extractMatchPlayerIds(match);

            return {
                home_team: teamMap.get(Number(match.home_team_api_id))?.name ?? `Eq. ${match.home_team_api_id}`,
                away_team: teamMap.get(Number(match.away_team_api_id))?.name ?? `Eq. ${match.away_team_api_id}`,
                home_club_logo_url: teamMap.get(Number(match.home_team_api_id))?.clubLogoUrl ?? null,
                away_club_logo_url: teamMap.get(Number(match.away_team_api_id))?.clubLogoUrl ?? null,
                has_my_player: playerIds.some(playerId => myRosterIds.has(playerId)),
            };
        });
    }

    private async getLeagueContext(leagueId: number): Promise<{ season: string; kaggle_league_id: number | null } | null> {
        const { data, error } = await this.db
            .from('fantasy_leagues')
            .select('season, kaggle_league_id')
            .eq('id', leagueId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener el contexto de la liga: ${error.message}`, 500);
        }

        return (data as { season: string; kaggle_league_id: number | null } | null) ?? null;
    }

    private async getMatches(season: string, kaggleLeagueId: number, jornada: number): Promise<Array<Record<string, unknown>>> {
        const { data, error } = await this.db
            .from('Match')
            .select(`home_team_api_id, away_team_api_id, ${MATCH_PLAYER_COLUMNS}`)
            .eq('season', season)
            .eq('league_id', kaggleLeagueId)
            .eq('stage', jornada);

        if (error) {
            throw new AppError(`Error al obtener los fixtures: ${error.message}`, 500);
        }

        return (data ?? []) as unknown as Array<Record<string, unknown>>;
    }

    private async getTeams(matches: Array<Record<string, unknown>>): Promise<Map<number, { name: string; clubLogoUrl: string | null }>> {
        const teamIds = [...new Set(matches.flatMap(match => [
            Number(match.home_team_api_id),
            Number(match.away_team_api_id),
        ]).filter(teamId => Number.isFinite(teamId) && teamId > 0))];

        if (!teamIds.length) return new Map();

        const { data, error } = await this.db
            .from('Team')
            .select('team_api_id, team_long_name, team_fifa_api_id')
            .in('team_api_id', teamIds);

        if (error) {
            throw new AppError(`Error al obtener los nombres de los equipos: ${error.message}`, 500);
        }

        return new Map((data ?? []).map(team => [
            Number(team.team_api_id),
            {
                name: String(team.team_long_name),
                clubLogoUrl: buildClubLogoUrl(team.team_fifa_api_id === null ? null : Number(team.team_fifa_api_id)),
            },
        ]));
    }

    private async getRosterIds(leagueId: number, userId: string): Promise<Set<number>> {
        const { data, error } = await this.db
            .from('user_roster')
            .select('player_api_id')
            .eq('league_id', leagueId)
            .eq('user_id', userId);

        if (error) {
            throw new AppError(`Error al obtener el roster del usuario: ${error.message}`, 500);
        }

        return new Set((data ?? []).map(row => Number(row.player_api_id)).filter(playerId => Number.isFinite(playerId)));
    }

    private extractMatchPlayerIds(match: Record<string, unknown>): number[] {
        const playerIds: number[] = [];

        for (let i = 1; i <= 11; i++) {
            const homeId = Number(match[`home_player_${i}`]);
            const awayId = Number(match[`away_player_${i}`]);

            if (Number.isFinite(homeId) && homeId > 0) playerIds.push(homeId);
            if (Number.isFinite(awayId) && awayId > 0) playerIds.push(awayId);
        }

        return playerIds;
    }
}
