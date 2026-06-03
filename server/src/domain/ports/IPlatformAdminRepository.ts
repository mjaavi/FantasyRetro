export interface PlatformUser {
    id: string;
    email: string;
    username: string | null;
    team_name: string | null;
    created_at: string | null;
}

export interface PlatformLeague {
    id: number;
    name: string;
    invite_code: string;
    season: string;
    admin_id: string;
    admin_username: string | null;
    participants_count: number;
    jornada_actual: number;
    created_at: string;
}

export interface PlatformLeagueParticipant {
    user_id: string;
    username: string | null;
    team_name: string | null;
    budget: number;
}

export interface IPlatformAdminRepository {
    getAllLeagues(): Promise<PlatformLeague[]>;
    deleteLeague(leagueId: number): Promise<void>;
    allocateBudget(leagueId: number, userId: string, amount: number): Promise<void>;
    getAllUsers(): Promise<PlatformUser[]>;
    getLeagueParticipants(leagueId: number): Promise<PlatformLeagueParticipant[]>;
    checkIfUserIsPlatformAdmin(userId: string): Promise<boolean>;

    // Auth-related operations
    createAuthUser(email: string, password: string, username: string, teamName: string): Promise<string>;
    deleteAuthUser(userId: string): Promise<void>;
    updateAuthUserPassword(userId: string, password: string): Promise<void>;
}
