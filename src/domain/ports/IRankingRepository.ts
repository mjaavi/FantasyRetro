export interface RosterEntry {
    user_id:        string;
    player_api_id:  number;
    purchase_price: number;
}

export interface IRankingRepository {
    findRosterByLeague(leagueId: number): Promise<RosterEntry[]>;
}
