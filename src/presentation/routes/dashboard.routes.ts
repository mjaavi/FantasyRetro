import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { DashboardController } from '../controllers/dashboard.controller';

export function createDashboardRouter(ctrl: DashboardController): Router {
    const r = Router();
    r.get('/dashboard/:leagueId', requireAuth, ctrl.getDashboard);
    return r;
}