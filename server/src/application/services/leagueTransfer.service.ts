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

export class LeagueTransferService {
    constructor(
        private readonly repo: ILeagueTransferRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly marketValueRepo?: IPlayerMarketValueRepository,
        private readonly pricingService: InitialPricingService = new InitialPricingService(),
        private readonly releaseClausePolicy: ReleaseClausePolicy = new ReleaseClausePolicy(),
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

        await this.repo.acceptDirectOffer(offerId, sellerUserId);
        const newBudget = await this.repo.getUserBudget(sellerUserId, leagueId);
        return { message: 'Oferta aceptada. Traspaso completado.', newBudget };
    }

    async rejectOffer(leagueId: number, sellerUserId: string, offerId: string): Promise<{ message: string }> {
        const offer = await this.repo.getPendingOfferById(offerId);
        if (!offer || offer.leagueId !== leagueId || offer.sellerUserId !== sellerUserId) {
            throw new AppError('Oferta no encontrada o no pertenece a tu equipo.', 404);
        }

        const buyerBudget = await this.repo.getUserBudget(offer.buyerUserId, leagueId);
        await this.repo.markDirectOfferStatus(offerId, 'rejected');
        await this.repo.updateUserBudget(offer.buyerUserId, leagueId, buyerBudget + offer.amount);
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
}
