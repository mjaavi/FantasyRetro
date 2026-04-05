import { Router } from 'express';
import { SeedController } from '../controllers/seed.controller';

export function createSeedRouter(ctrl: SeedController): Router {
    const r = Router();
    r.post('/seed/market', ctrl.seedMarket);
    return r;
}