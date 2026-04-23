import { AppError } from '../../domain/errors/AppError';
import { ILeagueRepository } from '../../domain/ports/ILeagueRepository';
import { SupabaseLeagueRepository } from '../../infrastructure/repositories/SupabaseLeagueRepository';
import { CatalogService, LEGACY_CATALOG_SEASONS } from './catalog.service';
import { LeagueMarketService } from './leagueMarket.service';
import { LeagueOnboardingService } from './leagueOnboarding.service';

export const TEMPORADAS_DISPONIBLES = [...LEGACY_CATALOG_SEASONS];

export class LeagueService {
    constructor(
        private readonly repo: ILeagueRepository = new SupabaseLeagueRepository(),
        private readonly catalogService: CatalogService,
        private readonly marketService: LeagueMarketService,
        private readonly onboardingService: LeagueOnboardingService,
    ) {}

    async crearLiga(input: {
        userId: string;
        nombre: string;
        season: string;
        competitionId?: number | null;
        kaggleLeagueId?: number | null;
        userToken: string;
    }) {
        const resolvedCatalog = await this.catalogService.resolveLeagueCreationInput({
            season: input.season,
            competitionId: input.competitionId ?? null,
            kaggleLeagueId: input.kaggleLeagueId ?? null,
        });

        const inviteCode = this.generarCodigoInvitacion();
        const liga = await this.repo.createWithUserToken(
            {
                name: input.nombre,
                invite_code: inviteCode,
                admin_id: input.userId,
                season: resolvedCatalog.season,
                competition_id: resolvedCatalog.competitionId,
                kaggle_league_id: resolvedCatalog.kaggleLeagueId,
            },
            input.userToken,
        );

        await this.repo.addParticipantWithUserToken(liga.id, input.userId, input.userToken);

        // El equipo inicial puede tardar bastante porque enriquece muchos jugadores.
        // Lo dejamos en background para no bloquear la creacion de la liga.
        this.onboardingService.assignInitialTeam(liga.id, input.userId).catch(err => {
            console.error(`[LeagueService] Fallo al generar equipo inicial para ${input.userId} en liga ${liga.id}:`, err);
        });

        // Abrir mercado en background acelera la respuesta inicial.
        // Si falla, el primer acceso a mercado volvera a intentarlo.
        this.marketService.openMarket(liga.id).catch((err: any) => {
            console.warn(`[LeagueService] Mercado no abierto automaticamente para liga ${liga.id}:`, err.message);
        });

        return liga;
    }

    async unirseALiga(userId: string, inviteCode: string, userToken: string) {
        const liga = await this.repo.findByInviteCode(inviteCode);
        if (!liga) throw new AppError('Codigo de invitacion invalido.', 404);

        const yaParticipa = await this.repo.findParticipant(liga.id, userId);
        if (yaParticipa) throw new AppError('Ya eres participante de esta liga.', 409);

        await this.repo.addParticipantWithUserToken(liga.id, userId, userToken);

        this.onboardingService.assignInitialTeam(liga.id, userId).catch(err => {
            console.error(`[LeagueService] Fallo al generar equipo inicial para ${userId} en liga ${liga.id}:`, err);
        });

        return liga;
    }

    async getMisLigas(userId: string) {
        return this.repo.findLeaguesByUser(userId);
    }

    async getLiga(leagueId: number, userId: string) {
        const participante = await this.repo.findParticipant(leagueId, userId);
        if (!participante) throw new AppError('No tienes acceso a esta liga.', 403);

        const liga = await this.repo.findById(leagueId);
        if (!liga) throw new AppError('Liga no encontrada.', 404);

        return liga;
    }

    private generarCodigoInvitacion(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    }
}
