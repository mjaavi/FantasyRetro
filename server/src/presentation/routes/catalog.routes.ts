import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireCatalogAdmin } from '../middleware/catalogAdminGuard.middleware';

export function createCatalogRouter(ctrl: CatalogController): Router {
    const router = Router();

    router.get('/catalog/league-options', ctrl.getLeagueCreationOptions);
    router.get('/catalog/competitions', ctrl.getCompetitions);
    router.get('/catalog/seasons', ctrl.getSeasons);
    router.get('/catalog/import-jobs', requireAuth, requireCatalogAdmin, ctrl.getImportJobs);

    return router;
}
