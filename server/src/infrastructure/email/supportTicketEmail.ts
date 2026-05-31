// ─────────────────────────────────────────────────────────────────────────────
// supportTicketEmail.ts — Support ticket email templates
// ─────────────────────────────────────────────────────────────────────────────

import { wrapInBaseLayout } from './emailBaseLayout';
import {
    emailBlockquote,
    emailDivider,
    emailHeading,
    emailInfoBadge,
    emailInfoRow,
    emailNotice,
    emailSpacer,
    emailText,
} from './emailComponents';

export interface SupportTicketEmailData {
    ticketId: string;
    userEmail: string;
    userName?: string;
    subject: string;
    message: string;
    userId?: string;
}

/**
 * User-facing confirmation email.
 */
export function buildSupportTicketUserEmail(data: SupportTicketEmailData): string {
    const greeting = data.userName
        ? `Hola <strong style="color:#e2e8f0;">${data.userName}</strong>,`
        : 'Hola,';

    const body = [
        emailHeading('Ticket recibido'),
        emailSpacer(12),

        emailText(greeting),
        emailText('Hemos recibido tu solicitud y nuestro equipo ya está trabajando en ella.'),

        emailInfoBadge('Nº de Ticket', `#${data.ticketId}`),

        emailInfoRow('Asunto', data.subject),

        emailSpacer(8),
        emailBlockquote(data.message),

        emailDivider(),

        emailNotice('Guarda este correo como referencia. Te notificaremos cuando haya novedades.'),

        emailSpacer(4),
        emailText('Si necesitas añadir información, responde a este correo o abre un nuevo ticket desde la app.', { muted: true, small: true }),
    ].join('\n');

    return wrapInBaseLayout({
        body,
        previewText: `Tu ticket #${data.ticketId} ha sido recibido`,
    });
}

/**
 * Admin/internal notification email.
 */
export function buildSupportTicketAdminEmail(data: SupportTicketEmailData): string {
    const body = [
        emailHeading('Nuevo ticket de soporte'),
        emailSpacer(12),

        emailInfoBadge('Ticket ID', `#${data.ticketId}`),

        emailInfoRow('De', data.userEmail),
        emailInfoRow('Usuario ID', data.userId || 'Anónimo'),
        emailInfoRow('Asunto', data.subject),

        emailDivider(),

        emailBlockquote(data.message),
    ].join('\n');

    return wrapInBaseLayout({
        body,
        previewText: `Nuevo ticket #${data.ticketId} de ${data.userEmail}`,
    });
}
