import { ICsvValidationStrategy } from './ICsvValidationStrategy';
import { KaggleLeagueStrategy } from './KaggleLeagueStrategy';
import { KaggleTeamStrategy } from './KaggleTeamStrategy';
import { KaggleMatchStrategy } from './KaggleMatchStrategy';
import { KagglePlayerStrategy } from './KagglePlayerStrategy';
import { KagglePlayerAttributesStrategy } from './KagglePlayerAttributesStrategy';

export const CSV_STRATEGIES: ICsvValidationStrategy[] = [
    new KaggleLeagueStrategy(),
    new KaggleTeamStrategy(),
    new KagglePlayerStrategy(),
    new KagglePlayerAttributesStrategy(),
    new KaggleMatchStrategy(),
];

export function getStrategyByKey(key: string): ICsvValidationStrategy | undefined {
    const normalizedKey = String(key ?? '').trim().toLowerCase();
    return CSV_STRATEGIES.find(s => s.key === normalizedKey);
}

export * from './ICsvValidationStrategy';
export * from './KaggleLeagueStrategy';
export * from './KaggleTeamStrategy';
export * from './KaggleMatchStrategy';
export * from './KagglePlayerStrategy';
export * from './KagglePlayerAttributesStrategy';
