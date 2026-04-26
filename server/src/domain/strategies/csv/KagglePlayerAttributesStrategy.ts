import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    parsePositiveInteger,
    normalizeRequiredText
} from '../../services/csvValidationHelpers';

export class KagglePlayerAttributesStrategy implements ICsvValidationStrategy {
    key = 'kaggle_player_attributes_v1';
    label = 'Player Attributes (Kaggle)';
    description = 'Alta de valoraciones raw de jugadores.';
    expectedHeaders = [
        'id',
        'player_api_id',
        'date',
        'overall_rating'
    ];
    sampleFilename = 'Player_Attributes.csv';
    sampleCsv = [
        'id,player_api_id,date,overall_rating',
        '1,505942,2016-02-18 00:00:00,67',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const id = parsePositiveInteger(rawRow.id);
            if (id === null) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'INVALID_INTEGER', 'id debe ser entero.', rawPayload));
            }

            const playerApiId = parsePositiveInteger(rawRow.player_api_id);
            if (playerApiId === null) {
                rowErrors.push(buildRowError(rowNumber, 'player_api_id', 'INVALID_INTEGER', 'player_api_id debe ser entero.', rawPayload));
            }

            const date = normalizeRequiredText(rawRow.date);
            const overallRating = parsePositiveInteger(rawRow.overall_rating);

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    player_api_id: playerApiId,
                    date,
                    overall_rating: overallRating,
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
        // Here we just use Supabase direct or repository
        // Since ICatalogRepository doesn't natively have upsertPlayerAttributes yet, we'll assume it's created.
        await repository.upsertPlayerAttributes(normalizedRows as any[]);
        return normalizedRows.length;
    }
}
