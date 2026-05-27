// ─────────────────────────────────────────────────────────────────────────────
// passwordResetEmail.ts — "Recuperación de contraseña" email template
// ─────────────────────────────────────────────────────────────────────────────

import { wrapInBaseLayout } from './emailBaseLayout';
import {
    emailButton,
    emailDivider,
    emailHeading,
    emailText,
    emailSpacer,
    emailNotice,
} from './emailComponents';

export interface PasswordResetEmailData {
    userName: string;
    resetLink: string;
    expirationMinutes?: number;
}

export function buildPasswordResetEmail(data: PasswordResetEmailData): string {
    const expMin = data.expirationMinutes ?? 60;

    const body = [
        emailHeading('Recupera tu acceso'),
        emailSpacer(12),

        emailText(`Hola <strong style="color:#e2e8f0;">${data.userName}</strong>,`),
        emailText('Hemos recibido una solicitud para restablecer tu contraseña. Pulsa el botón de abajo para crear una nueva.'),

        emailSpacer(20),

        emailButton('Restablecer Contraseña', data.resetLink),

        emailSpacer(16),

        emailNotice(`Este enlace expira en ${expMin} minutos. Si caduca, solicita uno nuevo desde el inicio de sesión.`, 'warning'),

        emailDivider(),

        emailText('Si no has solicitado este cambio, ignora este correo. Tu contraseña actual no se modificará.', { muted: true, small: true }),
        emailSpacer(4),
        emailText(`<a href="${data.resetLink}" style="color:#3b82f6; word-break:break-all; font-size:11px; text-decoration:none;">${data.resetLink}</a>`, { muted: true }),
    ].join('');

    return wrapInBaseLayout({
        body,
        previewText: `Restablece tu contraseña de RetroFantasy — enlace válido ${expMin} min`,
    });
}
