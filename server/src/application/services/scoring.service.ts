import { PlayerPosition } from '../../domain/models/player.models';
import { IDatasetParser } from '../../domain/ports/IDatasetParser';
import { IScoringRepository } from '../../domain/ports/IScoringRepository';
import { SupabaseScoringRepository } from '../../infrastructure/repositories/SupabaseScoringRepository';
import { DatasetParser } from '../../infrastructure/parser/DatasetParser';
import { inferirPosicionesDesdeMatch } from '../../infrastructure/repositories/posicionHelper';
import { ScoringEngine } from './scoring/ScoringEngine';

export class ScoringService {
    constructor(
        private readonly repo: IScoringRepository = new SupabaseScoringRepository(),
        private readonly parser: IDatasetParser = new DatasetParser(),
        private readonly engine: ScoringEngine = new ScoringEngine(),
    ) {}

    async calcularPuntosPorJugadores(
        playerIds: number[],
        season: string,
        kaggleLeagueId: number,
        jornada?: number,
    ): Promise<Map<number, number>> {
        if (!playerIds.length) return new Map();

        const posicionMap = await inferirPosicionesDesdeMatch(playerIds);
        const partidos = await this.parser.obtenerPartidosJornada(season, jornada, kaggleLeagueId);

        const resultado = new Map<number, number>();
        playerIds.forEach(id => resultado.set(id, 0));

        for (const partido of partidos) {
            const statsPartido = this.parser.parsearPartido(partido);
            const statsRoster = statsPartido
                .filter(stat => playerIds.includes(stat.playerApiId))
                .map(stat => ({
                    ...stat,
                    position: (posicionMap.get(stat.playerApiId) ?? PlayerPosition.MC) as PlayerPosition,
                }));

            if (!statsRoster.length) continue;

            const breakdowns = this.engine.calcularPartido(statsRoster);
            for (const breakdown of breakdowns) {
                const previous = resultado.get(breakdown.playerApiId) ?? 0;
                resultado.set(breakdown.playerApiId, previous + breakdown.totalPuntos);
            }
        }

        return resultado;
    }
}
