export interface AdminLeagueSnapshot {
    id:               number;
    season:           string;
    jornada_actual:   number | null;
    kaggle_league_id: number | null;
}

export interface AdminLeagueStatus {
    id:               number;
    name:             string;
    season:           string;
    jornada_actual:   number | null;
    kaggle_league_id: number | null;
}

export interface AdminRosterEntry {
    user_id:       string;
    player_api_id: number;
}

export interface FantasyScoreWriteModel {
    league_id:       number;
    user_id:         string;
    player_api_id:   number;
    jornada:         number;
    puntos_base:     number;
    puntos_cronista: number;
    puntos_total:    number;
    picas:           string;
    cronista_type:   string;
    calculado_en:    string;
}

export interface GlobalScoreWriteModel {
    player_api_id: number;
    league_id:     number;
    jornada:       number;
    puntos_base:   number;
    puntos_total:  number;
    picas:         string;
    cronista_type: string;
}

export interface AdminFantasyScoreRow {
    user_id:         string;
    player_api_id:   number;
    jornada:         number;
    puntos_base:     number;
    puntos_cronista: number;
    puntos_total:    number;
    picas:           string;
    cronista_type:   string;
}

export interface AdminGlobalScoreRow {
    player_api_id: number;
    jornada:       number;
    puntos_base:   number;
    puntos_total:  number;
    picas:         string;
    cronista_type: string;
}

export interface IAdminRepository {
    getLeagueForProcessing(leagueId: number): Promise<AdminLeagueSnapshot | null>;
    getEstadoLigas(): Promise<AdminLeagueStatus[]>;
    getLeagueRosterEntries(leagueId: number): Promise<AdminRosterEntry[]>;
    saveFantasyScores(rows: FantasyScoreWriteModel[]): Promise<void>;
    saveGlobalScores(rows: GlobalScoreWriteModel[]): Promise<void>;
    updateLeagueCurrentRound(leagueId: number, jornada: number): Promise<void>;
    getPuntosJornada(leagueId: number, jornada: number): Promise<AdminFantasyScoreRow[]>;
    getScoresLiga(leagueId: number): Promise<AdminFantasyScoreRow[]>;
    getGlobalScores(leagueId: number): Promise<AdminGlobalScoreRow[]>;
    getLeagueCurrentRound(leagueId: number): Promise<number>;
    getPlayerGlobalScoreHistory(leagueId: number, playerApiId: number): Promise<AdminGlobalScoreRow[]>;
}
