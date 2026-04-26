import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    parsePositiveInteger,
    normalizeRequiredText
} from '../../services/csvValidationHelpers';

export class KagglePlayerStrategy implements ICsvValidationStrategy {
    key = 'kaggle_player_v1';
    label = 'Player (Kaggle)';
    description = 'Alta de información base de jugador raw.';
    expectedHeaders = [
        'id',
        'player_api_id',
        'player_name',
        'player_fifa_api_id',
        'birthday',
        'height',
        'weight'
    ];
    sampleFilename = 'Player.csv';
    sampleCsv = [
        'id,player_api_id,player_name,player_fifa_api_id,birthday,height,weight',
        '1,505942,Aaron Appindangoye,218353,1992-02-29 00:00:00,182.88,187',
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

            const playerName = normalizeRequiredText(rawRow.player_name);
            const playerFifaApiId = parsePositiveInteger(rawRow.player_fifa_api_id);

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    player_api_id: playerApiId,
                    player_name: playerName,
                    player_fifa_api_id: playerFifaApiId,
                    birthday: normalizeRequiredText(rawRow.birthday),
                    height: parsePositiveInteger(rawRow.height?.replace('.', '')),
                    weight: parsePositiveInteger(rawRow.weight),
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
        await repository.upsertRawPlayers(normalizedRows as any[]);
        return normalizedRows.length;
    }
}
