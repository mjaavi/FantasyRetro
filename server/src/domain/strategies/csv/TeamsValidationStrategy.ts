import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogTeamWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parsePositiveInteger
} from '../../services/csvValidationHelpers';

export class TeamsValidationStrategy implements ICsvValidationStrategy {
    key = 'teams_v1';
    label = 'Equipos v1';
    description = 'Alta de equipos.';
    expectedHeaders = [
        'team_api_id',
        'team_long_name',
        'team_fifa_api_id',
    ];
    sampleFilename = 'catalog_teams_v1.csv';
    sampleCsv = [
        'team_api_id,team_long_name,team_fifa_api_id',
        '1000,Real Madrid CF,100',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];
        const seenIds = new Set<number>();

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const teamApiId = parsePositiveInteger(rawRow.team_api_id);
            if (teamApiId === null) {
                rowErrors.push(buildRowError(rowNumber, 'team_api_id', 'INVALID_INTEGER', 'team_api_id debe ser numérico positivo.', rawPayload));
            } else if (seenIds.has(teamApiId)) {
                rowErrors.push(buildRowError(rowNumber, 'team_api_id', 'DUPLICATE_ID', 'Id duplicado.', rawPayload));
            } else {
                seenIds.add(teamApiId);
            }

            const teamLongName = normalizeRequiredText(rawRow.team_long_name);
            if (!teamLongName) {
                rowErrors.push(buildRowError(rowNumber, 'team_long_name', 'REQUIRED_FIELD', 'El nombre es obligatorio.', rawPayload));
            }

            const teamFifaApiId = parsePositiveInteger(rawRow.team_fifa_api_id);

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    team_api_id: teamApiId,
                    team_long_name: teamLongName,
                    team_fifa_api_id: teamFifaApiId,
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
            team_api_id: Number(row.team_api_id),
            team_long_name: String(row.team_long_name),
            team_fifa_api_id: row.team_fifa_api_id === null ? null : Number(row.team_fifa_api_id),
        })) satisfies CatalogTeamWriteModel[];

        await repository.upsertTeams(rows);
        return rows.length;
    }
}
