import { Router } from 'express';
import { AdminController } from '../controllers/admin.controller';
import { requireLeagueAdmin, requireLeagueParticipant } from '../middleware/adminGuard.middleware';
import { requireAuth } from '../middleware/auth.middleware';

export function createAdminRouter(ctrl: AdminController): Router {
    const router = Router();
    const leagueAdminGuard = [requireAuth, requireLeagueAdmin] as const;
    const leagueParticipantGuard = [requireAuth, requireLeagueParticipant] as const;

    router.get('/admin/ligas', requireAuth, ctrl.getEstadoLigas);
    router.post('/admin/ligas/:leagueId/procesar', ...leagueAdminGuard, ctrl.procesarJornada);
    router.post('/admin/ligas/:leagueId/regenerar-mercado', ...leagueAdminGuard, ctrl.regenerarMercado);
    router.get('/admin/ligas/:leagueId/jornada/:jornada', ...leagueAdminGuard, ctrl.getPuntosJornada);
    router.get('/admin/ligas/:leagueId/scores', ...leagueParticipantGuard, ctrl.getScoresLiga);
    router.get('/admin/ligas/:leagueId/global-scores', ...leagueParticipantGuard, ctrl.getGlobalScores);
    router.get('/admin/ligas/:leagueId/jugador/:playerApiId/historial', ...leagueParticipantGuard, ctrl.getHistorialJugador);

    return router;
}
