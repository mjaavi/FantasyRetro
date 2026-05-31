// ─────────────────────────────────────────────────────────────────────────────
// leagueInvitationEmail.ts — League Invitation email template
// ─────────────────────────────────────────────────────────────────────────────

import { wrapInBaseLayout } from './emailBaseLayout';
import {
    emailButton,
    emailDivider,
    emailHeading,
    emailSpacer,
    emailText,
    emailInfoBadge,
} from './emailComponents';

export interface LeagueInvitationEmailData {
    inviterName: string;
    leagueName: string;
    inviteCode: string;
    joinUrl: string;
}

export function buildLeagueInvitationEmail(data: LeagueInvitationEmailData): string {
    const body = [
        emailHeading('Invitación a Liga'),
        emailSpacer(12),

        emailText(`¡Hola!`),
        emailText(`<strong style="color:#e2e8f0;">${data.inviterName}</strong> te ha invitado a unirte a su liga privada <strong style="color:#3b82f6;">${data.leagueName}</strong> en RetroFantasy.`),

        emailSpacer(16),
        emailText('Copia este código de invitación para unirte desde la aplicación:', { align: 'center', small: true, muted: true }),
        emailSpacer(8),
        emailInfoBadge('Código de invitación', data.inviteCode),
        emailSpacer(20),

        emailButton('Aceptar Invitación', data.joinUrl),

        emailDivider(),

        emailText('RetroFantasy es el juego manager donde construyes el equipo de tus sueños con leyendas del fútbol. ¡Demuestra quién sabe más de fútbol!', { muted: true, small: true }),
    ].join('\n');

    return wrapInBaseLayout({
        body,
        previewText: `¡${data.inviterName} te invita a unirte a la liga ${data.leagueName}!`,
    });
}
