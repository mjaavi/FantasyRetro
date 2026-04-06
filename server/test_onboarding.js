"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const dotenv = __importStar(require("dotenv"));
dotenv.config();
const leagueOnboarding_service_1 = require("./src/application/services/leagueOnboarding.service");
const SupabaseLeagueMarketRepository_1 = require("./src/infrastructure/repositories/SupabaseLeagueMarketRepository");
const supabase_client_1 = require("./src/infrastructure/supabase.client");
function test() {
    return __awaiter(this, void 0, void 0, function* () {
        const marketRepo = new SupabaseLeagueMarketRepository_1.SupabaseLeagueMarketRepository();
        const leagueRepo = new (require('./src/infrastructure/repositories/SupabaseLeagueRepository').SupabaseLeagueRepository)();
        const service = new leagueOnboarding_service_1.LeagueOnboardingService(marketRepo, leagueRepo);
        const { data: leagues } = yield supabase_client_1.supabaseAdmin.from('fantasy_leagues').select('id, admin_id').limit(1);
        const liga = leagues[0];
        console.log(`Testing onboarding for league ${liga.id} and user ${liga.admin_id}`);
        try {
            yield service.assignInitialTeam(liga.id, liga.admin_id);
            console.log("Success!");
        }
        catch (err) {
            console.error("Failed:", err);
        }
    });
}
test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
