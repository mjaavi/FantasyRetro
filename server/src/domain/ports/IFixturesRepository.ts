export interface FixtureMatch {
    home_team:     string;
    away_team:     string;
    home_club_logo_url: string | null;
    away_club_logo_url: string | null;
    has_my_player: boolean;
}

export interface IFixturesRepository {
    getFixtures(leagueId: number, jornada: number, userId: string): Promise<FixtureMatch[]>;
}
