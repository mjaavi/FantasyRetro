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



export interface CatalogMatchWriteModel {
    id: number;
    match_api_id: number;
    date: string;
    home_team_api_id: number;
    away_team_api_id: number;
    home_team_goal: number;
    away_team_goal: number;
    season: string;
    stage: number;
    league_id: number;
    goal: string | null;
    shoton: string | null;
    shotoff: string | null;
    foulcommit: string | null;
    card: string | null;
    cross: string | null;
    corner: string | null;
    possession: string | null;
    [key: string]: any; // Allow the 22 player spots
}

export interface CatalogTeamWriteModel {
    id: number;
    team_api_id: number;
    team_long_name: string;
    team_short_name: string;
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
    upsertRawPlayers(rows: any[]): Promise<void>;
    upsertPlayerAttributes(rows: any[]): Promise<void>;
    upsertMatches(rows: CatalogMatchWriteModel[]): Promise<void>;
    upsertTeams(rows: CatalogTeamWriteModel[]): Promise<void>;
    userHasRole(userId: string, role: string): Promise<boolean>;
}
