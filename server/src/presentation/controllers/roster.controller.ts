// infrastructure/http/controllers/roster.controller.ts
import { Request, Response, NextFunction } from 'express';
import { RosterService }   from '../../application/services/roster.service';
import { ValidationError } from '../../domain/errors/AppError';

function extractToken(req: Request): string {
    const h = req.headers.authorization ?? '';
    return h.startsWith('Bearer ') ? h.slice(7) : '';
}

export class RosterController {
    constructor(private readonly rosterService: RosterService) {}

    getRoster = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) throw new ValidationError('ID de liga inválido.');
            const roster = await this.rosterService.getRoster(req.userId!, leagueId);
            res.json({ status: 'ok', data: roster });
        } catch (err) { next(err); }
    };

    toggleStarter = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId    = Number(req.params.leagueId);
            const playerApiId = Number(req.params.playerApiId);
            const { is_starter } = req.body;
            if (typeof is_starter !== 'boolean') throw new ValidationError('El campo is_starter debe ser un booleano.');
            await this.rosterService.toggleStarter(req.userId!, leagueId, playerApiId, is_starter);
            res.json({ status: 'ok', message: 'Once actualizado.' });
        } catch (err) { next(err); }
    };
}