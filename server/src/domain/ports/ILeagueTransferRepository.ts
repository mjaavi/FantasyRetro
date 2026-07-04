import { RosterPlayer } from './IRosterRepository';

export type DirectOfferStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled' | 'expired';

export interface LeagueDirectOffer {
    id: string;
    leagueId: number;
    buyerUserId: string | null;
    sellerUserId: string;
    playerApiId: number;
    amount: number;
    status: DirectOfferStatus;
    createdAt: string;
    updatedAt: string;
    resolvedAt: string | null;
}

export interface LeagueTransferHistoryItem {
    id: string;
    leagueId: number;
    playerApiId: number;
    playerName: string;
    fromUserId: string | null;
    fromTeamName: string;
    fromUsername: string;
    toUserId: string | null;
    toTeamName: string;
    toUsername: string;
    amount: number;
    transferType: string;
    createdAt: string;
}

export interface LeagueDirectOfferView extends LeagueDirectOffer {
    playerName: string;
    position: string;
    realTeam: string;
    playerFifaApiId: number | null;
    faceUrl: string | null;
    clubLogoUrl: string | null;
    buyerUsername: string;
    buyerTeamName: string;
    sellerUsername: string;
    sellerTeamName: string;
}

export interface ILeagueTransferRepository {
    getRosterPlayer(leagueId: number, ownerUserId: string, playerApiId: number): Promise<RosterPlayer | null>;
    getPendingOfferByBuyerAndPlayer(leagueId: number, buyerUserId: string, playerApiId: number): Promise<LeagueDirectOffer | null>;
    createDirectOffer(input: {
        leagueId: number;
        buyerUserId: string;
        sellerUserId: string;
        playerApiId: number;
        amount: number;
    }): Promise<LeagueDirectOffer>;
    updateDirectOfferAmount(offerId: string, amount: number): Promise<LeagueDirectOffer>;
    markDirectOfferStatus(offerId: string, status: Exclude<DirectOfferStatus, 'pending'>): Promise<void>;
    getPendingOfferById(offerId: string): Promise<LeagueDirectOffer | null>;
    getReceivedDirectOffers(leagueId: number, sellerUserId: string): Promise<LeagueDirectOfferView[]>;
    getTransferHistory(leagueId: number): Promise<LeagueTransferHistoryItem[]>;
    acceptDirectOffer(offerId: string, sellerUserId: string): Promise<void>;
    payReleaseClause(input: {
        leagueId: number;
        buyerUserId: string;
        sellerUserId: string;
        playerApiId: number;
        clauseAmount: number;
        nextReleaseClause: number;
    }): Promise<void>;
    raiseReleaseClause(input: {
        leagueId: number;
        userId: string;
        playerApiId: number;
        contribution: number;
        nextReleaseClause: number;
    }): Promise<void>;
    dismissPlayer(input: {
        leagueId: number;
        userId: string;
        playerApiId: number;
        recoveredAmount: number;
    }): Promise<void>;
    getUserBudget(userId: string, leagueId: number): Promise<number>;
    updateUserBudget(userId: string, leagueId: number, newBudget: number): Promise<void>;
}
