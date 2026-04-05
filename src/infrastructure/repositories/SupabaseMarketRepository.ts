import { supabase } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';
import { Bid, IMarketRepository, LeagueMember, Player } from '../../domain/ports/IMarketRepository';

// ─────────────────────────────────────────────
// 📈 PILAR 4: ESCALABILIDAD — Queries Optimizadas
// ANTES: .select('*')  → Traía TODAS las columnas (payload innecesario)
//        Sin paginación → Si hay 10.000 jugadores, se cargaban todos
// AHORA: .select() con solo las columnas necesarias
//        Paginación con .range() para limitar el payload
// ─────────────────────────────────────────────

// Columnas mínimas necesarias para las tarjetas del mercado
const PLAYER_MARKET_FIELDS = 'id, name, position, real_team, market_value';
const BID_FIELDS = 'id, user_id, player_id, amount, status';

const PAGE_SIZE = 20;

export class SupabaseMarketRepository implements IMarketRepository {

    async getMarketPlayers(page = 0, pageSize = PAGE_SIZE): Promise<Player[]> {
        const from = page * pageSize;
        const to = from + pageSize - 1;

        const { data, error } = await supabase
            .from('players')
            .select(PLAYER_MARKET_FIELDS)
            .order('market_value', { ascending: false })
            .range(from, to);  // 📈 Paginación: solo carga lo visible

        if (error) throw new AppError('Error al obtener jugadores del mercado', 500);
        return data ?? [];
    }

    async getPlayerById(playerId: string): Promise<Player | null> {
        const { data, error } = await supabase
            .from('players')
            .select(PLAYER_MARKET_FIELDS)
            .eq('id', playerId)
            .single();

        if (error) return null;
        return data;
    }

    async getUserBids(userId: string): Promise<Bid[]> {
        const { data, error } = await supabase
            .from('market_bids')
            .select(BID_FIELDS)
            .eq('user_id', userId);

        if (error) throw new AppError('Error al obtener las pujas del usuario', 500);
        return data ?? [];
    }

    async getBidByUserAndPlayer(userId: string, playerId: string): Promise<Bid | null> {
        const { data, error } = await supabase
            .from('market_bids')
            .select(BID_FIELDS)
            .eq('user_id', userId)
            .eq('player_id', playerId)
            .maybeSingle(); // maybeSingle() no lanza error si no existe

        if (error) throw new AppError('Error al consultar la puja existente', 500);
        return data;
    }

    async createBid(userId: string, playerId: string, amount: number): Promise<void> {
        const { error } = await supabase
            .from('market_bids')
            .insert([{ player_id: playerId, amount, user_id: userId, status: 'pending' }]);

        if (error) throw new AppError('Error al crear la puja', 500);
    }

    async updateBid(bidId: string, amount: number): Promise<void> {
        const { error } = await supabase
            .from('market_bids')
            .update({ amount })
            .eq('id', bidId);

        if (error) throw new AppError('Error al modificar la puja', 500);
    }

    async deleteBidById(bidId: string): Promise<void> {
        const { error } = await supabase
            .from('market_bids')
            .delete()
            .eq('id', bidId);

        if (error) throw new AppError('Error al cancelar la puja', 500);
    }

    async getLeagueMember(userId: string): Promise<LeagueMember | null> {
        const { data, error } = await supabase
            .from('league_members')
            .select('user_id, budget')
            .eq('user_id', userId)
            .single();

        if (error) return null;
        return data;
    }

    async updateMemberBudget(userId: string, newBudget: number): Promise<void> {
        const { error } = await supabase
            .from('league_members')
            .update({ budget: newBudget })
            .eq('user_id', userId);

        if (error) throw new AppError('Error al actualizar el presupuesto', 500);
    }
}
