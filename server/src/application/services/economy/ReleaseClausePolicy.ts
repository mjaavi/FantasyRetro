const INITIAL_RELEASE_CLAUSE_MULTIPLIER = 1.25;
const RELEASE_CLAUSE_BOOST_MULTIPLIER = 2;

export class ReleaseClausePolicy {
    getInitialClause(marketValue: number): number {
        return Math.ceil(Number(marketValue ?? 0) * INITIAL_RELEASE_CLAUSE_MULTIPLIER);
    }

    getEffectiveClause(storedClause: number | null | undefined, marketValue: number): number {
        return Math.max(Number(storedClause ?? 0), Number(marketValue ?? 0));
    }

    getRaisedClause(storedClause: number | null | undefined, marketValue: number, contribution: number): number {
        return this.getEffectiveClause(storedClause, marketValue) + Number(contribution ?? 0) * RELEASE_CLAUSE_BOOST_MULTIPLIER;
    }
}
