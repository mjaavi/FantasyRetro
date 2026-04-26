import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogMatchWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parsePositiveInteger
} from '../../services/csvValidationHelpers';

export class MatchesValidationStrategy implements ICsvValidationStrategy {
    key = 'matches_v1';
    label = 'Partidos v1';
    description = 'Alta de partidos y alineaciones (Fixtures).';
    
    // Dynamically build the 22 player spots
    private playerHeaders = Array.from({ length: 11 }, (_, i) => `home_player_${i + 1}`)
        .concat(Array.from({ length: 11 }, (_, i) => `away_player_${i + 1}`));

    expectedHeaders = [
        'home_team_api_id',
        'away_team_api_id',
        'season',
        'stage',
        'league_id',
        ...this.playerHeaders
    ];
    
    sampleFilename = 'catalog_matches_v1.csv';
    sampleCsv = [
        this.expectedHeaders.join(','),
        `1000,2000,2015/2016,1,21518,${Array(22).fill('10').join(',')}`,
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const homeTeamId = parsePositiveInteger(rawRow.home_team_api_id);
            if (homeTeamId === null) {
                rowErrors.push(buildRowError(rowNumber, 'home_team_api_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));
            }

            const awayTeamId = parsePositiveInteger(rawRow.away_team_api_id);
            if (awayTeamId === null) {
                rowErrors.push(buildRowError(rowNumber, 'away_team_api_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));
            }

            const season = normalizeRequiredText(rawRow.season);
            if (!season) {
                rowErrors.push(buildRowError(rowNumber, 'season', 'REQUIRED_FIELD', 'Requerido.', rawPayload));
            }

            const stage = parsePositiveInteger(rawRow.stage);
            if (stage === null) {
                rowErrors.push(buildRowError(rowNumber, 'stage', 'INVALID_INTEGER', 'Requerido.', rawPayload));
            }

            const leagueId = parsePositiveInteger(rawRow.league_id);
            if (leagueId === null) {
                rowErrors.push(buildRowError(rowNumber, 'league_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));
            }

            const playerSpots: Record<string, number | null> = {};
            for (const ph of this.playerHeaders) {
                const val = parsePositiveInteger(rawRow[ph]);
                playerSpots[ph] = val; // can be null if not present, which is valid sometimes
            }

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    home_team_api_id: homeTeamId,
                    away_team_api_id: awayTeamId,
                    season,
                    stage,
                    league_id: leagueId,
                    ...playerSpots,
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
        const rows = normalizedRows.map(row => {
            const mapped: Record<string, any> = {
                home_team_api_id: Number(row.home_team_api_id),
                away_team_api_id: Number(row.away_team_api_id),
                season: String(row.season),
                stage: Number(row.stage),
                league_id: Number(row.league_id),
            };

            for (const ph of this.playerHeaders) {
                mapped[ph] = row[ph] === null ? null : Number(row[ph]);
            }

            return mapped as CatalogMatchWriteModel;
        });

        await repository.upsertMatches(rows);
        return rows.length;
    }
}
