// ─────────────────────────────────────────────────────────────────────────────
// presentation/routes/leagueMarket.routes.ts
//
// CAMBIOS:
//  1. Añadido schema Zod PlaceLeagueBidSchema + validateBody en POST /bids.
//     Antes el controlador hacía validación manual con Number() sin verificar
//     el tipo de entrada, lo que dejaba la puerta abierta a valores inesperados.
//  2. La validación de `amount > 0` ya no vive en el controlador sino aquí
//     (schema) y en el servicio (regla de negocio). El controlador queda limpio.
// ─────────────────────────────────────────────────────────────────────────────

import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.middleware';
import { requireLeagueAdmin, requireLeagueParticipant } from '../middleware/adminGuard.middleware';
import { validateBody } from '../middleware/validation.middleware';
import { LeagueMarketController } from '../controllers/leagueMarket.controller';

export const PlaceLeagueBidSchema = z.object({
    playerApiId: z
        .number({ message: 'playerApiId debe ser un número' })
        .int({ message: 'playerApiId debe ser un número entero' })
        .positive({ message: 'playerApiId debe ser positivo' }),
    amount: z
        .number({ message: 'amount debe ser un número' })
        .int({ message: 'amount debe ser un número entero' })
        .positive({ message: 'amount debe ser mayor que 0' })
        .max(500_000_000, { message: 'La puja supera el límite permitido' }),
});

export type PlaceLeagueBidDto = z.infer<typeof PlaceLeagueBidSchema>;

export function createLeagueMarketRouter(ctrl: LeagueMarketController): Router {
    const r = Router();
    const participantGuard = [requireAuth, requireLeagueParticipant] as const;
    const adminGuard = [requireAuth, requireLeagueAdmin] as const;

    r.get('/leagues/:leagueId/market',                       ...participantGuard, ctrl.getLeagueMarket);
    r.get('/leagues/:leagueId/market/bids',                  ...participantGuard, ctrl.getMyLeagueBids);
    r.post('/leagues/:leagueId/market/bids',                 ...participantGuard, validateBody(PlaceLeagueBidSchema), ctrl.placeLeagueBid);
    r.delete('/leagues/:leagueId/market/bids/:playerApiId',  ...participantGuard, ctrl.cancelLeagueBid);
    r.post('/leagues/:leagueId/market/open',                 ...adminGuard, ctrl.openLeagueMarket);
    r.post('/leagues/:leagueId/market/close',                ...adminGuard, ctrl.closeLeagueMarket);
    r.post('/market/process-expired',                                     ctrl.processExpiredMarkets);

    return r;
}
