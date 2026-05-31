import { AppError } from '../../domain/errors/AppError';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import {
    ILeagueTransferRepository,
    LeagueDirectOfferView,
    LeagueTransferHistoryItem,
} from '../../domain/ports/ILeagueTransferRepository';
import { IPlayerMarketValueRepository } from '../../domain/ports/IPlayerMarketValueRepository';
import { InitialPricingService } from './economy/InitialPricingService';
import { ReleaseClausePolicy } from './economy/ReleaseClausePolicy';
import { PlayerPosition } from '../../domain/models/player.models';
import { IEmailService } from '../../domain/services/IEmailService';
import { buildTransferNotificationEmail } from '../../infrastructure/email';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

export class LeagueTransferService {
    constructor(
        private readonly repo: ILeagueTransferRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly marketValueRepo?: IPlayerMarketValueRepository,
        private readonly pricingService: InitialPricingService = new InitialPricingService(),
        private readonly releaseClausePolicy: ReleaseClausePolicy = new ReleaseClausePolicy(),
        private readonly emailService?: IEmailService,
    ) {}

    async placeDirectOffer(
        leagueId: number,
        buyerUserId: string,
        sellerUserId: string,
        playerApiId: number,
        amount: number,
    ): Promise<{ message: string; newBudget: number }> {
        if (buyerUserId === sellerUserId) {
            throw new AppError('No puedes pujar por un jugador de tu propio equipo.', 400);
        }

        const [buyer, seller, rosterPlayer] = await Promise.all([
            this.leagueRepo.findParticipant(leagueId, buyerUserId),
            this.leagueRepo.findParticipant(leagueId, sellerUserId),
            this.repo.getRosterPlayer(leagueId, sellerUserId, playerApiId),
        ]);

        if (!buyer) throw new AppError('No participas en esta liga.', 403);
        if (!seller) throw new AppError('El vendedor no participa en esta liga.', 404);
        if (!rosterPlayer) throw new AppError('Este jugador ya no pertenece a ese equipo.', 404);

        const minimumAmount = await this.getCurrentMarketValue(leagueId, playerApiId, rosterPlayer);
        if (amount < minimumAmount) {
            throw new AppError('La oferta no puede ser inferior al valor de mercado del jugador.', 400);
        }

        const previousOffer = await this.repo.getPendingOfferByBuyerAndPlayer(leagueId, buyerUserId, playerApiId);
        const budget = await this.repo.getUserBudget(buyerUserId, leagueId);
        const realCost = previousOffer ? amount - previousOffer.amount : amount;

        if (realCost > budget) {
            throw new AppError('No tienes presupuesto suficiente para esta oferta.', 400);
        }

        const offer = previousOffer
            ? await this.repo.updateDirectOfferAmount(previousOffer.id, amount)
            : await this.repo.createDirectOffer({ leagueId, buyerUserId, sellerUserId, playerApiId, amount });

        const newBudget = budget - realCost;
        await this.repo.updateUserBudget(buyerUserId, leagueId, newBudget);

        if (this.emailService) {
            this.getUserEmail(sellerUserId).then(sellerEmail => {
                if (sellerEmail) {
                    const buyerName = buyer.profiles?.username || buyer.profiles?.team_name || 'Un manager';
                    const sellerName = seller.profiles?.username || seller.profiles?.team_name || 'Manager';
                    const html = buildTransferNotificationEmail({
                        userName: sellerName,
                        playerName: rosterPlayer.name,
                        amount: `${amount.toLocaleString()} €`,
                        fromUser: buyerName,
                        toUser: sellerName,
                        status: 'received',
                        marketUrl: 'https://fantasyretro.pages.dev',
                    });

                    this.emailService!.sendEmail({
                        to: sellerEmail,
                        subject: `¡Nueva oferta recibida por ${rosterPlayer.name}!`,
                        html,
                        text: `Hola ${sellerName}, has recibido una nueva oferta de traspaso de ${buyerName} por ${rosterPlayer.name} de ${amount.toLocaleString()} €.`,
                    }).catch(err => console.error('[EmailService] Error al enviar email de oferta recibida:', err));
                }
            }).catch(err => console.error('[EmailService] Error al obtener email de vendedor:', err));
        }

        return {
            message: previousOffer ? 'Oferta actualizada.' : 'Oferta enviada. Queda pendiente de aceptacion.',
            newBudget,
        };
    }

    async getReceivedOffers(leagueId: number, userId: string): Promise<LeagueDirectOfferView[]> {
        return this.repo.getReceivedDirectOffers(leagueId, userId);
    }

    async getTransferHistory(leagueId: number): Promise<LeagueTransferHistoryItem[]> {
        return this.repo.getTransferHistory(leagueId);
    }

    async acceptOffer(leagueId: number, sellerUserId: string, offerId: string): Promise<{ message: string; newBudget: number }> {
        const offer = await this.repo.getPendingOfferById(offerId);
        if (!offer || offer.leagueId !== leagueId || offer.sellerUserId !== sellerUserId) {
            throw new AppError('Oferta no encontrada o no pertenece a tu equipo.', 404);
        }

        const [rosterPlayer, buyerParticipant, sellerParticipant] = await Promise.all([
            this.repo.getRosterPlayer(leagueId, sellerUserId, offer.playerApiId),
            this.leagueRepo.findParticipant(leagueId, offer.buyerUserId),
            this.leagueRepo.findParticipant(leagueId, sellerUserId),
        ]);
        const playerName = rosterPlayer?.name ?? 'Desconocido';

        await this.repo.acceptDirectOffer(offerId, sellerUserId);
        const newBudget = await this.repo.getUserBudget(sellerUserId, leagueId);

        if (this.emailService) {
            this.getUserEmail(offer.buyerUserId).then(buyerEmail => {
                if (buyerEmail) {
                    const buyerName = buyerParticipant?.profiles?.username || buyerParticipant?.profiles?.team_name || 'Manager';
                    const sellerName = sellerParticipant?.profiles?.username || sellerParticipant?.profiles?.team_name || 'Un manager';
                    const html = buildTransferNotificationEmail({
                        userName: buyerName,
                        playerName,
                        amount: `${offer.amount.toLocaleString()} €`,
                        fromUser: sellerName,
                        toUser: buyerName,
                        status: 'accepted',
                        marketUrl: 'https://fantasyretro.pages.dev',
                    });

                    this.emailService!.sendEmail({
                        to: buyerEmail,
                        subject: `¡Oferta aceptada por ${playerName}!`,
                        html,
                        text: `¡Fichaje completado! ${sellerName} ha aceptado tu oferta de ${offer.amount.toLocaleString()} € por ${playerName}.`,
                    }).catch(err => console.error('[EmailService] Error al enviar email de oferta aceptada:', err));
                }
            }).catch(err => console.error('[EmailService] Error al obtener email de comprador:', err));
        }

        return { message: 'Oferta aceptada. Traspaso completado.', newBudget };
    }

    async rejectOffer(leagueId: number, sellerUserId: string, offerId: string): Promise<{ message: string }> {
        const offer = await this.repo.getPendingOfferById(offerId);
        if (!offer || offer.leagueId !== leagueId || offer.sellerUserId !== sellerUserId) {
            throw new AppError('Oferta no encontrada o no pertenece a tu equipo.', 404);
        }

        const [rosterPlayer, buyerParticipant, sellerParticipant] = await Promise.all([
            this.repo.getRosterPlayer(leagueId, sellerUserId, offer.playerApiId),
            this.leagueRepo.findParticipant(leagueId, offer.buyerUserId),
            this.leagueRepo.findParticipant(leagueId, sellerUserId),
        ]);
        const playerName = rosterPlayer?.name ?? 'Desconocido';

        const buyerBudget = await this.repo.getUserBudget(offer.buyerUserId, leagueId);
        await this.repo.markDirectOfferStatus(offerId, 'rejected');
        await this.repo.updateUserBudget(offer.buyerUserId, leagueId, buyerBudget + offer.amount);

        if (this.emailService) {
            this.getUserEmail(offer.buyerUserId).then(buyerEmail => {
                if (buyerEmail) {
                    const buyerName = buyerParticipant?.profiles?.username || buyerParticipant?.profiles?.team_name || 'Manager';
                    const sellerName = sellerParticipant?.profiles?.username || sellerParticipant?.profiles?.team_name || 'Un manager';
                    const html = buildTransferNotificationEmail({
                        userName: buyerName,
                        playerName,
                        amount: `${offer.amount.toLocaleString()} €`,
                        fromUser: sellerName,
                        toUser: buyerName,
                        status: 'rejected',
                        marketUrl: 'https://fantasyretro.pages.dev',
                    });

                    this.emailService!.sendEmail({
                        to: buyerEmail,
                        subject: `Oferta rechazada por ${playerName}`,
                        html,
                        text: `Hola ${buyerName}, ${sellerName} ha rechazado tu oferta de ${offer.amount.toLocaleString()} € por ${playerName}. Se te ha devuelto el presupuesto.`,
                    }).catch(err => console.error('[EmailService] Error al enviar email de oferta rechazada:', err));
                }
            }).catch(err => console.error('[EmailService] Error al obtener email de comprador:', err));
        }

        return { message: 'Oferta rechazada. Presupuesto devuelto al comprador.' };
    }

    async payReleaseClause(
        leagueId: number,
        buyerUserId: string,
        sellerUserId: string,
        playerApiId: number,
    ): Promise<{ message: string; newBudget: number }> {
        if (buyerUserId === sellerUserId) {
            throw new AppError('No puedes pagar la clausula de un jugador de tu propio equipo.', 400);
        }

        const [buyer, seller, rosterPlayer] = await Promise.all([
            this.leagueRepo.findParticipant(leagueId, buyerUserId),
            this.leagueRepo.findParticipant(leagueId, sellerUserId),
            this.repo.getRosterPlayer(leagueId, sellerUserId, playerApiId),
        ]);

        if (!buyer) throw new AppError('No participas en esta liga.', 403);
        if (!seller) throw new AppError('El vendedor no participa en esta liga.', 404);
        if (!rosterPlayer) throw new AppError('Este jugador ya no pertenece a ese equipo.', 404);

        const [marketValue, pendingOffer] = await Promise.all([
            this.getCurrentMarketValue(leagueId, playerApiId, rosterPlayer),
            this.repo.getPendingOfferByBuyerAndPlayer(leagueId, buyerUserId, playerApiId),
        ]);
        const clauseAmount = this.releaseClausePolicy.getEffectiveClause(rosterPlayer.release_clause, marketValue);
        const budget = await this.repo.getUserBudget(buyerUserId, leagueId);

        if (budget + Number(pendingOffer?.amount ?? 0) < clauseAmount) {
            throw new AppError('No tienes presupuesto suficiente para abonar esta clausula.', 400);
        }

        const nextReleaseClause = this.releaseClausePolicy.getInitialClause(Math.max(clauseAmount, marketValue));
        await this.repo.payReleaseClause({
            leagueId,
            buyerUserId,
            sellerUserId,
            playerApiId,
            clauseAmount,
            nextReleaseClause,
        });
        const newBudget = await this.repo.getUserBudget(buyerUserId, leagueId);

        if (this.emailService) {
            this.getUserEmail(sellerUserId).then(sellerEmail => {
                if (sellerEmail) {
                    const buyerName = buyer.profiles?.username || buyer.profiles?.team_name || 'Un manager';
                    const sellerName = seller.profiles?.username || seller.profiles?.team_name || 'Manager';
                    const html = buildTransferNotificationEmail({
                        userName: sellerName,
                        playerName: rosterPlayer.name,
                        amount: `${clauseAmount.toLocaleString()} €`,
                        fromUser: sellerName,
                        toUser: buyerName,
                        status: 'accepted',
                        marketUrl: 'https://fantasyretro.pages.dev',
                    });

                    this.emailService!.sendEmail({
                        to: sellerEmail,
                        subject: `¡Clausulazo! Se han llevado a ${rosterPlayer.name}`,
                        html,
                        text: `¡Hola ${sellerName}! El mánager ${buyerName} ha pagado la cláusula de rescisión de ${rosterPlayer.name} por ${clauseAmount.toLocaleString()} €. El jugador se ha incorporado a su equipo y tú has recibido el dinero.`,
                    }).catch(err => console.error('[EmailService] Error al enviar email de clausulazo:', err));
                }
            }).catch(err => console.error('[EmailService] Error al obtener email de vendedor:', err));
        }

        return {
            message: 'Clausulazo ejecutado. Fichaje completado.',
            newBudget,
        };
    }

    async raiseReleaseClause(
        leagueId: number,
        userId: string,
        playerApiId: number,
        contribution: number,
    ): Promise<{ message: string; newBudget: number; releaseClause: number }> {
        const [participant, rosterPlayer] = await Promise.all([
            this.leagueRepo.findParticipant(leagueId, userId),
            this.repo.getRosterPlayer(leagueId, userId, playerApiId),
        ]);

        if (!participant) throw new AppError('No participas en esta liga.', 403);
        if (!rosterPlayer) throw new AppError('Este jugador no pertenece a tu equipo.', 404);
        if (!Number.isInteger(contribution) || contribution <= 0) {
            throw new AppError('Introduce una cantidad valida para subir la clausula.', 400);
        }

        const budget = await this.repo.getUserBudget(userId, leagueId);
        if (budget < contribution) {
            throw new AppError('No tienes presupuesto suficiente para subir la clausula.', 400);
        }

        const marketValue = await this.getCurrentMarketValue(leagueId, playerApiId, rosterPlayer);
        const nextReleaseClause = this.releaseClausePolicy.getRaisedClause(
            rosterPlayer.release_clause,
            marketValue,
            contribution,
        );

        await this.repo.raiseReleaseClause({
            leagueId,
            userId,
            playerApiId,
            contribution,
            nextReleaseClause,
        });

        return {
            message: 'Clausula actualizada.',
            newBudget: budget - contribution,
            releaseClause: nextReleaseClause,
        };
    }

    async dismissPlayer(
        leagueId: number,
        userId: string,
        playerApiId: number,
    ): Promise<{ message: string; newBudget: number; recoveredAmount: number }> {
        const [participant, rosterPlayer] = await Promise.all([
            this.leagueRepo.findParticipant(leagueId, userId),
            this.repo.getRosterPlayer(leagueId, userId, playerApiId),
        ]);

        if (!participant) throw new AppError('No participas en esta liga.', 403);
        if (!rosterPlayer) throw new AppError('Este jugador no pertenece a tu equipo.', 404);

        const marketValue = await this.getCurrentMarketValue(leagueId, playerApiId, rosterPlayer);
        const recoveredAmount = Math.floor(marketValue * 0.5);

        await this.repo.dismissPlayer({
            leagueId,
            userId,
            playerApiId,
            recoveredAmount,
        });

        const newBudget = await this.repo.getUserBudget(userId, leagueId);

        return {
            message: 'Jugador despedido.',
            newBudget,
            recoveredAmount,
        };
    }

    private async getCurrentMarketValue(
        leagueId: number,
        playerApiId: number,
        player: { overall: number; position: string },
    ): Promise<number> {
        const [storedValue] = this.marketValueRepo
            ? await this.marketValueRepo.findMarketValues(leagueId, [playerApiId])
            : [];

        if (storedValue) {
            return storedValue.currentPrice;
        }

        return this.pricingService.calculate({
            ovr: player.overall,
            position: player.position as PlayerPosition,
        }).price;
    }

    private async getUserEmail(userId: string): Promise<string | null> {
        const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
        if (error || !data?.user) return null;
        return data.user.email ?? null;
    }
}
