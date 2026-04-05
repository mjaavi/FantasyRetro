import { PlayerPosition } from '../models/player.models';

export interface LeagueMarketPlayerSnapshot {
    id: string;
    leagueId: number;
    playerApiId: number;
    playerName: string;
    position: PlayerPosition;
    overallRating: number;
    expiresAt: string;
    isActive: boolean;
    playerFifaApiId: number | null;
    faceUrl: string | null;      // URL publica de la cara del jugador
    clubLogoUrl: string | null;  // URL publica del escudo del club
}

export interface LeagueMarketPlayer extends LeagueMarketPlayerSnapshot {
    marketValue: number;
}

export interface LeagueBid {
    id: string;
    leagueId: number;
    userId: string;
    playerApiId: number;
    amount: number;
    createdAt: string;
}

export interface BidResolutionResult {
    playerApiId: number;
    winnerId: string | null;
    winnerBid: number;
    loserIds: string[];
}

export interface ILeagueMarketRepository {
    getActiveMarket(leagueId: number): Promise<LeagueMarketPlayerSnapshot[]>;
    getMarketForLeague(leagueId: number): Promise<LeagueMarketPlayerSnapshot[]>;
    openMarket(leagueId: number, playerApiIds: number[], expiresAt: Date): Promise<void>;
    closeMarket(leagueId: number): Promise<void>;
    getExpiredMarkets(): Promise<number[]>;
    getPlayerIdsInLeague(leagueId: number): Promise<number[]>;
    getBidsForMarket(leagueId: number): Promise<LeagueBid[]>;
    getBidByUserAndPlayer(leagueId: number, userId: string, playerApiId: number): Promise<LeagueBid | null>;
    upsertBid(leagueId: number, userId: string, playerApiId: number, amount: number): Promise<void>;
    deleteBid(leagueId: number, userId: string, playerApiId: number): Promise<void>;
    clearBidsForLeague(leagueId: number): Promise<void>;
    getUserBidsForLeague(leagueId: number, userId: string): Promise<LeagueBid[]>;
    getUserBudget(userId: string): Promise<number>;
    updateUserBudget(userId: string, newBudget: number): Promise<void>;
    addPlayerToRoster(leagueId: number, userId: string, playerApiId: number, purchasePrice: number): Promise<void>;

    // ── Selección de jugadores para el mercado ─────────────────────────────
    // Responsabilidad movida desde la capa de aplicación: el servicio no debe
    // conocer detalles de Supabase ni la estructura de la tabla Match.

    /**
     * Devuelve los IDs de jugadores que aparecen en partidos de la liga/temporada
     * indicadas, excluyendo los que ya están fichados.
     */
    getMatchPlayerIds(kaggleLeagueId: number, season: string, excluidos: number[]): Promise<number[]>;

}
