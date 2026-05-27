// ─────────────────────────────────────────────────────────────────────────────
// index.ts — Email templates barrel export
//
// Central re-export for all email template builders and their data types.
// Usage:
//   import { buildWelcomeEmail, buildPasswordResetEmail, ... } from '../email';
// ─────────────────────────────────────────────────────────────────────────────

export { wrapInBaseLayout } from './emailBaseLayout';
export type { EmailLayoutOptions } from './emailBaseLayout';

export * from './emailComponents';

export { buildPasswordResetEmail } from './passwordResetEmail';
export type { PasswordResetEmailData } from './passwordResetEmail';

export {
    buildSupportTicketUserEmail,
    buildSupportTicketAdminEmail,
} from './supportTicketEmail';
export type { SupportTicketEmailData } from './supportTicketEmail';

export { buildWelcomeEmail } from './welcomeEmail';
export type { WelcomeEmailData } from './welcomeEmail';

export { buildLeagueInvitationEmail } from './leagueInvitationEmail';
export type { LeagueInvitationEmailData } from './leagueInvitationEmail';

export { buildTransferNotificationEmail } from './transferNotificationEmail';
export type { TransferNotificationEmailData } from './transferNotificationEmail';

export { buildNegativeBalanceEmail } from './negativeBalanceEmail';
export type { NegativeBalanceEmailData } from './negativeBalanceEmail';
