// ─────────────────────────────────────────────────────────────────────────────
// welcomeEmail.ts — "Bienvenido a RetroFantasy" email template
// ─────────────────────────────────────────────────────────────────────────────

import { wrapInBaseLayout } from './emailBaseLayout';
import {
    emailButton,
    emailDivider,
    emailHeading,
    emailSpacer,
    emailText,
} from './emailComponents';

export interface WelcomeEmailData {
    userName: string;
    appUrl: string;
}

const FONT = `'Plus Jakarta Sans','Segoe UI',Roboto,Helvetica,Arial,sans-serif`;

function onboardingStep(number: string, title: string, description: string): string {
    return `
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="margin-bottom:4px;">
            <tr>
                <td width="36" valign="top" style="padding-right:12px; padding-top:1px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:separate;">
                        <tr>
                            <td align="center" style="width:28px; height:28px; border-radius:8px; background: rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.12);">
                                <span style="font-family:${FONT}; font-size:11px; font-weight:800; color:#3b82f6; line-height:1;">${number}</span>
                            </td>
                        </tr>
                    </table>
                </td>
                <td valign="top">
                    <p style="margin:0; font-family:${FONT}; font-size:13px; font-weight:700; color:#e2e8f0; line-height:1.3;">
                        ${title}
                    </p>
                    <p style="margin:2px 0 0; font-family:${FONT}; font-size:11px; font-weight:500; color:#475569; line-height:1.5;">
                        ${description}
                    </p>
                </td>
            </tr>
        </table>`;
}

export function buildWelcomeEmail(data: WelcomeEmailData): string {
    const body = [
        emailHeading('Bienvenido al equipo'),
        emailSpacer(12),

        emailText(`Hola <strong style="color:#e2e8f0;">${data.userName}</strong>,`),
        emailText('Tu cuenta en <strong style="color:#3b82f6;">RetroFantasy</strong> está lista. Es hora de demostrar que eres el mejor mánager.'),

        emailSpacer(20),

        // Onboarding steps
        onboardingStep('1', 'Únete a una liga', 'Busca una liga activa o crea la tuya propia.'),
        emailSpacer(6),
        onboardingStep('2', 'Ficha a tus jugadores', 'Explora el mercado y construye tu plantilla.'),
        emailSpacer(6),
        onboardingStep('3', 'Alinea y compite', 'Configura tu formación y empieza a ganar puntos.'),

        emailSpacer(24),

        emailButton('Entrar al Vestuario', data.appUrl),

        emailDivider(),

        emailText('Si tienes alguna duda, contacta con nosotros desde la sección de soporte dentro de la app.', { muted: true, small: true }),
    ].join('');

    return wrapInBaseLayout({
        body,
        previewText: `Bienvenido a RetroFantasy, ${data.userName}. Tu carrera como mánager empieza ahora.`,
    });
}
