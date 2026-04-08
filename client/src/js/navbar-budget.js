import { supabase } from './supabase.js';
import { formatCurrency } from './market-renderer.js';

let lastBudgetValue = null;
let resizeListenerBound = false;

function normalizeBudget(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

function trimCompact(value) {
    const absValue = Math.abs(value);
    const digits = absValue >= 100 ? 0 : absValue >= 10 ? 1 : 2;
    return Number(value.toFixed(digits)).toString();
}

function formatCompactBudget(value) {
    const absValue = Math.abs(value);

    if (absValue >= 1_000_000_000) {
        return `${trimCompact(value / 1_000_000_000)}B`;
    }
    if (absValue >= 1_000_000) {
        return `${trimCompact(value / 1_000_000)}M`;
    }
    if (absValue >= 1_000) {
        return `${trimCompact(value / 1_000)}K`;
    }

    return `${Math.trunc(value)}`;
}

function isMobileBudgetLayout() {
    return typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches;
}

function applyBudgetText(element, budget) {
    element.textContent = isMobileBudgetLayout()
        ? formatCompactBudget(budget)
        : `${formatCurrency(budget)} €`;
    element.title = `${formatCurrency(budget)} €`;
}

function ensureResizeBinding() {
    if (resizeListenerBound || typeof window === 'undefined') {
        return;
    }

    window.addEventListener('resize', () => {
        if (lastBudgetValue === null) return;

        const element = document.getElementById('user-budget');
        if (!element) return;

        applyBudgetText(element, lastBudgetValue);
    }, { passive: true });

    resizeListenerBound = true;
}

export function renderNavbarBudget(value) {
    const budget = normalizeBudget(value);
    const element = document.getElementById('user-budget');

    if (!element || budget === null) {
        return false;
    }

    lastBudgetValue = budget;
    ensureResizeBinding();
    applyBudgetText(element, budget);
    element.dataset.budget = String(budget);
    return true;
}

async function fetchCurrentUserBudget() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
        return null;
    }

    const ligaStr = sessionStorage.getItem('ligaActiva');
    if (!ligaStr) return null;

    let liga;
    try {
        liga = JSON.parse(ligaStr);
    } catch {
        return null;
    }

    if (!liga?.id) return null;

    const { data, error } = await supabase
        .from('league_participants')
        .select('budget')
        .eq('user_id', session.user.id)
        .eq('league_id', liga.id)
        .single();

    if (error) {
        throw new Error(error.message);
    }

    return normalizeBudget(data?.budget);
}

export async function refreshNavbarBudget() {
    try {
        const budget = await fetchCurrentUserBudget();
        renderNavbarBudget(budget);
        return budget;
    } catch (error) {
        console.error('[NavbarBudget] Error al refrescar presupuesto:', error.message ?? error);
        return null;
    }
}

export async function syncNavbarBudget(nextBudget = null) {
    const budget = normalizeBudget(nextBudget);
    if (budget !== null) {
        renderNavbarBudget(budget);
        return budget;
    }

    return refreshNavbarBudget();
}
