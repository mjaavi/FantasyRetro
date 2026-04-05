// infrastructure/http/controllers/dashboard.controller.ts
import { Request, Response, NextFunction } from 'express';
import { DashboardService } from '../../application/services/dashboard.service';
import { ValidationError }  from '../../domain/errors/AppError';

export class DashboardController {
    constructor(private readonly dashboardService: DashboardService) {}

    getDashboard = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const userId   = req.userId;
            if (!userId)                          throw new ValidationError('No autenticado.');
            if (!leagueId || leagueId <= 0)       throw new ValidationError('ID de liga inválido.');
            const data = await this.dashboardService.getDashboardData(leagueId, userId);
            res.json({ status: 'ok', data });
        } catch (err) { next(err); }
    };
}