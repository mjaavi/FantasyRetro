import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { ScoringController } from '../controllers/scoring.controller';

export function createScoringRouter(ctrl: ScoringController): Router {
    const r = Router();
    r.get('/scoring/:leagueId/players', requireAuth, ctrl.getScoringForUser);
    return r;
}