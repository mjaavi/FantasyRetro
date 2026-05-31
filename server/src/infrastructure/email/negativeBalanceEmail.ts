// ─────────────────────────────────────────────────────────────────────────────
// negativeBalanceEmail.ts — Negative Balance Warning email template
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

export interface NegativeBalanceEmailData {
    userName: string;
    currentBalance: string;
    gameweekNumber: number;
    deadlineTime: string;
    rosterUrl: string;
}

export function buildNegativeBalanceEmail(data: NegativeBalanceEmailData): string {
    const body = [
        emailHeading('¡Saldo en Negativo!'),
        emailSpacer(12),

        emailText(`Hola <strong style="color:#e2e8f0;">${data.userName}</strong>,`),
        emailSpacer(8),
        emailNotice(`Tienes saldo negativo. Debes volver a saldo positivo antes del inicio de la jornada o **no puntuarás** esta semana.`, 'warning'),
        emailSpacer(16),

        emailInfoRow('Tu Saldo Actual', `<span style="color:#ef4444; font-weight:bold;">${data.currentBalance}</span>`),
        emailInfoRow('Jornada', `Jornada ${data.gameweekNumber}`),
        emailInfoRow('Fecha Límite', data.deadlineTime),

        emailSpacer(24),

        emailButton('Ajustar Plantilla', data.rosterUrl),

        emailDivider(),

        emailText('Puedes vender jugadores al mercado o aceptar ofertas de otros mánagers para conseguir dinero rápido.', { muted: true, small: true }),
    ].join('\n');

    return wrapInBaseLayout({
        body,
        previewText: `ALERTA: Tu saldo esta en negativo para la Jornada ${data.gameweekNumber}`,
    });
}
