// infrastructure/http/controllers/market.controller.ts
import { Request, Response, NextFunction } from 'express';
import { MarketService }   from '../../application/services/market.service';
import { CreateBidDto }    from '../middleware/validation.middleware';

export class MarketController {
    constructor(private readonly marketService: MarketService) {}

    getMarket = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const page = parseInt(req.query.page as string) || 0;
            const data = await this.marketService.getMarketPlayers(page);
            res.json({ status: 'success', data });
        } catch (err) { next(err); }
    };

    getMyBids = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const data = await this.marketService.getUserBids(req.userId!);
            res.json({ status: 'success', data });
        } catch (err) { next(err); }
    };

    createBid = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const { player_id, amount } = req.body as CreateBidDto;
            const result = await this.marketService.processBid(req.userId!, player_id, amount);
            res.status(201).json({ status: 'success', ...result });
        } catch (err) { next(err); }
    };

    deleteBid = async (req: Request, res: Response, next: NextFunction) => {
        try {
            const result = await this.marketService.cancelBid(req.userId!, req.params.playerId);
            res.json({ status: 'success', ...result });
        } catch (err) { next(err); }
    };
}