import { AppError } from '../../domain/errors/AppError';
import {
    CatalogCompetition,
    CatalogImportJob,
    CatalogSeason,
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

        return ((data ?? []) as SeasonRow[]).map(row => ({
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

        return ((data ?? []) as unknown as ImportJobRow[]).map(row => ({
            id: Number(row.id),
            datasetVersionId: row.dataset_version_id === null ? null : Number(row.dataset_version_id),
            jobType: String(row.job_type),
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
        }));
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
