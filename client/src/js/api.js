import { supabase } from './supabase.js';
import { getEnv } from './env.js';

// Cache en memoria (TTL = 5 minutos)
// Evita peticiones redundantes al servidor para datos que cambian poco.
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(key) {
    const entry = cache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}

function setCached(key, data) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCache(key) {
    cache.delete(key);
}

// Token de autenticacion
// Usamos supabase.auth.getSession() en lugar de leer localStorage directamente.
// Supabase v2 gestiona internamente la key de almacenamiento (varia por proyecto),
// asi que acceder a localStorage con una key hardcodeada siempre falla.
async function getAuthToken() {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
}

// Cliente HTTP base
export async function apiFetch(endpoint, options = {}) {
    const env = await getEnv();
    const token = await getAuthToken();

    const headers = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
    };

    const response = await fetch(`${env.apiUrl}${endpoint}`, { ...options, headers });
    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? `Error HTTP ${response.status}`);
    }

    return data;
}

// Endpoints del mercado

/** Jugadores del mercado con cache de 5 minutos */
/** Jugadores del mercado activo de una liga */
export async function fetchMarketPlayers(leagueId, page = 0) {
    if (!leagueId) return [];

    const cacheKey = `league-market-${leagueId}-${page}`;
    const cached   = getCached(cacheKey);
    if (cached?.length) return cached;  // Solo usar cache si tiene datos reales

    const result = await apiFetch(`/leagues/${leagueId}/market`);
    if (result.data?.length) {
        setCached(cacheKey, result.data);  // Solo cachear si hay jugadores
    }
    return result.data ?? [];
}

/** Pujas del usuario en el mercado de su liga */
export async function fetchUserBids(leagueId) {
    if (!leagueId) return [];
    return (await apiFetch(`/leagues/${leagueId}/market/bids`)).data ?? [];
}

/** Registra o actualiza una puja en la liga */
export async function submitBidRequest(leagueId, playerApiId, amount) {
    const result = await apiFetch(`/leagues/${leagueId}/market/bids`, {
        method: 'POST',
        body: JSON.stringify({ playerApiId, amount }),
    });
    invalidateCache(`league-market-${leagueId}-0`);
    return result;
}

/** Cancela una puja en la liga */
export async function cancelBidRequest(leagueId, playerApiId) {
    const result = await apiFetch(`/leagues/${leagueId}/market/bids/${playerApiId}`, {
        method: 'DELETE',
    });
    invalidateCache(`league-market-${leagueId}-0`);
    return result;
}


// Endpoints de ligas

/** Temporadas historicas disponibles del dataset Kaggle */
export async function fetchTemporadas() {
    return (await apiFetch('/temporadas')).data;
}

/** Ligas en las que participa el usuario */
export async function fetchMisLigas() {
    return (await apiFetch('/leagues')).data;
}

/** Detalles de una liga y sus participantes */
export async function fetchLiga(leagueId) {
    return (await apiFetch(`/leagues/${leagueId}`)).data;
}

/** Crea una nueva liga */
export async function crearLiga(nombre, season, kaggleLeagueId) {
    return (await apiFetch('/leagues', {
        method: 'POST',
        body: JSON.stringify({ nombre, season, kaggleLeagueId }),
    })).data;
}

/** Une al usuario a una liga con su codigo de invitacion */
export async function unirseALiga(inviteCode) {
    return (await apiFetch('/leagues/join', {
        method: 'POST',
        body: JSON.stringify({ inviteCode }),
    })).data;
}

// Endpoints de plantilla

/** Plantilla completa del usuario en una liga */
export async function fetchRoster(leagueId) {
    return (await apiFetch(`/roster/${leagueId}`)).data;
}

/** Resumen de puntos de la plantilla del usuario */
export async function fetchRosterScores(leagueId) {
    return (await apiFetch(`/roster/${leagueId}/scores`)).data;
}

/** Cambia el estado titular/suplente de un jugador */
export async function toggleStarter(leagueId, playerApiId, isStarter) {
    return apiFetch(`/roster/${leagueId}/${playerApiId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_starter: isStarter }),
    });
}
