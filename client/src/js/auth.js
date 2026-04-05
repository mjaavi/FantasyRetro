let supabasePromise = null;

const TAB_CLASSES = {
    active: 'tab-btn tab-btn-active',
    inactive: 'tab-btn tab-btn-inactive',
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
    if (msg.includes('email rate limit') || msg.includes('too many requests'))
        return 'Demasiados intentos. Espera unos minutos e intentalo de nuevo.';
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
    setLoading(button, true, 'Entrar al Vestuario');

    try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showMessage('login-error-message', mapAuthError(error));
            return;
        }

        window.location.href = 'app.html';
    } catch (error) {
        console.error('[Auth] Error al iniciar sesion:', error);
        showMessage('login-error-message', 'No se pudo conectar con el servicio de acceso. Intentalo de nuevo.');
    } finally {
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
    setLoading(button, true, 'Crear Cuenta');

    try {
        const supabase = await getSupabaseClient();
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { username } },
        });

        if (error) {
            showMessage('register-error-message', mapAuthError(error));
            return;
        }

        switchTab('login');
        showMessage('login-error-message', '\u2713 Cuenta creada. Revisa tu email para verificarla.', true);
    } catch (error) {
        console.error('[Auth] Error al registrarse:', error);
        showMessage('register-error-message', 'No se pudo conectar con el servicio de acceso. Intentalo de nuevo.');
    } finally {
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
    setLoading(button, true, 'Enviar Enlace');

    try {
        const supabase    = await getSupabaseClient();
        // usar frontendUrl del servidor en lugar de window.location.origin
        // para que funcione correctamente tanto en local como en producción
        const frontendUrl = window.__ENV__?.frontendUrl ?? window.__ENV__?.data?.frontendUrl ?? window.location.origin;
        const redirectTo  = `${frontendUrl}/reset-password.html`;
        const { error }  = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

        if (error) {
            showMessage('forgot-error-message', 'No se pudo enviar el correo. Intentalo de nuevo.');
            return;
        }

        // Mensaje genérico por seguridad: no revelar si el email existe o no
        switchTab('login');
        showMessage('login-error-message', 'Si el correo esta registrado, recibiras un enlace de recuperacion.', true);
    } catch (err) {
        console.error('[Auth] Error en recuperacion de contrasena:', err);
        showMessage('forgot-error-message', 'Error al conectar con el servicio. Intentalo de nuevo.');
    } finally {
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
