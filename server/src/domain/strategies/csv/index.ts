import { ICsvValidationStrategy } from './ICsvValidationStrategy';
import { CompetitionsValidationStrategy } from './CompetitionsValidationStrategy';
import { SeasonsValidationStrategy } from './SeasonsValidationStrategy';
import { TeamsValidationStrategy } from './TeamsValidationStrategy';
import { MatchesValidationStrategy } from './MatchesValidationStrategy';

import { KagglePlayerStrategy } from './KagglePlayerStrategy';
import { KagglePlayerAttributesStrategy } from './KagglePlayerAttributesStrategy';

export const CSV_STRATEGIES: ICsvValidationStrategy[] = [
    new CompetitionsValidationStrategy(),
    new SeasonsValidationStrategy(),
    new TeamsValidationStrategy(),
    new MatchesValidationStrategy(),
    new KagglePlayerStrategy(),
    new KagglePlayerAttributesStrategy(),
];

export function getStrategyByKey(key: string): ICsvValidationStrategy | undefined {
    const normalizedKey = String(key ?? '').trim().toLowerCase();
    return CSV_STRATEGIES.find(s => s.key === normalizedKey);
}

export * from './ICsvValidationStrategy';
export * from './CompetitionsValidationStrategy';
export * from './SeasonsValidationStrategy';
export * from './TeamsValidationStrategy';
export * from './MatchesValidationStrategy';
