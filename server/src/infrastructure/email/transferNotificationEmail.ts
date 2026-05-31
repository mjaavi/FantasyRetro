// ─────────────────────────────────────────────────────────────────────────────
// transferNotificationEmail.ts — Transfer Notification email template
// ─────────────────────────────────────────────────────────────────────────────

import { wrapInBaseLayout } from './emailBaseLayout';
import {
    emailButton,
    emailDivider,
    emailHeading,
    emailSpacer,
    emailText,
    emailNotice,
    emailInfoRow,
} from './emailComponents';

export interface TransferNotificationEmailData {
    userName: string;
    playerName: string;
    amount: string;
    fromUser: string;
    toUser: string;
    status: 'received' | 'accepted' | 'rejected';
    marketUrl: string;
}

export function buildTransferNotificationEmail(data: TransferNotificationEmailData): string {
    let heading = 'Novedades de Traspaso';
    let noticeType: 'info' | 'success' | 'warning' = 'info';
    let noticeText = '';

    if (data.status === 'received') {
        heading = 'Oferta Recibida';
        noticeType = 'info';
        noticeText = `¡Has recibido una nueva oferta de traspaso de <strong style="color:#e2e8f0;">${data.fromUser}</strong>!`;
    } else if (data.status === 'accepted') {
        heading = '¡Traspaso Completado!';
        noticeType = 'success';
        noticeText = `La oferta por <strong style="color:#e2e8f0;">${data.playerName}</strong> ha sido aceptada con éxito.`;
    } else if (data.status === 'rejected') {
        heading = 'Oferta Rechazada';
        noticeType = 'warning';
        noticeText = `La oferta por <strong style="color:#e2e8f0;">${data.playerName}</strong> ha sido rechazada.`;
    }

    const body = [
        emailHeading(heading),
        emailSpacer(12),

        emailText(`Hola <strong style="color:#e2e8f0;">${data.userName}</strong>,`),
        emailSpacer(8),
        emailNotice(noticeText, noticeType),
        emailSpacer(16),

        emailInfoRow('Jugador', data.playerName),
        emailInfoRow('Importe', data.amount),
        emailInfoRow('Origen', data.fromUser),
        emailInfoRow('Destino', data.toUser),

        emailSpacer(24),

        emailButton('Ir al Mercado', data.marketUrl),

        emailDivider(),

        emailText('Las ofertas tienen una duración limitada. Mantente activo para no perder oportunidades clave de mercado.', { muted: true, small: true }),
    ].join('\n');

    return wrapInBaseLayout({
        body,
        previewText: `Notificación de Mercado: ${data.playerName} — ${heading}`,
    });
}
