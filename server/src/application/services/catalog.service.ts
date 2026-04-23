import { ValidationError } from '../../domain/errors/AppError';
import {
    CatalogCompetition,
    CatalogImportJob,
    CatalogSeason,
    ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { SupabaseCatalogRepository } from '../../infrastructure/repositories/SupabaseCatalogRepository';

export const LEGACY_CATALOG_SEASONS = [
    '2008/2009',
    '2009/2010',
    '2010/2011',
    '2011/2012',
    '2012/2013',
    '2013/2014',
    '2014/2015',
    '2015/2016',
] as const;

const LEGACY_CATALOG_COMPETITIONS: CatalogCompetition[] = [
    {
        id: 21518,
        slug: 'spain-liga-bbva',
        provider: 'kaggle',
        sourceCompetitionId: 21518,
        name: 'Spain LIGA BBVA',
        country: 'Spain',
        tier: 1,
        sortOrder: 10,
        isActive: true,
    },
    {
        id: 1729,
        slug: 'england-premier-league',
        provider: 'kaggle',
        sourceCompetitionId: 1729,
        name: 'England Premier League',
        country: 'England',
        tier: 1,
        sortOrder: 20,
        isActive: true,
    },
    {
        id: 7809,
        slug: 'germany-bundesliga',
        provider: 'kaggle',
        sourceCompetitionId: 7809,
        name: 'Germany Bundesliga',
        country: 'Germany',
        tier: 1,
        sortOrder: 30,
        isActive: true,
    },
];

const LEGACY_SEASON_OPTIONS: CatalogSeason[] = LEGACY_CATALOG_SEASONS.map((season, index) => ({
    season,
    sortOrder: (index + 1) * 10,
    isActive: true,
}));

export interface LeagueCreationOptions {
    competitions: CatalogCompetition[];
    seasons: CatalogSeason[];
}

export interface ResolvedLeagueCreationInput {
    season: string;
    competitionId: number | null;
    kaggleLeagueId: number;
}

export class CatalogService {
    constructor(
        private readonly repo: ICatalogRepository = new SupabaseCatalogRepository(),
    ) {}

    async getLeagueCreationOptions(): Promise<LeagueCreationOptions> {
        const [competitions, seasons] = await Promise.all([
            this.getActiveCompetitions(),
            this.getActiveSeasons(),
        ]);

        return { competitions, seasons };
    }

    async getActiveCompetitions(): Promise<CatalogCompetition[]> {
        try {
            const competitions = await this.repo.getActiveCompetitions();
            return competitions.length ? competitions : LEGACY_CATALOG_COMPETITIONS;
        } catch (error) {
            console.warn('[CatalogService] Fallback a competiciones legacy:', error);
            return LEGACY_CATALOG_COMPETITIONS;
        }
    }

    async getActiveSeasons(): Promise<CatalogSeason[]> {
        try {
            const seasons = await this.repo.getActiveSeasons();
            return seasons.length ? seasons : LEGACY_SEASON_OPTIONS;
        } catch (error) {
            console.warn('[CatalogService] Fallback a temporadas legacy:', error);
            return LEGACY_SEASON_OPTIONS;
        }
    }

    async getAvailableSeasonLabels(): Promise<string[]> {
        const seasons = await this.getActiveSeasons();
        return seasons.map(item => item.season);
    }

    async resolveLeagueCreationInput(input: {
        season: string;
        competitionId?: number | null;
        kaggleLeagueId?: number | null;
    }): Promise<ResolvedLeagueCreationInput> {
        const normalizedSeason = input.season?.trim();
        if (!normalizedSeason) {
            throw new ValidationError('La temporada es obligatoria.');
        }

        const seasons = await this.getActiveSeasons();
        if (!seasons.some(item => item.season === normalizedSeason)) {
            throw new ValidationError('La temporada seleccionada no esta disponible en el catalogo.');
        }

        const competitions = await this.getActiveCompetitions();
        const normalizedCompetitionId = this.normalizePositiveInt(input.competitionId);
        const normalizedKaggleLeagueId = this.normalizePositiveInt(input.kaggleLeagueId);

        let selectedCompetition = normalizedCompetitionId
            ? competitions.find(item => item.id === normalizedCompetitionId)
            : undefined;

        if (!selectedCompetition && normalizedKaggleLeagueId) {
            selectedCompetition = competitions.find(item => item.sourceCompetitionId === normalizedKaggleLeagueId);
        }

        if (!selectedCompetition) {
            throw new ValidationError('La competicion seleccionada no esta disponible en el catalogo.');
        }

        return {
            season: normalizedSeason,
            competitionId: await this.resolvePersistedCompetitionId(
                normalizedCompetitionId,
                selectedCompetition.sourceCompetitionId,
            ),
            kaggleLeagueId: selectedCompetition.sourceCompetitionId,
        };
    }

    async getImportJobs(limit = 50): Promise<CatalogImportJob[]> {
        return this.repo.getImportJobs(limit);
    }

    async isCatalogAdmin(userId: string): Promise<boolean> {
        return this.repo.userHasRole(userId, 'catalog_admin');
    }

    private async resolvePersistedCompetitionId(
        requestedCompetitionId: number | null,
        sourceCompetitionId: number,
    ): Promise<number | null> {
        try {
            if (requestedCompetitionId) {
                const byId = await this.repo.findCompetitionById(requestedCompetitionId);
                if (byId) {
                    return byId.id;
                }
            }

            const bySource = await this.repo.findCompetitionBySource('kaggle', sourceCompetitionId);
            return bySource?.id ?? null;
        } catch (error) {
            console.warn('[CatalogService] No se pudo resolver competition_id persistente:', error);
            return null;
        }
    }

    private normalizePositiveInt(value: number | null | undefined): number | null {
        if (!Number.isInteger(value) || Number(value) <= 0) {
            return null;
        }

        return Number(value);
    }
}
