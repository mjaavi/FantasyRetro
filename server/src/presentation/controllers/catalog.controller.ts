import { NextFunction, Request, Response } from 'express';
import { CatalogService } from '../../application/services/catalog.service';
import { ValidationError } from '../../domain/errors/AppError';
import { isBootstrapCatalogAdmin } from '../middleware/catalogAdminGuard.middleware';

export class CatalogController {
    constructor(
        private readonly catalogService: CatalogService,
    ) {}

    getLeagueCreationOptions = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.catalogService.getLeagueCreationOptions();
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getCompetitions = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.catalogService.getActiveCompetitions();
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getSeasons = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.catalogService.getActiveSeasons();
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getCatalogMe = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.userId!;
            const isCatalogAdmin = isBootstrapCatalogAdmin(userId)
                || await this.catalogService.isCatalogAdmin(userId);

            res.json({
                status: 'ok',
                data: {
                    userId,
                    isCatalogAdmin,
                },
            });
        } catch (err) {
            next(err);
        }
    };

    getImportJobs = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const rawLimit = req.query.limit ? Number(req.query.limit) : 50;
            if (!Number.isInteger(rawLimit) || rawLimit <= 0 || rawLimit > 100) {
                throw new ValidationError('El parametro limit debe ser un entero entre 1 y 100.');
            }

            const data = await this.catalogService.getImportJobs(rawLimit);
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };
}
