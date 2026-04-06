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
exports.inferirPosicionesDesdeMatch = inferirPosicionesDesdeMatch;
const supabase_client_1 = require("../supabase.client");
/**
 * Infiere la posición de cada jugador usando la función SQL get_player_avg_y
 * que calcula la Y media táctica del jugador en la tabla Match de Kaggle.
 *
 * Y = 1        → PT
 * Y = 2..4     → DF
 * Y = 5..8     → MC
 * Y = 9..11    → DL
 */
function inferirPosicionesDesdeMatch(playerIds) {
    return __awaiter(this, void 0, void 0, function* () {
        const result = new Map();
        if (!playerIds.length)
            return result;
        const promises = playerIds.map((playerId) => __awaiter(this, void 0, void 0, function* () {
            const { data, error } = yield supabase_client_1.supabaseAdmin
                .rpc('get_player_avg_y', { p_player_id: playerId });
            if (error) {
                console.error(`[Posicion] RPC error para ${playerId}:`, error.message, error.code);
                result.set(playerId, 'MC');
            }
            else if (data === null || data === undefined) {
                console.warn(`[Posicion] Sin datos Y para jugador ${playerId}, usando MC`);
                result.set(playerId, 'MC');
            }
            else {
                const pos = yMediaAPosicion(Number(data));
                console.log(`[Posicion] Jugador ${playerId}: Y=${Number(data).toFixed(2)} → ${pos}`);
                result.set(playerId, pos);
            }
        }));
        yield Promise.all(promises);
        return result;
    });
}
function yMediaAPosicion(y) {
    if (y <= 1.5)
        return 'PT';
    if (y >= 2 && y <= 4.5)
        return 'DF';
    if (y >= 4.5 && y <= 8.5)
        return 'MC';
    return 'DL';
}
