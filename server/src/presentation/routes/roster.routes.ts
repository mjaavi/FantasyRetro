import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { requireLeagueParticipant } from '../middleware/adminGuard.middleware';
import { RosterController } from '../controllers/roster.controller';

export function createRosterRouter(ctrl: RosterController): Router {
    const r = Router();
    const participantGuard = [requireAuth, requireLeagueParticipant] as const;

    r.get('/roster/:leagueId',                    ...participantGuard, ctrl.getRoster);
    r.get('/roster/:leagueId/scores',             ...participantGuard, ctrl.getRosterScores);
    r.patch('/roster/:leagueId/:playerApiId',     ...participantGuard, ctrl.toggleStarter);
    return r;
}
