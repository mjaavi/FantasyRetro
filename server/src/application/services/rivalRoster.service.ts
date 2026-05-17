// ─────────────────────────────────────────────────────────────────────────────
// RivalRosterService — Obtiene el roster y puntos de un rival en la liga
// SRP: Solo responsable de orquestar la consulta del roster ajeno.
// DRY: Reutiliza IRosterRepository y ILeagueRepository existentes.
// ─────────────────────────────────────────────────────────────────────────────

import { AppError } from '../../domain/errors/AppError';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { IRosterRepository } from '../../domain/ports/IRosterRepository';
import { IPlayerMarketValueRepository } from '../../domain/ports/IPlayerMarketValueRepository';
import { RivalRosterResponseDTO, RivalPlayerDTO } from '../dtos/RivalRosterDTO';
import { inferFormationKey, isFormationKey } from '../../domain/models/formation.models';
import { InitialPricingService } from './economy/InitialPricingService';
import { ReleaseClausePolicy } from './economy/ReleaseClausePolicy';
import { PlayerPosition } from '../../domain/models/player.models';

const TOTAL_JORNADAS = 38;

export class RivalRosterService {

    constructor(
        private readonly rosterRepo: IRosterRepository,
        private readonly leagueRepo: ILeagueRepository,
        private readonly marketValueRepo?: IPlayerMarketValueRepository,
        private readonly pricingService: InitialPricingService = new InitialPricingService(),
        private readonly releaseClausePolicy: ReleaseClausePolicy = new ReleaseClausePolicy(),
    ) {}

    async getRivalRoster(
        leagueId: number,
        requestingUserId: string,
        targetUserId: string,
        jornada?: number,
    ): Promise<RivalRosterResponseDTO> {
        // 1. Verificar que ambos usuarios participan en la liga (seguridad)
        const [requestingParticipant, targetParticipant] = await Promise.all([
            this.leagueRepo.findParticipant(leagueId, requestingUserId),
            this.leagueRepo.findParticipant(leagueId, targetUserId),
        ]);

        if (!requestingParticipant) {
            throw new AppError('No participas en esta liga.', 403);
        }
        if (!targetParticipant) {
            throw new AppError('El usuario solicitado no participa en esta liga.', 404);
        }

        // 2. Obtener roster y scores del rival
        const [roster, scoreSummary, jornadaActual] = await Promise.all([
            this.rosterRepo.findByUserAndLeague(targetUserId, leagueId),
            this.rosterRepo.findScoresByUserAndLeague(targetUserId, leagueId),
            this.rosterRepo.findLeagueCurrentRound(leagueId),
        ]);
        const marketValuesByPlayer = await this.resolveMarketValues(leagueId, roster);

        // 3. Obtener formación del rival para la jornada
        const targetJornada = jornada ?? jornadaActual;
        const maxJornada = jornadaActual + 1;
        const lineupPreferences = await this.rosterRepo.findLineupPreferencesByUserAndLeague(
            targetUserId,
            leagueId,
            maxJornada,
        );

        // Resolver formación: preferencia guardada o inferida
        const savedFormation = lineupPreferences.find(l => l.jornada === targetJornada)?.formation_key;
        const formationKey = savedFormation && isFormationKey(savedFormation)
            ? savedFormation
            : inferFormationKey(roster);

        // 4. Calcular puntos por jugador en la jornada solicitada
        const scoresByPlayer = new Map<number, number>();
        let totalPoints = 0;

        for (const score of scoreSummary.scores) {
            if (score.jornada === targetJornada && score.is_starter) {
                scoresByPlayer.set(score.player_api_id, score.puntos_total);
                totalPoints += score.puntos_total;
            }
        }

        // Si no se solicita jornada específica (general), sumar todos los puntos de titulares
        if (jornada === undefined) {
            totalPoints = 0;
            scoresByPlayer.clear();
            for (const score of scoreSummary.scores) {
                if (score.is_starter) {
                    const current = scoresByPlayer.get(score.player_api_id) ?? 0;
                    scoresByPlayer.set(score.player_api_id, current + score.puntos_total);
                    totalPoints += score.puntos_total;
                }
            }
        }

        // 5. Mapear a DTOs separando titulares y suplentes
        const mapPlayer = (player: typeof roster[number]): RivalPlayerDTO => {
            const marketValue = marketValuesByPlayer.get(player.id) ?? player.purchase_price;
            return {
                id: player.id,
                name: player.name,
                position: player.position,
                real_team: player.real_team,
                overall: player.overall,
                is_starter: player.is_starter,
                purchase_price: player.purchase_price,
                marketValue,
                releaseClause: this.releaseClausePolicy.getEffectiveClause(player.release_clause, marketValue),
                playerFifaApiId: player.playerFifaApiId,
                faceUrl: player.faceUrl,
                clubLogoUrl: player.clubLogoUrl,
                jornadaPts: scoresByPlayer.get(player.id) ?? null,
            };
        };

        // Para jornada histórica, usar los datos de fantasy_scores para saber quién era titular
        let titulares: RivalPlayerDTO[];
        let suplentes: RivalPlayerDTO[];

        if (jornada !== undefined && jornada <= jornadaActual) {
            // Jornada histórica: titulares = los que tienen is_starter en fantasy_scores
            const starterIdsInJornada = new Set(
                scoreSummary.scores
                    .filter(s => s.jornada === jornada && s.is_starter)
                    .map(s => s.player_api_id),
            );

            titulares = roster
                .filter(p => starterIdsInJornada.has(p.id))
                .map(mapPlayer);
            suplentes = roster
                .filter(p => !starterIdsInJornada.has(p.id))
                .map(mapPlayer);
        } else {
            // Jornada actual/editable: usar el estado actual del roster
            titulares = roster.filter(p => p.is_starter).map(mapPlayer);
            suplentes = roster.filter(p => !p.is_starter).map(mapPlayer);
        }

        // 6. Construir jornadas disponibles
        const jornadasDisponibles = Array.from(
            { length: Math.min(jornadaActual + 1, TOTAL_JORNADAS) },
            (_, i) => i + 1,
        );

        // Nombre y equipo del rival
        const profile = targetParticipant.profiles;

        return {
            userId: targetUserId,
            username: profile?.username ?? 'Desconocido',
            teamName: profile?.team_name ?? '—',
            leagueId,
            jornadaActual,
            jornadasDisponibles,
            formationKey,
            titulares,
            suplentes,
            totalPoints,
        };
    }

    private async resolveMarketValues(
        leagueId: number,
        roster: Awaited<ReturnType<IRosterRepository['findByUserAndLeague']>>,
    ): Promise<Map<number, number>> {
        const storedValues = this.marketValueRepo
            ? await this.marketValueRepo.findMarketValues(leagueId, roster.map(player => player.id))
            : [];
        const values = new Map(storedValues.map(value => [value.playerApiId, value.currentPrice]));

        for (const player of roster) {
            if (!values.has(player.id)) {
                const initialPrice = this.pricingService.calculate({
                    ovr: player.overall,
                    position: player.position as PlayerPosition,
                }).price;
                values.set(player.id, initialPrice);
            }
        }

        return values;
    }
}
