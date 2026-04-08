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
exports.SupabaseLeagueMarketRepository = void 0;
const AppError_1 = require("../../domain/errors/AppError");
const leaguePlayerDataHelper_1 = require("./leaguePlayerDataHelper");
const supabase_client_1 = require("../supabase.client");
const MATCH_PLAYER_COLS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4',
    'home_player_5', 'home_player_6', 'home_player_7', 'home_player_8',
    'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4',
    'away_player_5', 'away_player_6', 'away_player_7', 'away_player_8',
    'away_player_9', 'away_player_10', 'away_player_11',
];
class SupabaseLeagueMarketRepository {
    getActiveMarket(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: marketData, error: marketError } = yield supabase_client_1.supabaseAdmin
                .from('league_market')
                .select('id, league_id, player_api_id, expires_at, is_active')
                .eq('league_id', leagueId)
                .eq('is_active', true)
                .gt('expires_at', new Date().toISOString());
            if (marketError) {
                console.error('[LeagueMarket] getActiveMarket error:', marketError.message, marketError.code);
                throw new AppError_1.AppError('Error al obtener el mercado de la liga.', 500);
            }
            if (!(marketData === null || marketData === void 0 ? void 0 : marketData.length)) {
                return [];
            }
            return this.enriquecerJugadores(leagueId, marketData);
        });
    }
    getMarketForLeague(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: marketData, error: marketError } = yield supabase_client_1.supabaseAdmin
                .from('league_market')
                .select('id, league_id, player_api_id, expires_at, is_active')
                .eq('league_id', leagueId)
                .eq('is_active', true);
            if (marketError) {
                throw new AppError_1.AppError('Error al obtener el mercado de la liga.', 500);
            }
            if (!(marketData === null || marketData === void 0 ? void 0 : marketData.length)) {
                return [];
            }
            return this.enriquecerJugadores(leagueId, marketData);
        });
    }
    getMatchPlayerIds(kaggleLeagueId, season, excluidos) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: matchData, error: matchError } = yield supabase_client_1.supabaseAdmin
                .from('Match')
                .select(MATCH_PLAYER_COLS.join(','))
                .eq('league_id', kaggleLeagueId)
                .eq('season', season)
                .limit(200);
            if (matchError || !(matchData === null || matchData === void 0 ? void 0 : matchData.length)) {
                return [];
            }
            const excludedIds = new Set(excluidos);
            const playerSet = new Set();
            for (const match of matchData) {
                const row = match;
                for (const col of MATCH_PLAYER_COLS) {
                    const value = row[col];
                    if (!value) {
                        continue;
                    }
                    const playerId = Number(value);
                    if (!Number.isNaN(playerId) && playerId > 0 && !excludedIds.has(playerId)) {
                        playerSet.add(playerId);
                    }
                }
            }
            return Array.from(playerSet);
        });
    }
    openMarket(leagueId, playerApiIds, expiresAt) {
        return __awaiter(this, void 0, void 0, function* () {
            const rows = playerApiIds.map(playerApiId => ({
                league_id: leagueId,
                player_api_id: playerApiId,
                expires_at: expiresAt.toISOString(),
                is_active: true,
            }));
            const { error } = yield supabase_client_1.supabaseAdmin.from('league_market').insert(rows);
            if (error) {
                throw new AppError_1.AppError(`Error al abrir el mercado: ${error.message}`, 500);
            }
        });
    }
    closeMarket(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('league_market')
                .update({ is_active: false })
                .eq('league_id', leagueId)
                .eq('is_active', true);
            if (error) {
                console.error('[LeagueMarket] closeMarket error:', error.message, error.code);
                throw new AppError_1.AppError(`Error al cerrar el mercado: ${error.message}`, 500);
            }
        });
    }
    getExpiredMarkets() {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('league_market')
                .select('league_id')
                .eq('is_active', true)
                .lt('expires_at', new Date().toISOString());
            if (error) {
                throw new AppError_1.AppError('Error al buscar mercados expirados.', 500);
            }
            return [...new Set((data !== null && data !== void 0 ? data : []).map(row => row.league_id))];
        });
    }
    getPlayerIdsInLeague(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('user_roster')
                .select('player_api_id')
                .eq('league_id', leagueId);
            if (error) {
                throw new AppError_1.AppError('Error al obtener jugadores del roster.', 500);
            }
            return (data !== null && data !== void 0 ? data : []).map(row => row.player_api_id);
        });
    }
    getBidsForMarket(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .select('id, league_id, user_id, player_api_id, amount, created_at')
                .eq('league_id', leagueId);
            if (error) {
                throw new AppError_1.AppError('Error al obtener pujas del mercado.', 500);
            }
            return (data !== null && data !== void 0 ? data : []).map(row => ({
                id: row.id,
                leagueId: row.league_id,
                userId: row.user_id,
                playerApiId: row.player_api_id,
                amount: Number(row.amount),
                createdAt: row.created_at,
            }));
        });
    }
    getBidByUserAndPlayer(leagueId, userId, playerApiId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .select('id, league_id, user_id, player_api_id, amount, created_at')
                .eq('league_id', leagueId)
                .eq('user_id', userId)
                .eq('player_api_id', playerApiId)
                .maybeSingle();
            if (error) {
                console.error('[LeagueMarket] getBidByUserAndPlayer error:', error.message, error.code);
                throw new AppError_1.AppError('Error al buscar puja existente.', 500);
            }
            if (!data) {
                return null;
            }
            return {
                id: data.id,
                leagueId: data.league_id,
                userId: data.user_id,
                playerApiId: data.player_api_id,
                amount: Number(data.amount),
                createdAt: data.created_at,
            };
        });
    }
    upsertBid(leagueId, userId, playerApiId, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .upsert({ league_id: leagueId, user_id: userId, player_api_id: playerApiId, amount }, { onConflict: 'league_id,user_id,player_api_id' });
            if (error) {
                throw new AppError_1.AppError(`Error al registrar la puja: ${error.message}`, 500);
            }
        });
    }
    deleteBid(leagueId, userId, playerApiId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .delete()
                .eq('league_id', leagueId)
                .eq('user_id', userId)
                .eq('player_api_id', playerApiId);
            if (error) {
                throw new AppError_1.AppError('Error al cancelar la puja.', 500);
            }
        });
    }
    clearBidsForLeague(leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .delete()
                .eq('league_id', leagueId);
            if (error) {
                throw new AppError_1.AppError('Error al limpiar pujas de la liga.', 500);
            }
        });
    }
    getUserBidsForLeague(leagueId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('league_bids')
                .select('id, league_id, user_id, player_api_id, amount, created_at')
                .eq('league_id', leagueId)
                .eq('user_id', userId);
            if (error) {
                throw new AppError_1.AppError('Error al obtener pujas del usuario.', 500);
            }
            return (data !== null && data !== void 0 ? data : []).map(row => ({
                id: row.id,
                leagueId: row.league_id,
                userId: row.user_id,
                playerApiId: row.player_api_id,
                amount: Number(row.amount),
                createdAt: row.created_at,
            }));
        });
    }
    getUserBudget(userId, leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .from('league_participants')
                .select('budget')
                .eq('user_id', userId)
                .eq('league_id', leagueId)
                .single();
            if (error || !data) {
                throw new AppError_1.AppError('Error al obtener el presupuesto de la liga.', 500);
            }
            return Number(data.budget);
        });
    }
    updateUserBudget(userId, leagueId, newBudget) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('league_participants')
                .update({ budget: newBudget })
                .eq('user_id', userId)
                .eq('league_id', leagueId);
            if (error) {
                throw new AppError_1.AppError('Error al actualizar el presupuesto de la liga.', 500);
            }
        });
    }
    addPlayerToRoster(leagueId, userId, playerApiId, purchasePrice) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('user_roster')
                .insert({
                league_id: leagueId,
                user_id: userId,
                player_api_id: playerApiId,
                purchase_price: purchasePrice,
                is_starter: false,
            });
            if (error) {
                throw new AppError_1.AppError(`Error al anadir jugador al roster: ${error.message}`, 500);
            }
        });
    }
    enriquecerJugadores(leagueId, marketData) {
        return __awaiter(this, void 0, void 0, function* () {
            const playerIds = marketData.map(row => row.player_api_id);
            const playerData = yield (0, leaguePlayerDataHelper_1.loadLeaguePlayerData)(leagueId, playerIds);
            return marketData.map(row => {
                var _a, _b, _c, _d, _e, _f, _g;
                const player = playerData.get(row.player_api_id);
                return {
                    id: row.id,
                    leagueId: row.league_id,
                    playerApiId: row.player_api_id,
                    playerName: (_a = player === null || player === void 0 ? void 0 : player.name) !== null && _a !== void 0 ? _a : 'Desconocido',
                    realTeam: (_b = player === null || player === void 0 ? void 0 : player.realTeam) !== null && _b !== void 0 ? _b : 'Sin equipo',
                    position: ((_c = player === null || player === void 0 ? void 0 : player.position) !== null && _c !== void 0 ? _c : 'MC'),
                    overallRating: (_d = player === null || player === void 0 ? void 0 : player.overall) !== null && _d !== void 0 ? _d : 50,
                    expiresAt: row.expires_at,
                    isActive: row.is_active,
                    playerFifaApiId: (_e = player === null || player === void 0 ? void 0 : player.playerFifaApiId) !== null && _e !== void 0 ? _e : null,
                    faceUrl: (_f = player === null || player === void 0 ? void 0 : player.faceUrl) !== null && _f !== void 0 ? _f : null,
                    clubLogoUrl: (_g = player === null || player === void 0 ? void 0 : player.clubLogoUrl) !== null && _g !== void 0 ? _g : null,
                };
            });
        });
    }
}
exports.SupabaseLeagueMarketRepository = SupabaseLeagueMarketRepository;
