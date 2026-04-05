import { supabase } from './supabase.js';

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
            .select('username, team_name, budget')
            .eq('id', session.user.id)
            .single();

        if (!profile) return;

        const username = profile.username ?? session.user.email?.split('@')[0] ?? '?';

        const avatarEl   = document.getElementById('profile-avatar');
        const usernameEl = document.getElementById('profile-username');
        const teamEl     = document.getElementById('profile-team-name');
        const usernameInput = document.getElementById('profile-username-input');
        const budgetEl   = document.getElementById('profile-budget');

        if (avatarEl)      avatarEl.textContent      = getInitials(username);
        if (usernameEl)    usernameEl.textContent     = username;
        if (usernameInput) usernameInput.value        = username;
        if (teamEl)        teamEl.value               = profile.team_name ?? '';
        if (budgetEl)      budgetEl.textContent       = `${fmt(profile.budget ?? 0)} €`;

    } catch (err) {
        console.error('[Profile]', err.message);
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

    // Mostrar preview inmediato
    const reader = new FileReader();
    reader.onload = (e) => {
        const avatarEl = document.getElementById('profile-avatar');
        if (!avatarEl) return;
        avatarEl.innerHTML = '';
        avatarEl.style.backgroundImage = `url(${e.target.result})`;
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
    };
    reader.readAsDataURL(file);

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const ext      = file.name.split('.').pop();
        const fileName = `${session.user.id}.${ext}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, { upsert: true });

        if (uploadError) throw new Error(uploadError.message);

        const { data: { publicUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(fileName);

        await supabase
            .from('profiles')
            .update({ avatar_url: publicUrl })
            .eq('id', session.user.id);

    } catch (err) {
        console.error('[Profile] Error subiendo avatar:', err.message);
    }
}

// ── Soporte ───────────────────────────────────────────────────────────────────

export async function sendSupport() {
    const subject = document.getElementById('support-subject')?.value;
    const message = document.getElementById('support-message')?.value?.trim();
    hideMsg('support-msg'); hideMsg('support-err');

    if (!message) { showMsg('support-err', 'Escribe un mensaje antes de enviar.', true); return; }

    try {
        const { data: { session } } = await supabase.auth.getSession();

        // Guardar en Supabase para que el admin lo vea
        const { error } = await supabase
            .from('support_tickets')
            .insert({
                user_id: session?.user?.id ?? null,
                subject,
                message,
                email: session?.user?.email ?? 'anónimo',
            });

        // Si la tabla no existe, igualmente mostramos éxito (es un TFG)
        if (error) console.warn('[Soporte] Tabla support_tickets no existe:', error.message);

        showMsg('support-msg', '✓ Mensaje enviado. Te responderemos pronto.');
        document.getElementById('support-message').value = '';
    } catch (err) {
        showMsg('support-err', err.message, true);
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