import { AppError } from '../../domain/errors/AppError';
import { IDashboardRepository } from '../../domain/ports/IDashboardRepository';
import { IFixturesRepository } from '../../domain/ports/IFixturesRepository';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { IRankingRepository } from '../../domain/ports/IRankingRepository';
import { SupabaseFixturesRepository } from '../../infrastructure/repositories/SupabaseFixturesRepository';
import { SupabaseDashboardRepository } from '../../infrastructure/repositories/SupabaseDashboardRepository';
import { SupabaseLeagueRepository } from '../../infrastructure/repositories/SupabaseLeagueRepository';
import { SupabaseRankingRepository } from '../../infrastructure/repositories/SupabaseRankingRepository';

export class DashboardService {
    constructor(
        private readonly repo: IDashboardRepository = new SupabaseDashboardRepository(),
        private readonly rankingRepo: IRankingRepository = new SupabaseRankingRepository(),
        private readonly leagueRepo: ILeagueRepository = new SupabaseLeagueRepository(),
        private readonly fixturesRepo: IFixturesRepository = new SupabaseFixturesRepository(),
    ) {}

    async getDashboardData(leagueId: number, userId: string) {
        const liga = await this.leagueRepo.findById(leagueId);
        if (!liga) {
            throw new AppError('Liga no encontrada.', 404);
        }

        const jornada = liga.jornada_actual ?? 0;

        const [scores, topGlobales, fixtures, rosterEntries] = await Promise.all([
            this.repo.getScoresLiga(leagueId),
            this.repo.getTopJugadoresGlobales(leagueId, 5),
            jornada > 0 ? this.fixturesRepo.getFixtures(leagueId, jornada + 1, userId) : Promise.resolve([]),
            this.rankingRepo.findRosterByLeague(leagueId),
        ]);

        const misScores = scores.filter(score => score.user_id === userId);
        const totalPts = misScores.reduce((sum, score) => sum + Number(score.puntos_total), 0);

        const misRosterIds = new Set(
            rosterEntries
                .filter(entry => entry.user_id === userId)
                .map(entry => entry.player_api_id),
        );

        const ultimaJornada = misScores.filter(score => score.jornada === jornada);
        const mvpVisuals = await this.repo.getPlayerVisuals(
            leagueId,
            [...new Set(ultimaJornada.map(score => score.player_api_id))],
        );
        const mvpVisualMap = new Map(mvpVisuals.map(player => [player.player_api_id, player]));
        const mvp = [...ultimaJornada]
            .sort((a, b) => Number(b.puntos_total) - Number(a.puntos_total))
            .slice(0, 3)
            .map(score => ({
                player_api_id: score.player_api_id,
                player_name: mvpVisualMap.get(score.player_api_id)?.player_name ?? `#${score.player_api_id}`,
                position: mvpVisualMap.get(score.player_api_id)?.position ?? 'MC',
                playerFifaApiId: mvpVisualMap.get(score.player_api_id)?.playerFifaApiId ?? null,
                faceUrl: mvpVisualMap.get(score.player_api_id)?.faceUrl ?? null,
                clubLogoUrl: mvpVisualMap.get(score.player_api_id)?.clubLogoUrl ?? null,
                puntos_total: Number(score.puntos_total),
                picas: score.picas,
                cronista_type: score.cronista_type,
                en_roster: misRosterIds.has(score.player_api_id),
            }));

        const jornadas = Array.from({ length: Math.min(jornada, 5) }, (_, i) => jornada - 4 + i).filter(j => j > 0);
        const chartYo = jornadas.map(j =>
            misScores
                .filter(score => score.jornada === j)
                .reduce((sum, score) => sum + Number(score.puntos_total), 0),
        );

        const puntosPorUsuario = new Map<string, number>();
        for (const score of scores) {
            puntosPorUsuario.set(
                score.user_id,
                (puntosPorUsuario.get(score.user_id) ?? 0) + Number(score.puntos_total),
            );
        }

        const rankingOrdenado = [...puntosPorUsuario.entries()].sort((a, b) => b[1] - a[1]);
        const myRankIdx = rankingOrdenado.findIndex(([uid]) => uid === userId);
        const rivalEntry = myRankIdx > 0 ? rankingOrdenado[myRankIdx - 1] : rankingOrdenado[myRankIdx + 1];
        const rivalId = rivalEntry?.[0];

        const chartRival = rivalId
            ? jornadas.map(j =>
                scores
                    .filter(score => score.user_id === rivalId && score.jornada === j)
                    .reduce((sum, score) => sum + Number(score.puntos_total), 0),
            )
            : [];

        const rival = rivalId
            ? {
                userId: rivalId,
                puntos: puntosPorUsuario.get(rivalId) ?? 0,
                diff: (puntosPorUsuario.get(rivalId) ?? 0) - totalPts,
            }
            : null;

        return {
            leagueId,
            jornada,
            totalPts,
            mvp,
            chart: { jornadas, yo: chartYo, rival: chartRival, rivalId },
            rival,
            topGlobales,
            fixtures,
        };
    }
}
