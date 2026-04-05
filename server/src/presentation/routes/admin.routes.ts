import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireAdmin } from '../middleware/adminGuard.middleware';
import { requireAuth } from '../middleware/auth.middleware';

export function createAdminRouter(ctrl: AdminController): Router {
    const router = Router();
    const adminGuard = [requireAuth, requireAdmin] as const;

    router.get('/admin/ligas', ...adminGuard, ctrl.getEstadoLigas);
    router.post('/admin/ligas/:leagueId/procesar', ...adminGuard, ctrl.procesarJornada);
    router.post('/admin/ligas/:leagueId/regenerar-mercado', ...adminGuard, ctrl.regenerarMercado);
    router.get('/admin/ligas/:leagueId/jornada/:jornada', ...adminGuard, ctrl.getPuntosJornada);
    router.get('/admin/ligas/:leagueId/scores', ...adminGuard, ctrl.getScoresLiga);
    router.get('/admin/ligas/:leagueId/global-scores', ...adminGuard, ctrl.getGlobalScores);
    router.get('/admin/ligas/:leagueId/jugador/:playerApiId/historial', ...adminGuard, ctrl.getHistorialJugador);

    return router;
}
