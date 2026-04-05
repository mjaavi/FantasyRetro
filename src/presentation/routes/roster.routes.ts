import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { RosterController } from '../controllers/roster.controller';

export function createRosterRouter(ctrl: RosterController): Router {
    const r = Router();
    r.get('/roster/:leagueId',                    requireAuth, ctrl.getRoster);
    r.patch('/roster/:leagueId/:playerApiId',     requireAuth, ctrl.toggleStarter);
    return r;
}