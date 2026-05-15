import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { RivalRosterController } from '../controllers/rivalRoster.controller';

export function createRivalRosterRouter(ctrl: RivalRosterController): Router {
    const r = Router();
    r.get('/leagues/:leagueId/rival-roster/:userId', requireAuth, ctrl.getRivalRoster);
    return r;
}
