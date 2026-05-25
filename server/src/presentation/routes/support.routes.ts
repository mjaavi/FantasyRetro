import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';
import { requireAuth } from '../middleware/auth.middleware';

export function createSupportRouter(ctrl: SupportController): Router {
    const router = Router();

    router.post('/ticket', requireAuth, ctrl.submitTicket);

    return router;
}
