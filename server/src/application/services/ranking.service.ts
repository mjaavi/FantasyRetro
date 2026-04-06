import { AppError } from '../../domain/errors/AppError';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { IRankingRepository } from '../../domain/ports/IRankingRepository';
import { SupabaseLeagueRepository } from '../../infrastructure/repositories/SupabaseLeagueRepository';
import { SupabaseRankingRepository } from '../../infrastructure/repositories/SupabaseRankingRepository';
import { RankingEntryDTO, RankingResponseDTO } from '../dtos/RankingDTO';
import { supabaseAdmin }            from '../../infrastructure/supabase.client';

const TOTAL_JORNADAS = 38;

export class RankingService {

    constructor(
        private readonly leagueRepo:  ILeagueRepository  = new SupabaseLeagueRepository(),
        private readonly rankingRepo: IRankingRepository  = new SupabaseRankingRepository(),
    ) {}

    async getRanking(leagueId: number, jornada?: number): Promise<RankingResponseDTO> {
        const liga = await this.leagueRepo.findById(leagueId);
        if (!liga) throw new AppError('Liga no encontrada.', 404);

        const participantes = await this.leagueRepo.findParticipantsByLeague(leagueId);
        const rosterEntries = await this.rankingRepo.findRosterByLeague(leagueId);

        // Agrupar roster por usuario
        const rosterPorUsuario = new Map<string, { playerIds: number[]; totalGastado: number }>();
        for (const entry of rosterEntries) {
            const userId = entry.user_id;
            if (!rosterPorUsuario.has(userId)) {
                rosterPorUsuario.set(userId, { playerIds: [], totalGastado: 0 });
            }
            const datos = rosterPorUsuario.get(userId)!;
            datos.playerIds.push(entry.player_api_id);
            datos.totalGastado += Number(entry.purchase_price ?? 0);
        }

        // Leer puntos de fantasy_scores (persistidos por AdminService)
        let puntosQuery = supabaseAdmin
            .from('fantasy_scores')
            .select('user_id, puntos_total')
            .eq('league_id', leagueId);

        if (jornada !== undefined) {
            puntosQuery = puntosQuery.eq('jornada', jornada);
        }

        const { data: scoresData } = await puntosQuery;

        const puntosPorUsuario = new Map<string, number>();
        for (const score of scoresData ?? []) {
            const uid = score.user_id as string;
            puntosPorUsuario.set(uid, (puntosPorUsuario.get(uid) ?? 0) + Number(score.puntos_total));
        }

        const ranking: RankingEntryDTO[] = [];

        for (const participante of participantes) {
            const profile  = participante.profiles;
            const userId   = participante.user_id;
            const userData = rosterPorUsuario.get(userId);

            ranking.push({
                posicion:            0,
                userId,
                username:            profile?.username  ?? 'Desconocido',
                teamName:            profile?.team_name ?? '—',
                puntosTotales:       puntosPorUsuario.get(userId) ?? 0,
                jugadoresPuntuados:  userData?.playerIds.length ?? 0,
                valorPlantilla:      userData?.totalGastado     ?? 0,
                presupuestoRestante: participante.budget        ?? 0,
            });
        }

        ranking.sort((a, b) => b.puntosTotales - a.puntosTotales);
        ranking.forEach((entry, i) => { entry.posicion = i + 1; });

        return {
            leagueId,
            temporada:           liga.season,
            jornada:             jornada ?? 'general',
            jornadasDisponibles: Array.from({ length: TOTAL_JORNADAS }, (_, i) => i + 1),
            ranking,
            calculadoEn:         new Date().toISOString(),
        };
    }
}
