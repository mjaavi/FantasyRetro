export const FORMATION_LAYOUTS = {
    '3-5-2': { PT: 1, DF: 3, MC: 5, DL: 2 },
    '3-4-3': { PT: 1, DF: 3, MC: 4, DL: 3 },
    '4-5-1': { PT: 1, DF: 4, MC: 5, DL: 1 },
    '4-4-2': { PT: 1, DF: 4, MC: 4, DL: 2 },
    '4-3-3': { PT: 1, DF: 4, MC: 3, DL: 3 },
    '5-3-2': { PT: 1, DF: 5, MC: 3, DL: 2 },
    '5-2-3': { PT: 1, DF: 5, MC: 2, DL: 3 },
} as const;

export type FormationKey = keyof typeof FORMATION_LAYOUTS;
export type LineupPosition = keyof typeof FORMATION_LAYOUTS[FormationKey];

interface FormationPlayer {
    readonly position: string;
    readonly is_starter: boolean;
}

const DEFAULT_FORMATION: FormationKey = '4-4-2';
const LINEUP_POSITIONS = new Set<string>(['PT', 'DF', 'MC', 'DL']);

export function isFormationKey(value: string): value is FormationKey {
    return Object.prototype.hasOwnProperty.call(FORMATION_LAYOUTS, value);
}

export function normalizeLineupPosition(position: string): LineupPosition {
    return LINEUP_POSITIONS.has(position) ? position as LineupPosition : 'MC';
}

export function inferFormationKey(players: readonly FormationPlayer[]): FormationKey {
    const counts = { DF: 0, MC: 0, DL: 0 };

    for (const player of players) {
        if (!player.is_starter) continue;
        const position = normalizeLineupPosition(player.position);
        if (position !== 'PT') counts[position] += 1;
    }

    for (const [key, layout] of Object.entries(FORMATION_LAYOUTS)) {
        if (layout.DF === counts.DF && layout.MC === counts.MC && layout.DL === counts.DL) {
            return key as FormationKey;
        }
    }

    for (const [key, layout] of Object.entries(FORMATION_LAYOUTS)) {
        if (layout.DF >= counts.DF && layout.MC >= counts.MC && layout.DL >= counts.DL) {
            return key as FormationKey;
        }
    }

    return DEFAULT_FORMATION;
}
