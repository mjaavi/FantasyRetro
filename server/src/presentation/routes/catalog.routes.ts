import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';
import { requireAuth } from '../middleware/auth.middleware';
import { requireCatalogAdmin } from '../middleware/catalogAdminGuard.middleware';

export function createCatalogRouter(ctrl: CatalogController): Router {
    const router = Router();

    router.get('/catalog/league-options', ctrl.getLeagueCreationOptions);
    router.get('/catalog/competitions', ctrl.getCompetitions);
    router.get('/catalog/seasons', ctrl.getSeasons);
    router.get('/catalog/me', requireAuth, ctrl.getCatalogMe);
    router.get('/catalog/import-templates', requireAuth, requireCatalogAdmin, ctrl.getImportTemplates);
    router.get('/catalog/import-jobs', requireAuth, requireCatalogAdmin, ctrl.getImportJobs);
    router.post('/catalog/import-jobs', requireAuth, requireCatalogAdmin, ctrl.createImportJob);
    router.get('/catalog/import-jobs/:jobId', requireAuth, requireCatalogAdmin, ctrl.getImportJobReview);
    router.post('/catalog/import-jobs/:jobId/publish', requireAuth, requireCatalogAdmin, ctrl.publishImportJob);

    return router;
}
