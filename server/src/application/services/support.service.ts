import { ISupportRepository, SupportTicket } from '../../domain/ports/ISupportRepository';
import { IEmailService } from '../../domain/services/IEmailService';
import {
    buildSupportTicketUserEmail,
    buildSupportTicketAdminEmail,
    SupportTicketEmailData,
} from '../../infrastructure/email';

export class SupportService {
    constructor(
        private readonly emailService: IEmailService,
        private readonly supportRepo: ISupportRepository,
    ) {}

    async submitTicket(ticket: SupportTicket): Promise<{ ticketId: string }> {
        const storedTicket = await this.supportRepo.createTicket(ticket);
        const adminEmail = process.env.SUPPORT_ADMIN_EMAIL || process.env.SUPPORT_TO_EMAIL;

        if (!adminEmail) {
            throw new Error('SUPPORT_ADMIN_EMAIL no esta configurado.');
        }

        const emailData: SupportTicketEmailData = {
            ticketId: storedTicket.id,
            userEmail: ticket.email,
            userName: ticket.userId ?? undefined,
            subject: ticket.subject,
            message: ticket.message,
            userId: ticket.userId ?? undefined,
        };

        await this.emailService.sendEmail({
            to: adminEmail,
            subject: `[RetroFantasy Support] ${ticket.subject}`,
            text: this.buildAdminEmailPlainText(ticket, storedTicket.id),
            html: buildSupportTicketAdminEmail(emailData),
        });

        if (ticket.email && ticket.email !== 'anonimo') {
            this.emailService.sendEmail({
                to: ticket.email,
                subject: 'Hemos recibido tu solicitud de soporte - RetroFantasy',
                text: this.buildUserConfirmationPlainText(ticket),
                html: buildSupportTicketUserEmail(emailData),
            }).catch(error => {
                console.warn('[SupportService] No se pudo enviar confirmacion al usuario:', error.message);
            });
        }

        return { ticketId: storedTicket.id };
    }

    private buildAdminEmailPlainText(ticket: SupportTicket, ticketId: string): string {
        return [
            'Nuevo ticket de soporte recibido:',
            '',
            `Ticket ID: ${ticketId}`,
            `De: ${ticket.email}`,
            `Usuario ID: ${ticket.userId || 'Anonimo'}`,
            `Asunto: ${ticket.subject}`,
            '',
            'Mensaje:',
            ticket.message,
        ].join('\n');
    }

    private buildUserConfirmationPlainText(ticket: SupportTicket): string {
        return [
            'Hola,',
            '',
            `Hemos recibido tu solicitud de soporte con el asunto: "${ticket.subject}".`,
            'Nuestro equipo revisara tu mensaje y te contactaremos pronto.',
            '',
            'Tu mensaje:',
            ticket.message,
            '',
            'Atentamente,',
            'El equipo de RetroFantasy',
        ].join('\n');
    }
}
