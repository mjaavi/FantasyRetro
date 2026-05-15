import { Request, Response, NextFunction } from 'express';
import { PlayerSearchService } from '../../application/services/playerSearch.service';
import { ValidationError } from '../../domain/errors/AppError';

export class PlayerSearchController {
    constructor(private readonly searchService: PlayerSearchService) {}

    searchPlayers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }

            const query = typeof req.query.q === 'string' ? req.query.q : '';
            const position = typeof req.query.position === 'string' ? req.query.position : undefined;
            const page = req.query.page ? parseInt(req.query.page as string, 10) : 0;

            if (position && !['PT', 'DF', 'MC', 'DL'].includes(position.toUpperCase())) {
                throw new ValidationError('La posición debe ser PT, DF, MC o DL.');
            }

            if (page < 0 || !Number.isFinite(page)) {
                throw new ValidationError('La página debe ser un número positivo.');
            }

            const result = await this.searchService.searchPlayers(leagueId, {
                query: query || undefined,
                position: position?.toUpperCase(),
                page,
            });

            res.json({ status: 'ok', data: result });
        } catch (err) { next(err); }
    };
}
