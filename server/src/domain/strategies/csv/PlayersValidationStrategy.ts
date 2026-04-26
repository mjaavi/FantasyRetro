import { ICsvValidationStrategy, RowValidationResult } from './ICsvValidationStrategy';
import { ParsedCsvDocument } from '../../services/csvParser.service';
import { ICatalogRepository, CatalogPlayerWriteModel } from '../../../domain/ports/ICatalogRepository';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../../domain/ports/ICatalogRepository';
import {
    buildRowError,
    normalizeRequiredText,
    parsePositiveInteger
} from '../../services/csvValidationHelpers';

export class PlayersValidationStrategy implements ICsvValidationStrategy {
    key = 'players_v1';
    label = 'Jugadores v1';
    description = 'Alta de jugadores.';
    expectedHeaders = [
        'id',
        'name',
        'position',
        'real_team',
        'market_value',
    ];
    sampleFilename = 'catalog_players_v1.csv';
    sampleCsv = [
        'id,name,position,real_team,market_value',
        'p100,Lionel Messi,FW,Inter Miami,50000000',
    ].join('\n');

    validate(parsed: ParsedCsvDocument): RowValidationResult {
        const rows: CatalogImportJobRowWriteModel[] = [];
        const errors: CatalogImportJobErrorWriteModel[] = [];
        const seenIds = new Set<string>();

        parsed.rows.forEach((rawRow, index) => {
            const rowNumber = parsed.dataLineNumbers[index] ?? index + 2;
            const rowErrors: CatalogImportJobErrorWriteModel[] = [];
            const rawPayload = { ...rawRow };

            const id = normalizeRequiredText(rawRow.id);
            if (!id) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'REQUIRED_FIELD', 'El id es obligatorio.', rawPayload));
            } else if (seenIds.has(id)) {
                rowErrors.push(buildRowError(rowNumber, 'id', 'DUPLICATE_ID', 'Id duplicado en el CSV.', rawPayload));
            } else {
                seenIds.add(id);
            }

            const name = normalizeRequiredText(rawRow.name);
            if (!name) {
                rowErrors.push(buildRowError(rowNumber, 'name', 'REQUIRED_FIELD', 'El nombre es obligatorio.', rawPayload));
            }

            const position = normalizeRequiredText(rawRow.position);
            if (!position) {
                rowErrors.push(buildRowError(rowNumber, 'position', 'REQUIRED_FIELD', 'La posicion es obligatoria.', rawPayload));
            }
            
            const realTeam = normalizeRequiredText(rawRow.real_team);
            if (!realTeam) {
                rowErrors.push(buildRowError(rowNumber, 'real_team', 'REQUIRED_FIELD', 'El equipo real es obligatorio.', rawPayload));
            }

            const marketValue = parsePositiveInteger(rawRow.market_value);
            if (rawRow.market_value && marketValue === null) {
                rowErrors.push(buildRowError(rowNumber, 'market_value', 'INVALID_INTEGER', 'market_value debe ser numérico positivo.', rawPayload));
            }

            const normalizedPayload = rowErrors.length
                ? null
                : {
                    id,
                    name,
                    position,
                    real_team: realTeam,
                    market_value: marketValue ?? 0,
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
            id: String(row.id),
            name: String(row.name),
            position: String(row.position),
            real_team: String(row.real_team),
            market_value: Number(row.market_value),
        })) satisfies CatalogPlayerWriteModel[];

        await repository.upsertPlayers(rows);
        return rows.length;
    }
}
