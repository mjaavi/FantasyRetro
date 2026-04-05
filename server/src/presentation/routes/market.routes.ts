import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { validateBody, createBidSchema } from '../middleware/validation.middleware';
import { MarketController } from '../controllers/market.controller';

export function createMarketRouter(ctrl: MarketController): Router {
    const r = Router();
    r.get('/market',         requireAuth, ctrl.getMarket);
    r.get('/market/bids',    requireAuth, ctrl.getMyBids);
    r.post('/market/bids',   requireAuth, validateBody(createBidSchema), ctrl.createBid);
    r.delete('/market/bids/:playerId', requireAuth, ctrl.deleteBid);
    return r;
}