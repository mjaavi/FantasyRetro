import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

function normalizeEnv(rawEnv) {
    const base = rawEnv && typeof rawEnv === 'object' ? rawEnv : {};
    const nested = base.data && typeof base.data === 'object' ? base.data : {};

    return {
        ...base,
        ...nested,
        apiUrl: nested.apiUrl ?? base.apiUrl ?? 'http://localhost:3000/api',
        supabaseUrl: nested.supabaseUrl ?? base.supabaseUrl ?? null,
        supabaseAnonKey:
            nested.supabaseAnonKey ??
            nested.supabaseKey ??
            base.supabaseAnonKey ??
            base.supabaseKey ??
            null,
    };
}

async function waitForEnv(timeoutMs = 5000) {
    const currentEnv = normalizeEnv(window.__ENV__);
    if (currentEnv.supabaseUrl && currentEnv.supabaseAnonKey) {
        window.__ENV__ = currentEnv;
        return currentEnv;
    }

    return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            const env = normalizeEnv(window.__ENV__);

            if (env.supabaseUrl && env.supabaseAnonKey) {
                clearInterval(interval);
                window.__ENV__ = env;
                resolve(env);
                return;
            }

            if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error('Timeout: /api/config no respondio en 5 segundos.'));
            }
        }, 50);
    });
}

const env = await waitForEnv();
window.__ENV__ = env;

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey);
