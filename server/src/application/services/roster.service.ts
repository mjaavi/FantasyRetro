import { ValidationError } from '../../domain/errors/AppError';
import { FORMATION_LAYOUTS, inferFormationKey, isFormationKey, normalizeLineupPosition } from '../../domain/models/formation.models';
import { IRosterRepository, LineupPreference, LineupPreferenceSummary, RosterPlayer, RosterScoreSummary } from '../../domain/ports/IRosterRepository';
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

    async getLineupPreferences(userId: string, leagueId: number): Promise<LineupPreferenceSummary> {
        const jornadaActual = await this.repo.findLeagueCurrentRound(leagueId);
        const editableJornada = jornadaActual + 1;
        const lineups = await this.repo.findLineupPreferencesByUserAndLeague(userId, leagueId, editableJornada);

        return { jornadaActual, editableJornada, lineups };
    }

    async saveLineupFormation(userId: string, leagueId: number, jornada: number, formationKey: string): Promise<LineupPreference> {
        if (!Number.isInteger(jornada) || jornada < 1 || jornada > 38) {
            throw new ValidationError('La jornada debe ser un numero entre 1 y 38.');
        }

        if (!isFormationKey(formationKey)) {
            throw new ValidationError('La formacion seleccionada no es valida.');
        }

        const jornadaActual = await this.repo.findLeagueCurrentRound(leagueId);
        const editableJornada = jornadaActual + 1;

        if (jornada !== editableJornada) {
            throw new ValidationError('Solo puedes cambiar la alineacion de la jornada abierta.');
        }

        return this.repo.upsertLineupPreference(userId, leagueId, jornada, formationKey);
    }

    async toggleStarter(userId: string, leagueId: number, playerApiId: number, isStarter: boolean): Promise<void> {
        if (isStarter) {
            await this.ensureStarterFitsCurrentFormation(userId, leagueId, playerApiId);
        }

        return this.repo.updateStarter(userId, leagueId, playerApiId, isStarter);
    }

    async addPlayer(userId: string, leagueId: number, playerApiId: number, purchasePrice: number, userToken: string): Promise<void> {
        return this.repo.addPlayer(userId, leagueId, playerApiId, purchasePrice, userToken);
    }

    private async ensureStarterFitsCurrentFormation(userId: string, leagueId: number, playerApiId: number): Promise<void> {
        const roster = await this.repo.findByUserAndLeague(userId, leagueId);
        const player = roster.find(item => item.id === playerApiId);

        if (!player) {
            throw new ValidationError('El jugador no pertenece a esta plantilla.');
        }

        if (player.is_starter) return;

        const jornadaActual = await this.repo.findLeagueCurrentRound(leagueId);
        const editableJornada = jornadaActual + 1;
        const preferences = await this.repo.findLineupPreferencesByUserAndLeague(userId, leagueId, editableJornada);
        const savedFormation = preferences.find(item => item.jornada === editableJornada)?.formation_key;
        const formationKey = savedFormation && isFormationKey(savedFormation)
            ? savedFormation
            : inferFormationKey(roster);

        const position = normalizeLineupPosition(player.position);
        const limit = FORMATION_LAYOUTS[formationKey][position];
        const currentStarters = roster.filter(item =>
            item.is_starter && normalizeLineupPosition(item.position) === position,
        ).length;

        if (currentStarters >= limit) {
            throw new ValidationError('No quedan huecos libres en esa posicion para la formacion seleccionada.');
        }
    }
}
