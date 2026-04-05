import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { FixturesController } from '../controllers/fixtures.controller';

export function createFixturesRouter(ctrl: FixturesController): Router {
    const r = Router();
    r.get('/fixtures/:leagueId', requireAuth, ctrl.getFixtures);
    return r;
}