"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadLeaguePlayerData = loadLeaguePlayerData;
const AppError_1 = require("../../domain/errors/AppError");
const supabase_client_1 = require("../supabase.client");
const posicionHelper_1 = require("./posicionHelper");
const assetUrlHelper_1 = require("./assetUrlHelper");
const MATCH_PLAYER_COLUMNS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4',
    'home_player_5', 'home_player_6', 'home_player_7', 'home_player_8',
    'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4',
    'away_player_5', 'away_player_6', 'away_player_7', 'away_player_8',
    'away_player_9', 'away_player_10', 'away_player_11',
];
function loadLeaguePlayerData(leagueId, rawPlayerIds) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b, _c, _d, _e, _f, _g;
        const playerIds = [...new Set(rawPlayerIds.filter(playerId => Number.isInteger(playerId) && playerId > 0))];
        if (!playerIds.length) {
            return new Map();
        }
        const leagueContext = yield fetchLeagueContext(leagueId);
        const [players, attributes, positions, seasonalClubs] = yield Promise.all([
            fetchPlayers(playerIds),
            fetchAttributes(playerIds, leagueContext),
            (0, posicionHelper_1.inferirPosicionesDesdeMatch)(playerIds),
            resolveSeasonalClubs(leagueContext, playerIds),
        ]);
        const data = new Map();
        for (const playerId of playerIds) {
            const player = players.get(playerId);
            const attr = attributes.get(playerId);
            const club = seasonalClubs.get(playerId);
            data.set(playerId, {
                id: playerId,
                name: (_a = player === null || player === void 0 ? void 0 : player.player_name) !== null && _a !== void 0 ? _a : 'Desconocido',
                position: (_b = positions.get(playerId)) !== null && _b !== void 0 ? _b : 'MC',
                overall: (_c = attr === null || attr === void 0 ? void 0 : attr.overall_rating) !== null && _c !== void 0 ? _c : 50,
                playerFifaApiId: (_d = player === null || player === void 0 ? void 0 : player.player_fifa_api_id) !== null && _d !== void 0 ? _d : null,
                faceUrl: (_e = player === null || player === void 0 ? void 0 : player.player_face_url) !== null && _e !== void 0 ? _e : null,
                realTeam: (_f = club === null || club === void 0 ? void 0 : club.realTeam) !== null && _f !== void 0 ? _f : 'Sin equipo',
                clubLogoUrl: (_g = club === null || club === void 0 ? void 0 : club.clubLogoUrl) !== null && _g !== void 0 ? _g : null,
            });
        }
        return data;
    });
}
function fetchPlayers(playerIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const allData = [];
        const CHUNK_SIZE = 100;
        for (let i = 0; i < playerIds.length; i += CHUNK_SIZE) {
            const chunk = playerIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('Player')
                .select('player_api_id, player_name, player_fifa_api_id, player_face_url')
                .in('player_api_id', chunk);
            if (error) {
                throw new AppError_1.AppError(`Error al obtener jugadores: ${error.message}`, 500);
            }
            allData.push(...(data !== null && data !== void 0 ? data : []));
        }
        return new Map(allData.map(row => [
            Number(row.player_api_id),
            {
                player_api_id: Number(row.player_api_id),
                player_name: row.player_name,
                player_fifa_api_id: row.player_fifa_api_id === null ? null : Number(row.player_fifa_api_id),
                player_face_url: row.player_face_url,
            },
        ]));
    });
}
function fetchAttributes(playerIds, leagueContext) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const allData = [];
        const CHUNK_SIZE = 30; // Cada jugador puede tener 10-30 filas de atributos. 30 * 30 = 900 (<1000 limit)
        for (let i = 0; i < playerIds.length; i += CHUNK_SIZE) {
            const chunk = playerIds.slice(i, i + CHUNK_SIZE);
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('Player_Attributes')
                .select('player_api_id, overall_rating, date')
                .in('player_api_id', chunk);
            if (error) {
                throw new AppError_1.AppError(`Error al obtener atributos de jugador: ${error.message}`, 500);
            }
            allData.push(...(data !== null && data !== void 0 ? data : []));
        }
        const targetTimestamp = getSeasonReferenceTimestamp((_a = leagueContext === null || leagueContext === void 0 ? void 0 : leagueContext.season) !== null && _a !== void 0 ? _a : null);
        const selectedAttributes = new Map();
        for (const row of allData) {
            const normalizedRow = {
                player_api_id: Number(row.player_api_id),
                overall_rating: row.overall_rating === null ? null : Number(row.overall_rating),
                date: row.date,
            };
            const timestamp = getAttributeTimestamp(normalizedRow.date);
            const distance = getAttributeDistance(timestamp, targetTimestamp);
            const current = selectedAttributes.get(normalizedRow.player_api_id);
            if (!current ||
                distance < current.distance ||
                (distance === current.distance && timestamp > current.timestamp)) {
                selectedAttributes.set(normalizedRow.player_api_id, {
                    row: normalizedRow,
                    distance,
                    timestamp,
                });
            }
        }
        return new Map([...selectedAttributes.entries()].map(([playerId, selected]) => [playerId, selected.row]));
    });
}
function resolveSeasonalClubs(leagueContext, playerIds) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!(leagueContext === null || leagueContext === void 0 ? void 0 : leagueContext.season) || !leagueContext.kaggle_league_id) {
            return new Map();
        }
        const { data: matches, error: matchError } = yield supabase_client_1.supabaseAdmin
            .from('Match')
            .select(`date, home_team_api_id, away_team_api_id, ${MATCH_PLAYER_COLUMNS.join(', ')}`)
            .eq('season', leagueContext.season)
            .eq('league_id', leagueContext.kaggle_league_id);
        if (matchError) {
            throw new AppError_1.AppError(`Error al resolver el club por temporada: ${matchError.message}`, 500);
        }
        if (!(matches === null || matches === void 0 ? void 0 : matches.length)) {
            return new Map();
        }
        const trackedPlayers = new Set(playerIds);
        const latestTeamByPlayer = new Map();
        for (const rawMatch of matches) {
            const timestamp = getMatchTimestamp(rawMatch.date);
            const homeTeamId = toPositiveNumber(rawMatch.home_team_api_id);
            const awayTeamId = toPositiveNumber(rawMatch.away_team_api_id);
            for (let index = 1; index <= 11; index++) {
                const homePlayerId = toPositiveNumber(rawMatch[`home_player_${index}`]);
                const awayPlayerId = toPositiveNumber(rawMatch[`away_player_${index}`]);
                if (homePlayerId && trackedPlayers.has(homePlayerId) && homeTeamId) {
                    registerLatestTeam(latestTeamByPlayer, homePlayerId, homeTeamId, timestamp);
                }
                if (awayPlayerId && trackedPlayers.has(awayPlayerId) && awayTeamId) {
                    registerLatestTeam(latestTeamByPlayer, awayPlayerId, awayTeamId, timestamp);
                }
            }
        }
        const teamIds = [...new Set([...latestTeamByPlayer.values()]
                .map(entry => entry.teamApiId)
                .filter(teamApiId => teamApiId > 0))];
        if (!teamIds.length) {
            return new Map();
        }
        const { data: teams, error: teamError } = yield supabase_client_1.supabaseAdmin
            .from('Team')
            .select('team_api_id, team_fifa_api_id, team_long_name')
            .in('team_api_id', teamIds);
        if (teamError) {
            throw new AppError_1.AppError(`Error al obtener los equipos de temporada: ${teamError.message}`, 500);
        }
        const teamMap = new Map((teams !== null && teams !== void 0 ? teams : []).map(row => [
            Number(row.team_api_id),
            {
                team_api_id: Number(row.team_api_id),
                team_fifa_api_id: row.team_fifa_api_id === null ? null : Number(row.team_fifa_api_id),
                team_long_name: row.team_long_name,
            },
        ]));
        const clubData = new Map();
        for (const [playerId, latestTeam] of latestTeamByPlayer.entries()) {
            const team = teamMap.get(latestTeam.teamApiId);
            clubData.set(playerId, {
                realTeam: (_a = team === null || team === void 0 ? void 0 : team.team_long_name) !== null && _a !== void 0 ? _a : 'Sin equipo',
                clubLogoUrl: (0, assetUrlHelper_1.buildClubLogoUrl)((_b = team === null || team === void 0 ? void 0 : team.team_fifa_api_id) !== null && _b !== void 0 ? _b : null),
            });
        }
        return clubData;
    });
}
function fetchLeagueContext(leagueId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const { data, error } = yield supabase_client_1.supabaseAdmin
            .from('fantasy_leagues')
            .select('season, kaggle_league_id')
            .eq('id', leagueId)
            .maybeSingle();
        if (error) {
            throw new AppError_1.AppError(`Error al obtener el contexto de la liga: ${error.message}`, 500);
        }
        if (!data) {
            return null;
        }
        return {
            season: String((_a = data.season) !== null && _a !== void 0 ? _a : ''),
            kaggle_league_id: data.kaggle_league_id === null ? null : Number(data.kaggle_league_id),
        };
    });
}
function registerLatestTeam(latestTeamByPlayer, playerId, teamApiId, timestamp) {
    const current = latestTeamByPlayer.get(playerId);
    if (!current || timestamp >= current.timestamp) {
        latestTeamByPlayer.set(playerId, { teamApiId, timestamp });
    }
}
function getMatchTimestamp(date) {
    if (!date) {
        return 0;
    }
    const timestamp = Date.parse(date);
    return Number.isNaN(timestamp) ? 0 : timestamp;
}
function toPositiveNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}
function getSeasonReferenceTimestamp(season) {
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
function getAttributeTimestamp(date) {
    if (!date) {
        return Number.NEGATIVE_INFINITY;
    }
    const timestamp = Date.parse(date);
    return Number.isNaN(timestamp) ? Number.NEGATIVE_INFINITY : timestamp;
}
function getAttributeDistance(timestamp, targetTimestamp) {
    if (targetTimestamp === null) {
        return Number.POSITIVE_INFINITY;
    }
    if (!Number.isFinite(timestamp)) {
        return Number.POSITIVE_INFINITY;
    }
    return Math.abs(timestamp - targetTimestamp);
}
