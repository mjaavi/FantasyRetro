export interface RosterPlayer {
    id:             number;
    name:           string;
    position:       string;
    real_team:      string;
    overall:        number;
    is_starter:     boolean;
    purchase_price: number;
    playerFifaApiId: number | null;
    faceUrl:        string | null;  // URL publica de la cara del jugador
    clubLogoUrl:    string | null;  // URL publica del escudo del club
}

export interface IRosterRepository {
    findByUserAndLeague(userId: string, leagueId: number): Promise<RosterPlayer[]>;
    updateStarter(userId: string, leagueId: number, playerApiId: number, isStarter: boolean): Promise<void>;
    addPlayer(userId: string, leagueId: number, playerApiId: number, purchasePrice: number, userToken: string): Promise<void>;
}
