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
exports.LeagueOnboardingService = void 0;
const InitialPricingService_1 = require("./economy/InitialPricingService");
const leaguePlayerDataHelper_1 = require("../../infrastructure/repositories/leaguePlayerDataHelper");
const player_models_1 = require("../../domain/models/player.models");
const TARGET_MIN = 180000000;
const TARGET_MAX = 220000000;
class LeagueOnboardingService {
    constructor(marketRepo, leagueRepo, pricingService = new InitialPricingService_1.InitialPricingService()) {
        this.marketRepo = marketRepo;
        this.leagueRepo = leagueRepo;
        this.pricingService = pricingService;
    }
    /**
     * Asigna un equipo inicial aleatorio de 11 jugadores (1 PT, 4 DF, 4 MC, 2 DL)
     * cuyo valor este estrictamente entre TARGET_MIN y TARGET_MAX.
     */
    assignInitialTeam(leagueId, userId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            console.log(`[LeagueOnboarding] Generando equipo inicial para usuario ${userId} en liga ${leagueId}...`);
            const liga = yield this.leagueRepo.findById(leagueId);
            if (!liga)
                return;
            const season = liga.season;
            const kaggleLeagueId = (_a = liga.kaggle_league_id) !== null && _a !== void 0 ? _a : 1;
            // 1. Obtener todos los jugadores de la liga/temporada, excluyendo los ya fichados en la liga
            const excluidos = yield this.marketRepo.getPlayerIdsInLeague(leagueId);
            const playerIds = yield this.marketRepo.getMatchPlayerIds(kaggleLeagueId, season, excluidos);
            if (playerIds.length < 11) {
                console.error('[LeagueOnboarding] No hay suficientes jugadores disponibles para armar un equipo inicial.');
                return;
            }
            // 2. Cargar datos de los jugadores y sus precios
            const playerDataMap = yield (0, leaguePlayerDataHelper_1.loadLeaguePlayerData)(leagueId, playerIds);
            const availablePlayers = [];
            for (const player of playerDataMap.values()) {
                const priceResult = this.pricingService.calculate({
                    ovr: player.overall,
                    position: player.position,
                });
                availablePlayers.push(Object.assign(Object.assign({}, player), { price: priceResult.price }));
            }
            // 3. Generar el equipo aleatorio ajustado a los limites de valor
            const selectedTeam = this.generateTeamStrictSum(availablePlayers);
            if (!selectedTeam || selectedTeam.length !== 11) {
                console.error('[LeagueOnboarding] Fallo generando el equipo para el budget indicado.');
                return;
            }
            // 4. Inscribirlos en el `user_roster`
            let totalValue = 0;
            for (const player of selectedTeam) {
                totalValue += player.price;
                try {
                    // Al insertarlos manualmente aqui, los marcamos como titulares/suplentes despues.
                    // Insertamos asincronamente.
                    yield this.marketRepo.addPlayerToRoster(leagueId, userId, player.id, player.price);
                }
                catch (err) {
                    console.error(`[LeagueOnboarding] Error al insertar jugador ${player.id}: ${err.message}`);
                }
            }
            console.log(`[LeagueOnboarding] Equipo generado con exito. Valoracion total: ${totalValue}`);
        });
    }
    generateTeamStrictSum(players, iterationLimit = 1000) {
        // Agrupar jugadores disponibles por posicion
        const byPos = {
            [player_models_1.PlayerPosition.PT]: [],
            [player_models_1.PlayerPosition.DF]: [],
            [player_models_1.PlayerPosition.MC]: [],
            [player_models_1.PlayerPosition.DL]: []
        };
        for (const p of players) {
            if (byPos[p.position])
                byPos[p.position].push(p);
        }
        // Desordenar cada arreglo
        const shuffle = (array) => array.sort(() => 0.5 - Math.random());
        for (const pos in byPos)
            shuffle(byPos[pos]);
        // Requerimientos (11 total)
        const requirements = [
            { pos: player_models_1.PlayerPosition.PT, count: 1 },
            { pos: player_models_1.PlayerPosition.DF, count: 4 },
            { pos: player_models_1.PlayerPosition.MC, count: 4 },
            { pos: player_models_1.PlayerPosition.DL, count: 2 },
        ];
        let selectedTeam = [];
        // Seleccion inicial ingenua
        for (const req of requirements) {
            if (byPos[req.pos].length < req.count)
                return []; // Fallo critico
            selectedTeam.push(...byPos[req.pos].slice(0, req.count));
        }
        let totalVal = selectedTeam.reduce((acc, p) => acc + p.price, 0);
        for (let iter = 0; iter < iterationLimit; iter++) {
            if (totalVal >= TARGET_MIN && totalVal <= TARGET_MAX) {
                return selectedTeam; // Exito
            }
            // Elegir un cambio aleatorio
            const posToChange = requirements[Math.floor(Math.random() * requirements.length)].pos;
            const currentOfPos = selectedTeam.filter(p => p.position === posToChange);
            const playerToReplace = currentOfPos[Math.floor(Math.random() * currentOfPos.length)];
            const poolOfPos = byPos[posToChange].filter(p => !selectedTeam.find(s => s.id === p.id));
            if (!poolOfPos.length)
                continue;
            let newPlayer;
            if (totalVal < TARGET_MIN) {
                // Buscamos uno mas caro
                const richerPool = poolOfPos.filter(p => p.price > playerToReplace.price);
                newPlayer = richerPool.length > 0 ? richerPool[Math.floor(Math.random() * richerPool.length)] : null;
            }
            else {
                // Buscamos uno mas barato
                const cheaperPool = poolOfPos.filter(p => p.price < playerToReplace.price);
                newPlayer = cheaperPool.length > 0 ? cheaperPool[Math.floor(Math.random() * cheaperPool.length)] : null;
            }
            if (newPlayer) {
                selectedTeam = selectedTeam.filter(p => p.id !== playerToReplace.id);
                selectedTeam.push(newPlayer);
                totalVal = totalVal - playerToReplace.price + newPlayer.price;
            }
        }
        // Si excedemos el limite de iteraciones, devolvemos el equipo mas cercano
        return selectedTeam;
    }
}
exports.LeagueOnboardingService = LeagueOnboardingService;
