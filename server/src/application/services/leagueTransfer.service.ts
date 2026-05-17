import { AppError } from '../../domain/errors/AppError';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import {
    ILeagueTransferRepository,
    LeagueDirectOfferView,
    LeagueTransferHistoryItem,
} from '../../domain/ports/ILeagueTransferRepository';

export class LeagueTransferService {
    constructor(
        private readonly repo: ILeagueTransferRepository,
        private readonly leagueRepo: ILeagueRepository,
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

        const minimumAmount = Number(rosterPlayer.purchase_price ?? 0);
        if (amount < minimumAmount) {
            throw new AppError('La oferta no puede ser inferior al precio de compra del jugador.', 400);
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
}
