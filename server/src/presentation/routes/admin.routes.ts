import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireLeagueAdmin } from '../middleware/adminGuard.middleware';
import { requireAuth } from '../middleware/auth.middleware';

export function createAdminRouter(ctrl: AdminController): Router {
    const router = Router();
    const leagueAdminGuard = [requireAuth, requireLeagueAdmin] as const;

    router.get('/admin/ligas', requireAuth, ctrl.getEstadoLigas);
    router.post('/admin/ligas/:leagueId/procesar', ...leagueAdminGuard, ctrl.procesarJornada);
    router.post('/admin/ligas/:leagueId/regenerar-mercado', ...leagueAdminGuard, ctrl.regenerarMercado);
    router.get('/admin/ligas/:leagueId/jornada/:jornada', ...leagueAdminGuard, ctrl.getPuntosJornada);
    router.get('/admin/ligas/:leagueId/scores', ...leagueAdminGuard, ctrl.getScoresLiga);
    router.get('/admin/ligas/:leagueId/global-scores', ...leagueAdminGuard, ctrl.getGlobalScores);
    router.get('/admin/ligas/:leagueId/jugador/:playerApiId/historial', ...leagueAdminGuard, ctrl.getHistorialJugador);

    return router;
}
