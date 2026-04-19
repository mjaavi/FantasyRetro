import { IRosterRepository, RosterPlayer, RosterScoreSummary } from '../../domain/ports/IRosterRepository';
import { SupabaseRosterRepository } from '../../infrastructure/repositories/SupabaseRosterRepository';

/**
 * RosterService — responsabilidad única: gestionar la plantilla de un usuario.
 * No contiene queries. Delega el acceso a datos al repositorio.
 */
export class RosterService {

    constructor(private readonly repo: IRosterRepository = new SupabaseRosterRepository()) {}

    async getRoster(userId: string, leagueId: number): Promise<RosterPlayer[]> {
        return this.repo.findByUserAndLeague(userId, leagueId);
    }

    async getRosterScores(userId: string, leagueId: number): Promise<RosterScoreSummary> {
        return this.repo.findScoresByUserAndLeague(userId, leagueId);
    }

    async toggleStarter(userId: string, leagueId: number, playerApiId: number, isStarter: boolean): Promise<void> {
        return this.repo.updateStarter(userId, leagueId, playerApiId, isStarter);
    }

    async addPlayer(userId: string, leagueId: number, playerApiId: number, purchasePrice: number, userToken: string): Promise<void> {
        return this.repo.addPlayer(userId, leagueId, playerApiId, purchasePrice, userToken);
    }
}
