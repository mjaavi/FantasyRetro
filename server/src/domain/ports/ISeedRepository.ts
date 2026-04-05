export interface KagglePlayer {
    player_api_id: number;
    player_name:   string;
    overall_rating?: number;
    attacking_work_rate?: string;
    defensive_work_rate?: string;
    gk_diving?:    number;
    gk_reflexes?:  number;
}

export interface MarketPlayer {
    name:         string;
    position:     string;
    real_team:    string;
    market_value: number;
}

export interface ISeedRepository {
    fetchKagglePlayers(limit: number): Promise<KagglePlayer[]>;
    clearMarketPlayers(): Promise<void>;
    insertMarketPlayers(players: MarketPlayer[]): Promise<number>;
}
