// infrastructure/http/controllers/ranking.controller.ts
import { Request, Response, NextFunction } from 'express';
import { RankingService }  from '../../application/services/ranking.service';
import { ValidationError } from '../../domain/errors/AppError';

export class RankingController {
    constructor(private readonly rankingService: RankingService) {}

    getRanking = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) throw new ValidationError('ID de liga inválido.');
            const jornada = req.query.jornada ? parseInt(req.query.jornada as string, 10) : undefined;
            if (jornada !== undefined && (isNaN(jornada) || jornada < 1 || jornada > 38))
                throw new ValidationError('La jornada debe ser un número entre 1 y 38.');
            const ranking = await this.rankingService.getRanking(leagueId, jornada);
            res.json({ status: 'ok', data: ranking });
        } catch (err) { next(err); }
    };
}