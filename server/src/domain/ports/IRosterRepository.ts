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

export interface RosterScoreRow {
    player_api_id:   number;
    jornada:         number;
    puntos_base:     number;
    puntos_cronista: number;
    puntos_total:    number;
    picas:           string;
    cronista_type:   string;
    is_starter: boolean;
    name: string;
    position: string;
    faceUrl: string | null;
    clubLogoUrl: string | null;
    real_team: string | null;
}

export interface RosterScoreSummary {
    jornadaActual: number;
    scores: RosterScoreRow[];
}

export interface IRosterRepository {
    findByUserAndLeague(userId: string, leagueId: number): Promise<RosterPlayer[]>;
    findScoresByUserAndLeague(userId: string, leagueId: number): Promise<RosterScoreSummary>;
    updateStarter(userId: string, leagueId: number, playerApiId: number, isStarter: boolean): Promise<void>;
    addPlayer(userId: string, leagueId: number, playerApiId: number, purchasePrice: number, userToken: string): Promise<void>;
}
