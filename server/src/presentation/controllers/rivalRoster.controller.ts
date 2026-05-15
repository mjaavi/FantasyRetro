import { Request, Response, NextFunction } from 'express';
import { RivalRosterService } from '../../application/services/rivalRoster.service';
import { ValidationError } from '../../domain/errors/AppError';

export class RivalRosterController {
    constructor(private readonly rivalRosterService: RivalRosterService) {}

    getRivalRoster = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const targetUserId = req.params.userId;

            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }
            if (!targetUserId || typeof targetUserId !== 'string') {
                throw new ValidationError('ID de usuario inválido.');
            }

            const jornada = req.query.jornada
                ? parseInt(req.query.jornada as string, 10)
                : undefined;

            if (jornada !== undefined && (isNaN(jornada) || jornada < 1 || jornada > 38)) {
                throw new ValidationError('La jornada debe ser un número entre 1 y 38.');
            }

            const result = await this.rivalRosterService.getRivalRoster(
                leagueId,
                req.userId!,
                targetUserId,
                jornada,
            );

            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };
}
