import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogTeamWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parsePositiveInteger
} from '../../services/csvValidationHelpers';

export class KaggleTeamStrategy implements ICsvValidationStrategy {
    key = 'kaggle_team_v1';
    label = 'Team (Kaggle)';
    description = 'Alta de equipos desde el dataset original de Kaggle.';
    
    // Exact Kaggle Team.csv headers
    expectedHeaders = [
        'id',
        'team_api_id',
        'team_fifa_api_id',
        'team_long_name',
        'team_short_name'
    ];
    
    sampleFilename = 'Team.csv';
    sampleCsv = [
        'id,team_api_id,team_fifa_api_id,team_long_name,team_short_name',
        '1,9987,673,KRC Genk,GEN',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];
        const seenTeamApiIds = new Set<number>();

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const id = parsePositiveInteger(rawRow.id);
            if (id === null) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'INVALID_INTEGER', 'id debe ser entero.', rawPayload));
            }

            const teamApiId = parsePositiveInteger(rawRow.team_api_id);
            if (teamApiId === null) {
                rowErrors.push(buildRowError(rowNumber, 'team_api_id', 'INVALID_INTEGER', 'team_api_id debe ser entero.', rawPayload));
            } else if (seenTeamApiIds.has(teamApiId)) {
                rowErrors.push(buildRowError(rowNumber, 'team_api_id', 'DUPLICATE_TEAM_API_ID', 'team_api_id duplicado.', rawPayload));
            } else {
                seenTeamApiIds.add(teamApiId);
            }

            const teamFifaApiId = parsePositiveInteger(rawRow.team_fifa_api_id);
            
            const teamLongName = normalizeRequiredText(rawRow.team_long_name);
            if (!teamLongName) {
                rowErrors.push(buildRowError(rowNumber, 'team_long_name', 'REQUIRED_FIELD', 'team_long_name es obligatorio.', rawPayload));
            }

            const teamShortName = normalizeRequiredText(rawRow.team_short_name);

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    team_api_id: teamApiId,
                    team_fifa_api_id: teamFifaApiId,
                    team_long_name: teamLongName,
                    team_short_name: teamShortName || teamLongName?.substring(0, 3).toUpperCase()
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
            team_api_id: Number(row.team_api_id),
            team_fifa_api_id: row.team_fifa_api_id ? Number(row.team_fifa_api_id) : null,
            team_long_name: String(row.team_long_name),
            team_short_name: String(row.team_short_name),
        })) satisfies CatalogTeamWriteModel[];

        await repository.upsertTeams(rows);
        return rows.length;
    }
}
