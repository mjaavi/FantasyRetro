// infrastructure/http/controllers/league.controller.ts
import { Request, Response, NextFunction } from 'express';
import { LeagueService, TEMPORADAS_DISPONIBLES } from '../../application/services/league.service';
import { ValidationError } from '../../domain/errors/AppError';

function extractToken(req: Request): string {
    const h = req.headers.authorization ?? '';
    return h.startsWith('Bearer ') ? h.slice(7) : '';
}

export class LeagueController {
    constructor(private readonly leagueService: LeagueService) {}

    crearLiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { nombre, season, kaggleLeagueId } = req.body;
            if (!nombre?.trim())  throw new ValidationError('El nombre de la liga es obligatorio.');
            if (!season)          throw new ValidationError('La temporada es obligatoria.');
            if (!kaggleLeagueId)  throw new ValidationError('La competición es obligatoria.');
            const liga = await this.leagueService.crearLiga(req.userId!, nombre.trim(), season, Number(kaggleLeagueId), extractToken(req));
            res.status(201).json({ status: 'ok', data: liga });
        } catch (err) { next(err); }
    };

    unirseALiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { inviteCode } = req.body;
            if (!inviteCode?.trim()) throw new ValidationError('El código de invitación es obligatorio.');
            const liga = await this.leagueService.unirseALiga(req.userId!, inviteCode.trim(), extractToken(req));
            res.json({ status: 'ok', data: liga });
        } catch (err) { next(err); }
    };

    getMisLigas = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ligas = await this.leagueService.getMisLigas(req.userId!);
            res.json({ status: 'ok', data: ligas });
        } catch (err) { next(err); }
    };

    getLiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = parseInt(req.params.leagueId, 10);
            if (isNaN(leagueId)) throw new ValidationError('ID de liga inválido.');
            const liga = await this.leagueService.getLiga(leagueId, req.userId!);
            res.json({ status: 'ok', data: liga });
        } catch (err) { next(err); }
    };

    getTemporadas = (_req: Request, res: Response) => {
        res.json({ status: 'ok', data: TEMPORADAS_DISPONIBLES });
    };
}