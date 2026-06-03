import { IPlatformAdminRepository, PlatformLeague, PlatformUser, PlatformLeagueParticipant } from '../../domain/ports/IPlatformAdminRepository';
import { LeagueMarketService } from './leagueMarket.service';
import { AppError } from '../../domain/errors/AppError';

export class PlatformAdminService {
    constructor(
        private readonly repo: IPlatformAdminRepository,
        private readonly leagueMarketService: LeagueMarketService,
    ) {}

    async checkIfUserIsPlatformAdmin(userId: string): Promise<boolean> {
        if (!userId) return false;
        return this.repo.checkIfUserIsPlatformAdmin(userId);
    }

    async getAllLeagues(): Promise<PlatformLeague[]> {
        return this.repo.getAllLeagues();
    }

    async deleteLeague(leagueId: number): Promise<void> {
        if (!leagueId || leagueId <= 0) {
            throw new AppError('ID de liga inválido.', 400);
        }
        return this.repo.deleteLeague(leagueId);
    }

    async getLeagueParticipants(leagueId: number): Promise<PlatformLeagueParticipant[]> {
        if (!leagueId || leagueId <= 0) {
            throw new AppError('ID de liga inválido.', 400);
        }
        return this.repo.getLeagueParticipants(leagueId);
    }

    async allocateBudget(leagueId: number, userId: string, amount: number): Promise<void> {
        if (!leagueId || leagueId <= 0) {
            throw new AppError('ID de liga inválido.', 400);
        }
        if (!userId) {
            throw new AppError('ID de usuario inválido.', 400);
        }
        if (amount === undefined || Number.isNaN(amount)) {
            throw new AppError('Presupuesto inválido.', 400);
        }
        return this.repo.allocateBudget(leagueId, userId, amount);
    }

    async getAllUsers(): Promise<PlatformUser[]> {
        return this.repo.getAllUsers();
    }

    async crearUsuario(email: string, password: string, username: string, teamName: string): Promise<string> {
        if (!email || !email.includes('@')) {
            throw new AppError('Email inválido.', 400);
        }
        if (!password || password.length < 8) {
            throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400);
        }
        if (!username) {
            throw new AppError('El nombre de usuario es obligatorio.', 400);
        }
        if (!teamName) {
            throw new AppError('El nombre del equipo es obligatorio.', 400);
        }

        return this.repo.createAuthUser(email, password, username, teamName);
    }

    async borrarUsuario(userId: string): Promise<void> {
        if (!userId) {
            throw new AppError('ID de usuario inválido.', 400);
        }
        return this.repo.deleteAuthUser(userId);
    }

    async cambiarContrasena(userId: string, newPassword: string): Promise<void> {
        if (!userId) {
            throw new AppError('ID de usuario inválido.', 400);
        }
        if (!newPassword || newPassword.length < 8) {
            throw new AppError('La contraseña debe tener al menos 8 caracteres.', 400);
        }
        return this.repo.updateAuthUserPassword(userId, newPassword);
    }

    async resolverPujasLiga(leagueId: number): Promise<any> {
        if (!leagueId || leagueId <= 0) {
            throw new AppError('ID de liga inválido.', 400);
        }
        return this.leagueMarketService.forceResolveAndRegenerateMarket(leagueId);
    }
}
