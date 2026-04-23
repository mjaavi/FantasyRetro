import { createHash } from 'crypto';
import {
    ConflictError,
    InfrastructureError,
    NotFoundError,
    ValidationError,
} from '../../domain/errors/AppError';
import {
    CatalogCompetitionWriteModel,
    CatalogImportJob,
    CatalogImportJobError,
    CatalogImportJobErrorWriteModel,
    CatalogImportJobRow,
    CatalogImportJobRowWriteModel,
    CatalogSeasonWriteModel,
    ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { SupabaseCatalogRepository } from '../../infrastructure/repositories/SupabaseCatalogRepository';

type CatalogImportTemplateKey = 'competitions_v1' | 'seasons_v1';

interface TemplateDefinition {
    key: CatalogImportTemplateKey;
    label: string;
    description: string;
    expectedHeaders: string[];
    sampleFilename: string;
    sampleCsv: string;
}

interface ParsedCsvDocument {
    headers: string[];
    rows: Array<Record<string, string>>;
    dataLineNumbers: number[];
}

interface RowValidationResult {
    rows: CatalogImportJobRowWriteModel[];
    errors: CatalogImportJobErrorWriteModel[];
}

interface CreateCatalogImportJobInput {
    templateKey: string;
    filename: string | null | undefined;
    csvContent: string | null | undefined;
}

export interface CatalogImportTemplateInfo extends TemplateDefinition {}

export interface CatalogImportJobReview {
    job: CatalogImportJob;
    errors: CatalogImportJobError[];
    rowsPreview: CatalogImportJobRow[];
    totalRowsStored: number;
    canPublish: boolean;
}

export interface PublishCatalogImportResult {
    job: CatalogImportJob;
    publishedRecords: number;
}

const MAX_CSV_CHARACTERS = 750_000;
const MAX_PREVIEW_ROWS = 20;

const IMPORT_TEMPLATES: Record<CatalogImportTemplateKey, TemplateDefinition> = {
    competitions_v1: {
        key: 'competitions_v1',
        label: 'Competiciones v1',
        description: 'Alta o actualizacion de competiciones globales del catalogo.',
        expectedHeaders: [
            'slug',
            'provider',
            'source_competition_id',
            'name',
            'country',
            'tier',
            'sort_order',
            'is_active',
        ],
        sampleFilename: 'catalog_competitions_v1.csv',
        sampleCsv: [
            'slug,provider,source_competition_id,name,country,tier,sort_order,is_active',
            'italy-serie-a,manual,1001,Italy Serie A,Italy,1,40,true',
        ].join('\n'),
    },
    seasons_v1: {
        key: 'seasons_v1',
        label: 'Temporadas v1',
        description: 'Alta o actualizacion de temporadas historicas disponibles para crear ligas.',
        expectedHeaders: [
            'season',
            'sort_order',
            'is_active',
        ],
        sampleFilename: 'catalog_seasons_v1.csv',
        sampleCsv: [
            'season,sort_order,is_active',
            '2016/2017,90,true',
        ].join('\n'),
    },
};

export class CatalogImportService {
    constructor(
        private readonly repo: ICatalogRepository = new SupabaseCatalogRepository(),
    ) {}

    getTemplates(): CatalogImportTemplateInfo[] {
        return Object.values(IMPORT_TEMPLATES);
    }

    async createImportJob(input: CreateCatalogImportJobInput, userId: string): Promise<CatalogImportJobReview> {
        const template = this.requireTemplate(input.templateKey);
        const filename = this.normalizeFilename(input.filename);
        const csvContent = this.normalizeCsvContent(input.csvContent);
        const checksumSha256 = createHash('sha256').update(csvContent, 'utf8').digest('hex');
        const startedAt = new Date().toISOString();

        const job = await this.repo.createImportJob({
            jobType: 'csv_import',
            templateKey: template.key,
            status: 'validating',
            filename,
            checksumSha256,
            createdBy: userId,
            startedAt,
            validationSummary: {
                templateKey: template.key,
                filename,
                checksumSha256,
            },
        });

        try {
            const parsed = parseCsvDocument(csvContent);
            const headerValidationErrors = this.validateHeaders(template, parsed.headers);
            const validation = headerValidationErrors.length
                ? { rows: [] as CatalogImportJobRowWriteModel[], errors: headerValidationErrors }
                : this.validateRows(template.key, parsed);

            const summary = {
                templateKey: template.key,
                filename,
                checksumSha256,
                detectedHeaders: parsed.headers,
                expectedHeaders: template.expectedHeaders,
                totalRows: parsed.rows.length,
                validRows: validation.rows.filter(row => row.isValid).length,
                invalidRows: validation.rows.filter(row => !row.isValid).length,
                errorCount: validation.errors.length,
                previewRowCount: Math.min(validation.rows.length, MAX_PREVIEW_ROWS),
            };

            await Promise.all([
                this.repo.replaceImportJobRows(job.id, validation.rows),
                this.repo.replaceImportJobErrors(job.id, validation.errors),
                this.repo.updateImportJob(job.id, {
                    status: validation.errors.length ? 'failed' : 'validated',
                    validationSummary: summary,
                    errorCount: validation.errors.length,
                    finishedAt: new Date().toISOString(),
                }),
            ]);

            return this.getImportJobReview(job.id);
        } catch (error) {
            await this.failImportJob(job.id, job.validationSummary, error);
            throw error;
        }
    }

    async getImportJobReview(jobId: number): Promise<CatalogImportJobReview> {
        const job = await this.repo.findImportJobById(jobId);
        if (!job) {
            throw new NotFoundError('El import job solicitado no existe.');
        }

        const [errors, rows] = await Promise.all([
            this.repo.getImportJobErrors(jobId),
            this.repo.getImportJobRows(jobId),
        ]);

        return {
            job,
            errors,
            rowsPreview: rows.slice(0, MAX_PREVIEW_ROWS),
            totalRowsStored: rows.length,
            canPublish: job.status === 'validated' && job.errorCount === 0,
        };
    }

    async publishImportJob(jobId: number, userId: string): Promise<PublishCatalogImportResult> {
        const job = await this.repo.findImportJobById(jobId);
        if (!job) {
            throw new NotFoundError('El import job solicitado no existe.');
        }

        if (!job.templateKey) {
            throw new ValidationError('El import job no tiene una plantilla asociada.');
        }

        const template = this.requireTemplate(job.templateKey);

        if (job.status === 'published') {
            throw new ConflictError('Este import job ya fue publicado.');
        }

        if (job.status !== 'validated' || job.errorCount > 0) {
            throw new ConflictError('Solo se pueden publicar import jobs validados sin errores.');
        }

        const storedRows = await this.repo.getImportJobRows(jobId);
        const normalizedRows = storedRows
            .filter(row => row.isValid && row.normalizedPayload)
            .map(row => row.normalizedPayload as Record<string, unknown>);

        if (!normalizedRows.length) {
            throw new ConflictError('No hay filas validas preparadas para publicar.');
        }

        try {
            const publishedRecords = await this.publishTemplateRows(template.key, normalizedRows);
            const publishedAt = new Date().toISOString();
            const validationSummary = {
                ...job.validationSummary,
                publishedRecords,
                publishedAt,
            };

            await this.repo.updateImportJob(jobId, {
                status: 'published',
                validationSummary,
                publishedAt,
                publishedBy: userId,
            });

            const updatedJob = await this.repo.findImportJobById(jobId);
            if (!updatedJob) {
                throw new InfrastructureError('El import job publicado ya no se pudo recuperar.');
            }

            return {
                job: updatedJob,
                publishedRecords,
            };
        } catch (error) {
            await this.repo.updateImportJob(jobId, {
                validationSummary: {
                    ...job.validationSummary,
                    lastPublishAttemptAt: new Date().toISOString(),
                    lastPublishError: error instanceof Error ? error.message : 'Error desconocido al publicar.',
                },
            });

            throw error;
        }
    }

    private requireTemplate(templateKey: string): TemplateDefinition {
        const normalizedKey = String(templateKey ?? '').trim().toLowerCase() as CatalogImportTemplateKey;
        const template = IMPORT_TEMPLATES[normalizedKey];
        if (!template) {
            throw new ValidationError('La plantilla de importacion no esta soportada.');
        }

        return template;
    }

    private normalizeFilename(filename: string | null | undefined): string {
        const normalized = String(filename ?? '').trim();
        if (!normalized) {
            throw new ValidationError('Debes indicar el nombre del archivo CSV.');
        }

        if (!normalized.toLowerCase().endsWith('.csv')) {
            throw new ValidationError('El archivo debe tener extension .csv.');
        }

        return normalized;
    }

    private normalizeCsvContent(csvContent: string | null | undefined): string {
        const normalized = String(csvContent ?? '').replace(/^\uFEFF/, '').trim();
        if (!normalized) {
            throw new ValidationError('El CSV no puede estar vacio.');
        }

        if (normalized.length > MAX_CSV_CHARACTERS) {
            throw new ValidationError(`El CSV supera el limite de ${MAX_CSV_CHARACTERS} caracteres.`);
        }

        return normalized;
    }

    private validateHeaders(
        template: TemplateDefinition,
        headers: string[],
    ): CatalogImportJobErrorWriteModel[] {
        const duplicateHeaders = findDuplicates(headers);
        const missingHeaders = template.expectedHeaders.filter(header => !headers.includes(header));

        const errors: CatalogImportJobErrorWriteModel[] = [];

        if (!headers.length) {
            errors.push({
                rowNumber: 1,
                fieldName: null,
                errorCode: 'CSV_HEADERS_MISSING',
                message: 'El CSV no contiene cabeceras.',
                rawPayload: null,
            });
        }

        if (duplicateHeaders.length) {
            errors.push({
                rowNumber: 1,
                fieldName: null,
                errorCode: 'CSV_DUPLICATE_HEADERS',
                message: `Las cabeceras estan duplicadas: ${duplicateHeaders.join(', ')}.`,
                rawPayload: { duplicateHeaders },
            });
        }

        if (missingHeaders.length) {
            errors.push({
                rowNumber: 1,
                fieldName: null,
                errorCode: 'CSV_MISSING_HEADERS',
                message: `Faltan columnas obligatorias: ${missingHeaders.join(', ')}.`,
                rawPayload: { missingHeaders },
            });
        }

        return errors;
    }

    private validateRows(templateKey: CatalogImportTemplateKey, parsed: ParsedCsvDocument): RowValidationResult {
        if (!parsed.rows.length) {
            return {
                rows: [],
                errors: [{
                    rowNumber: 2,
                    fieldName: null,
                    errorCode: 'CSV_EMPTY_DATA',
                    message: 'El CSV no contiene filas de datos.',
                    rawPayload: null,
                }],
            };
        }

        if (templateKey === 'competitions_v1') {
            return validateCompetitionRows(parsed);
        }

        return validateSeasonRows(parsed);
    }

    private async publishTemplateRows(
        templateKey: CatalogImportTemplateKey,
        normalizedRows: Record<string, unknown>[],
    ): Promise<number> {
        if (templateKey === 'competitions_v1') {
            const rows = normalizedRows.map(row => ({
                slug: String(row.slug),
                provider: String(row.provider),
                source_competition_id: Number(row.source_competition_id),
                name: String(row.name),
                country: row.country === null ? null : String(row.country),
                tier: row.tier === null ? null : Number(row.tier),
                sort_order: Number(row.sort_order),
                is_active: Boolean(row.is_active),
                updated_at: new Date().toISOString(),
            })) satisfies CatalogCompetitionWriteModel[];

            await this.repo.upsertCompetitions(rows);
            return rows.length;
        }

        const rows = normalizedRows.map(row => ({
            season: String(row.season),
            sort_order: Number(row.sort_order),
            is_active: Boolean(row.is_active),
        })) satisfies CatalogSeasonWriteModel[];

        await this.repo.upsertSeasons(rows);
        return rows.length;
    }

    private async failImportJob(
        jobId: number,
        currentSummary: Record<string, unknown>,
        error: unknown,
    ): Promise<void> {
        const message = error instanceof Error
            ? error.message
            : 'Error inesperado durante la validacion del CSV.';

        await this.repo.updateImportJob(jobId, {
            status: 'failed',
            validationSummary: {
                ...currentSummary,
                fatalError: message,
                failedAt: new Date().toISOString(),
            },
            finishedAt: new Date().toISOString(),
        });
    }
}

function parseCsvDocument(csvContent: string): ParsedCsvDocument {
    const rawRows = parseCsvRows(csvContent).map(row => row.map(cell => cell.trim()));
    const nonEmptyRows: string[][] = [];
    const nonEmptyLineNumbers: number[] = [];

    rawRows.forEach((row, index) => {
        if (row.some(cell => cell.length > 0)) {
            nonEmptyRows.push(row);
            nonEmptyLineNumbers.push(index + 1);
        }
    });

    if (!nonEmptyRows.length) {
        return { headers: [], rows: [], dataLineNumbers: [] };
    }

    const rawHeaders = nonEmptyRows[0];
    const headers = rawHeaders.map(normalizeHeader);
    const dataRows: Array<Record<string, string>> = [];
    const dataLineNumbers: number[] = [];

    for (let index = 1; index < nonEmptyRows.length; index += 1) {
        const rawRow = nonEmptyRows[index];
        const payload: Record<string, string> = {};

        headers.forEach((header, headerIndex) => {
            if (!header) {
                return;
            }
            payload[header] = rawRow[headerIndex] ?? '';
        });

        dataRows.push(payload);
        dataLineNumbers.push(nonEmptyLineNumbers[index] ?? index + 1);
    }

    return { headers, rows: dataRows, dataLineNumbers };
}

function parseCsvRows(csvContent: string): string[][] {
    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentCell = '';
    let inQuotes = false;

    for (let index = 0; index < csvContent.length; index += 1) {
        const char = csvContent[index];
        const nextChar = csvContent[index + 1];

        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                currentCell += '"';
                index += 1;
                continue;
            }

            inQuotes = !inQuotes;
            continue;
        }

        if (!inQuotes && char === ',') {
            currentRow.push(currentCell);
            currentCell = '';
            continue;
        }

        if (!inQuotes && (char === '\n' || char === '\r')) {
            currentRow.push(currentCell);
            rows.push(currentRow);
            currentRow = [];
            currentCell = '';

            if (char === '\r' && nextChar === '\n') {
                index += 1;
            }
            continue;
        }

        currentCell += char;
    }

    if (inQuotes) {
        throw new ValidationError('El CSV contiene comillas sin cerrar.');
    }

    if (currentCell.length > 0 || currentRow.length > 0) {
        currentRow.push(currentCell);
        rows.push(currentRow);
    }

    return rows;
}

function validateCompetitionRows(parsed: ParsedCsvDocument): RowValidationResult {
    const rows: CatalogImportJobRowWriteModel[] = [];
    const errors: CatalogImportJobErrorWriteModel[] = [];
    const seenSlugs = new Set<string>();
    const seenProviderSourceKeys = new Set<string>();

    parsed.rows.forEach((rawRow, index) => {
        const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
        const rowErrors: CatalogImportJobErrorWriteModel[] = [];
        const rawPayload = { ...rawRow };

        const slug = normalizeSlug(rawRow.slug);
        if (!slug) {
            rowErrors.push(buildRowError(rowNumber, 'slug', 'REQUIRED_FIELD', 'El slug es obligatorio.', rawPayload));
        } else if (seenSlugs.has(slug)) {
            rowErrors.push(buildRowError(rowNumber, 'slug', 'DUPLICATE_SLUG', 'El slug esta duplicado dentro del CSV.', rawPayload));
        } else {
            seenSlugs.add(slug);
        }

        const provider = normalizeToken(rawRow.provider);
        if (!provider) {
            rowErrors.push(buildRowError(rowNumber, 'provider', 'REQUIRED_FIELD', 'El provider es obligatorio.', rawPayload));
        }

        const sourceCompetitionId = parsePositiveInteger(rawRow.source_competition_id);
        if (sourceCompetitionId === null) {
            rowErrors.push(buildRowError(rowNumber, 'source_competition_id', 'INVALID_INTEGER', 'source_competition_id debe ser un entero positivo.', rawPayload));
        }

        if (provider && sourceCompetitionId !== null) {
            const providerSourceKey = `${provider}:${sourceCompetitionId}`;
            if (seenProviderSourceKeys.has(providerSourceKey)) {
                rowErrors.push(buildRowError(rowNumber, 'source_competition_id', 'DUPLICATE_SOURCE_KEY', 'provider + source_competition_id estan duplicados dentro del CSV.', rawPayload));
            } else {
                seenProviderSourceKeys.add(providerSourceKey);
            }
        }

        const name = normalizeRequiredText(rawRow.name);
        if (!name) {
            rowErrors.push(buildRowError(rowNumber, 'name', 'REQUIRED_FIELD', 'El nombre de la competicion es obligatorio.', rawPayload));
        }

        const country = normalizeOptionalText(rawRow.country);
        const tier = parseOptionalInteger(rawRow.tier, { allowZero: false });
        if (rawRow.tier && tier === null) {
            rowErrors.push(buildRowError(rowNumber, 'tier', 'INVALID_INTEGER', 'tier debe ser un entero positivo o vacio.', rawPayload));
        }

        const sortOrder = parseOptionalInteger(rawRow.sort_order, { defaultValue: (index + 1) * 10, allowZero: true });
        if (sortOrder === null) {
            rowErrors.push(buildRowError(rowNumber, 'sort_order', 'INVALID_INTEGER', 'sort_order debe ser un entero valido.', rawPayload));
        }

        const isActive = parseBooleanValue(rawRow.is_active, true);
        if (isActive === null) {
            rowErrors.push(buildRowError(rowNumber, 'is_active', 'INVALID_BOOLEAN', 'is_active debe ser true/false, 1/0, yes/no o vacio.', rawPayload));
        }

        const normalizedPayload = rowErrors.length
            ? null
            : {
                slug,
                provider,
                source_competition_id: sourceCompetitionId,
                name,
                country,
                tier,
                sort_order: sortOrder,
                is_active: isActive,
            };

        rows.push({
            rowNumber,
            isValid: rowErrors.length === 0,
            rawPayload,
            normalizedPayload,
        });

        errors.push(...rowErrors);
    });

    return { rows, errors };
}

function validateSeasonRows(parsed: ParsedCsvDocument): RowValidationResult {
    const rows: CatalogImportJobRowWriteModel[] = [];
    const errors: CatalogImportJobErrorWriteModel[] = [];
    const seenSeasons = new Set<string>();

    parsed.rows.forEach((rawRow, index) => {
        const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
        const rowErrors: CatalogImportJobErrorWriteModel[] = [];
        const rawPayload = { ...rawRow };

        const season = normalizeRequiredText(rawRow.season);
        if (!season) {
            rowErrors.push(buildRowError(rowNumber, 'season', 'REQUIRED_FIELD', 'La temporada es obligatoria.', rawPayload));
        } else if (seenSeasons.has(season)) {
            rowErrors.push(buildRowError(rowNumber, 'season', 'DUPLICATE_SEASON', 'La temporada esta duplicada dentro del CSV.', rawPayload));
        } else {
            seenSeasons.add(season);
        }

        const sortOrder = parseOptionalInteger(rawRow.sort_order, { defaultValue: (index + 1) * 10, allowZero: true });
        if (sortOrder === null) {
            rowErrors.push(buildRowError(rowNumber, 'sort_order', 'INVALID_INTEGER', 'sort_order debe ser un entero valido.', rawPayload));
        }

        const isActive = parseBooleanValue(rawRow.is_active, true);
        if (isActive === null) {
            rowErrors.push(buildRowError(rowNumber, 'is_active', 'INVALID_BOOLEAN', 'is_active debe ser true/false, 1/0, yes/no o vacio.', rawPayload));
        }

        const normalizedPayload = rowErrors.length
            ? null
            : {
                season,
                sort_order: sortOrder,
                is_active: isActive,
            };

        rows.push({
            rowNumber,
            isValid: rowErrors.length === 0,
            rawPayload,
            normalizedPayload,
        });

        errors.push(...rowErrors);
    });

    return { rows, errors };
}

function buildRowError(
    rowNumber: number,
    fieldName: string | null,
    errorCode: string,
    message: string,
    rawPayload: Record<string, unknown> | null,
): CatalogImportJobErrorWriteModel {
    return {
        rowNumber,
        fieldName,
        errorCode,
        message,
        rawPayload,
    };
}

function normalizeHeader(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeRequiredText(value: string | undefined): string | null {
    const normalized = normalizeOptionalText(value);
    return normalized && normalized.length ? normalized : null;
}

function normalizeOptionalText(value: string | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length ? normalized : null;
}

function normalizeToken(value: string | undefined): string | null {
    const normalized = normalizeOptionalText(value);
    return normalized ? normalized.toLowerCase() : null;
}

function normalizeSlug(value: string | undefined): string | null {
    const base = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return base || null;
}

function parsePositiveInteger(value: string | undefined): number | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized || !/^-?\d+$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function parseOptionalInteger(
    value: string | undefined,
    options: { defaultValue?: number; allowZero: boolean },
): number | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized) {
        return options.defaultValue ?? null;
    }

    if (!/^-?\d+$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isInteger(parsed)) {
        return null;
    }

    if (parsed < 0) {
        return null;
    }

    if (parsed === 0 && !options.allowZero) {
        return null;
    }

    return parsed;
}

function parseBooleanValue(value: string | undefined, defaultValue: boolean): boolean | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized) {
        return defaultValue;
    }

    const candidate = normalized.toLowerCase();
    if (['true', '1', 'yes', 'y', 'si'].includes(candidate)) {
        return true;
    }

    if (['false', '0', 'no', 'n'].includes(candidate)) {
        return false;
    }

    return null;
}

function findDuplicates(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    values
        .filter(Boolean)
        .forEach(value => {
            if (seen.has(value)) {
                duplicates.add(value);
                return;
            }

            seen.add(value);
        });

    return Array.from(duplicates.values());
}
