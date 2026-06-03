import { Router } from 'express';
import { PlatformAdminController } from '../controllers/platformAdmin.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requirePlatformAdmin } from '../middleware/platformAdminGuard.middleware';

export function createPlatformAdminRouter(ctrl: PlatformAdminController): Router {
    const router = Router();

    // Check platform admin status (only authentication required, checks if user is admin)
    router.get('/platform-admin/status', requireAuth, ctrl.checkAdminStatus);

    // Guard array requiring both authentication and platform admin permissions
    const adminGuard = [requireAuth, requirePlatformAdmin] as const;

    // User management routes
    router.get('/platform-admin/users', ...adminGuard, ctrl.getAllUsers);
    router.post('/platform-admin/users', ...adminGuard, ctrl.crearUsuario);
    router.post('/platform-admin/users/:userId/change-password', ...adminGuard, ctrl.cambiarContrasena);
    router.delete('/platform-admin/users/:userId', ...adminGuard, ctrl.borrarUsuario);

    // League management routes
    router.get('/platform-admin/leagues', ...adminGuard, ctrl.getAllLeagues);
    router.delete('/platform-admin/leagues/:leagueId', ...adminGuard, ctrl.deleteLeague);
    router.get('/platform-admin/leagues/:leagueId/participants', ...adminGuard, ctrl.getLeagueParticipants);
    router.post('/platform-admin/leagues/:leagueId/participants/:userId/budget', ...adminGuard, ctrl.allocateBudget);
    router.post('/platform-admin/leagues/:leagueId/resolve-market', ...adminGuard, ctrl.resolverPujasLiga);

    return router;
}
