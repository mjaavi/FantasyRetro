import { IPlatformAdminRepository, PlatformUser, PlatformLeague, PlatformLeagueParticipant } from '../../domain/ports/IPlatformAdminRepository';
import { supabaseAdmin } from '../supabase.client';
import { AppError } from '../../domain/errors/AppError';

type SupabaseClientLike = typeof supabaseAdmin;

export class SupabasePlatformAdminRepository implements IPlatformAdminRepository {
    constructor(private readonly db: SupabaseClientLike = supabaseAdmin) {}

    async checkIfUserIsPlatformAdmin(userId: string): Promise<boolean> {
        const { data, error } = await this.db
            .from('platform_user_roles')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', 'platform_admin')
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al verificar rol de platform_admin: ${error.message}`, 500);
        }

        return Boolean(data);
    }

    async getAllLeagues(): Promise<PlatformLeague[]> {
        const { data: leagues, error: lError } = await this.db
            .from('fantasy_leagues')
            .select(`
                id,
                name,
                invite_code,
                season,
                admin_id,
                jornada_actual,
                created_at,
                profiles:admin_id ( username )
            `)
            .order('id', { ascending: true });

        if (lError) {
            throw new AppError(`Error al listar ligas: ${lError.message}`, 500);
        }

        const { data: participants, error: pError } = await this.db
            .from('league_participants')
            .select('league_id');

        if (pError) {
            throw new AppError(`Error al contar participantes de ligas: ${pError.message}`, 500);
        }

        const participantCountMap = new Map<number, number>();
        for (const p of participants ?? []) {
            participantCountMap.set(p.league_id, (participantCountMap.get(p.league_id) ?? 0) + 1);
        }

        return (leagues ?? []).map((l: any) => {
            const profile = Array.isArray(l.profiles) ? l.profiles[0] : l.profiles;
            return {
                id: l.id,
                name: l.name,
                invite_code: l.invite_code,
                season: l.season,
                admin_id: l.admin_id,
                admin_username: profile?.username ?? null,
                participants_count: participantCountMap.get(l.id) ?? 0,
                jornada_actual: l.jornada_actual ?? 0,
                created_at: l.created_at,
            };
        });
    }

    async deleteLeague(leagueId: number): Promise<void> {
        await this.db.from('league_market_offers').delete().eq('league_id', leagueId);
        await this.db.from('direct_transfers').delete().eq('league_id', leagueId);
        await this.db.from('fantasy_scores').delete().eq('league_id', leagueId);
        await this.db.from('player_global_scores').delete().eq('league_id', leagueId);
        await this.db.from('league_market').delete().eq('league_id', leagueId);
        await this.db.from('user_roster').delete().eq('league_id', leagueId);
        await this.db.from('league_participants').delete().eq('league_id', leagueId);
        
        const { error } = await this.db
            .from('fantasy_leagues')
            .delete()
            .eq('id', leagueId);

        if (error) {
            throw new AppError(`Error al eliminar la liga #${leagueId}: ${error.message}`, 500);
        }
    }

    async getLeagueParticipants(leagueId: number): Promise<PlatformLeagueParticipant[]> {
        const { data, error } = await this.db
            .from('league_participants')
            .select(`
                user_id,
                budget,
                profiles:user_id ( username, team_name )
            `)
            .eq('league_id', leagueId);

        if (error) {
            throw new AppError(`Error al obtener participantes de la liga: ${error.message}`, 500);
        }

        return (data ?? []).map((p: any) => {
            const profile = Array.isArray(p.profiles) ? p.profiles[0] : p.profiles;
            return {
                user_id: p.user_id,
                username: profile?.username ?? null,
                team_name: profile?.team_name ?? null,
                budget: Number(p.budget),
            };
        });
    }

    async allocateBudget(leagueId: number, userId: string, amount: number): Promise<void> {
        const { error } = await this.db
            .from('league_participants')
            .update({ budget: amount })
            .eq('league_id', leagueId)
            .eq('user_id', userId);

        if (error) {
            throw new AppError(`Error al actualizar el presupuesto: ${error.message}`, 500);
        }
    }

    async getAllUsers(): Promise<PlatformUser[]> {
        const { data: profiles, error: pError } = await this.db
            .from('profiles')
            .select('id, username, team_name')
            .order('username', { ascending: true });

        if (pError) {
            throw new AppError(`Error al obtener perfiles de usuario: ${pError.message}`, 500);
        }

        const { data: authResult, error: aError } = await this.db.auth.admin.listUsers({
            perPage: 1000
        });

        if (aError) {
            throw new AppError(`Error al listar usuarios de autenticación: ${aError.message}`, 500);
        }

        const authUserMap = new Map<string, { email: string; created_at: string }>();
        for (const user of authResult.users) {
            authUserMap.set(user.id, {
                email: user.email ?? '(Sin email registrado)',
                created_at: user.created_at,
            });
        }

        return (profiles ?? []).map((p: any) => {
            const authUser = authUserMap.get(p.id);
            return {
                id: p.id,
                email: authUser?.email ?? '(Sin email registrado)',
                username: p.username,
                team_name: p.team_name,
                created_at: authUser?.created_at ?? null,
            };
        });
    }

    // --- Operaciones Privilegiadas de Auth ---

    async createAuthUser(email: string, password: string, username: string, teamName: string): Promise<string> {
        // 1. Crear el usuario en auth.users
        const { data, error } = await this.db.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { username }
        });

        if (error) {
            throw new AppError(`Error al crear usuario en autenticación: ${error.message}`, 400);
        }

        const userId = data.user.id;

        // 2. Crear/Upsertar el perfil en public.profiles para mantener sincronización
        const { error: profileError } = await this.db
            .from('profiles')
            .upsert({
                id: userId,
                username,
                team_name: teamName,
                updated_at: new Date().toISOString()
            });

        if (profileError) {
            // Rollback en Auth si falla la creación del perfil público
            await this.db.auth.admin.deleteUser(userId);
            throw new AppError(`Error al guardar perfil de usuario: ${profileError.message}`, 500);
        }

        return userId;
    }

    async deleteAuthUser(userId: string): Promise<void> {
        // 1. Eliminar datos asociados del usuario en la base de datos
        // Eliminar del roster
        await this.db.from('user_roster').delete().eq('user_id', userId);
        // Eliminar de las ligas participadas
        await this.db.from('league_participants').delete().eq('user_id', userId);
        // Eliminar ofertas recibidas/enviadas
        await this.db.from('league_market_offers').delete().eq('buyer_id', userId);
        // Eliminar puntuaciones del fantasy del usuario
        await this.db.from('fantasy_scores').delete().eq('user_id', userId);
        // Eliminar perfil público
        await this.db.from('profiles').delete().eq('id', userId);
        // Eliminar roles si los tiene
        await this.db.from('platform_user_roles').delete().eq('user_id', userId);

        // 2. Eliminar del sistema de autenticación
        const { error } = await this.db.auth.admin.deleteUser(userId);

        if (error) {
            throw new AppError(`Error al eliminar usuario en autenticación: ${error.message}`, 500);
        }
    }

    async updateAuthUserPassword(userId: string, password: string): Promise<void> {
        const { error } = await this.db.auth.admin.updateUserById(userId, { password });

        if (error) {
            throw new AppError(`Error al actualizar contraseña en autenticación: ${error.message}`, 500);
        }
    }
}
