export interface DashboardScoreRow {
    readonly user_id: string;
    readonly player_api_id: number;
    readonly jornada: number;
    readonly puntos_base: number;
    readonly puntos_cronista: number;
    readonly puntos_total: number;
    readonly picas: string;
    readonly cronista_type: string;
}

export interface GlobalTopPlayer {
    readonly player_api_id: number;
    readonly player_name: string;
    readonly position: string;
    readonly playerFifaApiId: number | null;
    readonly faceUrl: string | null;
    readonly clubLogoUrl: string | null;
    readonly puntos_total: number;
}

export interface FixtureMatch {
    readonly home_team: string;
    readonly away_team: string;
    readonly home_club_logo_url: string | null;
    readonly away_club_logo_url: string | null;
    readonly has_my_player: boolean;
}

export interface DashboardPlayerVisual {
    readonly player_api_id: number;
    readonly player_name: string;
    readonly position: string;
    readonly playerFifaApiId: number | null;
    readonly faceUrl: string | null;
    readonly clubLogoUrl: string | null;
}

export interface IDashboardRepository {
    getScoresLiga(leagueId: number): Promise<DashboardScoreRow[]>;
    getTopJugadoresGlobales(leagueId: number, limit?: number): Promise<GlobalTopPlayer[]>;
    getPlayerVisuals(leagueId: number, playerIds: number[]): Promise<DashboardPlayerVisual[]>;
    getFixtures(leagueId: number, jornada: number, userId: string): Promise<FixtureMatch[]>;
}
