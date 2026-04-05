export interface Player {
    id:           string;
    name:         string;
    position:     string;
    real_team:    string;
    market_value: number;
}

export interface Bid {
    id:        string;
    user_id:   string;
    player_id: string;
    amount:    number;
    status:    'pending' | 'accepted' | 'rejected';
}

export interface LeagueMember {
    user_id: string;
    budget:  number;
}

export interface IMarketRepository {
    getMarketPlayers(page?: number, pageSize?: number): Promise<Player[]>;
    getPlayerById(playerId: string): Promise<Player | null>;
    getUserBids(userId: string): Promise<Bid[]>;
    getBidByUserAndPlayer(userId: string, playerId: string): Promise<Bid | null>;
    createBid(userId: string, playerId: string, amount: number): Promise<void>;
    updateBid(bidId: string, amount: number): Promise<void>;
    deleteBidById(bidId: string): Promise<void>;
    getLeagueMember(userId: string): Promise<LeagueMember | null>;
    updateMemberBudget(userId: string, newBudget: number): Promise<void>;
}
