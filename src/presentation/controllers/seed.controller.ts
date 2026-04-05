// infrastructure/http/controllers/seed.controller.ts
import { Request, Response, NextFunction } from 'express';
import { SeedService } from '../../application/services/seed.service';

export class SeedController {
    constructor(private readonly seedService: SeedService) {}

    seedMarket = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const limit  = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;
            const result = await this.seedService.seedMarketPlayers(limit);
            res.json({ status: 'ok', message: `${result.inserted} jugadores insertados en el mercado.` });
        } catch (err) { next(err); }
    };
}