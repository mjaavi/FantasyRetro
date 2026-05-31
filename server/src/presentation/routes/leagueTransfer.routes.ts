import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { requireLeagueParticipant } from '../middleware/adminGuard.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { LeagueTransferController } from '../controllers/leagueTransfer.controller';

export const PlaceDirectOfferSchema = z.object({
    sellerUserId: z.string().uuid({ message: 'sellerUserId debe ser un UUID valido' }),
    playerApiId: z
        .number({ message: 'playerApiId debe ser un numero' })
        .int({ message: 'playerApiId debe ser un numero entero' })
        .positive({ message: 'playerApiId debe ser positivo' }),
    amount: z
        .number({ message: 'amount debe ser un numero' })
        .int({ message: 'amount debe ser un numero entero' })
        .positive({ message: 'amount debe ser mayor que 0' })
        .max(500_000_000, { message: 'La oferta supera el limite permitido' }),
});

export type PlaceDirectOfferDto = z.infer<typeof PlaceDirectOfferSchema>;

export const RaiseReleaseClauseSchema = z.object({
    contribution: z
        .number({ message: 'contribution debe ser un numero' })
        .int({ message: 'contribution debe ser un numero entero' })
        .positive({ message: 'contribution debe ser mayor que 0' })
        .max(500_000_000, { message: 'La aportacion supera el limite permitido' }),
});

export type RaiseReleaseClauseDto = z.infer<typeof RaiseReleaseClauseSchema>;

export function createLeagueTransferRouter(ctrl: LeagueTransferController): Router {
    const r = Router();
    const participantGuard = [requireAuth, requireLeagueParticipant] as const;

    r.post('/leagues/:leagueId/transfers/offers', ...participantGuard, validateBody(PlaceDirectOfferSchema), ctrl.placeDirectOffer);
    r.get('/leagues/:leagueId/transfers/offers/received', ...participantGuard, ctrl.getReceivedOffers);
    r.get('/leagues/:leagueId/transfers/history', ...participantGuard, ctrl.getTransferHistory);
    r.post('/leagues/:leagueId/transfers/offers/:offerId/accept', ...participantGuard, ctrl.acceptOffer);
    r.post('/leagues/:leagueId/transfers/offers/:offerId/reject', ...participantGuard, ctrl.rejectOffer);
    r.post('/leagues/:leagueId/transfers/release-clauses/:sellerUserId/:playerApiId/pay', ...participantGuard, ctrl.payReleaseClause);
    r.post('/leagues/:leagueId/transfers/release-clauses/:playerApiId/raise', ...participantGuard, validateBody(RaiseReleaseClauseSchema), ctrl.raiseReleaseClause);
    r.post('/leagues/:leagueId/transfers/dismiss/:playerApiId', ...participantGuard, ctrl.dismissPlayer);

    return r;
}
