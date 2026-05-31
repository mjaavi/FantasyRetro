import { AppError } from '../../domain/errors/AppError';
import { IAdminRepository } from '../../domain/ports/IAdminRepository';
import { IDatasetParser } from '../../domain/ports/IDatasetParser';
import { PlayerPosition } from '../../domain/models/player.models';
import { SupabaseAdminRepository } from '../../infrastructure/repositories/SupabaseAdminRepository';
import { DatasetParser } from '../../infrastructure/parser/DatasetParser';
import { inferirPosicionesDesdeMatch } from '../../infrastructure/repositories/posicionHelper';
import { LeagueMarketValueRecalculationService } from './economy/LeagueMarketValueRecalculationService';
import { PlayerMarketValueHistoryService, PlayerMarketValueHistoryResult } from './economy/PlayerMarketValueHistoryService';
import { ScoringEngine } from './scoring/ScoringEngine';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { SupabaseLeagueRepository } from '../../infrastructure/repositories/SupabaseLeagueRepository';
import { IEmailService } from '../../domain/services/IEmailService';
import { buildNegativeBalanceEmail } from '../../infrastructure/email';
import { supabaseAdmin } from '../../infrastructure/supabase.client';

export interface ProcesoJornadaResult {
    leagueId: number;
    jornada: number;
    jugadoresPuntuados: number;
    valoresMercadoActualizados: number;
    errores: string[];
}

type PuntosCalc = {
    puntosBase: number;
    puntosCronista: number;
    total: number;
    picas: string;
    cronista: string;
    rawStats?: any;
};

export class AdminService {
    constructor(
        private readonly repo: IAdminRepository = new SupabaseAdminRepository(),
        private readonly parser: IDatasetParser = new DatasetParser(),
        private readonly engine: ScoringEngine = new ScoringEngine(),
        private readonly marketValueRecalculationService?: LeagueMarketValueRecalculationService,
        private readonly marketValueHistoryService?: PlayerMarketValueHistoryService,
        private readonly leagueRepo: ILeagueRepository = new SupabaseLeagueRepository(),
        private readonly emailService?: IEmailService,
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
                    rawStats: breakdown.rawStats,
                });

                if (rosterPlayerIds.has(breakdown.playerApiId)) {
                    this.accumulate(rosterMap, breakdown.playerApiId, {
                        puntosBase: breakdown.puntosBase,
                        puntosCronista: breakdown.puntosCronista,
                        total: breakdown.totalPuntos,
                        picas: breakdown.picas,
                        cronista: breakdown.cronistaType,
                        rawStats: breakdown.rawStats,
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
                raw_stats: puntos?.rawStats,
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
            raw_stats: puntos.rawStats,
        }));

        let globalScoresSaved = false;
        if (globalRows.length) {
            try {
                await this.repo.saveGlobalScores(globalRows);
                globalScoresSaved = true;
            } catch (error) {
                errores.push((error as Error).message);
            }
        }

        let valoresMercadoActualizados = 0;
        if (globalScoresSaved && this.marketValueRecalculationService) {
            try {
                const result = await this.marketValueRecalculationService.recalculateAfterRound(leagueId, jornada);
                valoresMercadoActualizados = result.playersUpdated;
            } catch (error) {
                errores.push((error as Error).message);
            }
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
            valoresMercadoActualizados,
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
                    raw_stats: null,
                    jugo: false,
                };
            }

            return {
                jornada,
                puntos_base: score.puntos_base,
                puntos_total: score.puntos_total,
                picas: score.picas,
                cronista_type: score.cronista_type,
                raw_stats: score.raw_stats,
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

    async getMarketValueHistory(leagueId: number, playerApiId: number): Promise<PlayerMarketValueHistoryResult> {
        if (!this.marketValueHistoryService) {
            return { playerApiId, leagueId, initialPrice: 0, currentPrice: 0, history: [] };
        }

        const jornadaActual = await this.repo.getLeagueCurrentRound(leagueId);
        return this.marketValueHistoryService.getHistory(leagueId, playerApiId, jornadaActual);
    }

    async auditarYAlertarSaldosNegativos(leagueId: number): Promise<{ alertsSent: number; usersAlerted: string[] }> {
        if (!this.emailService) {
            throw new AppError('Servicio de email no configurado en el servidor.', 500);
        }

        const [liga, participants] = await Promise.all([
            this.leagueRepo.findById(leagueId),
            this.leagueRepo.findParticipantsByLeague(leagueId),
        ]);

        if (!liga) throw new AppError('Liga no encontrada.', 404);

        const negativeParticipants = participants.filter(p => p.budget < 0);
        const usersAlerted: string[] = [];
        let alertsSent = 0;

        for (const p of negativeParticipants) {
            try {
                const { data, error } = await supabaseAdmin.auth.admin.getUserById(p.user_id);
                if (error || !data?.user?.email) {
                    console.warn(`[AdminService] No se pudo obtener email del usuario ${p.user_id}`);
                    continue;
                }

                const email = data.user.email;
                const username = p.profiles?.username || p.profiles?.team_name || email;
                const nextJornada = (liga.jornada_actual ?? 0) + 1;

                const html = buildNegativeBalanceEmail({
                    userName: username,
                    currentBalance: `${p.budget.toLocaleString()} €`,
                    gameweekNumber: nextJornada,
                    deadlineTime: 'Viernes 20:00h (Inicio de jornada)',
                    rosterUrl: 'https://fantasyretro.pages.dev',
                });

                await this.emailService.sendEmail({
                    to: email,
                    subject: `⚠️ ¡Saldo en negativo! Corrige tu plantilla para puntuar en la Jornada ${nextJornada}`,
                    html,
                    text: `Hola ${username}, tienes saldo negativo (${p.budget.toLocaleString()} €) para la Jornada ${nextJornada}. Vende jugadores antes del viernes para evitar puntuar 0.`,
                });

                usersAlerted.push(username);
                alertsSent++;
            } catch (err: any) {
                console.error(`[AdminService] Error al alertar saldo negativo para usuario ${p.user_id}:`, err.message);
            }
        }

        return { alertsSent, usersAlerted };
    }

    private accumulate(target: Map<number, PuntosCalc>, playerApiId: number, delta: PuntosCalc): void {
        const previous = target.get(playerApiId);

        target.set(playerApiId, {
            puntosBase: (previous?.puntosBase ?? 0) + delta.puntosBase,
            puntosCronista: (previous?.puntosCronista ?? 0) + delta.puntosCronista,
            total: (previous?.total ?? 0) + delta.total,
            picas: delta.picas,
            cronista: delta.cronista,
            rawStats: delta.rawStats,
        });
    }
}
