import { supabaseAdmin } from '../supabase.client';
import { PlayerPosition } from '../../domain/models/player.models';
import { IDatasetParser, RawMatchRecord } from '../../domain/ports/IDatasetParser';
import { PlayerStats, ResultadoPartido } from '../../domain/models/scoring.models';

type SupabaseClientLike = typeof supabaseAdmin;

interface XmlValue {
    player1?:   number;
    player2?:   number;
    team?:      number;
    type?:      string;
    subtype?:   string;
    card_type?: string;
    homepos?:   number;
    awaypos?:   number;
}

function extraerTag(tag: string, xml: string): string | null {
    const match = xml.match(new RegExp(`<${tag}>([^<]*)<\\/${tag}>`));
    return match ? match[1] : null;
}

function extraerValues(xml: string): string[] {
    const results: string[] = [];
    let depth = 0;
    let start = -1;
    let i = 0;

    while (i < xml.length) {
        if (xml.startsWith('<value>', i)) {
            if (depth === 0) start = i;
            depth++;
            i += 7;
            continue;
        }

        if (xml.startsWith('</value>', i)) {
            depth--;
            if (depth === 0 && start !== -1) {
                results.push(xml.substring(start, i + 8));
                start = -1;
            }
            i += 8;
            continue;
        }

        i++;
    }

    return results;
}

function parsearValue(value: string): XmlValue {
    return {
        player1:   Number(extraerTag('player1', value)) || undefined,
        player2:   Number(extraerTag('player2', value)) || undefined,
        team:      Number(extraerTag('team', value)) || undefined,
        type:      extraerTag('type', value) ?? undefined,
        subtype:   extraerTag('subtype', value) ?? undefined,
        card_type: extraerTag('card_type', value) ?? undefined,
        homepos:   Number(extraerTag('homepos', value)) || undefined,
        awaypos:   Number(extraerTag('awaypos', value)) || undefined,
    };
}

export class DatasetParser implements IDatasetParser {
    constructor(private readonly db: SupabaseClientLike = supabaseAdmin) {}

    async obtenerPartidosJornada(season: string, jornada?: number, kaggleLeagueId?: number): Promise<RawMatchRecord[]> {
        let query = this.db
            .from('Match')
            .select(`
                id, season, stage,
                home_team_api_id, away_team_api_id,
                home_team_goal, away_team_goal,
                goal, card, shoton, shotoff, foulcommit, cross, possession,
                home_player_1, home_player_2, home_player_3, home_player_4,
                home_player_5, home_player_6, home_player_7, home_player_8,
                home_player_9, home_player_10, home_player_11,
                away_player_1, away_player_2, away_player_3, away_player_4,
                away_player_5, away_player_6, away_player_7, away_player_8,
                away_player_9, away_player_10, away_player_11
            `)
            .eq('season', season);

        if (kaggleLeagueId !== undefined) query = query.eq('league_id', kaggleLeagueId);
        if (jornada !== undefined) query = query.eq('stage', jornada);

        const { data, error } = await query;
        if (error) {
            console.error('[Parser] Error:', error.message);
            return [];
        }

        return (data ?? []) as RawMatchRecord[];
    }

    parsearPartido(match: RawMatchRecord): PlayerStats[] {
        const homeGoals = Number(match.home_team_goal ?? 0);
        const awayGoals = Number(match.away_team_goal ?? 0);
        const homeId = Number(match.home_team_api_id);
        const awayId = Number(match.away_team_api_id);

        const resultadoHome = homeGoals > awayGoals
            ? ResultadoPartido.VICTORIA
            : homeGoals < awayGoals
                ? ResultadoPartido.DERROTA
                : ResultadoPartido.EMPATE;

        const resultadoAway = awayGoals > homeGoals
            ? ResultadoPartido.VICTORIA
            : awayGoals < homeGoals
                ? ResultadoPartido.DERROTA
                : ResultadoPartido.EMPATE;

        const stats = new Map<number, PlayerStats>();
        const homePlayers = this.extraerAlineacion(match, 'home');
        const awayPlayers = this.extraerAlineacion(match, 'away');

        for (const id of homePlayers) {
            if (id > 0) stats.set(id, this.statsVacias(id, resultadoHome));
        }

        for (const id of awayPlayers) {
            if (id > 0) stats.set(id, this.statsVacias(id, resultadoAway));
        }

        if (typeof match.goal === 'string') {
            for (const value of extraerValues(match.goal)) {
                const ev = parsearValue(value);
                if (ev.player1 && stats.has(ev.player1)) stats.get(ev.player1)!.goles++;
                if (ev.player2 && stats.has(ev.player2)) stats.get(ev.player2)!.asistencias++;
            }
        }

        if (typeof match.card === 'string') {
            for (const value of extraerValues(match.card)) {
                const ev = parsearValue(value);
                if (!ev.player1 || !stats.has(ev.player1)) continue;

                if (ev.card_type === 'y') stats.get(ev.player1)!.tarjetasAmarillas++;
                if (ev.card_type === 'r') stats.get(ev.player1)!.tarjetasRojas++;
            }
        }

        let tirosDelAway = 0;
        let tirosDelHome = 0;

        if (typeof match.shoton === 'string') {
            for (const value of extraerValues(match.shoton)) {
                const ev = parsearValue(value);

                if (ev.subtype === 'blocked_shot') {
                    if (ev.player1 && stats.has(ev.player1)) stats.get(ev.player1)!.tirosAPuerta++;
                    if (ev.team) {
                        const defensores = ev.team === homeId ? awayPlayers : homePlayers;
                        for (const id of defensores) {
                            if (!stats.has(id)) continue;
                            stats.get(id)!.tirosRivalesBloqueados++;
                            break;
                        }
                    }
                    continue;
                }

                if (ev.player1 && stats.has(ev.player1)) stats.get(ev.player1)!.tirosAPuerta++;
                if (ev.team === awayId) tirosDelAway++;
                if (ev.team === homeId) tirosDelHome++;
            }
        }

        if (typeof match.shotoff === 'string') {
            for (const value of extraerValues(match.shotoff)) {
                const ev = parsearValue(value);
                if (ev.player1 && ev.subtype === 'post' && stats.has(ev.player1)) {
                    stats.get(ev.player1)!.tirosAlPalo++;
                }
            }
        }

        if (typeof match.foulcommit === 'string') {
            for (const value of extraerValues(match.foulcommit)) {
                const ev = parsearValue(value);
                if (ev.player1 && stats.has(ev.player1)) {
                    stats.get(ev.player1)!.faltasCometidas++;
                }
            }
        }

        if (typeof match.cross === 'string') {
            for (const value of extraerValues(match.cross)) {
                const ev = parsearValue(value);
                if (ev.type === 'cross' && ev.player1 && stats.has(ev.player1)) {
                    stats.get(ev.player1)!.centrosAlArea++;
                }
            }
        }

        if (typeof match.possession === 'string') {
            const values = extraerValues(match.possession);
            if (values.length) {
                const lastValue = parsearValue(values[values.length - 1]);
                const homePos = lastValue.homepos ?? 50;
                const awayPos = lastValue.awaypos ?? 50;

                if (homePos > 60) {
                    homePlayers.forEach(id => {
                        const playerStats = stats.get(id);
                        if (playerStats) playerStats.posesionSuperior60 = true;
                    });
                }

                if (awayPos > 60) {
                    awayPlayers.forEach(id => {
                        const playerStats = stats.get(id);
                        if (playerStats) playerStats.posesionSuperior60 = true;
                    });
                }
            }
        }

        const porteroHome = Number(match.home_player_1);
        const porteroAway = Number(match.away_player_1);

        if (awayGoals === 0 && porteroHome && stats.has(porteroHome)) {
            stats.get(porteroHome)!.porteriaACero = true;
        }

        if (homeGoals === 0 && porteroAway && stats.has(porteroAway)) {
            stats.get(porteroAway)!.porteriaACero = true;
        }

        if (porteroHome && stats.has(porteroHome)) {
            stats.get(porteroHome)!.paradasDeducidas = Math.max(0, tirosDelAway - awayGoals);
        }

        if (porteroAway && stats.has(porteroAway)) {
            stats.get(porteroAway)!.paradasDeducidas = Math.max(0, tirosDelHome - homeGoals);
        }

        return Array.from(stats.values());
    }

    private extraerAlineacion(match: RawMatchRecord, side: 'home' | 'away'): number[] {
        return Array.from({ length: 11 }, (_, i) => i + 1)
            .map(i => Number(match[`${side}_player_${i}`]))
            .filter(id => !Number.isNaN(id) && id > 0);
    }

    private statsVacias(playerApiId: number, resultado: ResultadoPartido): PlayerStats {
        return {
            playerApiId,
            position: PlayerPosition.MC,
            goles: 0,
            asistencias: 0,
            tirosAPuerta: 0,
            tirosAlPalo: 0,
            centrosAlArea: 0,
            posesionSuperior60: false,
            faltasCometidas: 0,
            tarjetasAmarillas: 0,
            tarjetasRojas: 0,
            porteriaACero: false,
            paradasDeducidas: 0,
            tirosRivalesBloqueados: 0,
            resultado,
        };
    }
}
