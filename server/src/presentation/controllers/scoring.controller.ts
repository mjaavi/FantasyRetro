// infrastructure/http/controllers/scoring.controller.ts
import { Request, Response, NextFunction } from 'express';
import { ScoringService }  from '../../application/services/scoring.service';
import { ValidationError } from '../../domain/errors/AppError';

export class ScoringController {
    constructor(private readonly scoringService: ScoringService) {}

    getScoringForUser = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const jornada = req.query.jornada ? parseInt(req.query.jornada as string, 10) : undefined;
            if (jornada !== undefined && (isNaN(jornada) || jornada < 1 || jornada > 38))
                throw new ValidationError('La jornada debe ser un número entre 1 y 38.');
            res.json({ status: 'ok', data: {} });
        } catch (err) { next(err); }
    };
}