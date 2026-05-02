let supabasePromise = null;

const TAB_CLASSES = {
    active: 'tab-btn tab-btn-active',
    inactive: 'tab-btn tab-btn-inactive',
};

const AUTH_COOLDOWN_STORAGE_KEY = 'retroFantasy.authCooldowns';
const AUTH_SHARED_COOLDOWN_MS = 2 * 60 * 1000;
const AUTH_EMAIL_COOLDOWN_MS = 60 * 1000;
const AUTH_MIN_RETRY_DELAY_MS = 2500;

const authActionState = {
    login: { inFlight: false, lastAttemptAt: 0 },
    register: { inFlight: false, lastAttemptAt: 0 },
    forgot: { inFlight: false, lastAttemptAt: 0 },
};

async function getSupabaseClient() {
    if (!supabasePromise) {
        supabasePromise = import('./supabase.js')
            .then(({ supabase }) => supabase)
            .catch((error) => {
                supabasePromise = null;
                throw error;
            });
    }

    return supabasePromise;
}

function readAuthCooldowns() {
    try {
        const raw = window.localStorage.getItem(AUTH_COOLDOWN_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function writeAuthCooldowns(cooldowns) {
    try {
        window.localStorage.setItem(AUTH_COOLDOWN_STORAGE_KEY, JSON.stringify(cooldowns));
    } catch {
    }
}

function getCooldownRemainingMs(action) {
    const cooldowns = readAuthCooldowns();
    const cooldownUntil = Number(cooldowns[action] ?? 0);

    if (!cooldownUntil || cooldownUntil <= Date.now()) {
        if (cooldownUntil) {
            delete cooldowns[action];
            writeAuthCooldowns(cooldowns);
        }
        return 0;
    }

    return cooldownUntil - Date.now();
}

function setCooldown(action, durationMs) {
    const cooldowns = readAuthCooldowns();
    cooldowns[action] = Date.now() + durationMs;
    writeAuthCooldowns(cooldowns);
}

function applySharedAuthCooldown() {
    setCooldown('login', AUTH_SHARED_COOLDOWN_MS);
    setCooldown('register', AUTH_SHARED_COOLDOWN_MS);
}

function isRateLimitError(error) {
    const msg = error?.message?.toLowerCase() ?? '';
    return msg.includes('too many requests') || msg.includes('rate limit');
}

function maskEmail(email) {
    if (!email || !email.includes('@')) return null;

    const [localPart, domain] = email.split('@');
    if (!localPart || !domain) return null;

    const visible = localPart.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(1, localPart.length - visible.length))}@${domain}`;
}

function logAuthError(context, error, email = null) {
    console.warn(`[Auth:${context}]`, {
        message: error?.message ?? null,
        status: error?.status ?? null,
        code: error?.code ?? null,
        name: error?.name ?? null,
        email: maskEmail(email),
    });
}

function formatRetryTime(ms) {
    const totalSeconds = Math.max(1, Math.ceil(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    if (!minutes) return `${totalSeconds} s`;
    if (!seconds) return `${minutes} min`;
    return `${minutes} min ${seconds} s`;
}

function blockIfCooldownActive(action, messageId) {
    const remainingMs = getCooldownRemainingMs(action);
    if (!remainingMs) return false;

    showMessage(
        messageId,
        `Demasiados intentos desde esta red o este correo. Espera ${formatRetryTime(remainingMs)} e intentalo de nuevo.`
    );
    return true;
}

function beginAuthAction(action, messageId) {
    const state = authActionState[action];
    if (!state) return true;

    if (state.inFlight) return false;
    if (blockIfCooldownActive(action, messageId)) return false;

    const elapsedMs = Date.now() - state.lastAttemptAt;
    if (state.lastAttemptAt && elapsedMs < AUTH_MIN_RETRY_DELAY_MS) {
        showMessage(
            messageId,
            `Espera ${formatRetryTime(AUTH_MIN_RETRY_DELAY_MS - elapsedMs)} antes de volver a intentarlo.`
        );
        return false;
    }

    state.inFlight = true;
    state.lastAttemptAt = Date.now();
    return true;
}

function endAuthAction(action) {
    if (authActionState[action]) authActionState[action].inFlight = false;
}

export function switchTab(activeTabId) {
    // La barra de pestañas se oculta cuando se muestra el panel "forgot" (sin pestaña propia)
    const tabsBar = document.getElementById('tabs-bar');
    if (tabsBar) tabsBar.classList.toggle('hidden', activeTabId === 'forgot');

    const config = {
        login:    { tab: document.getElementById('tab-login'),    panel: document.getElementById('panel-login') },
        register: { tab: document.getElementById('tab-register'), panel: document.getElementById('panel-register') },
        forgot:   { tab: null,                                     panel: document.getElementById('panel-forgot') },
    };

    for (const [id, { tab, panel }] of Object.entries(config)) {
        if (!panel) continue;
        const isActive = id === activeTabId;
        panel.classList.toggle('hidden', !isActive);
        if (tab) tab.className = isActive ? TAB_CLASSES.active : TAB_CLASSES.inactive;
    }
}

function showMessage(elementId, message, isSuccess = false) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.textContent = message;
    el.className = `text-sm font-bold text-center mt-1 ${isSuccess ? 'text-green-400' : 'text-red-400'}`;
}

function hideMessage(elementId) {
    const el = document.getElementById(elementId);
    if (!el) return;

    el.classList.add('hidden');
    el.textContent = '';
}

function setLoading(button, loading, defaultText) {
    if (!button) return;

    button.disabled = loading;
    button.textContent = loading ? 'Un momento...' : defaultText;
}

/**
 * Traduce los códigos de error de Supabase Auth a mensajes claros en español.
 * SRP: única función responsable del mapeo de errores de autenticación.
 */
function mapAuthError(error) {
    if (!error?.message) return 'Error inesperado. Intentalo de nuevo.';
    const msg = error.message.toLowerCase();

    if (msg.includes('user already registered') || msg.includes('already been registered'))
        return 'Este correo ya tiene una cuenta. Inicia sesión o recupera tu contraseña.';
    if (isRateLimitError(error))
        return 'Demasiados intentos desde esta red o este correo. Espera unos minutos e intentalo de nuevo.';
    if (msg.includes('invalid email') || msg.includes('unable to validate email'))
        return 'El formato del correo no es válido.';
    if (msg.includes('password') && msg.includes('characters'))
        return 'La contraseña no cumple los requisitos de seguridad.';
    if (msg.includes('email not confirmed'))
        return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
    if (msg.includes('invalid login credentials') || msg.includes('invalid password'))
        return 'Email o contraseña incorrectos.';
    if (msg.includes('duplicate') || msg.includes('unique'))
        return 'El nombre de usuario ya está en uso. Elige otro.';

    // Fallback: mostrar el mensaje original en consola para depuración
    console.error('[Auth] Error de Supabase:', error.message);
    return 'Error al conectar. Intentalo de nuevo.';
}

export async function handleLogin(event) {
    event.preventDefault();
    hideMessage('login-error-message');

    const email = document.getElementById('login-email')?.value.trim() ?? '';
    const password = document.getElementById('login-password')?.value ?? '';

    if (!email || !password) {
        showMessage('login-error-message', 'Introduce tu email y contrasena.');
        return;
    }

    const button = event.target?.querySelector('[type="submit"]');
    if (!beginAuthAction('login', 'login-error-message')) return;
    setLoading(button, true, 'Entrar al Vestuario');

    try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            logAuthError('login', error, email);
            if (isRateLimitError(error)) applySharedAuthCooldown();
            showMessage('login-error-message', mapAuthError(error));
            return;
        }

        window.location.href = 'app.html';
    } catch (error) {
        logAuthError('login-unexpected', error, email);
        console.error('[Auth] Error al iniciar sesion:', error);
        showMessage('login-error-message', 'El servidor se esta iniciando. Espera unos segundos y vuelve a intentarlo.');
    } finally {
        endAuthAction('login');
        setLoading(button, false, 'Entrar al Vestuario');
    }
}

export async function handleRegister(event) {
    event.preventDefault();
    hideMessage('register-error-message');

    const username = document.getElementById('register-username')?.value.trim() ?? '';
    const email = document.getElementById('register-email')?.value.trim() ?? '';
    const password = document.getElementById('register-password')?.value ?? '';
    const passwordConfirm = document.getElementById('register-password-confirm')?.value ?? '';

    if (!username) {
        showMessage('register-error-message', 'El nombre de usuario es obligatorio.');
        return;
    }

    if (password !== passwordConfirm) {
        showMessage('register-error-message', 'Las contrasenas no coinciden.');
        return;
    }

    if (password.length < 8) {
        showMessage('register-error-message', 'La contrasena debe tener al menos 8 caracteres.');
        return;
    }

    const button = event.target?.querySelector('[type="submit"]');
    if (!beginAuthAction('register', 'register-error-message')) return;
    setLoading(button, true, 'Crear Cuenta');

    try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } },
        });

        if (error) {
            logAuthError('register', error, email);
            if (isRateLimitError(error)) applySharedAuthCooldown();
            showMessage('register-error-message', mapAuthError(error));
            return;
        }

        switchTab('login');
        showMessage('login-error-message', '\u2713 Cuenta creada. Revisa tu email para verificarla.', true);
    } catch (error) {
        logAuthError('register-unexpected', error, email);
        console.error('[Auth] Error al registrarse:', error);
        showMessage('register-error-message', 'No se pudo conectar con el servicio de acceso. Intentalo de nuevo.');
    } finally {
        endAuthAction('register');
        setLoading(button, false, 'Crear Cuenta');
    }
}

export async function handleForgotPassword(event) {
    event.preventDefault();
    hideMessage('forgot-error-message');

    const email = document.getElementById('forgot-email')?.value.trim() ?? '';
    if (!email) {
        showMessage('forgot-error-message', 'Introduce tu email.');
        return;
    }

    const button = event.target?.querySelector('[type="submit"]');
    if (!beginAuthAction('forgot', 'forgot-error-message')) return;
    setLoading(button, true, 'Enviar Enlace');

    try {
        const supabase    = await getSupabaseClient();
        // usar frontendUrl del servidor en lugar de window.location.origin
        // para que funcione correctamente tanto en local como en producción
        const frontendUrl = window.__ENV__?.frontendUrl ?? window.__ENV__?.data?.frontendUrl ?? window.location.origin;
        const redirectTo  = `${frontendUrl}/reset-password.html`;
        const { error }  = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) {
            logAuthError('forgot-password', error, email);
            if (isRateLimitError(error)) {
                setCooldown('forgot', AUTH_EMAIL_COOLDOWN_MS);
                showMessage(
                    'forgot-error-message',
                    `Has solicitado demasiados enlaces seguidos. Espera ${formatRetryTime(AUTH_EMAIL_COOLDOWN_MS)} e intentalo de nuevo.`
                );
                return;
            }

            showMessage('forgot-error-message', 'No se pudo enviar el correo. Intentalo de nuevo.');
            return;
        }

        setCooldown('forgot', AUTH_EMAIL_COOLDOWN_MS);

        // Mensaje genérico por seguridad: no revelar si el email existe o no
        switchTab('login');
        showMessage('login-error-message', 'Si el correo esta registrado, recibiras un enlace de recuperacion.', true);
    } catch (err) {
        logAuthError('forgot-password-unexpected', err, email);
        console.error('[Auth] Error en recuperacion de contrasena:', err);
        showMessage('forgot-error-message', 'Error al conectar con el servicio. Intentalo de nuevo.');
    } finally {
        endAuthAction('forgot');
        setLoading(button, false, 'Enviar Enlace');
    }
}

export async function handleLogout() {
    const supabase = await getSupabaseClient();
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

window.handleLogout = handleLogout;

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('tab-login')?.addEventListener('click',       () => switchTab('login'));
    document.getElementById('tab-register')?.addEventListener('click',    () => switchTab('register'));
    document.getElementById('link-forgot-password')?.addEventListener('click', (e) => { e.preventDefault(); switchTab('forgot'); });
    document.getElementById('btn-back-to-login')?.addEventListener('click', () => switchTab('login'));

    document.getElementById('form-login')?.addEventListener('submit',    handleLogin);
    document.getElementById('form-register')?.addEventListener('submit', handleRegister);
    document.getElementById('form-forgot')?.addEventListener('submit',   handleForgotPassword);
});
