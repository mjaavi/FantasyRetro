import { NextFunction, Request, Response } from 'express';
import { AdminService } from '../../application/services/admin.service';
import { LeagueMarketService } from '../../application/services/leagueMarket.service';
import { ValidationError } from '../../domain/errors/AppError';

export class AdminController {
    constructor(
        private readonly adminService: AdminService,
        private readonly leagueMarketService: LeagueMarketService,
    ) {}

    getEstadoLigas = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const ligas = await this.adminService.getEstadoLigas(req.userId!);
            res.json({ status: 'ok', data: ligas });
        } catch (err) {
            next(err);
        }
    };

    procesarJornada = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const jornada = Number(req.body.jornada);

            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga invalido.');
            }

            if (!Number.isInteger(jornada) || jornada <= 0) {
                throw new ValidationError('Jornada invalida.');
            }

            const resultado = await this.adminService.procesarJornada(leagueId, jornada);
            res.json({ status: 'ok', data: resultado });
        } catch (err) {
            next(err);
        }
    };

    regenerarMercado = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);

            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga invalido.');
            }

            const resultado = await this.leagueMarketService.regenerateMarketSafely(leagueId);
            res.json({ status: 'ok', data: resultado });
        } catch (err) {
            next(err);
        }
    };

    getPuntosJornada = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const jornada = Number(req.params.jornada);
            const data = await this.adminService.getPuntosJornada(leagueId, jornada);
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getScoresLiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.adminService.getScoresLiga(Number(req.params.leagueId));
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getGlobalScores = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.adminService.getGlobalScores(Number(req.params.leagueId));
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };

    getHistorialJugador = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const playerApiId = Number(req.params.playerApiId);
            const data = await this.adminService.getHistorialJugador(leagueId, playerApiId);
            res.json({ status: 'ok', data });
        } catch (err) {
            next(err);
        }
    };
}
