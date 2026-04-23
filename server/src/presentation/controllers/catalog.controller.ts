import { NextFunction, Request, Response } from 'express';
import { CatalogService } from '../../application/services/catalog.service';
import { CatalogImportService } from '../../application/services/catalogImport.service';
import { ValidationError } from '../../domain/errors/AppError';
import { isBootstrapCatalogAdmin } from '../middleware/catalogAdminGuard.middleware';

export class CatalogController {
    constructor(
        private readonly catalogService: CatalogService,
        private readonly catalogImportService: CatalogImportService,
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

    getImportTemplates = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const data = this.catalogImportService.getTemplates();
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    createImportJob = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.userId!;
            const { templateKey, filename, csvContent } = req.body ?? {};

            const data = await this.catalogImportService.createImportJob({
                templateKey,
                filename,
                csvContent,
            }, userId);

            res.status(201).json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getImportJobReview = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const jobId = Number(req.params.jobId);
            if (!Number.isInteger(jobId) || jobId <= 0) {
                throw new ValidationError('El identificador del import job no es valido.');
            }

            const data = await this.catalogImportService.getImportJobReview(jobId);
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    publishImportJob = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.userId!;
            const jobId = Number(req.params.jobId);
            if (!Number.isInteger(jobId) || jobId <= 0) {
                throw new ValidationError('El identificador del import job no es valido.');
            }

            const data = await this.catalogImportService.publishImportJob(jobId, userId);
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };
}
