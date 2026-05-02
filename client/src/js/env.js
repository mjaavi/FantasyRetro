const PROD_CONFIG_URL = 'https://fantasyretro.onrender.com/api/config';
const DEV_CONFIG_URL = 'http://localhost:3000/api/config';
const CONFIG_FETCH_TIMEOUT_MS = 25000;
const CONFIG_RETRY_DELAY_MS = 3000;
const CONFIG_MAX_RETRIES = 1;

let envPromise = null;

function getWindowOrigin() {
    const origin = window.location?.origin;
    return origin && origin !== 'null' ? origin : null;
}

function getDefaultApiUrl() {
    const origin = getWindowOrigin();
    return origin ? new URL('/api', origin).toString() : 'http://localhost:3000/api';
}

function getDefaultFrontendUrl() {
    return getWindowOrigin() ?? 'http://localhost:3000';
}

function hasSupabaseConfig(env) {
    return Boolean(env?.supabaseUrl && env?.supabaseAnonKey);
}

function unique(values) {
    return [...new Set(values.filter(Boolean))];
}

function buildConfigCandidates() {
    const origin = getWindowOrigin();
    const isLocalOrigin = /:\/\/(localhost|127\.0\.0\.1)(?::|\/|$)/i.test(origin ?? '');
    const fallbackUrls = isLocalOrigin
        ? [DEV_CONFIG_URL, PROD_CONFIG_URL]
        : [PROD_CONFIG_URL];

    return unique([
        origin ? new URL('/api/config', origin).toString() : null,
        ...fallbackUrls,
    ]);
}

async function fetchJsonWithTimeout(url, timeoutMs = CONFIG_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(url, {
            headers: { Accept: 'application/json' },
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const contentType = response.headers.get('content-type') ?? '';
        if (!contentType.includes('application/json')) {
            throw new Error(`Respuesta no es JSON (Content-Type: ${contentType}) desde ${url}`);
        }

        const env = normalizeEnv(await response.json());
        if (!hasSupabaseConfig(env)) {
            throw new Error('La respuesta de /api/config no incluye credenciales de Supabase.');
        }

        return env;
    } catch (error) {
        if (error?.name === 'AbortError') {
            throw new Error(`Timeout al cargar ${url}`);
        }

        throw error;
    } finally {
        window.clearTimeout(timeoutId);
    }
}

function publishEnv(env) {
    window.__ENV__ = env;
    return env;
}

export function normalizeEnv(rawEnv) {
    const base = rawEnv && typeof rawEnv === 'object' ? rawEnv : {};
    const nested = base.data && typeof base.data === 'object' ? base.data : {};

    return {
        ...base,
        ...nested,
        apiUrl: nested.apiUrl ?? base.apiUrl ?? getDefaultApiUrl(),
        frontendUrl: nested.frontendUrl ?? base.frontendUrl ?? getDefaultFrontendUrl(),
        supabaseUrl: nested.supabaseUrl ?? base.supabaseUrl ?? null,
        supabaseAnonKey: nested.supabaseAnonKey ?? base.supabaseAnonKey ?? null,
    };
}

export async function getEnv() {
    const currentEnv = normalizeEnv(window.__ENV__);
    if (hasSupabaseConfig(currentEnv)) {
        return publishEnv(currentEnv);
    }

    if (!envPromise) {
        envPromise = (async () => {
            let lastError = null;

            for (let attempt = 0; attempt <= CONFIG_MAX_RETRIES; attempt++) {
                if (attempt > 0) {
                    console.info(`[Env] Reintentando carga de configuracion (intento ${attempt + 1})...`);
                    await new Promise((r) => setTimeout(r, CONFIG_RETRY_DELAY_MS));
                }

                for (const url of buildConfigCandidates()) {
                    try {
                        return publishEnv(await fetchJsonWithTimeout(url));
                    } catch (error) {
                        lastError = error;
                        console.warn(`[Env] No se pudo cargar la configuracion desde ${url}:`, error);
                    }
                }
            }

            throw lastError ?? new Error('No se pudo cargar la configuracion de la aplicacion.');
        })();
    }

    try {
        return await envPromise;
    } catch (error) {
        envPromise = null;
        throw error;
    }
}

export async function getApiBaseUrl() {
    return (await getEnv()).apiUrl;
}

export function getApiBaseUrlSync() {
    return normalizeEnv(window.__ENV__).apiUrl;
}
