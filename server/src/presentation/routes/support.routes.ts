import { Router } from 'express';
import { SupportController } from '../controllers/support.controller';

const router = Router();
const supportController = new SupportController();

// POST /api/support/ticket
router.post('/ticket', (req, res) => supportController.submitTicket(req, res));

export default router;
