import { IEmailService } from '../../domain/services/IEmailService';
import { SupabaseSupportRepository, SupportTicket } from '../../infrastructure/repositories/SupabaseSupportRepository';

export class SupportService {
    private emailService: IEmailService;
    private supportRepo: SupabaseSupportRepository;

    constructor(emailService: IEmailService, supportRepo: SupabaseSupportRepository) {
        this.emailService = emailService;
        this.supportRepo = supportRepo;
    }

    async submitTicket(ticket: SupportTicket): Promise<void> {
        // 1. Guardar en base de datos
        await this.supportRepo.createTicket(ticket);

        // 2. Enviar correo al equipo de soporte
        const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || 'admin@retrofantasy.com';
        const emailContent = `
Nuevo ticket de soporte recibido:

De: ${ticket.email}
Usuario ID: ${ticket.user_id || 'Anónimo'}
Asunto (Categoría): ${ticket.subject}

Mensaje:
${ticket.message}
        `;

        await this.emailService.sendEmail({
            to: adminEmail,
            subject: `[RetroFantasy Support] ${ticket.subject}`,
            text: emailContent,
        });
        
        // 3. (Opcional) Enviar correo de confirmación al usuario
        const userEmailContent = `
Hola,

Hemos recibido tu solicitud de soporte con el asunto: "${ticket.subject}".
Nuestro equipo revisará tu mensaje y te contactaremos pronto.

Tu mensaje:
${ticket.message}

Atentamente,
El equipo de RetroFantasy
        `;

        if (ticket.email && ticket.email !== 'anónimo') {
            await this.emailService.sendEmail({
                to: ticket.email,
                subject: `Hemos recibido tu solicitud de soporte - RetroFantasy`,
                text: userEmailContent,
            });
        }
    }
}
