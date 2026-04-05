/**
 * reset-password.js
 *
 * Responsabilidad única: gestionar el flujo de restablecimiento de contraseña
 * cuando el usuario llega desde el enlace enviado por Supabase.
 *
 * Flujo (Supabase v2 con PKCE):
 *   1. Supabase redirige a esta página con ?code=XXX en la URL
 *   2. El cliente Supabase intercambia el code por una sesión automáticamente
 *   3. onAuthStateChange dispara el evento PASSWORD_RECOVERY
 *   4. El usuario introduce la nueva contraseña y llamamos a updateUser()
 */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// ── Helpers de UI ─────────────────────────────────────────────────────────────

/** Oculta todos los estados y muestra únicamente el solicitado. */
function showState(stateId) {
    ['state-loading', 'state-invalid', 'state-form', 'state-success'].forEach(id => {
        document.getElementById(id)?.classList.toggle('hidden', id !== stateId);
    });
}

function showError(message) {
    const el = document.getElementById('reset-error-message');
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
}

function hideError() {
    document.getElementById('reset-error-message')?.classList.add('hidden');
}

function setLoading(loading) {
    const btn = document.getElementById('reset-submit-btn');
    if (!btn) return;
    btn.disabled  = loading;
    btn.textContent = loading ? 'Guardando…' : 'Guardar nueva contraseña';
}

// ── Config y cliente Supabase ─────────────────────────────────────────────────

/**
 * Espera a que window.__ENV__ esté disponible (inyectado por el fetch a /api/config).
 * Mismo patrón que supabase.js del cliente para no duplicar lógica (DRY).
 */
async function waitForEnv(timeoutMs = 5000) {
    const env = window.__ENV__;
    if (env?.supabaseUrl && (env?.supabaseAnonKey ?? env?.supabaseKey)) return env;

    return new Promise((resolve, reject) => {
        const start = Date.now();
        const interval = setInterval(() => {
            const e = window.__ENV__;
            const key = e?.supabaseAnonKey ?? e?.supabaseKey ?? e?.data?.supabaseAnonKey ?? e?.data?.supabaseKey;
            const url = e?.supabaseUrl ?? e?.data?.supabaseUrl;

            if (url && key) {
                clearInterval(interval);
                resolve({ supabaseUrl: url, supabaseAnonKey: key });
                return;
            }

            if (Date.now() - start > timeoutMs) {
                clearInterval(interval);
                reject(new Error('Timeout: /api/config no respondió.'));
            }
        }, 50);
    });
}

// ── Inicialización ────────────────────────────────────────────────────────────

async function init() {
    let supabase;

    try {
        const env = await waitForEnv();
        supabase  = createClient(env.supabaseUrl, env.supabaseAnonKey);
    } catch (err) {
        console.error('[ResetPassword] No se pudo inicializar Supabase:', err);
        showState('state-invalid');
        return;
    }

    // Supabase v2 detecta el ?code= de la URL y emite PASSWORD_RECOVERY automáticamente.
    // Si el token es inválido/expirado, emite SIGNED_OUT o no emite nada → mostramos error.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
            showState('state-form');

        } else if (event === 'SIGNED_IN' && session) {
            // En algunos flujos el evento es SIGNED_IN en lugar de PASSWORD_RECOVERY.
            // Esto ocurre cuando el usuario ya tenía sesión abierta; seguimos mostrando el form.
            showState('state-form');

        } else if (event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED') {
            // No hay sesión válida tras el intercambio → enlace inválido
            showState('state-invalid');
        }
    });

    // Timeout de seguridad: si en 8 s no llegó ningún evento de auth, mostramos error.
    const safetyTimeout = setTimeout(() => {
        const currentState = document.querySelector('[id^="state-"]:not(.hidden)')?.id;
        if (currentState === 'state-loading') {
            showState('state-invalid');
        }
    }, 8000);

    // ── Formulario de nueva contraseña ────────────────────────────────────────

    document.getElementById('form-reset')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        hideError();

        const password        = document.getElementById('reset-password')?.value ?? '';
        const passwordConfirm = document.getElementById('reset-password-confirm')?.value ?? '';

        if (password.length < 8) {
            showError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (password !== passwordConfirm) {
            showError('Las contraseñas no coinciden.');
            return;
        }

        setLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password });

            if (error) {
                showError('No se pudo actualizar la contraseña. El enlace puede haber expirado.');
                return;
            }

            clearTimeout(safetyTimeout);
            subscription.unsubscribe();
            await supabase.auth.signOut();
            showState('state-success');

        } catch (err) {
            console.error('[ResetPassword] Error al actualizar:', err);
            showError('Error inesperado. Inténtalo de nuevo.');
        } finally {
            setLoading(false);
        }
    });
}

init();
