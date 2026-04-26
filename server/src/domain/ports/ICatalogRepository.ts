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
    templateKey: string | null;
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
    publishedAt: string | null;
    publishedBy: string | null;
}

export interface CatalogImportJobError {
    id: number;
    jobId: number;
    rowNumber: number | null;
    fieldName: string | null;
    errorCode: string;
    message: string;
    rawPayload: Record<string, unknown> | null;
    createdAt: string;
}

export interface CatalogImportJobRow {
    id: number;
    jobId: number;
    rowNumber: number;
    isValid: boolean;
    rawPayload: Record<string, unknown>;
    normalizedPayload: Record<string, unknown> | null;
    createdAt: string;
}

export interface CreateCatalogImportJobInput {
    datasetVersionId?: number | null;
    jobType: string;
    templateKey: string;
    status: string;
    filename: string | null;
    storagePath?: string | null;
    checksumSha256?: string | null;
    validationSummary?: Record<string, unknown>;
    errorCount?: number;
    createdBy: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
}

export interface CatalogImportJobUpdate {
    status?: string;
    validationSummary?: Record<string, unknown>;
    errorCount?: number;
    startedAt?: string | null;
    finishedAt?: string | null;
    publishedAt?: string | null;
    publishedBy?: string | null;
}

export interface CatalogImportJobErrorWriteModel {
    rowNumber: number | null;
    fieldName: string | null;
    errorCode: string;
    message: string;
    rawPayload: Record<string, unknown> | null;
}

export interface CatalogImportJobRowWriteModel {
    rowNumber: number;
    isValid: boolean;
    rawPayload: Record<string, unknown>;
    normalizedPayload: Record<string, unknown> | null;
}

export interface CatalogCompetitionWriteModel {
    slug: string;
    provider: string;
    source_competition_id: number;
    name: string;
    country: string | null;
    tier: number | null;
    sort_order: number;
    is_active: boolean;
    updated_at?: string;
}

export interface CatalogSeasonWriteModel {
    season: string;
    sort_order: number;
    is_active: boolean;
}

export interface CatalogPlayerWriteModel {
    id: string; // The player ID
    name: string;
    position: string;
    real_team: string; // the name or ID of the real club team
    market_value: number;
}

export interface CatalogMatchWriteModel {
    home_team_api_id: number;
    away_team_api_id: number;
    season: string;
    stage: number;
    league_id: number;
    [key: string]: any; // Allow the 22 player spots
}

export interface CatalogTeamWriteModel {
    team_api_id: number;
    team_long_name: string;
    team_fifa_api_id: number | null;
}

export interface ICatalogRepository {
    getActiveCompetitions(): Promise<CatalogCompetition[]>;
    getActiveSeasons(): Promise<CatalogSeason[]>;
    findCompetitionById(competitionId: number): Promise<CatalogCompetition | null>;
    findCompetitionBySource(provider: string, sourceCompetitionId: number): Promise<CatalogCompetition | null>;
    getImportJobs(limit?: number): Promise<CatalogImportJob[]>;
    findImportJobById(jobId: number): Promise<CatalogImportJob | null>;
    createImportJob(input: CreateCatalogImportJobInput): Promise<CatalogImportJob>;
    updateImportJob(jobId: number, input: CatalogImportJobUpdate): Promise<void>;
    replaceImportJobErrors(jobId: number, rows: CatalogImportJobErrorWriteModel[]): Promise<void>;
    replaceImportJobRows(jobId: number, rows: CatalogImportJobRowWriteModel[]): Promise<void>;
    getImportJobErrors(jobId: number): Promise<CatalogImportJobError[]>;
    getImportJobRows(jobId: number): Promise<CatalogImportJobRow[]>;
    upsertCompetitions(rows: CatalogCompetitionWriteModel[]): Promise<void>;
    upsertSeasons(rows: CatalogSeasonWriteModel[]): Promise<void>;
    upsertPlayers(rows: CatalogPlayerWriteModel[]): Promise<void>;
    upsertMatches(rows: CatalogMatchWriteModel[]): Promise<void>;
    upsertTeams(rows: CatalogTeamWriteModel[]): Promise<void>;
    userHasRole(userId: string, role: string): Promise<boolean>;
}
