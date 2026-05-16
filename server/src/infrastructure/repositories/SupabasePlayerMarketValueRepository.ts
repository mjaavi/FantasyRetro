import { AppError } from '../../domain/errors/AppError';
import {
    IPlayerMarketValueRepository,
    PlayerGlobalScoreSnapshot,
    PlayerMarketValueSnapshot,
    PlayerMarketValueWriteModel,
    PlayerPricingSnapshot,
} from '../../domain/ports/IPlayerMarketValueRepository';
import { PlayerPosition } from '../../domain/models/player.models';
import { supabaseAdmin } from '../supabase.client';
import { loadLeaguePlayerData } from './leaguePlayerDataHelper';

type SupabaseClientLike = typeof supabaseAdmin;

const MARKET_VALUE_FIELDS = [
    'league_id',
    'player_api_id',
    'current_price',
    'previous_price',
    'last_variation',
    'raw_variation',
    'moving_average_points',
    'last_jornada_processed',
    'updated_at',
].join(', ');

function toPlayerPosition(value: string): PlayerPosition {
    return value in PlayerPosition ? value as PlayerPosition : PlayerPosition.MC;
}

export class SupabasePlayerMarketValueRepository implements IPlayerMarketValueRepository {
    constructor(private readonly db: SupabaseClientLike = supabaseAdmin) {}

    async findMarketValues(leagueId: number, playerApiIds: number[]): Promise<PlayerMarketValueSnapshot[]> {
        const ids = [...new Set(playerApiIds.filter(id => Number.isInteger(id) && id > 0))];
        if (!ids.length) return [];

        const { data, error } = await this.db
            .from('league_player_market_values')
            .select(MARKET_VALUE_FIELDS)
            .eq('league_id', leagueId)
            .in('player_api_id', ids);

        if (error) {
            throw new AppError(`Error al obtener valores dinamicos de mercado: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as Array<Record<string, unknown>>).map(row => ({
            leagueId: Number(row.league_id),
            playerApiId: Number(row.player_api_id),
            currentPrice: Number(row.current_price),
            previousPrice: Number(row.previous_price),
            lastVariation: Number(row.last_variation ?? 0),
            rawVariation: Number(row.raw_variation ?? 0),
            movingAveragePoints: Number(row.moving_average_points ?? 0),
            lastJornadaProcessed: Number(row.last_jornada_processed),
            updatedAt: row.updated_at ? String(row.updated_at) : null,
        }));
    }

    async findGlobalScoresUntilRound(leagueId: number, jornada: number): Promise<PlayerGlobalScoreSnapshot[]> {
        const { data, error } = await this.db
            .from('player_global_scores')
            .select('player_api_id, jornada, puntos_total')
            .eq('league_id', leagueId)
            .lte('jornada', jornada)
            .order('player_api_id', { ascending: true })
            .order('jornada', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener puntuaciones para valor de mercado: ${error.message}`, 500);
        }

        return (data ?? []).map(row => ({
            playerApiId: Number(row.player_api_id),
            jornada: Number(row.jornada),
            points: Number(row.puntos_total ?? 0),
        }));
    }

    async findPricingSnapshots(leagueId: number, playerApiIds: number[]): Promise<PlayerPricingSnapshot[]> {
        const playerData = await loadLeaguePlayerData(leagueId, playerApiIds);

        return [...playerData.values()].map(player => ({
            playerApiId: player.id,
            position: toPlayerPosition(player.position),
            overallRating: Number(player.overall ?? 50),
        }));
    }

    async upsertMarketValues(rows: PlayerMarketValueWriteModel[]): Promise<void> {
        if (!rows.length) return;

        const payload = rows.map(row => ({
            league_id: row.leagueId,
            player_api_id: row.playerApiId,
            current_price: row.currentPrice,
            previous_price: row.previousPrice,
            last_variation: row.lastVariation,
            raw_variation: row.rawVariation,
            moving_average_points: row.movingAveragePoints,
            last_jornada_processed: row.lastJornadaProcessed,
            updated_at: new Date().toISOString(),
        }));

        const { error } = await this.db
            .from('league_player_market_values')
            .upsert(payload, { onConflict: 'league_id,player_api_id' });

        if (error) {
            throw new AppError(`Error al guardar valores dinamicos de mercado: ${error.message}`, 500);
        }
    }

    async getTopMarketVariations(leagueId: number, limit: number = 5) {
        // Obtenemos los risers (mayor variacion positiva)
        const { data: risersData, error: risersError } = await this.db
            .from('league_player_market_values')
            .select('player_api_id, current_price, previous_price, raw_variation')
            .eq('league_id', leagueId)
            .gt('raw_variation', 0)
            .order('raw_variation', { ascending: false })
            .limit(limit);

        // Obtenemos los fallers (mayor variacion negativa)
        const { data: fallersData, error: fallersError } = await this.db
            .from('league_player_market_values')
            .select('player_api_id, current_price, previous_price, raw_variation')
            .eq('league_id', leagueId)
            .lt('raw_variation', 0)
            .order('raw_variation', { ascending: true })
            .limit(limit);

        if (risersError || fallersError) {
            console.error('[Dashboard] Error al obtener variaciones:', risersError?.message, fallersError?.message);
            throw new AppError('Error al obtener variaciones de mercado.', 500);
        }

        const allIds = [
            ...(risersData || []).map(r => r.player_api_id as number),
            ...(fallersData || []).map(r => r.player_api_id as number)
        ];

        const playerData = await loadLeaguePlayerData(leagueId, allIds);

        const mapToTrend = (row: any) => {
            const player = playerData.get(row.player_api_id);
            return {
                playerApiId: row.player_api_id,
                playerName: player?.name ?? 'Desconocido',
                clubLogoUrl: player?.clubLogoUrl ?? null,
                currentPrice: Number(row.current_price),
                rawVariation: Number(row.current_price) - Number(row.previous_price),
                position: player?.position ?? 'MC',
                faceUrl: player?.faceUrl ?? null,
                playerFifaApiId: player?.playerFifaApiId ?? null
            };
        };

        return {
            risers: (risersData || []).map(mapToTrend),
            fallers: (fallersData || []).map(mapToTrend)
        };
    }
}
