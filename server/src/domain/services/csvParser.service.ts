import { ValidationError } from '../errors/AppError';

export interface ParsedCsvDocument {
    headers: string[];
    rows: Array<Record<string, string>>;
    dataLineNumbers: number[];
}

export class CsvParserService {
    parseCsvDocument(csvContent: string): ParsedCsvDocument {
        const rawRows = this.parseCsvRows(csvContent).map(row => row.map(cell => cell.trim()));
        const nonEmptyRows: string[][] = [];
        const nonEmptyLineNumbers: number[] = [];

        rawRows.forEach((row, index) => {
            if (row.some(cell => cell.length > 0)) {
                nonEmptyRows.push(row);
                nonEmptyLineNumbers.push(index + 1);
            }
        });

        if (!nonEmptyRows.length) {
            return { headers: [], rows: [], dataLineNumbers: [] };
        }

        const rawHeaders = nonEmptyRows[0];
        const headers = rawHeaders.map(this.normalizeHeader);
        const dataRows: Array<Record<string, string>> = [];
        const dataLineNumbers: number[] = [];

        for (let index = 1; index < nonEmptyRows.length; index += 1) {
            const rawRow = nonEmptyRows[index];
            const payload: Record<string, string> = {};

            headers.forEach((header, headerIndex) => {
                if (!header) {
                    return;
                }
                payload[header] = rawRow[headerIndex] ?? '';
            });

            dataRows.push(payload);
            dataLineNumbers.push(nonEmptyLineNumbers[index] ?? index + 1);
        }

        return { headers, rows: dataRows, dataLineNumbers };
    }

    private parseCsvRows(csvContent: string): string[][] {
        const rows: string[][] = [];
        let currentRow: string[] = [];
        let currentCell = '';
        let inQuotes = false;

        for (let index = 0; index < csvContent.length; index += 1) {
            const char = csvContent[index];
            const nextChar = csvContent[index + 1];

            if (char === '"') {
                if (inQuotes && nextChar === '"') {
                    currentCell += '"';
                    index += 1;
                    continue;
                }

                inQuotes = !inQuotes;
                continue;
            }

            if (!inQuotes && char === ',') {
                currentRow.push(currentCell);
                currentCell = '';
                continue;
            }

            if (!inQuotes && (char === '\n' || char === '\r')) {
                currentRow.push(currentCell);
                rows.push(currentRow);
                currentRow = [];
                currentCell = '';

                if (char === '\r' && nextChar === '\n') {
                    index += 1;
                }
                continue;
            }

            currentCell += char;
        }

        if (inQuotes) {
            throw new ValidationError('El CSV contiene comillas sin cerrar.');
        }

        if (currentCell.length > 0 || currentRow.length > 0) {
            currentRow.push(currentCell);
            rows.push(currentRow);
        }

        return rows;
    }

    private normalizeHeader(value: string): string {
        return value.trim().toLowerCase();
    }
}
