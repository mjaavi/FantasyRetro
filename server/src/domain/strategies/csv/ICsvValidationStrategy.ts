import { ParsedCsvDocument } from '../../services/csvParser.service';
import { CatalogImportJobRowWriteModel, CatalogImportJobErrorWriteModel } from '../../ports/ICatalogRepository';

export interface RowValidationResult {
    rows: CatalogImportJobRowWriteModel[];
    errors: CatalogImportJobErrorWriteModel[];
}

export interface ICsvValidationStrategy {
    key: string;
    label: string;
    description: string;
    expectedHeaders: string[];
    sampleFilename: string;
    sampleCsv: string;

    validate(parsed: ParsedCsvDocument): RowValidationResult;
    publish(repository: any, normalizedRows: Record<string, unknown>[]): Promise<number>;
}
