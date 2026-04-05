import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { RankingController } from '../controllers/ranking.controller';

export function createRankingRouter(ctrl: RankingController): Router {
    const r = Router();
    r.get('/ranking/:leagueId', requireAuth, ctrl.getRanking);
    return r;
}