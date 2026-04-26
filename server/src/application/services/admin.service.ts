import { AppError } from '../../domain/errors/AppError';
import { IAdminRepository } from '../../domain/ports/IAdminRepository';
import { IDatasetParser } from '../../domain/ports/IDatasetParser';
import { PlayerPosition } from '../../domain/models/player.models';
import { SupabaseAdminRepository } from '../../infrastructure/repositories/SupabaseAdminRepository';
import { DatasetParser } from '../../infrastructure/parser/DatasetParser';
import { inferirPosicionesDesdeMatch } from '../../infrastructure/repositories/posicionHelper';
import { ScoringEngine } from './scoring/ScoringEngine';

export interface ProcesoJornadaResult {
    leagueId: number;
    jornada: number;
    jugadoresPuntuados: number;
    errores: string[];
}

type PuntosCalc = {
    puntosBase: number;
    puntosCronista: number;
    total: number;
    picas: string;
    cronista: string;
};

export class AdminService {
    constructor(
        private readonly repo: IAdminRepository = new SupabaseAdminRepository(),
        private readonly parser: IDatasetParser = new DatasetParser(),
        private readonly engine: ScoringEngine = new ScoringEngine(),
    ) {}

    async procesarJornada(leagueId: number, jornada: number): Promise<ProcesoJornadaResult> {
        const errores: string[] = [];

        const liga = await this.repo.getLeagueForProcessing(leagueId);
        if (!liga) {
            throw new AppError('Liga no encontrada.', 404);
        }

        const rosterEntries = await this.repo.getLeagueRosterEntries(leagueId);
        const rosterPlayerIds = new Set(rosterEntries.map(entry => entry.player_api_id));

        const partidos = await this.parser.obtenerPartidosJornada(
            liga.season,
            jornada,
            liga.kaggle_league_id ?? undefined,
        );

        if (!partidos.length) {
            errores.push(`No se encontraron partidos para jornada ${jornada} en temporada ${liga.season}`);
        }

        const allPlayerIds = new Set<number>();
        const statsPorPartido = partidos.map(partido => {
            const stats = this.parser.parsearPartido(partido);
            for (const stat of stats) allPlayerIds.add(stat.playerApiId);
            return stats;
        });

        const posicionMap = await inferirPosicionesDesdeMatch([...allPlayerIds]);
        const globalMap = new Map<number, PuntosCalc>();
        const rosterMap = new Map<number, PuntosCalc>();

        for (const statsPartido of statsPorPartido) {
            const statsConPosicion = statsPartido.map(stat => ({
                ...stat,
                position: (posicionMap.get(stat.playerApiId) ?? PlayerPosition.MC) as PlayerPosition,
            }));

            const breakdowns = this.engine.calcularPartido(statsConPosicion);
            for (const breakdown of breakdowns) {
                this.accumulate(globalMap, breakdown.playerApiId, {
                    puntosBase: breakdown.puntosBase,
                    puntosCronista: breakdown.puntosCronista,
                    total: breakdown.totalPuntos,
                    picas: breakdown.picas,
                    cronista: breakdown.cronistaType,
                });

                if (rosterPlayerIds.has(breakdown.playerApiId)) {
                    this.accumulate(rosterMap, breakdown.playerApiId, {
                        puntosBase: breakdown.puntosBase,
                        puntosCronista: breakdown.puntosCronista,
                        total: breakdown.totalPuntos,
                        picas: breakdown.picas,
                        cronista: breakdown.cronistaType,
                    });
                }
            }
        }

        const fantasyRows = rosterEntries.map(entry => {
            const puntos = rosterMap.get(entry.player_api_id);
            return {
                league_id: leagueId,
                user_id: entry.user_id,
                player_api_id: entry.player_api_id,
                jornada,
                puntos_base: puntos?.puntosBase ?? 0,
                puntos_cronista: puntos?.puntosCronista ?? 0,
                puntos_total: puntos?.total ?? 0,
                picas: puntos?.picas ?? 'SC',
                cronista_type: puntos?.cronista ?? 'analitico',
                calculado_en: new Date().toISOString(),
                is_starter: entry.is_starter,
            };
        });

        try {
            await this.repo.saveFantasyScores(fantasyRows);
        } catch (error) {
            errores.push((error as Error).message);
        }

        const globalRows = [...globalMap.entries()].map(([playerApiId, puntos]) => ({
            player_api_id: playerApiId,
            league_id: leagueId,
            jornada,
            puntos_base: puntos.puntosBase,
            puntos_total: puntos.total,
            picas: puntos.picas,
            cronista_type: puntos.cronista,
        }));

        try {
            await this.repo.saveGlobalScores(globalRows);
        } catch (error) {
            errores.push((error as Error).message);
        }

        if (jornada === (liga.jornada_actual ?? 0) + 1) {
            try {
                await this.repo.updateLeagueCurrentRound(leagueId, jornada);
            } catch (error) {
                errores.push((error as Error).message);
            }
        }

        return {
            leagueId,
            jornada,
            jugadoresPuntuados: globalMap.size,
            errores,
        };
    }

    async getEstadoLigas(adminUserId: string): Promise<unknown[]> {
        return this.repo.getEstadoLigas(adminUserId);
    }

    async getPuntosJornada(leagueId: number, jornada: number): Promise<unknown[]> {
        return this.repo.getPuntosJornada(leagueId, jornada);
    }

    async getScoresLiga(leagueId: number): Promise<unknown[]> {
        return this.repo.getScoresLiga(leagueId);
    }

    async getGlobalScores(leagueId: number): Promise<unknown[]> {
        return this.repo.getGlobalScores(leagueId);
    }

    async getHistorialJugador(leagueId: number, playerApiId: number): Promise<unknown> {
        const jornadaActual = await this.repo.getLeagueCurrentRound(leagueId);
        const scores = await this.repo.getPlayerGlobalScoreHistory(leagueId, playerApiId);
        const scoreMap = new Map(scores.map(score => [score.jornada, score]));

        const historial = Array.from({ length: jornadaActual }, (_, index) => {
            const jornada = index + 1;
            const score = scoreMap.get(jornada);

            if (!score) {
                return {
                    jornada,
                    puntos_base: null,
                    puntos_total: null,
                    picas: null,
                    cronista_type: null,
                    jugo: false,
                };
            }

            return {
                jornada,
                puntos_base: score.puntos_base,
                puntos_total: score.puntos_total,
                picas: score.picas,
                cronista_type: score.cronista_type,
                jugo: true,
            };
        });

        const total = scores.reduce((sum, score) => sum + Number(score.puntos_total), 0);

        return {
            playerApiId,
            leagueId,
            jornadaActual,
            total,
            historial,
        };
    }

    private accumulate(target: Map<number, PuntosCalc>, playerApiId: number, delta: PuntosCalc): void {
        const previous = target.get(playerApiId);

        target.set(playerApiId, {
            puntosBase: (previous?.puntosBase ?? 0) + delta.puntosBase,
            puntosCronista: (previous?.puntosCronista ?? 0) + delta.puntosCronista,
            total: (previous?.total ?? 0) + delta.total,
            picas: delta.picas,
            cronista: delta.cronista,
        });
    }
}
