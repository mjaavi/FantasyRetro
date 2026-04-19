import { AppError } from '../../domain/errors/AppError';
import { supabaseAdmin } from '../supabase.client';
import { inferirPosicionesDesdeMatch } from './posicionHelper';
import { buildClubLogoUrl } from './assetUrlHelper';

const MATCH_PLAYER_COLUMNS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4',
    'home_player_5', 'home_player_6', 'home_player_7', 'home_player_8',
    'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4',
    'away_player_5', 'away_player_6', 'away_player_7', 'away_player_8',
    'away_player_9', 'away_player_10', 'away_player_11',
] as const;

type MatchPlayerColumn = typeof MATCH_PLAYER_COLUMNS[number];

interface LeagueContext {
    season: string;
    kaggle_league_id: number | null;
}

interface SeasonalClubData {
    realTeam: string;
    clubLogoUrl: string | null;
}

interface PlayerRow {
    player_api_id: number;
    player_name: string | null;
    player_fifa_api_id: number | null;
    player_face_url: string | null;
}

interface PlayerAttributeRow {
    player_api_id: number;
    overall_rating: number | null;
    date: string | null;
}

interface TeamRow {
    team_api_id: number;
    team_fifa_api_id: number | null;
    team_long_name: string | null;
}

type MatchRow = {
    date: string | null;
    home_team_api_id: number | null;
    away_team_api_id: number | null;
} & Partial<Record<MatchPlayerColumn, number | null>>;

export interface LeaguePlayerData {
    id: number;
    name: string;
    position: string;
    overall: number;
    playerFifaApiId: number | null;
    faceUrl: string | null;
    realTeam: string;
    clubLogoUrl: string | null;
}

const leagueContextCache = new Map<number, LeagueContext | null>();
const playerCache = new Map<number, PlayerRow | null>();
const playerAttributeCache = new Map<string, PlayerAttributeRow | null>();
const seasonalClubCache = new Map<string, Map<number, SeasonalClubData>>();

export async function loadLeaguePlayerData(
    leagueId: number,
    rawPlayerIds: number[],
): Promise<Map<number, LeaguePlayerData>> {
    const playerIds = [...new Set(rawPlayerIds.filter(playerId => Number.isInteger(playerId) && playerId > 0))];
    if (!playerIds.length) {
        return new Map();
    }

    const leagueContext = await fetchLeagueContext(leagueId);
    const [players, attributes, positions, seasonalClubs] = await Promise.all([
        fetchPlayers(playerIds),
        fetchAttributes(playerIds, leagueContext),
        inferirPosicionesDesdeMatch(playerIds),
        resolveSeasonalClubs(leagueContext, playerIds),
    ]);

    const data = new Map<number, LeaguePlayerData>();

    for (const playerId of playerIds) {
        const player = players.get(playerId);
        const attr = attributes.get(playerId);
        const club = seasonalClubs.get(playerId);

        data.set(playerId, {
            id: playerId,
            name: player?.player_name ?? 'Desconocido',
            position: positions.get(playerId) ?? 'MC',
            overall: attr?.overall_rating ?? 50,
            playerFifaApiId: player?.player_fifa_api_id ?? null,
            faceUrl: player?.player_face_url ?? null,
            realTeam: club?.realTeam ?? 'Sin equipo',
            clubLogoUrl: club?.clubLogoUrl ?? null,
        });
    }

    return data;
}

async function fetchPlayers(playerIds: number[]): Promise<Map<number, PlayerRow>> {
    const result = new Map<number, PlayerRow>();
    const missingIds: number[] = [];

    for (const playerId of playerIds) {
        const cachedPlayer = playerCache.get(playerId);
        if (cachedPlayer !== undefined) {
            if (cachedPlayer) {
                result.set(playerId, cachedPlayer);
            }
            continue;
        }

        missingIds.push(playerId);
    }

    const CHUNK_SIZE = 100;
    for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        const chunk = missingIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabaseAdmin
            .from('Player')
            .select('player_api_id, player_name, player_fifa_api_id, player_face_url')
            .in('player_api_id', chunk);

        if (error) {
            throw new AppError(`Error al obtener jugadores: ${error.message}`, 500);
        }

        const chunkMap = new Map<number, PlayerRow>();
        for (const row of data ?? []) {
            const normalizedRow: PlayerRow = {
                player_api_id: Number(row.player_api_id),
                player_name: row.player_name as string | null,
                player_fifa_api_id: row.player_fifa_api_id === null ? null : Number(row.player_fifa_api_id),
                player_face_url: row.player_face_url as string | null,
            };

            chunkMap.set(normalizedRow.player_api_id, normalizedRow);
            playerCache.set(normalizedRow.player_api_id, normalizedRow);
            result.set(normalizedRow.player_api_id, normalizedRow);
        }

        for (const playerId of chunk) {
            if (!chunkMap.has(playerId)) {
                playerCache.set(playerId, null);
            }
        }
    }

    return result;
}

async function fetchAttributes(
    playerIds: number[],
    leagueContext: LeagueContext | null,
): Promise<Map<number, PlayerAttributeRow>> {
    const result = new Map<number, PlayerAttributeRow>();
    const missingIds: number[] = [];
    const seasonKey = leagueContext?.season ?? 'unknown';

    for (const playerId of playerIds) {
        const cacheKey = `${seasonKey}:${playerId}`;
        const cachedAttribute = playerAttributeCache.get(cacheKey);
        if (cachedAttribute !== undefined) {
            if (cachedAttribute) {
                result.set(playerId, cachedAttribute);
            }
            continue;
        }

        missingIds.push(playerId);
    }

    const targetTimestamp = getSeasonReferenceTimestamp(leagueContext?.season ?? null);
    const CHUNK_SIZE = 30;

    for (let i = 0; i < missingIds.length; i += CHUNK_SIZE) {
        const chunk = missingIds.slice(i, i + CHUNK_SIZE);
        const { data, error } = await supabaseAdmin
            .from('Player_Attributes')
            .select('player_api_id, overall_rating, date')
            .in('player_api_id', chunk);

        if (error) {
            throw new AppError(`Error al obtener atributos de jugador: ${error.message}`, 500);
        }

        const selectedAttributes = new Map<number, { row: PlayerAttributeRow; distance: number; timestamp: number }>();

        for (const row of data ?? []) {
            const normalizedRow: PlayerAttributeRow = {
                player_api_id: Number(row.player_api_id),
                overall_rating: row.overall_rating === null ? null : Number(row.overall_rating),
                date: row.date as string | null,
            };

            const timestamp = getAttributeTimestamp(normalizedRow.date);
            const distance = getAttributeDistance(timestamp, targetTimestamp);
            const current = selectedAttributes.get(normalizedRow.player_api_id);

            if (!current || distance < current.distance || (distance === current.distance && timestamp > current.timestamp)) {
                selectedAttributes.set(normalizedRow.player_api_id, {
                    row: normalizedRow,
                    distance,
                    timestamp,
                });
            }
        }

        for (const playerId of chunk) {
            const cacheKey = `${seasonKey}:${playerId}`;
            const selected = selectedAttributes.get(playerId)?.row ?? null;
            playerAttributeCache.set(cacheKey, selected);

            if (selected) {
                result.set(playerId, selected);
            }
        }
    }

    return result;
}

async function resolveSeasonalClubs(
    leagueContext: LeagueContext | null,
    playerIds: number[],
): Promise<Map<number, SeasonalClubData>> {
    if (!leagueContext?.season || !leagueContext.kaggle_league_id) {
        return new Map();
    }

    const cacheKey = `${leagueContext.season}:${leagueContext.kaggle_league_id}`;
    let cachedSeasonalClubs = seasonalClubCache.get(cacheKey);

    if (!cachedSeasonalClubs) {
        cachedSeasonalClubs = await buildSeasonalClubCache(leagueContext);
        seasonalClubCache.set(cacheKey, cachedSeasonalClubs);
    }

    const result = new Map<number, SeasonalClubData>();
    for (const playerId of playerIds) {
        const club = cachedSeasonalClubs.get(playerId);
        if (club) {
            result.set(playerId, club);
        }
    }

    return result;
}

async function buildSeasonalClubCache(leagueContext: LeagueContext): Promise<Map<number, SeasonalClubData>> {
    const { data: matches, error: matchError } = await supabaseAdmin
        .from('Match')
        .select(`date, home_team_api_id, away_team_api_id, ${MATCH_PLAYER_COLUMNS.join(', ')}`)
        .eq('season', leagueContext.season)
        .eq('league_id', leagueContext.kaggle_league_id);

    if (matchError) {
        throw new AppError(`Error al resolver el club por temporada: ${matchError.message}`, 500);
    }

    if (!matches?.length) {
        return new Map();
    }

    const latestTeamByPlayer = new Map<number, { teamApiId: number; timestamp: number }>();

    for (const rawMatch of matches as unknown as MatchRow[]) {
        const timestamp = getMatchTimestamp(rawMatch.date);
        const homeTeamId = toPositiveNumber(rawMatch.home_team_api_id);
        const awayTeamId = toPositiveNumber(rawMatch.away_team_api_id);

        for (let index = 1; index <= 11; index++) {
            const homePlayerId = toPositiveNumber(rawMatch[`home_player_${index}` as MatchPlayerColumn]);
            const awayPlayerId = toPositiveNumber(rawMatch[`away_player_${index}` as MatchPlayerColumn]);

            if (homePlayerId && homeTeamId) {
                registerLatestTeam(latestTeamByPlayer, homePlayerId, homeTeamId, timestamp);
            }

            if (awayPlayerId && awayTeamId) {
                registerLatestTeam(latestTeamByPlayer, awayPlayerId, awayTeamId, timestamp);
            }
        }
    }

    const teamIds = [...new Set(
        [...latestTeamByPlayer.values()]
            .map(entry => entry.teamApiId)
            .filter(teamApiId => teamApiId > 0),
    )];

    if (!teamIds.length) {
        return new Map();
    }

    const { data: teams, error: teamError } = await supabaseAdmin
        .from('Team')
        .select('team_api_id, team_fifa_api_id, team_long_name')
        .in('team_api_id', teamIds);

    if (teamError) {
        throw new AppError(`Error al obtener los equipos de temporada: ${teamError.message}`, 500);
    }

    const teamMap = new Map<number, TeamRow>((teams ?? []).map(row => [
        Number(row.team_api_id),
        {
            team_api_id: Number(row.team_api_id),
            team_fifa_api_id: row.team_fifa_api_id === null ? null : Number(row.team_fifa_api_id),
            team_long_name: row.team_long_name as string | null,
        },
    ]));

    const clubData = new Map<number, SeasonalClubData>();
    for (const [playerId, latestTeam] of latestTeamByPlayer.entries()) {
        const team = teamMap.get(latestTeam.teamApiId);
        clubData.set(playerId, {
            realTeam: team?.team_long_name ?? 'Sin equipo',
            clubLogoUrl: buildClubLogoUrl(team?.team_fifa_api_id ?? null),
        });
    }

    return clubData;
}

async function fetchLeagueContext(leagueId: number): Promise<LeagueContext | null> {
    if (leagueContextCache.has(leagueId)) {
        return leagueContextCache.get(leagueId) ?? null;
    }

    const { data, error } = await supabaseAdmin
        .from('fantasy_leagues')
        .select('season, kaggle_league_id')
        .eq('id', leagueId)
        .maybeSingle();

    if (error) {
        throw new AppError(`Error al obtener el contexto de la liga: ${error.message}`, 500);
    }

    const context = data
        ? {
            season: String(data.season ?? ''),
            kaggle_league_id: data.kaggle_league_id === null ? null : Number(data.kaggle_league_id),
        }
        : null;

    leagueContextCache.set(leagueId, context);
    return context;
}

function registerLatestTeam(
    latestTeamByPlayer: Map<number, { teamApiId: number; timestamp: number }>,
    playerId: number,
    teamApiId: number,
    timestamp: number,
): void {
    const current = latestTeamByPlayer.get(playerId);

    if (!current || timestamp >= current.timestamp) {
        latestTeamByPlayer.set(playerId, { teamApiId, timestamp });
    }
}

function getMatchTimestamp(date: string | null): number {
    if (!date) {
        return 0;
    }

    const timestamp = Date.parse(date);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}

function toPositiveNumber(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getSeasonReferenceTimestamp(season: string | null): number | null {
    if (!season) {
        return null;
    }

    const match = season.match(/^(\d{4})(?:\/(\d{4}))?$/);
    if (!match) {
        return null;
    }

    const startYear = Number(match[1]);
    if (!Number.isInteger(startYear)) {
        return null;
    }

    return Date.UTC(startYear, 6, 1);
}

function getAttributeTimestamp(date: string | null): number {
    if (!date) {
        return Number.NEGATIVE_INFINITY;
    }

    const timestamp = Date.parse(date);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}

function getAttributeDistance(timestamp: number, targetTimestamp: number | null): number {
    if (targetTimestamp === null) {
        return Number.POSITIVE_INFINITY;
    }

    if (!Number.isFinite(timestamp)) {
        return Number.POSITIVE_INFINITY;
    }

    return Math.abs(timestamp - targetTimestamp);
}
