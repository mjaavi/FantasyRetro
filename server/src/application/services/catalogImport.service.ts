import { createHash } from 'crypto';
import {
    ConflictError,
    InfrastructureError,
    NotFoundError,
    ValidationError,
} from '../../domain/errors/AppError';
import {
    CatalogImportJob,
    CatalogImportJobError,
    CatalogImportJobRow,
    ICatalogRepository,
} from '../../domain/ports/ICatalogRepository';
import { SupabaseCatalogRepository } from '../../infrastructure/repositories/SupabaseCatalogRepository';
import { CsvParserService } from '../../domain/services/csvParser.service';
import { CSV_STRATEGIES, getStrategyByKey, ICsvValidationStrategy } from '../../domain/strategies/csv';
import { findDuplicates } from '../../domain/services/csvValidationHelpers';
import { CatalogImportJobErrorWriteModel, CatalogImportJobRowWriteModel } from '../../domain/ports/ICatalogRepository';

export interface CatalogImportTemplateInfo {
    key: string;
    label: string;
    description: string;
    expectedHeaders: string[];
    sampleFilename: string;
    sampleCsv: string;
}

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

interface CreateCatalogImportJobInput {
    templateKey: string;
    filename: string | null | undefined;
    csvContent: string | null | undefined;
}

const MAX_CSV_CHARACTERS = 750_000;
const MAX_PREVIEW_ROWS = 20;

export class CatalogImportService {
    constructor(
        private readonly repo: ICatalogRepository = new SupabaseCatalogRepository(),
        private readonly csvParser: CsvParserService = new CsvParserService(),
    ) {}

    getTemplates(): CatalogImportTemplateInfo[] {
        return CSV_STRATEGIES.map(s => ({
            key: s.key,
            label: s.label,
            description: s.description,
            expectedHeaders: s.expectedHeaders,
            sampleFilename: s.sampleFilename,
            sampleCsv: s.sampleCsv,
        }));
    }

    async createImportJob(input: CreateCatalogImportJobInput, userId: string): Promise<CatalogImportJobReview> {
        const strategy = this.requireStrategy(input.templateKey);
        const filename = this.normalizeFilename(input.filename);
        const csvContent = this.normalizeCsvContent(input.csvContent);
        const checksumSha256 = createHash('sha256').update(csvContent, 'utf8').digest('hex');
        const startedAt = new Date().toISOString();

        const job = await this.repo.createImportJob({
            jobType: 'csv_import',
            templateKey: strategy.key,
            status: 'validating',
            filename,
            checksumSha256,
            createdBy: userId,
            startedAt,
            validationSummary: {
                templateKey: strategy.key,
                filename,
                checksumSha256,
            },
        });

        try {
            const parsed = this.csvParser.parseCsvDocument(csvContent);
            const headerValidationErrors = this.validateHeaders(strategy, parsed.headers);
            
            let validation = { rows: [] as CatalogImportJobRowWriteModel[], errors: headerValidationErrors };
            
            if (headerValidationErrors.length === 0) {
                validation = strategy.validate(parsed);
            }

            const summary = {
                templateKey: strategy.key,
                filename,
                checksumSha256,
                detectedHeaders: parsed.headers,
                expectedHeaders: strategy.expectedHeaders,
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

        const strategy = this.requireStrategy(job.templateKey);

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
            const publishedRecords = await strategy.publish(this.repo, normalizedRows);
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

    private requireStrategy(templateKey: string): ICsvValidationStrategy {
        const strategy = getStrategyByKey(templateKey);
        if (!strategy) {
            throw new ValidationError('La plantilla de importacion no esta soportada.');
        }
        return strategy;
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
        strategy: ICsvValidationStrategy,
        headers: string[],
    ): CatalogImportJobErrorWriteModel[] {
        const duplicateHeaders = findDuplicates(headers);
        const missingHeaders = strategy.expectedHeaders.filter(header => !headers.includes(header));

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
