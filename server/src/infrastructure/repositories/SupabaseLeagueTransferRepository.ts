import { AppError } from '../../domain/errors/AppError';
import { RosterPlayer } from '../../domain/ports/IRosterRepository';
import {
    ILeagueTransferRepository,
    LeagueDirectOffer,
    LeagueDirectOfferView,
    LeagueTransferHistoryItem,
    DirectOfferStatus,
} from '../../domain/ports/ILeagueTransferRepository';
import { supabaseAdmin } from '../supabase.client';
import { loadLeaguePlayerData } from './leaguePlayerDataHelper';

type ProfileSummary = { username: string; teamName: string };

export class SupabaseLeagueTransferRepository implements ILeagueTransferRepository {
    async getRosterPlayer(leagueId: number, ownerUserId: string, playerApiId: number): Promise<RosterPlayer | null> {
        const { data, error } = await supabaseAdmin
            .from('user_roster')
            .select('player_api_id, is_starter, purchase_price, release_clause')
            .eq('league_id', leagueId)
            .eq('user_id', ownerUserId)
            .eq('player_api_id', playerApiId)
            .maybeSingle();

        if (error) throw new AppError(`Error al obtener el jugador del equipo: ${error.message}`, 500);
        if (!data) return null;

        const playerData = await loadLeaguePlayerData(leagueId, [playerApiId]);
        const player = playerData.get(playerApiId);

        return {
            id: playerApiId,
            name: player?.name ?? 'Desconocido',
            position: player?.position ?? 'MC',
            real_team: player?.realTeam ?? 'Sin equipo',
            overall: player?.overall ?? 50,
            is_starter: Boolean(data.is_starter),
            purchase_price: Number(data.purchase_price),
            release_clause: Number(data.release_clause ?? 0),
            playerFifaApiId: player?.playerFifaApiId ?? null,
            faceUrl: player?.faceUrl ?? null,
            clubLogoUrl: player?.clubLogoUrl ?? null,
        };
    }

    async getPendingOfferByBuyerAndPlayer(leagueId: number, buyerUserId: string, playerApiId: number): Promise<LeagueDirectOffer | null> {
        const { data, error } = await supabaseAdmin
            .from('league_direct_offers')
            .select('*')
            .eq('league_id', leagueId)
            .eq('buyer_user_id', buyerUserId)
            .eq('player_api_id', playerApiId)
            .eq('status', 'pending')
            .maybeSingle();

        if (error) throw new AppError('Error al buscar la oferta existente.', 500);
        return data ? this.mapOffer(data) : null;
    }

    async createDirectOffer(input: {
        leagueId: number;
        buyerUserId: string;
        sellerUserId: string;
        playerApiId: number;
        amount: number;
    }): Promise<LeagueDirectOffer> {
        const { data, error } = await supabaseAdmin
            .from('league_direct_offers')
            .insert({
                league_id: input.leagueId,
                buyer_user_id: input.buyerUserId,
                seller_user_id: input.sellerUserId,
                player_api_id: input.playerApiId,
                amount: input.amount,
            })
            .select('*')
            .single();

        if (error) throw new AppError(`Error al crear la oferta: ${error.message}`, 500);
        return this.mapOffer(data);
    }

    async updateDirectOfferAmount(offerId: string, amount: number): Promise<LeagueDirectOffer> {
        const { data, error } = await supabaseAdmin
            .from('league_direct_offers')
            .update({ amount, updated_at: new Date().toISOString() })
            .eq('id', offerId)
            .eq('status', 'pending')
            .select('*')
            .single();

        if (error) throw new AppError(`Error al actualizar la oferta: ${error.message}`, 500);
        return this.mapOffer(data);
    }

    async markDirectOfferStatus(offerId: string, status: Exclude<DirectOfferStatus, 'pending'>): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_direct_offers')
            .update({ status, resolved_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', offerId)
            .eq('status', 'pending');

        if (error) throw new AppError('Error al resolver la oferta.', 500);
    }

    async getPendingOfferById(offerId: string): Promise<LeagueDirectOffer | null> {
        const { data, error } = await supabaseAdmin
            .from('league_direct_offers')
            .select('*')
            .eq('id', offerId)
            .eq('status', 'pending')
            .maybeSingle();

        if (error) throw new AppError('Error al obtener la oferta.', 500);
        return data ? this.mapOffer(data) : null;
    }

    async getReceivedDirectOffers(leagueId: number, sellerUserId: string): Promise<LeagueDirectOfferView[]> {
        const { data, error } = await supabaseAdmin
            .from('league_direct_offers')
            .select('*')
            .eq('league_id', leagueId)
            .eq('seller_user_id', sellerUserId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });

        if (error) throw new AppError('Error al obtener tus ofertas recibidas.', 500);
        const offers = (data ?? []).map(row => this.mapOffer(row));
        return this.enrichOffers(leagueId, offers);
    }

    async getTransferHistory(leagueId: number): Promise<LeagueTransferHistoryItem[]> {
        const { data, error } = await supabaseAdmin
            .from('league_transfer_history')
            .select('*')
            .eq('league_id', leagueId)
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw new AppError('Error al obtener el historico de fichajes.', 500);

        const rows = data ?? [];
        const playerIds = rows.map(row => Number(row.player_api_id));
        const userIds = rows.flatMap(row => [row.from_user_id, row.to_user_id].filter(Boolean) as string[]);
        const [players, profiles] = await Promise.all([
            loadLeaguePlayerData(leagueId, playerIds),
            this.getProfiles(leagueId, userIds),
        ]);

        return rows.map(row => {
            const playerApiId = Number(row.player_api_id);
            const fromUserId = row.from_user_id as string | null;
            const toUserId = row.to_user_id as string | null;
            const fromProfile = fromUserId ? profiles.get(fromUserId) : null;
            const toProfile = toUserId ? profiles.get(toUserId) : null;

            return {
                id: row.id as string,
                leagueId: Number(row.league_id),
                playerApiId,
                playerName: players.get(playerApiId)?.name ?? 'Desconocido',
                fromUserId,
                fromTeamName: fromProfile?.teamName ?? 'Mercado',
                fromUsername: fromProfile?.username ?? 'Mercado',
                toUserId,
                toTeamName: toProfile?.teamName ?? 'Mercado',
                toUsername: toProfile?.username ?? 'Mercado',
                amount: Number(row.amount),
                transferType: row.transfer_type as string,
                createdAt: row.created_at as string,
            };
        });
    }

    async acceptDirectOffer(offerId: string, sellerUserId: string): Promise<void> {
        const { error } = await supabaseAdmin.rpc('accept_league_direct_offer', {
            p_offer_id: offerId,
            p_seller_user_id: sellerUserId,
        });

        if (error) throw new AppError(`Error al aceptar la oferta: ${error.message}`, 500);
    }

    async payReleaseClause(input: {
        leagueId: number;
        buyerUserId: string;
        sellerUserId: string;
        playerApiId: number;
        clauseAmount: number;
        nextReleaseClause: number;
    }): Promise<void> {
        const { error } = await supabaseAdmin.rpc('pay_league_release_clause', {
            p_league_id: input.leagueId,
            p_buyer_user_id: input.buyerUserId,
            p_seller_user_id: input.sellerUserId,
            p_player_api_id: input.playerApiId,
            p_clause_amount: input.clauseAmount,
            p_next_release_clause: input.nextReleaseClause,
        });

        if (error) throw new AppError(`Error al ejecutar el clausulazo: ${error.message}`, 500);
    }

    async raiseReleaseClause(input: {
        leagueId: number;
        userId: string;
        playerApiId: number;
        contribution: number;
        nextReleaseClause: number;
    }): Promise<void> {
        const { error } = await supabaseAdmin.rpc('raise_player_release_clause', {
            p_league_id: input.leagueId,
            p_user_id: input.userId,
            p_player_api_id: input.playerApiId,
            p_contribution: input.contribution,
            p_next_release_clause: input.nextReleaseClause,
        });

        if (error) throw new AppError(`Error al subir la clausula: ${error.message}`, 500);
    }

    async dismissPlayer(input: {
        leagueId: number;
        userId: string;
        playerApiId: number;
        recoveredAmount: number;
    }): Promise<void> {
        const { error } = await supabaseAdmin.rpc('dismiss_league_player', {
            p_league_id: input.leagueId,
            p_user_id: input.userId,
            p_player_api_id: input.playerApiId,
            p_recovered_amount: input.recoveredAmount,
        });

        if (error) throw new AppError(`Error al despedir el jugador: ${error.message}`, 500);
    }

    async getUserBudget(userId: string, leagueId: number): Promise<number> {
        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('budget')
            .eq('user_id', userId)
            .eq('league_id', leagueId)
            .single();

        if (error || !data) throw new AppError('Error al obtener el presupuesto de la liga.', 500);
        return Number(data.budget);
    }

    async updateUserBudget(userId: string, leagueId: number, newBudget: number): Promise<void> {
        const { error } = await supabaseAdmin
            .from('league_participants')
            .update({ budget: newBudget })
            .eq('user_id', userId)
            .eq('league_id', leagueId);

        if (error) throw new AppError('Error al actualizar el presupuesto de la liga.', 500);
    }

    private async enrichOffers(leagueId: number, offers: LeagueDirectOffer[]): Promise<LeagueDirectOfferView[]> {
        const playerIds = offers.map(offer => offer.playerApiId);
        const userIds = offers.flatMap(offer => [offer.buyerUserId, offer.sellerUserId]);
        const [players, profiles] = await Promise.all([
            loadLeaguePlayerData(leagueId, playerIds),
            this.getProfiles(leagueId, userIds),
        ]);

        return offers.map(offer => {
            const player = players.get(offer.playerApiId);
            const buyer = profiles.get(offer.buyerUserId);
            const seller = profiles.get(offer.sellerUserId);

            return {
                ...offer,
                playerName: player?.name ?? 'Desconocido',
                position: player?.position ?? 'MC',
                realTeam: player?.realTeam ?? 'Sin equipo',
                playerFifaApiId: player?.playerFifaApiId ?? null,
                faceUrl: player?.faceUrl ?? null,
                clubLogoUrl: player?.clubLogoUrl ?? null,
                buyerUsername: buyer?.username ?? 'Manager',
                buyerTeamName: buyer?.teamName ?? 'Equipo comprador',
                sellerUsername: seller?.username ?? 'Manager',
                sellerTeamName: seller?.teamName ?? 'Equipo vendedor',
            };
        });
    }

    private async getProfiles(leagueId: number, userIds: string[]): Promise<Map<string, ProfileSummary>> {
        const uniqueIds = [...new Set(userIds.filter(Boolean))];
        if (!uniqueIds.length) return new Map();

        const { data, error } = await supabaseAdmin
            .from('league_participants')
            .select('user_id, profiles ( username, team_name )')
            .eq('league_id', leagueId)
            .in('user_id', uniqueIds);

        if (error) throw new AppError('Error al obtener managers de la liga.', 500);

        return new Map((data ?? []).map(row => {
            const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
            return [
                row.user_id as string,
                {
                    username: profile?.username ?? 'Manager',
                    teamName: profile?.team_name ?? 'Equipo',
                },
            ];
        }));
    }

    private mapOffer(row: any): LeagueDirectOffer {
        return {
            id: row.id as string,
            leagueId: Number(row.league_id),
            buyerUserId: row.buyer_user_id as string,
            sellerUserId: row.seller_user_id as string,
            playerApiId: Number(row.player_api_id),
            amount: Number(row.amount),
            status: row.status as DirectOfferStatus,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
            resolvedAt: row.resolved_at as string | null,
        };
    }
}
