// infrastructure/http/controllers/leagueMarket.controller.ts
import { Request, Response, NextFunction } from 'express';
import { LeagueMarketService } from '../../application/services/leagueMarket.service';
import { ValidationError }     from '../../domain/errors/AppError';
import { PlaceLeagueBidDto }   from '../routes/leagueMarket.routes';

export class LeagueMarketController {
    constructor(private readonly leagueMarketService: LeagueMarketService) {}

    getLeagueMarket = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            if (!Number.isInteger(leagueId) || leagueId <= 0) {
                throw new ValidationError('ID de liga inválido.');
            }
            const jugadores = await this.leagueMarketService.getMarket(leagueId);
            res.json({ status: 'ok', data: jugadores });
        } catch (err) { next(err); }
    };

    getMyLeagueBids = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            const pujas = await this.leagueMarketService.getUserBids(leagueId, req.userId!);
            res.json({ status: 'ok', data: pujas });
        } catch (err) { next(err); }
    };

    placeLeagueBid = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId = Number(req.params.leagueId);
            // req.body ya fue validado y tipado por validateBody(PlaceLeagueBidSchema)
            const { playerApiId, amount } = req.body as PlaceLeagueBidDto;
            const resultado = await this.leagueMarketService.placeBid(leagueId, req.userId!, playerApiId, amount);
            res.status(201).json({ status: 'ok', data: resultado });
        } catch (err) { next(err); }
    };

    cancelLeagueBid = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const leagueId    = Number(req.params.leagueId);
            const playerApiId = Number(req.params.playerApiId);
            if (!Number.isInteger(playerApiId) || playerApiId <= 0) {
                throw new ValidationError('playerApiId inválido.');
            }
            const resultado = await this.leagueMarketService.cancelBid(leagueId, req.userId!, playerApiId);
            res.json({ status: 'ok', data: resultado });
        } catch (err) { next(err); }
    };

    openLeagueMarket = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const resultado = await this.leagueMarketService.openMarket(Number(req.params.leagueId));
            res.json({ status: 'ok', data: resultado });
        } catch (err) { next(err); }
    };

    closeLeagueMarket = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const resultado = await this.leagueMarketService.closeMarket(Number(req.params.leagueId));
            res.json({ status: 'ok', data: resultado });
        } catch (err) { next(err); }
    };

    processExpiredMarkets = async (_req: Request, res: Response, next: NextFunction) => {
        try {
            const resultado = await this.leagueMarketService.processExpiredMarkets();
            res.json({ status: 'ok', data: resultado });
        } catch (err) { next(err); }
    };
}