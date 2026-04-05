import { supabase } from './supabase.js';
import { formatCurrency } from './market-renderer.js';

function normalizeBudget(value) {
    const numericValue = Number(value);
    return Number.isFinite(numericValue) ? numericValue : null;
}

export function renderNavbarBudget(value) {
    const budget = normalizeBudget(value);
    const element = document.getElementById('user-budget');

    if (!element || budget === null) {
        return false;
    }

    element.textContent = `${formatCurrency(budget)} €`;
    element.dataset.budget = String(budget);
    return true;
}

async function fetchCurrentUserBudget() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user?.id) {
        return null;
    }

    const { data, error } = await supabase
        .from('profiles')
        .select('budget')
        .eq('id', session.user.id)
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
