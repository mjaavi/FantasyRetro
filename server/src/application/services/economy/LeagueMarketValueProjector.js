"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LeagueMarketValueProjector = void 0;
const InitialPricingService_1 = require("./InitialPricingService");
class LeagueMarketValueProjector {
    constructor(initialPricingService = new InitialPricingService_1.InitialPricingService()) {
        this.initialPricingService = initialPricingService;
    }
    projectPlayers(players) {
        return players.map((player) => {
            const valuation = this.initialPricingService.calculate({
                ovr: player.overallRating,
                position: player.position,
            });
            return Object.assign(Object.assign({}, player), { marketValue: valuation.price });
        });
    }
}
exports.LeagueMarketValueProjector = LeagueMarketValueProjector;
