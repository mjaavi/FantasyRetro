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
const leaguePlayerDataHelper_1 = require("./src/infrastructure/repositories/leaguePlayerDataHelper");
const dotenv = require("dotenv");
dotenv.config();
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log('Testing Griezmann...');
        const data = yield (0, leaguePlayerDataHelper_1.loadLeaguePlayerData)(1, [184138, 281085, 185644]);
        console.log(data);
    });
}
run();
