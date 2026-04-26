import { AppError } from '../../domain/errors/AppError';
import {
    CatalogCompetition,
    CatalogCompetitionWriteModel,
    CatalogImportJob,
    CatalogImportJobError,
    CatalogImportJobErrorWriteModel,
    CatalogImportJobRow,
    CatalogImportJobRowWriteModel,
    CatalogImportJobUpdate,
    CatalogSeason,
    CatalogSeasonWriteModel,
    CatalogPlayerWriteModel,
    CatalogMatchWriteModel,
    CatalogTeamWriteModel,
    CreateCatalogImportJobInput,
    ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { supabaseAdmin } from '../supabase.client';

type SupabaseClientLike = typeof supabaseAdmin;

interface CompetitionRow {
    id: number | string;
    slug: string;
    provider: string;
    source_competition_id: number | string;
    name: string;
    country: string | null;
    tier: number | string | null;
    sort_order: number | string | null;
    is_active: boolean | null;
}

interface SeasonRow {
    season: string;
    sort_order: number | string | null;
    is_active: boolean | null;
}

interface ImportJobRow {
    id: number | string;
    dataset_version_id: number | string | null;
    job_type: string;
    template_key: string | null;
    status: string;
    filename: string | null;
    storage_path: string | null;
    checksum_sha256: string | null;
    validation_summary: Record<string, unknown> | null;
    error_count: number | string | null;
    created_by: string | null;
    created_at: string;
    started_at: string | null;
    finished_at: string | null;
    published_at: string | null;
    published_by: string | null;
}

interface ImportJobErrorRow {
    id: number | string;
    job_id: number | string;
    row_number: number | string | null;
    field_name: string | null;
    error_code: string;
    message: string;
    raw_payload: Record<string, unknown> | null;
    created_at: string;
}

interface ImportJobDataRow {
    id: number | string;
    job_id: number | string;
    row_number: number | string;
    is_valid: boolean;
    raw_payload: Record<string, unknown> | null;
    normalized_payload: Record<string, unknown> | null;
    created_at: string;
}

const COMPETITION_FIELDS = [
    'id',
    'slug',
    'provider',
    'source_competition_id',
    'name',
    'country',
    'tier',
    'sort_order',
    'is_active',
].join(', ');

const SEASON_FIELDS = 'season, sort_order, is_active';
const IMPORT_JOB_FIELDS = [
    'id',
    'dataset_version_id',
    'job_type',
    'template_key',
    'status',
    'filename',
    'storage_path',
    'checksum_sha256',
    'validation_summary',
    'error_count',
    'created_by',
    'created_at',
    'started_at',
    'finished_at',
    'published_at',
    'published_by',
].join(', ');

export class SupabaseCatalogRepository implements ICatalogRepository {
    constructor(
        private readonly db: SupabaseClientLike = supabaseAdmin,
    ) {}

    async getActiveCompetitions(): Promise<CatalogCompetition[]> {
        const { data, error } = await this.db
            .from('catalog_competitions')
            .select(COMPETITION_FIELDS)
            .eq('is_active', true)
            .order('sort_order', { ascending: true })
            .order('name', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener el catalogo de competiciones: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as CompetitionRow[]).map(row => ({
            id: Number(row.id),
            slug: String(row.slug),
            provider: String(row.provider),
            sourceCompetitionId: Number(row.source_competition_id),
            name: String(row.name),
            country: row.country ? String(row.country) : null,
            tier: row.tier === null ? null : Number(row.tier),
            sortOrder: Number(row.sort_order ?? 0),
            isActive: Boolean(row.is_active),
        }));
    }

    async getActiveSeasons(): Promise<CatalogSeason[]> {
        const { data, error } = await this.db
            .from('catalog_seasons')
            .select(SEASON_FIELDS)
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener el catalogo de temporadas: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as SeasonRow[]).map(row => ({
            season: String(row.season),
            sortOrder: Number(row.sort_order ?? 0),
            isActive: Boolean(row.is_active),
        }));
    }

    async findCompetitionById(competitionId: number): Promise<CatalogCompetition | null> {
        const { data, error } = await this.db
            .from('catalog_competitions')
            .select(COMPETITION_FIELDS)
            .eq('id', competitionId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener la competicion del catalogo: ${error.message}`, 500);
        }

        if (!data) {
            return null;
        }

        const row = data as unknown as CompetitionRow;
        return {
            id: Number(row.id),
            slug: String(row.slug),
            provider: String(row.provider),
            sourceCompetitionId: Number(row.source_competition_id),
            name: String(row.name),
            country: row.country ? String(row.country) : null,
            tier: row.tier === null ? null : Number(row.tier),
            sortOrder: Number(row.sort_order ?? 0),
            isActive: Boolean(row.is_active),
        };
    }

    async findCompetitionBySource(provider: string, sourceCompetitionId: number): Promise<CatalogCompetition | null> {
        const { data, error } = await this.db
            .from('catalog_competitions')
            .select(COMPETITION_FIELDS)
            .eq('provider', provider)
            .eq('source_competition_id', sourceCompetitionId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al resolver la competicion del catalogo: ${error.message}`, 500);
        }

        if (!data) {
            return null;
        }

        const row = data as unknown as CompetitionRow;
        return {
            id: Number(row.id),
            slug: String(row.slug),
            provider: String(row.provider),
            sourceCompetitionId: Number(row.source_competition_id),
            name: String(row.name),
            country: row.country ? String(row.country) : null,
            tier: row.tier === null ? null : Number(row.tier),
            sortOrder: Number(row.sort_order ?? 0),
            isActive: Boolean(row.is_active),
        };
    }

    async getImportJobs(limit = 50): Promise<CatalogImportJob[]> {
        const { data, error } = await this.db
            .from('catalog_import_jobs')
            .select(IMPORT_JOB_FIELDS)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) {
            throw new AppError(`Error al obtener los import jobs: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as ImportJobRow[]).map(mapImportJobRow);
    }

    async findImportJobById(jobId: number): Promise<CatalogImportJob | null> {
        const { data, error } = await this.db
            .from('catalog_import_jobs')
            .select(IMPORT_JOB_FIELDS)
            .eq('id', jobId)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al obtener el import job: ${error.message}`, 500);
        }

        return data ? mapImportJobRow(data as unknown as ImportJobRow) : null;
    }

    async createImportJob(input: CreateCatalogImportJobInput): Promise<CatalogImportJob> {
        const payload = {
            dataset_version_id: input.datasetVersionId ?? null,
            job_type: input.jobType,
            template_key: input.templateKey,
            status: input.status,
            filename: input.filename,
            storage_path: input.storagePath ?? null,
            checksum_sha256: input.checksumSha256 ?? null,
            validation_summary: input.validationSummary ?? {},
            error_count: input.errorCount ?? 0,
            created_by: input.createdBy,
            started_at: input.startedAt ?? null,
            finished_at: input.finishedAt ?? null,
        };

        const { data, error } = await this.db
            .from('catalog_import_jobs')
            .insert(payload)
            .select(IMPORT_JOB_FIELDS)
            .single();

        if (error) {
            throw new AppError(`Error al crear el import job: ${error.message}`, 500);
        }

        return mapImportJobRow(data as unknown as ImportJobRow);
    }

    async updateImportJob(jobId: number, input: CatalogImportJobUpdate): Promise<void> {
        const payload: Record<string, unknown> = {};

        if (input.status !== undefined) payload.status = input.status;
        if (input.validationSummary !== undefined) payload.validation_summary = input.validationSummary;
        if (input.errorCount !== undefined) payload.error_count = input.errorCount;
        if (input.startedAt !== undefined) payload.started_at = input.startedAt;
        if (input.finishedAt !== undefined) payload.finished_at = input.finishedAt;
        if (input.publishedAt !== undefined) payload.published_at = input.publishedAt;
        if (input.publishedBy !== undefined) payload.published_by = input.publishedBy;

        if (!Object.keys(payload).length) {
            return;
        }

        const { error } = await this.db
            .from('catalog_import_jobs')
            .update(payload)
            .eq('id', jobId);

        if (error) {
            throw new AppError(`Error al actualizar el import job: ${error.message}`, 500);
        }
    }

    async replaceImportJobErrors(jobId: number, rows: CatalogImportJobErrorWriteModel[]): Promise<void> {
        const { error: deleteError } = await this.db
            .from('catalog_import_job_errors')
            .delete()
            .eq('job_id', jobId);

        if (deleteError) {
            throw new AppError(`Error al limpiar errores previos del import job: ${deleteError.message}`, 500);
        }

        if (!rows.length) {
            return;
        }

        const payload = rows.map(row => ({
            job_id: jobId,
            row_number: row.rowNumber,
            field_name: row.fieldName,
            error_code: row.errorCode,
            message: row.message,
            raw_payload: row.rawPayload,
        }));

        const { error } = await this.db
            .from('catalog_import_job_errors')
            .insert(payload);

        if (error) {
            throw new AppError(`Error al guardar los errores del import job: ${error.message}`, 500);
        }
    }

    async replaceImportJobRows(jobId: number, rows: CatalogImportJobRowWriteModel[]): Promise<void> {
        const { error: deleteError } = await this.db
            .from('catalog_import_job_rows')
            .delete()
            .eq('job_id', jobId);

        if (deleteError) {
            throw new AppError(`Error al limpiar filas previas del import job: ${deleteError.message}`, 500);
        }

        if (!rows.length) {
            return;
        }

        const payload = rows.map(row => ({
            job_id: jobId,
            row_number: row.rowNumber,
            is_valid: row.isValid,
            raw_payload: row.rawPayload,
            normalized_payload: row.normalizedPayload,
        }));

        const { error } = await this.db
            .from('catalog_import_job_rows')
            .insert(payload);

        if (error) {
            throw new AppError(`Error al guardar las filas del import job: ${error.message}`, 500);
        }
    }

    async getImportJobErrors(jobId: number): Promise<CatalogImportJobError[]> {
        const { data, error } = await this.db
            .from('catalog_import_job_errors')
            .select('id, job_id, row_number, field_name, error_code, message, raw_payload, created_at')
            .eq('job_id', jobId)
            .order('row_number', { ascending: true })
            .order('id', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener los errores del import job: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as ImportJobErrorRow[]).map(row => ({
            id: Number(row.id),
            jobId: Number(row.job_id),
            rowNumber: row.row_number === null ? null : Number(row.row_number),
            fieldName: row.field_name ? String(row.field_name) : null,
            errorCode: String(row.error_code),
            message: String(row.message),
            rawPayload: row.raw_payload ?? null,
            createdAt: String(row.created_at),
        }));
    }

    async getImportJobRows(jobId: number): Promise<CatalogImportJobRow[]> {
        const { data, error } = await this.db
            .from('catalog_import_job_rows')
            .select('id, job_id, row_number, is_valid, raw_payload, normalized_payload, created_at')
            .eq('job_id', jobId)
            .order('row_number', { ascending: true });

        if (error) {
            throw new AppError(`Error al obtener las filas del import job: ${error.message}`, 500);
        }

        return ((data ?? []) as unknown as ImportJobDataRow[]).map(row => ({
            id: Number(row.id),
            jobId: Number(row.job_id),
            rowNumber: Number(row.row_number),
            isValid: Boolean(row.is_valid),
            rawPayload: row.raw_payload ?? {},
            normalizedPayload: row.normalized_payload ?? null,
            createdAt: String(row.created_at),
        }));
    }

    async upsertCompetitions(rows: CatalogCompetitionWriteModel[]): Promise<void> {
        if (!rows.length) {
            return;
        }

        const { error } = await this.db
            .from('catalog_competitions')
            .upsert(rows, { onConflict: 'provider,source_competition_id' });

        if (error) {
            throw new AppError(`Error al publicar competiciones del catalogo: ${error.message}`, 500);
        }
    }

    async upsertSeasons(rows: CatalogSeasonWriteModel[]): Promise<void> {
        if (!rows.length) {
            return;
        }

        const { error } = await this.db
            .from('catalog_seasons')
            .upsert(rows, { onConflict: 'season' });

        if (error) {
            throw new AppError(`Error al publicar temporadas del catalogo: ${error.message}`, 500);
        }
    }

    async upsertPlayers(rows: CatalogPlayerWriteModel[]): Promise<void> {
        if (!rows.length) return;
        const { error } = await this.db
            .from('players')
            .upsert(rows, { onConflict: 'id' });
            
        if (error) throw new AppError(`Error al publicar jugadores: ${error.message}`, 500);
    }

    async upsertRawPlayers(rows: any[]): Promise<void> {
        if (!rows.length) return;
        const { error } = await this.db
            .from('Player')
            .upsert(rows, { onConflict: 'player_api_id' });
            
        if (error) throw new AppError(`Error al publicar Player raw: ${error.message}`, 500);
    }

    async upsertPlayerAttributes(rows: any[]): Promise<void> {
        if (!rows.length) return;
        const { error } = await this.db
            .from('Player_Attributes')
            .upsert(rows);
            
        if (error) throw new AppError(`Error al publicar Player Attributes raw: ${error.message}`, 500);
    }

    async upsertMatches(rows: CatalogMatchWriteModel[]): Promise<void> {
        if (!rows.length) return;
        const { error } = await this.db
            .from('Match')
            .upsert(rows); // Assumes Match has standard primary key or duplicates are okay, or no onConflict needed for raw dump
            
        if (error) throw new AppError(`Error al publicar Partidos / Fixtures: ${error.message}`, 500);
    }

    async upsertTeams(rows: CatalogTeamWriteModel[]): Promise<void> {
        if (!rows.length) return;
        const { error } = await this.db
            .from('Team')
            .upsert(rows, { onConflict: 'team_api_id' });
            
        if (error) throw new AppError(`Error al publicar Teams: ${error.message}`, 500);
    }

    async userHasRole(userId: string, role: string): Promise<boolean> {
        const { data, error } = await this.db
            .from('platform_user_roles')
            .select('user_id')
            .eq('user_id', userId)
            .eq('role', role)
            .maybeSingle();

        if (error) {
            throw new AppError(`Error al verificar el rol global del usuario: ${error.message}`, 500);
        }

        return Boolean(data);
    }
}

function mapImportJobRow(row: ImportJobRow): CatalogImportJob {
    return {
        id: Number(row.id),
        datasetVersionId: row.dataset_version_id === null ? null : Number(row.dataset_version_id),
        jobType: String(row.job_type),
        templateKey: row.template_key ? String(row.template_key) : null,
        status: String(row.status),
        filename: row.filename ? String(row.filename) : null,
        storagePath: row.storage_path ? String(row.storage_path) : null,
        checksumSha256: row.checksum_sha256 ? String(row.checksum_sha256) : null,
        validationSummary: (row.validation_summary as Record<string, unknown> | null) ?? {},
        errorCount: Number(row.error_count ?? 0),
        createdBy: row.created_by ? String(row.created_by) : null,
        createdAt: String(row.created_at),
        startedAt: row.started_at ? String(row.started_at) : null,
        finishedAt: row.finished_at ? String(row.finished_at) : null,
        publishedAt: row.published_at ? String(row.published_at) : null,
        publishedBy: row.published_by ? String(row.published_by) : null,
    };
}
