export interface FantasyLeague {
    id:               number;
    name:             string;
    invite_code:      string;
    season:           string;
    admin_id:         string;
    kaggle_league_id: number | null;
    jornada_actual?:  number | null;
    created_at:       string;
}

export interface LeagueParticipantProfile {
    username:  string;
    team_name: string;
    budget:    number;
}

export interface LeagueParticipant {
    user_id:   string;
    league_id: number;
    joined_at: string;
    profiles?: LeagueParticipantProfile;
}

export interface CreateLeagueInput {
    name:             string;
    invite_code:      string;
    admin_id:         string;
    season:           string;
    kaggle_league_id: number;
}

export interface UserLeagueSummary extends FantasyLeague {
    joined_at: string;
    esAdmin:   boolean;
}

export interface ILeagueRepository {
    findById(leagueId: number): Promise<FantasyLeague | null>;
    findByInviteCode(inviteCode: string): Promise<FantasyLeague | null>;
    create(data: CreateLeagueInput): Promise<FantasyLeague>;
    createWithUserToken(data: CreateLeagueInput, userToken: string): Promise<FantasyLeague>;
    findParticipantsByLeague(leagueId: number): Promise<LeagueParticipant[]>;
    findParticipant(leagueId: number, userId: string): Promise<LeagueParticipant | null>;
    findLeaguesByUser(userId: string): Promise<UserLeagueSummary[]>;
    addParticipant(leagueId: number, userId: string): Promise<void>;
    addParticipantWithUserToken(leagueId: number, userId: string, userToken: string): Promise<void>;
}
