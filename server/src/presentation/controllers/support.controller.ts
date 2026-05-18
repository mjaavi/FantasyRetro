import { Request, Response } from 'express';
import { SupportService } from '../../application/services/support.service';
import { NodemailerEmailService } from '../../infrastructure/services/NodemailerEmailService';
import { SupabaseSupportRepository } from '../../infrastructure/repositories/SupabaseSupportRepository';

export class SupportController {
    private supportService: SupportService;

    constructor() {
        const emailService = new NodemailerEmailService();
        const supportRepo = new SupabaseSupportRepository();
        this.supportService = new SupportService(emailService, supportRepo);
    }

    async submitTicket(req: Request, res: Response) {
        try {
            const { subject, message, email, user_id } = req.body;

            if (!subject || !message) {
                return res.status(400).json({ error: 'Asunto y mensaje son requeridos.' });
            }

            await this.supportService.submitTicket({
                subject,
                message,
                email: email || 'anónimo',
                user_id: user_id || null
            });

            return res.status(200).json({ success: true, message: 'Ticket enviado correctamente.' });
        } catch (error: any) {
            console.error('[SupportController] Error:', error);
            return res.status(500).json({ error: 'Hubo un problema al procesar el ticket.' });
        }
    }
}
