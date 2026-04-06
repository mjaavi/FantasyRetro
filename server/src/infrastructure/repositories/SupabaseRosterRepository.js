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
exports.SupabaseRosterRepository = void 0;
const supabase_client_1 = require("../supabase.client");
const AppError_1 = require("../../domain/errors/AppError");
const leaguePlayerDataHelper_1 = require("./leaguePlayerDataHelper");
class SupabaseRosterRepository {
    findByUserAndLeague(userId, leagueId) {
        return __awaiter(this, void 0, void 0, function* () {
            const { data: rosterData, error: rosterError } = yield supabase_client_1.supabaseAdmin
                .from('user_roster')
                .select('player_api_id, is_starter, purchase_price')
                .eq('user_id', userId)
                .eq('league_id', leagueId);
            if (rosterError) {
                throw new AppError_1.AppError(`Error al obtener la plantilla: ${rosterError.message}`, 500);
            }
            if (!(rosterData === null || rosterData === void 0 ? void 0 : rosterData.length)) {
                return [];
            }
            const playerIds = rosterData.map(row => Number(row.player_api_id));
            const playerData = yield (0, leaguePlayerDataHelper_1.loadLeaguePlayerData)(leagueId, playerIds);
            return rosterData.map(row => {
                var _a, _b, _c, _d, _e, _f, _g, _h;
                const playerId = Number(row.player_api_id);
                const player = playerData.get(playerId);
                return {
                    id: playerId,
                    name: (_a = player === null || player === void 0 ? void 0 : player.name) !== null && _a !== void 0 ? _a : 'Desconocido',
                    position: (_b = player === null || player === void 0 ? void 0 : player.position) !== null && _b !== void 0 ? _b : 'MC',
                    real_team: (_c = player === null || player === void 0 ? void 0 : player.realTeam) !== null && _c !== void 0 ? _c : 'Sin equipo',
                    overall: (_d = player === null || player === void 0 ? void 0 : player.overall) !== null && _d !== void 0 ? _d : 50,
                    is_starter: Boolean(row.is_starter),
                    purchase_price: Number((_e = row.purchase_price) !== null && _e !== void 0 ? _e : 0),
                    playerFifaApiId: (_f = player === null || player === void 0 ? void 0 : player.playerFifaApiId) !== null && _f !== void 0 ? _f : null,
                    faceUrl: (_g = player === null || player === void 0 ? void 0 : player.faceUrl) !== null && _g !== void 0 ? _g : null,
                    clubLogoUrl: (_h = player === null || player === void 0 ? void 0 : player.clubLogoUrl) !== null && _h !== void 0 ? _h : null,
                };
            });
        });
    }
    updateStarter(userId, leagueId, playerApiId, isStarter) {
        return __awaiter(this, void 0, void 0, function* () {
            const { error } = yield supabase_client_1.supabaseAdmin
                .from('user_roster')
                .update({ is_starter: isStarter })
                .eq('user_id', userId)
                .eq('league_id', leagueId)
                .eq('player_api_id', playerApiId);
            if (error) {
                throw new AppError_1.AppError('Error al actualizar el once inicial.', 500);
            }
        });
    }
    addPlayer(userId, leagueId, playerApiId, purchasePrice, userToken) {
        return __awaiter(this, void 0, void 0, function* () {
            const db = (0, supabase_client_1.supabaseAsUser)(userToken);
            const { error } = yield db
                .from('user_roster')
                .insert({
                user_id: userId,
                league_id: leagueId,
                player_api_id: playerApiId,
                purchase_price: purchasePrice,
                is_starter: false,
            });
            if (error) {
                throw new AppError_1.AppError(`Error al anadir jugador: ${error.message}`, 500);
            }
        });
    }
}
exports.SupabaseRosterRepository = SupabaseRosterRepository;
