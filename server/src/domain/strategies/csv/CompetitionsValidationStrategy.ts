import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogCompetitionWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    normalizeOptionalText,
    normalizeSlug,
    normalizeToken,
    parsePositiveInteger,
    parseOptionalInteger,
    parseBooleanValue
} from '../../services/csvValidationHelpers';

export class CompetitionsValidationStrategy implements ICsvValidationStrategy {
    key = 'competitions_v1';
    label = 'Competiciones v1';
    description = 'Alta o actualizacion de competiciones globales del catalogo.';
    expectedHeaders = [
        'slug',
        'provider',
        'source_competition_id',
        'name',
        'country',
        'tier',
        'sort_order',
        'is_active',
    ];
    sampleFilename = 'catalog_competitions_v1.csv';
    sampleCsv = [
        'slug,provider,source_competition_id,name,country,tier,sort_order,is_active',
        'italy-serie-a,manual,1001,Italy Serie A,Italy,1,40,true',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
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

    async publish(repository: ICatalogRepository, normalizedRows: Record<string, unknown>[]): Promise<number> {
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

        await repository.upsertCompetitions(rows);
        return rows.length;
    }
}
