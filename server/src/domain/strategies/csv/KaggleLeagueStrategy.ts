import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogCompetitionWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    normalizeSlug,
    parsePositiveInteger
} from '../../services/csvValidationHelpers';

export class KaggleLeagueStrategy implements ICsvValidationStrategy {
    key = 'kaggle_league_v1';
    label = 'League (Kaggle)';
    description = 'Alta de ligas desde el dataset original de Kaggle.';
    
    // Kaggle's League.csv expects id, country_id, name
    expectedHeaders = [
        'id',
        'country_id',
        'name'
    ];
    
    sampleFilename = 'League.csv';
    sampleCsv = [
        'id,country_id,name',
        '21518,21518,Spain LIGA BBVA',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];
        const seenIds = new Set<number>();

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const id = parsePositiveInteger(rawRow.id);
            if (id === null) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'INVALID_INTEGER', 'id debe ser entero.', rawPayload));
            } else if (seenIds.has(id)) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'DUPLICATE_ID', 'id de liga duplicado.', rawPayload));
            } else {
                seenIds.add(id);
            }

            const countryId = parsePositiveInteger(rawRow.country_id);
            if (countryId === null) {
                rowErrors.push(buildRowError(rowNumber, 'country_id', 'INVALID_INTEGER', 'country_id debe ser entero.', rawPayload));
            }

            const name = normalizeRequiredText(rawRow.name);
            if (!name) {
                rowErrors.push(buildRowError(rowNumber, 'name', 'REQUIRED_FIELD', 'name es obligatorio.', rawPayload));
            }

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    country_id: countryId,
                    name,
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
            id: Number(row.id),
            slug: normalizeSlug(String(row.name)) || `league-${row.id}`,
            provider: 'kaggle',
            source_competition_id: Number(row.id),
            name: String(row.name),
            country: String(row.country_id), // Since we don't map country names directly here, storing ID as string
            tier: 1,
            sort_order: 10,
            is_active: true,
            updated_at: new Date().toISOString(),
        })) satisfies CatalogCompetitionWriteModel[];

        await repository.upsertCompetitions(rows);
        return rows.length;
    }
}
