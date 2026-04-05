import { supabaseAdmin } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { IJugador } from '../../domain/interfaces/IJugador';
import { Posicion } from '../../domain/interfaces/ICronistaStrategy';
import { EstadisticasPartido } from '../../domain/interfaces/IJugador';
import { IScoringRepository } from '../../domain/ports/IScoringRepository';

export class SupabaseScoringRepository implements IScoringRepository {

    async findPlayersByIds(playerIds: number[], _season: string): Promise<IJugador[]> {
        if (!playerIds.length) return [];

        // Dos queries separadas — sin FK entre Player y Player_Attributes en Supabase
        const { data: players, error: playerError } = await supabaseAdmin
            .from('Player')
            .select('player_api_id, player_name')
            .in('player_api_id', playerIds);

        if (playerError) throw new AppError('Error al obtener jugadores del dataset.', 500);

        const { data: attrs, error: attrsError } = await supabaseAdmin
            .from('Player_Attributes')
            .select('player_api_id, overall_rating, attacking_work_rate, defensive_work_rate, gk_diving, gk_reflexes')
            .in('player_api_id', playerIds);

        if (attrsError) console.error('[Scoring] Player_Attributes error:', attrsError.message);

        const attrsMap = new Map((attrs ?? []).map(a => [a.player_api_id as number, a]));

        return (players ?? []).map(row => {
            const a = attrsMap.get(row.player_api_id as number);
            return {
                id:           row.player_api_id as number,
                nombre:       row.player_name   as string,
                posicion:     this.inferirPosicion(a),
                estadisticas: this.estadisticasVacias(),
            };
        });
    }

    private inferirPosicion(attrs: any): Posicion {
        if (!attrs) return 'MC';
        if ((attrs.gk_diving ?? 0) > 60 || (attrs.gk_reflexes ?? 0) > 60) return 'PT';
        if (attrs.attacking_work_rate === 'high' && attrs.defensive_work_rate === 'low')  return 'DL';
        if (attrs.attacking_work_rate === 'low'  && attrs.defensive_work_rate === 'high') return 'DF';
        return 'MC';
    }

    private estadisticasVacias(): EstadisticasPartido {
        return {
            goles: 0, asistencias: 0, tirosAPuerta: 0, tirosAlPalo: 0,
            centrosAlArea: 0, posesionSuperior60: false, faltasCometidas: 0,
            tarjetasAmarillas: 0, tarjetasRojas: 0, porteriaACero: false,
            paradasDeducidas: 0, tirosRivalesBloqueados: 0, resultado: 'empate',
        };
    }
}
