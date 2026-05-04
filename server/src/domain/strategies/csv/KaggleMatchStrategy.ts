import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogMatchWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parsePositiveInteger,
    normalizeOptionalText
} from '../../services/csvValidationHelpers';

export class KaggleMatchStrategy implements ICsvValidationStrategy {
    key = 'kaggle_match_v1';
    label = 'Match (Kaggle)';
    description = 'Alta de partidos con estadisticas XML desde el dataset original de Kaggle.';
    
    // Dynamically build the 22 player spots
    private playerHeaders = Array.from({ length: 11 }, (_, i) => \`home_player_\${i + 1}\`)
        .concat(Array.from({ length: 11 }, (_, i) => \`away_player_\${i + 1}\`));

    // Exact Kaggle Match.csv headers we care about. 
    // The CSV parser will ignore betting odds and X/Y coordinates if they are in the CSV but not here.
    expectedHeaders = [
        'id',
        'league_id',
        'season',
        'stage',
        'date',
        'match_api_id',
        'home_team_api_id',
        'away_team_api_id',
        'home_team_goal',
        'away_team_goal',
        ...this.playerHeaders,
        'goal',
        'shoton',
        'shotoff',
        'foulcommit',
        'card',
        'cross',
        'corner',
        'possession'
    ];
    
    sampleFilename = 'Match.csv';
    sampleCsv = [
        this.expectedHeaders.join(','),
        \`1,21518,2015/2016,1,2015-08-23 00:00:00,123456,1000,2000,1,0,\${Array(22).fill('10').join(',')},<xml></xml>,,,,,,,,\`,
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
                rowErrors.push(buildRowError(rowNumber, 'id', 'DUPLICATE_ID', 'id duplicado.', rawPayload));
            } else {
                seenIds.add(id);
            }

            const matchApiId = parsePositiveInteger(rawRow.match_api_id);
            if (matchApiId === null) rowErrors.push(buildRowError(rowNumber, 'match_api_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const leagueId = parsePositiveInteger(rawRow.league_id);
            if (leagueId === null) rowErrors.push(buildRowError(rowNumber, 'league_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const season = normalizeRequiredText(rawRow.season);
            if (!season) rowErrors.push(buildRowError(rowNumber, 'season', 'REQUIRED_FIELD', 'Requerido.', rawPayload));

            const stage = parsePositiveInteger(rawRow.stage);
            if (stage === null) rowErrors.push(buildRowError(rowNumber, 'stage', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const date = normalizeRequiredText(rawRow.date);
            if (!date) rowErrors.push(buildRowError(rowNumber, 'date', 'REQUIRED_FIELD', 'Requerido.', rawPayload));

            const homeTeamId = parsePositiveInteger(rawRow.home_team_api_id);
            if (homeTeamId === null) rowErrors.push(buildRowError(rowNumber, 'home_team_api_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const awayTeamId = parsePositiveInteger(rawRow.away_team_api_id);
            if (awayTeamId === null) rowErrors.push(buildRowError(rowNumber, 'away_team_api_id', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            // Goals can be 0, parsePositiveInteger doesn't accept 0 natively without allowZero if using a custom wrapper, let's use parseInt
            const homeTeamGoal = parseInt(rawRow.home_team_goal, 10);
            if (isNaN(homeTeamGoal)) rowErrors.push(buildRowError(rowNumber, 'home_team_goal', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const awayTeamGoal = parseInt(rawRow.away_team_goal, 10);
            if (isNaN(awayTeamGoal)) rowErrors.push(buildRowError(rowNumber, 'away_team_goal', 'INVALID_INTEGER', 'Requerido.', rawPayload));

            const playerSpots: Record<string, number | null> = {};
            for (const ph of this.playerHeaders) {
                const val = parsePositiveInteger(rawRow[ph]);
                playerSpots[ph] = val; // can be null if not present
            }

            // XML fields are optional text
            const goal = normalizeOptionalText(rawRow.goal);
            const shoton = normalizeOptionalText(rawRow.shoton);
            const shotoff = normalizeOptionalText(rawRow.shotoff);
            const foulcommit = normalizeOptionalText(rawRow.foulcommit);
            const card = normalizeOptionalText(rawRow.card);
            const cross = normalizeOptionalText(rawRow.cross);
            const corner = normalizeOptionalText(rawRow.corner);
            const possession = normalizeOptionalText(rawRow.possession);

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    match_api_id: matchApiId,
                    date,
                    home_team_api_id: homeTeamId,
                    away_team_api_id: awayTeamId,
                    home_team_goal: homeTeamGoal,
                    away_team_goal: awayTeamGoal,
                    season,
                    stage,
                    league_id: leagueId,
                    ...playerSpots,
                    goal,
                    shoton,
                    shotoff,
                    foulcommit,
                    card,
                    cross,
                    corner,
                    possession
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
                id: Number(row.id),
                match_api_id: Number(row.match_api_id),
                date: String(row.date),
                home_team_api_id: Number(row.home_team_api_id),
                away_team_api_id: Number(row.away_team_api_id),
                home_team_goal: Number(row.home_team_goal),
                away_team_goal: Number(row.away_team_goal),
                season: String(row.season),
                stage: Number(row.stage),
                league_id: Number(row.league_id),
                goal: row.goal ? String(row.goal) : null,
                shoton: row.shoton ? String(row.shoton) : null,
                shotoff: row.shotoff ? String(row.shotoff) : null,
                foulcommit: row.foulcommit ? String(row.foulcommit) : null,
                card: row.card ? String(row.card) : null,
                cross: row.cross ? String(row.cross) : null,
                corner: row.corner ? String(row.corner) : null,
                possession: row.possession ? String(row.possession) : null,
            };

            for (const ph of this.playerHeaders) {
                mapped[ph] = row[ph] === null || row[ph] === undefined ? null : Number(row[ph]);
            }

            return mapped as CatalogMatchWriteModel;
        });

        await repository.upsertMatches(rows);
        return rows.length;
    }
}
