import { NextFunction, Request, Response } from 'express';
import { PlatformAdminService } from '../../application/services/platformAdmin.service';
import { ValidationError } from '../../domain/errors/AppError';

export class PlatformAdminController {
    constructor(private readonly service: PlatformAdminService) {}

    checkAdminStatus = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const isAdmin = await this.service.checkIfUserIsPlatformAdmin(req.userId!);
            res.json({ status: 'ok', data: { isAdmin } });
        } catch (err) {
            next(err);
        }
    };

    getAllLeagues = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagues = await this.service.getAllLeagues();
            res.json({ status: 'ok', data: leagues });
        } catch (err) {
            next(err);
        }
    };

    deleteLeague = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }

            await this.service.deleteLeague(leagueId);
            res.json({ status: 'ok', message: `Liga #${leagueId} eliminada correctamente.` });
        } catch (err) {
            next(err);
        }
    };

    getLeagueParticipants = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }

            const participants = await this.service.getLeagueParticipants(leagueId);
            res.json({ status: 'ok', data: participants });
        } catch (err) {
            next(err);
        }
    };

    allocateBudget = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const userId = req.params.userId;
            const amount = Number(req.body.amount);

            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }
            if (!userId) {
                throw new ValidationError('ID de usuario inválido.');
            }
            if (Number.isNaN(amount)) {
                throw new ValidationError('Monto de presupuesto inválido.');
            }

            await this.service.allocateBudget(leagueId, userId, amount);
            res.json({ status: 'ok', message: 'Presupuesto actualizado correctamente.' });
        } catch (err) {
            next(err);
        }
    };

    getAllUsers = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const users = await this.service.getAllUsers();
            res.json({ status: 'ok', data: users });
        } catch (err) {
            next(err);
        }
    };

    crearUsuario = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { email, password, username, teamName } = req.body;

            if (!email || !password || !username || !teamName) {
                throw new ValidationError('Faltan campos obligatorios para crear el usuario.');
            }

            const userId = await this.service.crearUsuario(email, password, username, teamName);
            res.json({ status: 'ok', data: { userId }, message: 'Usuario creado correctamente.' });
        } catch (err) {
            next(err);
        }
    };

    borrarUsuario = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.params.userId;
            if (!userId) {
                throw new ValidationError('ID de usuario inválido.');
            }

            await this.service.borrarUsuario(userId);
            res.json({ status: 'ok', message: `Usuario ${userId} eliminado correctamente de la plataforma.` });
        } catch (err) {
            next(err);
        }
    };

    cambiarContrasena = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const userId = req.params.userId;
            const { password } = req.body;

            if (!userId) {
                throw new ValidationError('ID de usuario inválido.');
            }
            if (!password || password.length < 8) {
                throw new ValidationError('La contraseña debe tener al menos 8 caracteres.');
            }

            await this.service.cambiarContrasena(userId, password);
            res.json({ status: 'ok', message: 'Contraseña actualizada correctamente.' });
        } catch (err) {
            next(err);
        }
    };

    resolverPujasLiga = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }

            const resultado = await this.service.resolverPujasLiga(leagueId);
            res.json({ status: 'ok', data: resultado, message: 'Mercado de liga resuelto y regenerado.' });
        } catch (err) {
            next(err);
        }
    };
}
