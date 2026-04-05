import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { LeagueController } from '../controllers/league.controller';

export function createLeagueRouter(ctrl: LeagueController): Router {
    const r = Router();
    r.get('/temporadas',              ctrl.getTemporadas);
    r.get('/leagues',    requireAuth,  ctrl.getMisLigas);
    r.post('/leagues',   requireAuth,  ctrl.crearLiga);
    r.post('/leagues/join', requireAuth, ctrl.unirseALiga);
    r.get('/leagues/:leagueId', requireAuth, ctrl.getLiga);
    return r;
}