import { CatalogImportJobErrorWriteModel } from '../ports/ICatalogRepository';

export function buildRowError(
    rowNumber: number,
    fieldName: string | null,
    errorCode: string,
    message: string,
    rawPayload: Record<string, unknown> | null,
): CatalogImportJobErrorWriteModel {
    return {
        rowNumber,
        fieldName,
        errorCode,
        message,
        rawPayload,
    };
}

export function normalizeRequiredText(value: string | undefined): string | null {
    const normalized = normalizeOptionalText(value);
    return normalized && normalized.length ? normalized : null;
}

export function normalizeOptionalText(value: string | undefined): string | null {
    const normalized = String(value ?? '').trim();
    return normalized.length ? normalized : null;
}

export function normalizeToken(value: string | undefined): string | null {
    const normalized = normalizeOptionalText(value);
    return normalized ? normalized.toLowerCase() : null;
}

export function normalizeSlug(value: string | undefined): string | null {
    const base = String(value ?? '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\s_-]/g, '')
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');

    return base || null;
}

export function parsePositiveInteger(value: string | undefined): number | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized || !/^-?\d+$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseOptionalInteger(
    value: string | undefined,
    options: { defaultValue?: number; allowZero: boolean },
): number | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized) {
        return options.defaultValue ?? null;
    }

    if (!/^-?\d+$/.test(normalized)) {
        return null;
    }

    const parsed = Number(normalized);
    if (!Number.isInteger(parsed)) {
        return null;
    }

    if (parsed < 0) {
        return null;
    }

    if (parsed === 0 && !options.allowZero) {
        return null;
    }

    return parsed;
}

export function parseDecimal(value: string | undefined): number | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized) return null;
    
    // Support commas as decimals
    const num = Number(normalized.replace(',', '.'));
    return isNaN(num) ? null : num;
}

export function parseBooleanValue(value: string | undefined, defaultValue: boolean): boolean | null {
    const normalized = normalizeOptionalText(value);
    if (!normalized) {
        return defaultValue;
    }

    const candidate = normalized.toLowerCase();
    if (['true', '1', 'yes', 'y', 'si'].includes(candidate)) {
        return true;
    }

    if (['false', '0', 'no', 'n'].includes(candidate)) {
        return false;
    }

    return null;
}

export function findDuplicates(values: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    values
        .filter(Boolean)
        .forEach(value => {
            if (seen.has(value)) {
                duplicates.add(value);
                return;
            }

            seen.add(value);
        });

    return Array.from(duplicates.values());
}
