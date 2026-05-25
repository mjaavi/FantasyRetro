import { Request, Response } from 'express';
import { SupportService } from '../../application/services/support.service';

const MAX_SUBJECT_LENGTH = 120;
const MAX_MESSAGE_LENGTH = 5000;

export class SupportController {
    constructor(private readonly supportService: SupportService) {}

    submitTicket = async (req: Request, res: Response) => {
        try {
            const subject = String(req.body?.subject ?? '').trim();
            const message = String(req.body?.message ?? '').trim();
            const email = String(req.body?.email ?? 'anonimo').trim();

            if (!subject || !message) {
                return res.status(400).json({ error: 'Asunto y mensaje son requeridos.' });
            }

            if (subject.length > MAX_SUBJECT_LENGTH || message.length > MAX_MESSAGE_LENGTH) {
                return res.status(400).json({ error: 'El mensaje supera el tamano permitido.' });
            }

            const result = await this.supportService.submitTicket({
                subject,
                message,
                email,
                userId: req.userId ?? null,
            });

            return res.status(200).json({
                success: true,
                message: 'Ticket enviado correctamente.',
                ticketId: result.ticketId,
            });
        } catch (error: any) {
            console.error('[SupportController] Error:', error);
            return res.status(500).json({
                status: 'error',
                error: error?.message ?? 'Hubo un problema al procesar el ticket.',
            });
        }
    };
}
