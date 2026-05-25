import { supabase } from './supabase.js';
import { apiFetch } from './api.js';

const fmt = n => new Intl.NumberFormat('es-ES').format(n);

function getInitials(name) {
    return (name ?? '?').split(' ').map(w => w[0] ?? '').join('').substring(0, 2).toUpperCase();
}

function showMsg(id, text, isErr = false) {
    const el = document.getElementById(id);
    if (!el) return;
    if (text) el.textContent = text;
    el.className = `text-sm font-bold mt-1 ${isErr ? 'text-red-400' : 'text-green-400'}`;
    el.classList.remove('hidden');
    if (!isErr) setTimeout(() => el.classList.add('hidden'), 3000);
}

function hideMsg(id) {
    document.getElementById(id)?.classList.add('hidden');
}

// ── Tabs ──────────────────────────────────────────────────────────────────────

export function showProfileTab(tabId) {
    ['tab-cuenta', 'tab-seguridad', 'tab-soporte'].forEach(id => {
        document.getElementById(id)?.classList.add('hidden');
    });
    ['profile-nav-cuenta', 'profile-nav-seguridad', 'profile-nav-soporte'].forEach(id => {
        document.getElementById(id)?.classList.remove('profile-nav-btn-active');
    });

    document.getElementById(tabId)?.classList.remove('hidden');
    const navId = tabId.replace('tab-', 'profile-nav-');
    document.getElementById(navId)?.classList.add('profile-nav-btn-active');
}

// ── Carga del perfil ──────────────────────────────────────────────────────────

export async function loadProfile() {
    showProfileTab('tab-cuenta');

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const emailEl = document.getElementById('profile-email');
        if (emailEl) emailEl.textContent = session.user.email ?? '—';

        const { data: profile } = await supabase
            .from('profiles')
            .select('username, team_name, budget, avatar_url')
            .eq('id', session.user.id)
            .single();

        if (!profile) return;

        const username = profile.username ?? session.user.email?.split('@')[0] ?? '?';

        const avatarEl   = document.getElementById('profile-avatar');
        const usernameEl = document.getElementById('profile-username');
        const teamEl     = document.getElementById('profile-team-name');
        const usernameInput = document.getElementById('profile-username-input');
        const budgetEl   = document.getElementById('profile-budget');

        if (avatarEl) {
            if (profile.avatar_url) {
                avatarEl.textContent = '';
                let url = profile.avatar_url;
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.set('t', Date.now().toString());
                    url = urlObj.toString();
                } catch (e) {
                    url = `${url}?t=${Date.now()}`;
                }
                avatarEl.style.backgroundImage = `url("${url}")`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
            } else {
                avatarEl.style.backgroundImage = '';
                avatarEl.textContent = getInitials(username);
            }
        }

        // Actualizar también el avatar de la barra de navegación (#btn-perfil)
        const btnPerfil = document.getElementById('btn-perfil');
        if (btnPerfil) {
            if (profile.avatar_url) {
                btnPerfil.textContent = '';
                let url = profile.avatar_url;
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.set('t', Date.now().toString());
                    url = urlObj.toString();
                } catch (e) {
                    url = `${url}?t=${Date.now()}`;
                }
                btnPerfil.style.backgroundImage = `url("${url}")`;
                btnPerfil.style.backgroundSize = 'cover';
                btnPerfil.style.backgroundPosition = 'center';
            } else {
                btnPerfil.style.backgroundImage = '';
                btnPerfil.textContent = getInitials(username);
            }
        }

        if (usernameEl)    usernameEl.textContent     = username;
        if (usernameInput) usernameInput.value        = username;
        if (teamEl)        teamEl.value               = profile.team_name ?? '';
        if (budgetEl)      budgetEl.textContent       = `${fmt(profile.budget ?? 0)} €`;

    } catch (err) {
        console.error('[Profile]', err.message);
    }
}

export async function initProfileNav() {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data: profile } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', session.user.id)
            .single();

        if (!profile) return;

        const navBtn = document.getElementById('btn-perfil');
        if (navBtn) {
            if (profile.avatar_url) {
                console.log('[Profile Nav] Estableciendo avatar desde BD:', profile.avatar_url);
                navBtn.textContent = '';
                let url = profile.avatar_url;
                try {
                    const urlObj = new URL(url);
                    urlObj.searchParams.set('t', Date.now().toString());
                    url = urlObj.toString();
                } catch (e) {
                    url = `${url}?t=${Date.now()}`;
                }
                navBtn.style.backgroundImage = `url("${url}")`;
                navBtn.style.backgroundSize = 'cover';
                navBtn.style.backgroundPosition = 'center';
            } else {
                console.log('[Profile Nav] No hay avatar_url, usando iniciales');
                const username = profile.username ?? session.user.email?.split('@')[0] ?? '?';
                navBtn.textContent = getInitials(username);
                navBtn.style.backgroundImage = 'none';
            }
        }
    } catch (err) {
        console.error('[Profile Nav]', err.message);
    }
}

// ── Guardar nombre y equipo ───────────────────────────────────────────────────

export async function saveProfile() {
    const username = document.getElementById('profile-username-input')?.value?.trim();
    const teamName = document.getElementById('profile-team-name')?.value?.trim();
    const btn      = document.getElementById('profile-save-btn');

    hideMsg('profile-save-msg'); hideMsg('profile-save-err');
    if (!username && !teamName) return;
    if (btn) { btn.disabled = true; btn.textContent = 'Guardando...'; }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('No autenticado');

        const updates = {};
        if (username) updates.username  = username;
        if (teamName) updates.team_name = teamName;

        const { error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('id', session.user.id);

        if (error) throw new Error(error.message);

        // Actualizar UI
        const usernameEl = document.getElementById('profile-username');
        const avatarEl   = document.getElementById('profile-avatar');
        if (usernameEl && username) usernameEl.textContent = username;
        if (avatarEl   && username) avatarEl.textContent   = getInitials(username);

        showMsg('profile-save-msg', '✓ Cambios guardados');
    } catch (err) {
        showMsg('profile-save-err', err.message, true);
    } finally {
        if (btn) { btn.disabled = false; btn.textContent = 'Guardar Cambios'; }
    }
}

// ── Cambiar email ─────────────────────────────────────────────────────────────

export async function changeEmail() {
    const email = document.getElementById('new-email-input')?.value?.trim();
    hideMsg('email-change-msg'); hideMsg('email-change-err');

    if (!email) { showMsg('email-change-err', 'Introduce un correo válido.', true); return; }

    try {
        const { error } = await supabase.auth.updateUser({ email });
        if (error) throw new Error(error.message);
        showMsg('email-change-msg', '✓ Revisa tu bandeja de entrada para confirmar el cambio');
        document.getElementById('new-email-input').value = '';
    } catch (err) {
        showMsg('email-change-err', err.message, true);
    }
}

// ── Cambiar contraseña ────────────────────────────────────────────────────────

export async function changePassword() {
    const pwd     = document.getElementById('new-password-input')?.value;
    const confirm = document.getElementById('confirm-password-input')?.value;
    hideMsg('password-change-msg'); hideMsg('password-change-err');

    if (!pwd || pwd.length < 6) {
        showMsg('password-change-err', 'La contraseña debe tener al menos 6 caracteres.', true); return;
    }
    if (pwd !== confirm) {
        showMsg('password-change-err', 'Las contraseñas no coinciden.', true); return;
    }

    try {
        const { error } = await supabase.auth.updateUser({ password: pwd });
        if (error) throw new Error(error.message);
        showMsg('password-change-msg', '✓ Contraseña actualizada');
        document.getElementById('new-password-input').value = '';
        document.getElementById('confirm-password-input').value = '';
    } catch (err) {
        showMsg('password-change-err', err.message, true);
    }
}

// ── Subir foto de perfil ──────────────────────────────────────────────────────

export async function uploadAvatar(input) {
    const file = input.files?.[0];
    if (!file) return;

    // Límite de tamaño: 2MB
    if (file.size > 2 * 1024 * 1024) {
        alert('La imagen es demasiado grande. El límite es 2 MB.');
        return;
    }

    // Mostrar preview inmediato
    const reader = new FileReader();
    reader.onload = (e) => {
        const avatarEl = document.getElementById('profile-avatar');
        if (avatarEl) {
            avatarEl.innerHTML = '';
            avatarEl.style.backgroundImage = `url(${e.target.result})`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
        }
        
        // Actualizar navbar inmediatamente localmente
        const navBtn = document.getElementById('btn-perfil');
        if (navBtn) {
            navBtn.textContent = '';
            navBtn.style.backgroundImage = `url(${e.target.result})`;
            navBtn.style.backgroundSize = 'cover';
            navBtn.style.backgroundPosition = 'center';
        }
    };
    reader.readAsDataURL(file);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const ext      = file.name.split('.').pop();
        // Usar timestamp único evita conflictos RLS y refresca la caché al instante
        const fileName = `${session.user.id}_${Date.now()}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        const publicUrlWithBuster = `${publicUrl}?t=${Date.now()}`;

        const { error: updateError } = await supabase
            .from('profiles')
            .update({ avatar_url: publicUrlWithBuster })
            .eq('id', session.user.id);

        if (updateError) throw new Error(updateError.message);

        // Actualizar la barra de navegación (#btn-perfil) al instante
        const btnPerfil = document.getElementById('btn-perfil');
        if (btnPerfil) {
            btnPerfil.textContent = '';
            btnPerfil.style.backgroundImage = `url(${publicUrlWithBuster})`;
            btnPerfil.style.backgroundSize = 'cover';
            btnPerfil.style.backgroundPosition = 'center';
        }

    } catch (err) {
        console.error('[Profile] Error subiendo avatar:', err.message);
        alert('Hubo un error guardando el avatar: ' + err.message + '\n\nAsegúrate de que el bucket "avatars" de Supabase esté creado con acceso público.');
    }
}

// ── Soporte ───────────────────────────────────────────────────────────────────

export function showSupportAlert(text, isErr = false) {
    const container = document.getElementById('support-alert-container');
    const alertBox = document.getElementById('support-alert');
    const iconBox = document.getElementById('support-alert-icon');
    const textBox = document.getElementById('support-alert-text');

    if (!container || !alertBox || !iconBox || !textBox) return;

    textBox.textContent = text;

    if (isErr) {
        alertBox.className = 'flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-md bg-red-500/10 border-red-500/20 text-red-400 shadow-[0_0_20px_rgba(239,68,68,0.15)]';
        iconBox.innerHTML = `
            <svg class="w-5 h-5 text-red-400 animate-pulse" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
        `;
    } else {
        alertBox.className = 'flex items-center gap-3 p-4 rounded-2xl border backdrop-blur-md bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.15)]';
        iconBox.innerHTML = `
            <svg class="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
        `;
    }

    container.classList.remove('hidden');
    // Force layout reflow to allow transition
    container.offsetHeight; 
    container.classList.remove('scale-95', 'opacity-0');
    container.classList.add('scale-100', 'opacity-100');

    if (!isErr) {
        setTimeout(() => {
            container.classList.remove('scale-100', 'opacity-100');
            container.classList.add('scale-95', 'opacity-0');
            setTimeout(() => {
                container.classList.add('hidden');
            }, 300);
        }, 5000);
    }
}

export function hideSupportAlert() {
    const container = document.getElementById('support-alert-container');
    if (!container) return;
    container.classList.remove('scale-100', 'opacity-100');
    container.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        container.classList.add('hidden');
    }, 300);
}

export async function sendSupport() {
    const subject = document.getElementById('support-subject')?.value;
    const message = document.getElementById('support-message')?.value?.trim();
    const btn = document.querySelector('#tab-soporte button');
    
    hideSupportAlert();

    if (!message) { 
        showSupportAlert('Escribe un mensaje antes de enviar.', true); 
        return; 
    }

    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Enviando...
        `;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        const userEmail = session?.user?.email ?? 'anónimo';
        const userId = session?.user?.id ?? null;

        // Llamada a nuestro nuevo endpoint backend con Nodemailer y Supabase
        await apiFetch('/support/ticket', {
            method: 'POST',
            body: JSON.stringify({
                subject,
                message,
                email: userEmail,
                userId
            })
        });

        showSupportAlert('✓ Mensaje enviado. Te responderemos pronto.');
        const messageEl = document.getElementById('support-message');
        if (messageEl) messageEl.value = '';
        
    } catch (err) {
        console.error('[Soporte] Error enviando soporte:', err.message);
        showSupportAlert(err.message || 'Error al enviar el ticket. Inténtalo de nuevo.', true);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = 'Enviar Mensaje';
        }
    }
}

// ── Borrar cuenta ─────────────────────────────────────────────────────────────

export async function confirmarBorrarCuenta() {
    const confirmacion = prompt('Escribe "ELIMINAR" para confirmar que quieres borrar tu cuenta permanentemente:');
    if (confirmacion !== 'ELIMINAR') return;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Borrar datos del usuario
        await supabase.from('user_roster').delete().eq('user_id', session.user.id);
        await supabase.from('league_participants').delete().eq('user_id', session.user.id);
        await supabase.from('league_bids').delete().eq('user_id', session.user.id);

        // Cerrar sesión y redirigir
        await supabase.auth.signOut();
        window.location.href = 'index.html';
    } catch (err) {
        alert('Error al eliminar la cuenta: ' + err.message);
    }
}

// ── Cerrar sesión ─────────────────────────────────────────────────────────────

export async function cerrarSesion() {
    await supabase.auth.signOut();
    window.location.href = 'index.html';
}

// ── Global ────────────────────────────────────────────────────────────────────

window.saveProfile          = saveProfile;
window.cerrarSesion         = cerrarSesion;
window.loadProfile          = loadProfile;
window.showProfileTab       = showProfileTab;
window.changeEmail          = changeEmail;
window.changePassword       = changePassword;
window.uploadAvatar         = uploadAvatar;
window.sendSupport          = sendSupport;
window.confirmarBorrarCuenta = confirmarBorrarCuenta;
window.initProfileNav       = initProfileNav;

// Sobrescribir confirmarBorrarCuenta para usar el modal
window.confirmarBorrarCuenta = function() {
    document.getElementById('delete-account-password').value = '';
    document.getElementById('delete-account-err')?.classList.add('hidden');
    document.getElementById('modal-eliminar-cuenta').classList.remove('hidden');
};

window.ejecutarBorrarCuenta = async function() {
    const password = document.getElementById('delete-account-password')?.value;
    const errEl    = document.getElementById('delete-account-err');

    if (!password) {
        if (errEl) { errEl.textContent = 'Introduce tu contraseña.'; errEl.classList.remove('hidden'); }
        return;
    }

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Verificar contraseña intentando re-autenticar
        const { error: signInError } = await supabase.auth.signInWithPassword({
            email: session.user.email,
            password,
        });

        if (signInError) {
            if (errEl) { errEl.textContent = 'Contraseña incorrecta.'; errEl.classList.remove('hidden'); }
            return;
        }

        // Borrar datos del usuario
        await supabase.from('user_roster').delete().eq('user_id', session.user.id);
        await supabase.from('league_participants').delete().eq('user_id', session.user.id);
        await supabase.from('league_bids').delete().eq('user_id', session.user.id);

        await supabase.auth.signOut();
        window.location.href = 'index.html';

    } catch (err) {
        if (errEl) { errEl.textContent = err.message; errEl.classList.remove('hidden'); }
    }
};
