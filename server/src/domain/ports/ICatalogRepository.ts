export interface CatalogCompetition {
    id: number;
    slug: string;
    provider: string;
    sourceCompetitionId: number;
    name: string;
    country: string | null;
    tier: number | null;
    sortOrder: number;
    isActive: boolean;
}

export interface CatalogSeason {
    season: string;
    sortOrder: number;
    isActive: boolean;
}

export interface CatalogImportJob {
    id: number;
    datasetVersionId: number | null;
    jobType: string;
    status: string;
    filename: string | null;
    storagePath: string | null;
    checksumSha256: string | null;
    validationSummary: Record<string, unknown>;
    errorCount: number;
    createdBy: string | null;
    createdAt: string;
    startedAt: string | null;
    finishedAt: string | null;
}

export interface ICatalogRepository {
    getActiveCompetitions(): Promise<CatalogCompetition[]>;
    getActiveSeasons(): Promise<CatalogSeason[]>;
    findCompetitionById(competitionId: number): Promise<CatalogCompetition | null>;
    findCompetitionBySource(provider: string, sourceCompetitionId: number): Promise<CatalogCompetition | null>;
    getImportJobs(limit?: number): Promise<CatalogImportJob[]>;
    userHasRole(userId: string, role: string): Promise<boolean>;
}
