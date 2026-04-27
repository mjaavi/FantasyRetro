// formations.js
// Manager for team formations, applying DRY and purely functional inference.

const AVAILABLE_FORMATIONS = {
    '3-5-2': { DF: 3, MC: 5, DL: 2, PT: 1 },
    '3-4-3': { DF: 3, MC: 4, DL: 3, PT: 1 },
    '4-5-1': { DF: 4, MC: 5, DL: 1, PT: 1 },
    '4-4-2': { DF: 4, MC: 4, DL: 2, PT: 1 },
    '4-3-3': { DF: 4, MC: 3, DL: 3, PT: 1 },
    '5-3-2': { DF: 5, MC: 3, DL: 2, PT: 1 },
    '5-2-3': { DF: 5, MC: 2, DL: 3, PT: 1 }
};

/**
 * Infers the closest valid formation based on the current composition of starters.
 * Resolves the issue of stateless persistence by calculating the formation layout directly from data.
 * @param {Array} roster - The array of all roster players.
 * @returns {string} The formation key (e.g. '4-4-2').
 */
function inferFormation(roster) {
    const starters = roster.filter(p => p.is_starter);
    if (!starters.length) return '4-4-2'; // Default empty

    const counts = { DF: 0, MC: 0, DL: 0 };
    for (const p of starters) {
        if (counts[p.position] !== undefined) counts[p.position]++;
    }

    // 1. Try to find exact match
    for (const [key, layout] of Object.entries(AVAILABLE_FORMATIONS)) {
        if (layout.DF === counts.DF && layout.MC === counts.MC && layout.DL === counts.DL) {
            return key;
        }
    }

    // 2. Try to find a formation that satisfies current counts (incomplete lineup)
    for (const [key, layout] of Object.entries(AVAILABLE_FORMATIONS)) {
        if (layout.DF >= counts.DF && layout.MC >= counts.MC && layout.DL >= counts.DL) {
            return key;
        }
    }

    // fallback
    return '4-4-2';
}

/**
 * Applies a new formation mathematically, demoting excess players iteratively to the bench.
 * @param {Array} roster - Existing roster array.
 * @param {string} newFormationKey - Targeted formation (e.g., '3-4-3').
 * @returns {Array} List of player IDs to demote (they exceeded the positional limit).
 */
function calcFormationDemotions(roster, newFormationKey) {
    const layout = AVAILABLE_FORMATIONS[newFormationKey];
    if (!layout) return [];

    const startersByPos = { PT: [], DF: [], MC: [], DL: [] };
    
    // Solo tomamos a los que son titulares
    roster.filter(p => p.is_starter).forEach(p => {
        if (startersByPos[p.position]) startersByPos[p.position].push(p);
    });

    const toDemote = [];

    for (const pos of ['PT', 'DF', 'MC', 'DL']) {
        const limit = layout[pos] || 0;
        const currentStarters = startersByPos[pos];
        
        while (currentStarters.length > limit) {
            // Sacar al utlimo añadido
            const demoted = currentStarters.pop();
            toDemote.push(demoted.id);
        }
    }

    return toDemote;
}

window.AVAILABLE_FORMATIONS = AVAILABLE_FORMATIONS;
window.inferFormation = inferFormation;
window.calcFormationDemotions = calcFormationDemotions;
