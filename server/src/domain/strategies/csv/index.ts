import { ICsvValidationStrategy } from './ICsvValidationStrategy';
import { CompetitionsValidationStrategy } from './CompetitionsValidationStrategy';
import { SeasonsValidationStrategy } from './SeasonsValidationStrategy';
import { PlayersValidationStrategy } from './PlayersValidationStrategy';
import { TeamsValidationStrategy } from './TeamsValidationStrategy';
import { MatchesValidationStrategy } from './MatchesValidationStrategy';

export const CSV_STRATEGIES: ICsvValidationStrategy[] = [
    new CompetitionsValidationStrategy(),
    new SeasonsValidationStrategy(),
    new PlayersValidationStrategy(),
    new TeamsValidationStrategy(),
    new MatchesValidationStrategy(),
];

export function getStrategyByKey(key: string): ICsvValidationStrategy | undefined {
    const normalizedKey = String(key ?? '').trim().toLowerCase();
    return CSV_STRATEGIES.find(s => s.key === normalizedKey);
}

export * from './ICsvValidationStrategy';
export * from './CompetitionsValidationStrategy';
export * from './SeasonsValidationStrategy';
export * from './PlayersValidationStrategy';
export * from './TeamsValidationStrategy';
export * from './MatchesValidationStrategy';
