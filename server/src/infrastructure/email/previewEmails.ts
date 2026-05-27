// ─────────────────────────────────────────────────────────────────────────────
// previewEmails.ts — Dev-only script to preview all email templates in browser
//
// Usage: npx tsx server/src/infrastructure/email/previewEmails.ts
// Opens generated HTML files so you can inspect the designs.
// ─────────────────────────────────────────────────────────────────────────────

import * as fs from 'fs';
import * as path from 'path';

import { buildPasswordResetEmail } from './passwordResetEmail';
import { buildSupportTicketUserEmail, buildSupportTicketAdminEmail } from './supportTicketEmail';
import { buildWelcomeEmail } from './welcomeEmail';
import { buildLeagueInvitationEmail } from './leagueInvitationEmail';
import { buildTransferNotificationEmail } from './transferNotificationEmail';
import { buildNegativeBalanceEmail } from './negativeBalanceEmail';

const outDir = path.join(__dirname, '..', '..', '..', '..', 'email-previews');
fs.mkdirSync(outDir, { recursive: true });

const templates = [
    {
        name: '01-bienvenida',
        html: buildWelcomeEmail({
            userName: 'Carlos Martínez',
            appUrl: 'https://retrofantasy.com/app.html',
        }),
    },
    {
        name: '02-recuperacion-contrasena',
        html: buildPasswordResetEmail({
            userName: 'Carlos Martínez',
            resetLink: 'https://retrofantasy.com/reset-password.html?token=abc123xyz',
            expirationMinutes: 60,
        }),
    },
    {
        name: '03-ticket-usuario',
        html: buildSupportTicketUserEmail({
            ticketId: 'TK-20260527-0042',
            userEmail: 'carlos@universidad.es',
            userName: 'Carlos Martínez',
            subject: 'No puedo fichar jugadores en el mercado',
            message: 'Hola, llevo dos días intentando fichar jugadores en la liga "Copa Universitaria" pero al pulsar el botón de puja no ocurre nada. He probado en Chrome y Firefox. ¿Podrían ayudarme? Gracias.',
            userId: 'usr_8f3k2m',
        }),
    },
    {
        name: '04-ticket-admin',
        html: buildSupportTicketAdminEmail({
            ticketId: 'TK-20260527-0042',
            userEmail: 'carlos@universidad.es',
            userName: 'Carlos Martínez',
            subject: 'No puedo fichar jugadores en el mercado',
            message: 'Hola, llevo dos días intentando fichar jugadores en la liga "Copa Universitaria" pero al pulsar el botón de puja no ocurre nada. He probado en Chrome y Firefox. ¿Podrían ayudarme? Gracias.',
            userId: 'usr_8f3k2m',
        }),
    },
    {
        name: '05-invitacion-liga',
        html: buildLeagueInvitationEmail({
            inviterName: 'Javier Rodríguez',
            leagueName: 'Premier Retro League',
            inviteCode: 'PREM-98FX-RETRO',
            joinUrl: 'https://retrofantasy.com/app.html?join=PREM-98FX-RETRO',
        }),
    },
    {
        name: '06-oferta-recibida',
        html: buildTransferNotificationEmail({
            userName: 'Carlos Martínez',
            playerName: 'Diego Maradona (86)',
            amount: '45.500.000 €',
            fromUser: 'Javier Rodríguez',
            toUser: 'Carlos Martínez',
            status: 'received',
            marketUrl: 'https://retrofantasy.com/app.html?page=market',
        }),
    },
    {
        name: '07-oferta-aceptada',
        html: buildTransferNotificationEmail({
            userName: 'Javier Rodríguez',
            playerName: 'Zinedine Zidane (84)',
            amount: '38.200.000 €',
            fromUser: 'Javier Rodríguez',
            toUser: 'Carlos Martínez',
            status: 'accepted',
            marketUrl: 'https://retrofantasy.com/app.html?page=market',
        }),
    },
    {
        name: '08-saldo-negativo',
        html: buildNegativeBalanceEmail({
            userName: 'Carlos Martínez',
            currentBalance: '-3.450.000 €',
            gameweekNumber: 14,
            deadlineTime: 'Viernes 20:00h (Inicio de jornada)',
            rosterUrl: 'https://retrofantasy.com/app.html?page=roster',
        }),
    },
];

for (const { name, html } of templates) {
    const filePath = path.join(outDir, `${name}.html`);
    fs.writeFileSync(filePath, html, 'utf-8');
    console.log(`✅ ${name}.html → ${filePath}`);
}

console.log(`\n🎨 Previews generados en: ${outDir}`);
console.log('   Abre los archivos .html en tu navegador para ver el diseño.');
