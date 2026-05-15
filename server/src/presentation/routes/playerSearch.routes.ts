import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { PlayerSearchController } from '../controllers/playerSearch.controller';

export function createPlayerSearchRouter(ctrl: PlayerSearchController): Router {
    const r = Router();
    r.get('/leagues/:leagueId/players/search', requireAuth, ctrl.searchPlayers);
    return r;
}
