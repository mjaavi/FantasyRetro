"use strict";
// ─────────────────────────────────────────────────────────────────────────────
// domain/models/player.models.ts
//
// Entidad central del dominio: el Jugador.
// PlayerPosition es el único lugar donde se define la posición táctica.
// Cualquier otro modelo que la necesite importa desde aquí.
// ─────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlayerPosition = void 0;
/**
 * Posición táctica de un jugador en el campo.
 * Fuente única de verdad — importar desde aquí, nunca redefinir.
 */
var PlayerPosition;
(function (PlayerPosition) {
    PlayerPosition["PT"] = "PT";
    PlayerPosition["DF"] = "DF";
    PlayerPosition["MC"] = "MC";
    PlayerPosition["DL"] = "DL";
})(PlayerPosition || (exports.PlayerPosition = PlayerPosition = {}));
