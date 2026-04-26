import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogSeasonWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parseOptionalInteger,
    parseBooleanValue
} from '../../services/csvValidationHelpers';

export class SeasonsValidationStrategy implements ICsvValidationStrategy {
    key = 'seasons_v1';
    label = 'Temporadas v1';
    description = 'Alta o actualizacion de temporadas historicas disponibles para crear ligas.';
    expectedHeaders = [
        'season',
        'sort_order',
        'is_active',
    ];
    sampleFilename = 'catalog_seasons_v1.csv';
    sampleCsv = [
        'season,sort_order,is_active',
        '2016/2017,90,true',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
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

    async publish(repository: ICatalogRepository, normalizedRows: Record<string, unknown>[]): Promise<number> {
        const rows = normalizedRows.map(row => ({
            season: String(row.season),
            sort_order: Number(row.sort_order),
            is_active: Boolean(row.is_active),
        })) satisfies CatalogSeasonWriteModel[];

        await repository.upsertSeasons(rows);
        return rows.length;
    }
}
