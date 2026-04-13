import { AppError } from '../../domain/errors/AppError';
import { PlayerPosition } from '../../domain/models/player.models';
import {
    ILeagueMarketRepository,
    LeagueBid,
    LeagueMarketPlayerSnapshot,
} from '../../domain/ports/ILeagueMarketRepository';
import { loadLeaguePlayerData } from './leaguePlayerDataHelper';
import { supabaseAdmin } from '../supabase.client';

const MATCH_PLAYER_COLS = [
    'home_player_1', 'home_player_2', 'home_player_3', 'home_player_4',
    'home_player_5', 'home_player_6', 'home_player_7', 'home_player_8',
    'home_player_9', 'home_player_10', 'home_player_11',
    'away_player_1', 'away_player_2', 'away_player_3', 'away_player_4',
    'away_player_5', 'away_player_6', 'away_player_7', 'away_player_8',
    'away_player_9', 'away_player_10', 'away_player_11',
] as const;

export class SupabaseLeagueMarketRepository implements ILeagueMarketRepository {
    async getActiveMarket(leagueId: number): Promise<LeagueMarketPlayerSnapshot[]> {
        const { data: marketData, error: marketError } = await supabaseAdmin
            .from('league_market')
            .select('id, league_id, player_api_id, expires_at, is_active')
            .eq('league_id', leagueId)
            .eq('is_active', true)
            .gt('expires_at', new Date().toISOString());

        if (marketError) {
            console.error('[LeagueMarket] getActiveMarket error:', marketError.message, marketError.code);
            throw new AppError('Error al obtener el mercado de la liga.', 500);
        }

        if (!marketData?.length) {
            return [];
        }

        return this.enriquecerJugadores(leagueId, marketData);
    }

    async getMarketForLeague(leagueId: number): Promise<LeagueMarketPlayerSnapshot[]> {
        const { data: marketData, error: marketError } = await supabaseAdmin
            .from('league_market')
            .select('id, league_id, player_api_id, expires_at, is_active')
            .eq('league_id', leagueId)
            .eq('is_active', true);

        if (marketError) {
            throw new AppError('Error al obtener el mercado de la liga.', 500);
        }

        if (!marketData?.length) {
            return [];
        }

        return this.enriquecerJugadores(leagueId, marketData);
    }

    async getMatchPlayerIds(
        kaggleLeagueId: number,
        season: string,
        excluidos: number[],
    ): Promise<number[]> {
        const { data: matchData, error: matchError } = await supabaseAdmin
            .from('Match')
            .select(MATCH_PLAYER_COLS.join(','))
            .eq('league_id', kaggleLeagueId)
            .eq('season', season)
            .limit(200);

        if (matchError || !matchData?.length) {
            return [];
        }

        const excludedIds = new Set(excluidos);
        const playerSet = new Set<number>();

        for (const match of matchData) {
            const row = match as unknown as Record<string, unknown>;
            for (const col of MATCH_PLAYER_COLS) {
                const value = row[col];
                if (!value) {
                    continue;
                }

                const playerId = Number(value);
                if (!Number.isNaN(playerId) && playerId > 0 && !excludedIds.has(playerId)) {
                    playerSet.add(playerId);
                }
            }
        }

        return Array.from(playerSet);
    }

    async openMarket(leagueId: number, playerApiIds: number[], expiresAt: Date): Promise<void> {
        const rows = playerApiIds.map(playerApiId => ({
            league_id: leagueId,
            player_api_id: playerApiId,
            expires_at: expiresAt.toISOString(),
            is_active: true,
        }));

        const { error } = await supabaseAdmin.from('league_market').insert(rows);
        if (error) {
            throw new AppError(`Error al abrir el mercado: ${error.message}`, 500);
        }
    }

    async closeMarket(leagueId: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_market')
            .update({ is_active: false })
            .eq('league_id', leagueId)
            .eq('is_active', true);

        if (error) {
            console.error('[LeagueMarket] closeMarket error:', error.message, error.code);
            throw new AppError(`Error al cerrar el mercado: ${error.message}`, 500);
        }
    }

    async getExpiredMarkets(): Promise<number[]> {
        const { data, error } = await supabaseAdmin
            .from('league_market')
            .select('league_id')
            .eq('is_active', true)
            .lt('expires_at', new Date().toISOString());

        if (error) {
            throw new AppError('Error al buscar mercados expirados.', 500);
        }

        return [...new Set((data ?? []).map(row => row.league_id as number))];
    }

    async getPlayerIdsInLeague(leagueId: number): Promise<number[]> {
        const { data, error } = await supabaseAdmin
            .from('user_roster')
            .select('player_api_id')
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError('Error al obtener jugadores del roster.', 500);
        }

        return (data ?? []).map(row => row.player_api_id as number);
    }

    async getBidsForMarket(leagueId: number): Promise<LeagueBid[]> {
        const { data, error } = await supabaseAdmin
            .from('league_bids')
            .select('id, league_id, user_id, player_api_id, amount, created_at')
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError('Error al obtener pujas del mercado.', 500);
        }

        return (data ?? []).map(row => ({
            id: row.id as string,
            leagueId: row.league_id as number,
            userId: row.user_id as string,
            playerApiId: row.player_api_id as number,
            amount: Number(row.amount),
            createdAt: row.created_at as string,
        }));
    }

    async getBidByUserAndPlayer(leagueId: number, userId: string, playerApiId: number): Promise<LeagueBid | null> {
        const { data, error } = await supabaseAdmin
            .from('league_bids')
            .select('id, league_id, user_id, player_api_id, amount, created_at')
            .eq('league_id', leagueId)
            .eq('user_id', userId)
            .eq('player_api_id', playerApiId)
            .maybeSingle();

        if (error) {
            console.error('[LeagueMarket] getBidByUserAndPlayer error:', error.message, error.code);
            throw new AppError('Error al buscar puja existente.', 500);
        }

        if (!data) {
            return null;
        }

        return {
            id: data.id as string,
            leagueId: data.league_id as number,
            userId: data.user_id as string,
            playerApiId: data.player_api_id as number,
            amount: Number(data.amount),
            createdAt: data.created_at as string,
        };
    }

    async upsertBid(leagueId: number, userId: string, playerApiId: number, amount: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_bids')
            .upsert(
                { league_id: leagueId, user_id: userId, player_api_id: playerApiId, amount },
                { onConflict: 'league_id,user_id,player_api_id' },
            );

        if (error) {
            throw new AppError(`Error al registrar la puja: ${error.message}`, 500);
        }
    }

    async deleteBid(leagueId: number, userId: string, playerApiId: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_bids')
            .delete()
            .eq('league_id', leagueId)
            .eq('user_id', userId)
            .eq('player_api_id', playerApiId);

        if (error) {
            throw new AppError('Error al cancelar la puja.', 500);
        }
    }

    async clearBidsForLeague(leagueId: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_bids')
            .delete()
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError('Error al limpiar pujas de la liga.', 500);
        }
    }

    async getUserBidsForLeague(leagueId: number, userId: string): Promise<LeagueBid[]> {
        const { data, error } = await supabaseAdmin
            .from('league_bids')
            .select('id, league_id, user_id, player_api_id, amount, created_at')
            .eq('league_id', leagueId)
            .eq('user_id', userId);

        if (error) {
            throw new AppError('Error al obtener pujas del usuario.', 500);
        }

        return (data ?? []).map(row => ({
            id: row.id as string,
            leagueId: row.league_id as number,
            userId: row.user_id as string,
            playerApiId: row.player_api_id as number,
            amount: Number(row.amount),
            createdAt: row.created_at as string,
        }));
    }

    async getUserBudget(userId: string, leagueId: number): Promise<number> {
        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('budget')
            .eq('user_id', userId)
            .eq('league_id', leagueId)
            .single();

        if (error || !data) {
            throw new AppError('Error al obtener el presupuesto de la liga.', 500);
        }

        return Number(data.budget);
    }

    async updateUserBudget(userId: string, leagueId: number, newBudget: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_participants')
            .update({ budget: newBudget })
            .eq('user_id', userId)
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError('Error al actualizar el presupuesto de la liga.', 500);
        }
    }

    async addPlayerToRoster(leagueId: number, userId: string, playerApiId: number, purchasePrice: number, isStarter: boolean = false): Promise<void> {
        const { error } = await supabaseAdmin
            .from('user_roster')
            .insert({
                league_id: leagueId,
                user_id: userId,
                player_api_id: playerApiId,
                purchase_price: purchasePrice,
                is_starter: isStarter,
            });

        if (error) {
            throw new AppError(`Error al anadir jugador al roster: ${error.message}`, 500);
        }
    }

    /**
     * Inserta los 11 jugadores iniciales en UNA SOLA TRANSACCIÓN atómica
     * via la función RPC `assign_initial_roster` de Supabase/PostgreSQL.
     * Si cualquier inserción falla (ej. UNIQUE violation), PostgreSQL hace
     * ROLLBACK automáticamente: el usuario no queda con un equipo incompleto.
     */
    async addPlayersToRosterBatch(
        leagueId: number,
        userId: string,
        players: { playerApiId: number; purchasePrice: number }[],
    ): Promise<void> {
        if (players.length !== 11) {
            throw new AppError(
                `addPlayersToRosterBatch requiere exactamente 11 jugadores, se recibieron ${players.length}.`,
                400,
            );
        }

        const playerIds = players.map(p => p.playerApiId);
        const prices    = players.map(p => p.purchasePrice);

        const { error } = await supabaseAdmin.rpc('assign_initial_roster', {
            p_league_id:  leagueId,
            p_user_id:    userId,
            p_player_ids: playerIds,
            p_prices:     prices,
        });

        if (error) {
            throw new AppError(
                `Error en la transacción de asignación inicial del equipo: ${error.message}`,
                500,
            );
        }
    }

    private async enriquecerJugadores(leagueId: number, marketData: Array<Record<string, unknown>>): Promise<LeagueMarketPlayerSnapshot[]> {
        const playerIds = marketData.map(row => row.player_api_id as number);
        const playerData = await loadLeaguePlayerData(leagueId, playerIds);

        return marketData.map(row => {
            const player = playerData.get(row.player_api_id as number);

            return {
                id: row.id as string,
                leagueId: row.league_id as number,
                playerApiId: row.player_api_id as number,
                playerName: player?.name ?? 'Desconocido',
                realTeam: player?.realTeam ?? 'Sin equipo',
                position: (player?.position ?? 'MC') as PlayerPosition,
                overallRating: player?.overall ?? 50,
                expiresAt: row.expires_at as string,
                isActive: row.is_active as boolean,
                playerFifaApiId: player?.playerFifaApiId ?? null,
                faceUrl: player?.faceUrl ?? null,
                clubLogoUrl: player?.clubLogoUrl ?? null,
            };
        });
    }
}
