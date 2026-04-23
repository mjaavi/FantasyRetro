import { Request, Response, NextFunction } from 'express';
import { CatalogService } from '../../application/services/catalog.service';
import { LeagueService } from '../../application/services/league.service';
import { ValidationError } from '../../domain/errors/AppError';

function extractToken(req: Request): string {
    const h = req.headers.authorization ?? '';
    return h.startsWith('Bearer ') ? h.slice(7) : '';
}

function normalizeOptionalPositiveInt(value: unknown): number | null {
    const normalized = Number(value);
    return Number.isInteger(normalized) && normalized > 0 ? normalized : null;
}

export class LeagueController {
    constructor(
        private readonly leagueService: LeagueService,
        private readonly catalogService: CatalogService,
    ) {}

    crearLiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { nombre, season, competitionId, kaggleLeagueId } = req.body;
            if (!nombre?.trim())  throw new ValidationError('El nombre de la liga es obligatorio.');
            if (!season)          throw new ValidationError('La temporada es obligatoria.');
            if (!competitionId && !kaggleLeagueId) {
                throw new ValidationError('La competicion es obligatoria.');
            }

            const liga = await this.leagueService.crearLiga({
                userId: req.userId!,
                nombre: nombre.trim(),
                season: String(season),
                competitionId: normalizeOptionalPositiveInt(competitionId),
                kaggleLeagueId: normalizeOptionalPositiveInt(kaggleLeagueId),
                userToken: extractToken(req),
            });
            res.status(201).json({ status: 'ok', data: liga });
        } catch (err) { next(err); }
    };

    unirseALiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { inviteCode } = req.body;
            if (!inviteCode?.trim()) throw new ValidationError('El codigo de invitacion es obligatorio.');
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
            if (Number.isNaN(leagueId)) throw new ValidationError('ID de liga invalido.');
            const liga = await this.leagueService.getLiga(leagueId, req.userId!);
            res.json({ status: 'ok', data: liga });
        } catch (err) { next(err); }
    };

    getTemporadas = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const temporadas = await this.catalogService.getAvailableSeasonLabels();
            res.json({ status: 'ok', data: temporadas });
        } catch (err) {
            next(err);
        }
    };
}
