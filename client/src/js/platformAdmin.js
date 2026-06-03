import { apiFetch, invalidateCache } from './api.js';

let currentTab = 'users'; // 'users' | 'leagues' | 'stats'

export async function loadPlatformAdmin() {
    setupTabListeners();
    setupFormListeners();
    await switchPanel(currentTab);
}

function setupTabListeners() {
    const tabs = {
        'users': document.getElementById('padmin-tab-users'),
        'leagues': document.getElementById('padmin-tab-leagues'),
        'stats': document.getElementById('padmin-tab-stats'),
    };

    Object.entries(tabs).forEach(([tabName, button]) => {
        if (!button) return;
        // Evitar duplicar listeners
        button.onclick = async () => {
            currentTab = tabName;
            // Actualizar clases de botones
            Object.values(tabs).forEach(btn => {
                if (btn) btn.className = 'flex-1 text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 text-slate-500 hover:text-slate-300 border border-transparent';
            });
            button.className = 'flex-1 text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 bg-blue-500/20 text-blue-400 border border-blue-500/30';
            
            await switchPanel(tabName);
        };
    });
}

async function switchPanel(tabName) {
    const panels = {
        'users': document.getElementById('padmin-panel-users'),
        'leagues': document.getElementById('padmin-panel-leagues'),
        'stats': document.getElementById('padmin-panel-stats'),
    };

    Object.entries(panels).forEach(([name, panel]) => {
        if (panel) panel.classList.toggle('hidden', name !== tabName);
    });

    if (tabName === 'users') {
        await fetchAndRenderUsers();
    } else if (tabName === 'leagues') {
        await fetchAndRenderLeagues();
    } else if (tabName === 'stats') {
        await fetchAndRenderStats();
    }
}

// --- PANEL USUARIOS ---

async function fetchAndRenderUsers() {
    const tbody = document.getElementById('padmin-users-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">Cargando usuarios...</td></tr>';

    try {
        const response = await apiFetch('/platform-admin/users');
        const users = response.data ?? [];

        if (users.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-500">No hay usuarios en la plataforma.</td></tr>';
            return;
        }

        tbody.innerHTML = users.map(u => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-4 font-mono text-xs text-slate-400 select-all">${u.email}</td>
                <td class="p-4 text-white font-extrabold">${u.username || '<sin username>'}</td>
                <td class="p-4 text-slate-300">${u.team_name || '<sin equipo>'}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="padminAbrirModalCambiarPass('${u.id}', '${u.username || u.email}')" class="btn-glass text-[10px] px-2.5 py-1.5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                            Llave
                        </button>
                        <button onclick="padminEliminarUsuario('${u.id}', '${u.username || u.email}')" class="btn-danger-glass text-[10px] px-2.5 py-1.5">
                            Borrar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-4 text-center text-red-400">Error: ${err.message}</td></tr>`;
    }
}

// --- PANEL LIGAS ---

async function fetchAndRenderLeagues() {
    const tbody = document.getElementById('padmin-leagues-tbody');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">Cargando ligas...</td></tr>';

    try {
        const response = await apiFetch('/platform-admin/leagues');
        const leagues = response.data ?? [];

        if (leagues.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-500">No hay ligas fundadas.</td></tr>';
            return;
        }

        tbody.innerHTML = leagues.map(l => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-4 text-white font-extrabold">${l.name} <span class="text-xs text-slate-500 font-mono">(${l.invite_code})</span></td>
                <td class="p-4 text-slate-400">${l.season}</td>
                <td class="p-4"><span class="badge badge-blue">J${l.jornada_actual}</span></td>
                <td class="p-4 text-slate-300 text-xs font-mono">${l.admin_username || l.admin_id.substring(0,8)}</td>
                <td class="p-4 text-center text-white font-black">${l.participants_count}</td>
                <td class="p-4 text-center">
                    <div class="flex items-center justify-center gap-2">
                        <button onclick="padminAbrirModalLigaParticipantes(${l.id}, '${l.name}')" class="btn-glass text-[10px] px-2.5 py-1.5 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10">
                            Mánagers
                        </button>
                        <button onclick="padminResolverPujasLiga(${l.id}, '${l.name}')" class="btn-glass text-[10px] px-2.5 py-1.5 border-yellow-500/20 text-yellow-400 hover:bg-yellow-500/10">
                            Pujas
                        </button>
                        <button onclick="padminEliminarLiga(${l.id}, '${l.name}')" class="btn-danger-glass text-[10px] px-2.5 py-1.5">
                            Borrar
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-400">Error: ${err.message}</td></tr>`;
    }
}

// --- PANEL STATS ---

async function fetchAndRenderStats() {
    const statUsers = document.getElementById('padmin-stat-users');
    const statLeagues = document.getElementById('padmin-stat-leagues');
    const statBudget = document.getElementById('padmin-stat-budget');

    try {
        const [usersRes, leaguesRes] = await Promise.all([
            apiFetch('/platform-admin/users'),
            apiFetch('/platform-admin/leagues')
        ]);

        const usersCount = usersRes.data?.length ?? 0;
        const leaguesCount = leaguesRes.data?.length ?? 0;

        let totalBudget = 0;
        // Obtener presupuesto acumulado sumando el presupuesto de todos los participantes de todas las ligas
        for (const league of leaguesRes.data ?? []) {
            try {
                const partRes = await apiFetch(`/platform-admin/leagues/${league.id}/participants`);
                totalBudget += (partRes.data ?? []).reduce((acc, curr) => acc + (curr.budget || 0), 0);
            } catch (_) {}
        }

        if (statUsers) statUsers.textContent = usersCount.toLocaleString();
        if (statLeagues) statLeagues.textContent = leaguesCount.toLocaleString();
        if (statBudget) statBudget.textContent = `${totalBudget.toLocaleString('es-ES')} €`;
    } catch (err) {
        console.error('[PlatformAdmin:Stats] Error cargando estadísticas:', err);
    }
}

// --- FUNCIONES EVENT LISTENERS FORMULARIOS ---

function setupFormListeners() {
    const formCrear = document.getElementById('form-padmin-crear-usuario');
    if (formCrear) {
        formCrear.onsubmit = async (e) => {
            e.preventDefault();
            const email = document.getElementById('padmin-create-email').value.trim();
            const password = document.getElementById('padmin-create-pass').value;
            const username = document.getElementById('padmin-create-username').value.trim();
            const teamName = document.getElementById('padmin-create-teamname').value.trim();

            const errEl = document.getElementById('padmin-create-error');
            const okEl = document.getElementById('padmin-create-ok');

            errEl.classList.add('hidden');
            okEl.classList.add('hidden');

            try {
                await apiFetch('/platform-admin/users', {
                    method: 'POST',
                    body: JSON.stringify({ email, password, username, teamName }),
                });

                okEl.classList.remove('hidden');
                formCrear.reset();
                setTimeout(() => {
                    padminCerrarModal('modal-padmin-crear-usuario');
                    fetchAndRenderUsers();
                }, 1500);
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        };
    }

    const formPass = document.getElementById('form-padmin-cambiar-pass');
    if (formPass) {
        formPass.onsubmit = async (e) => {
            e.preventDefault();
            const userId = document.getElementById('padmin-pass-userid').value;
            const password = document.getElementById('padmin-pass-new').value;

            const errEl = document.getElementById('padmin-pass-error');
            const okEl = document.getElementById('padmin-pass-ok');

            errEl.classList.add('hidden');
            okEl.classList.add('hidden');

            try {
                await apiFetch(`/platform-admin/users/${userId}/change-password`, {
                    method: 'POST',
                    body: JSON.stringify({ password }),
                });

                okEl.classList.remove('hidden');
                formPass.reset();
                setTimeout(() => {
                    padminCerrarModal('modal-padmin-cambiar-pass');
                }, 1500);
            } catch (err) {
                errEl.textContent = err.message;
                errEl.classList.remove('hidden');
            }
        };
    }
}

// --- MODALES Y ACCIONES ---

export function padminAbrirModalCrearUsuario() {
    const m = document.getElementById('modal-padmin-crear-usuario');
    if (!m) return;
    
    // Ocultar mensajes de estado anteriores
    document.getElementById('padmin-create-error')?.classList.add('hidden');
    document.getElementById('padmin-create-ok')?.classList.add('hidden');

    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
    }, 10);
}

export function padminAbrirModalCambiarPass(userId, username) {
    const m = document.getElementById('modal-padmin-cambiar-pass');
    if (!m) return;

    document.getElementById('padmin-pass-userid').value = userId;
    document.getElementById('padmin-pass-username').textContent = username;
    
    document.getElementById('padmin-pass-error')?.classList.add('hidden');
    document.getElementById('padmin-pass-ok')?.classList.add('hidden');

    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
    }, 10);
}

export async function padminAbrirModalLigaParticipantes(leagueId, leagueName) {
    const m = document.getElementById('modal-padmin-liga-participantes');
    if (!m) return;

    document.getElementById('padmin-part-leaguename').textContent = leagueName;
    m.classList.remove('hidden');
    setTimeout(() => {
        m.classList.remove('opacity-0');
    }, 10);

    const tbody = document.getElementById('padmin-part-tbody');
    tbody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-500">Cargando participantes...</td></tr>';

    try {
        const res = await apiFetch(`/platform-admin/leagues/${leagueId}/participants`);
        const participants = res.data ?? [];

        if (participants.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-3 text-center text-slate-500">Sin participantes en esta liga.</td></tr>';
            return;
        }

        tbody.innerHTML = participants.map(p => `
            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
                <td class="p-3 text-white font-extrabold">${p.username || '<sin username>'}</td>
                <td class="p-3 text-slate-300">${p.team_name || '<sin equipo>'}</td>
                <td class="p-3 text-right text-emerald-400 font-mono">${p.budget.toLocaleString('es-ES')} €</td>
                <td class="p-3 text-center">
                    <button onclick="padminDarPresupuesto(${leagueId}, '${p.user_id}', '${p.username || 'Mánager'}', ${p.budget})" class="btn-glass text-[10px] px-2.5 py-1.5 border-blue-500/20 text-blue-400 hover:bg-blue-500/10">
                        Presupuesto
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-red-400">Error: ${err.message}</td></tr>`;
    }
}

export function padminCerrarModal(modalId) {
    const m = document.getElementById(modalId);
    if (!m) return;

    m.classList.add('opacity-0');
    setTimeout(() => {
        m.classList.add('hidden');
    }, 200);
}

export async function padminEliminarUsuario(userId, username) {
    const confirmed = window.confirm(`¿Estás seguro de eliminar definitivamente a "${username}" de la plataforma?\nSe eliminarán todos sus equipos, saldos y relaciones de forma irreversible.`);
    if (!confirmed) return;

    try {
        await apiFetch(`/platform-admin/users/${userId}`, { method: 'DELETE' });
        await fetchAndRenderUsers();
    } catch (err) {
        alert(`Error al eliminar usuario: ${err.message}`);
    }
}

export async function padminEliminarLiga(leagueId, leagueName) {
    const confirmed = window.confirm(`¿Estás seguro de eliminar la liga "${leagueName}" (#${leagueId})?\nEsta acción es irreversible y borrará a todos los participantes y plantillas asociados.`);
    if (!confirmed) return;

    try {
        await apiFetch(`/platform-admin/leagues/${leagueId}`, { method: 'DELETE' });
        await fetchAndRenderLeagues();
    } catch (err) {
        alert(`Error al eliminar liga: ${err.message}`);
    }
}

export async function padminResolverPujasLiga(leagueId, leagueName) {
    const confirmed = window.confirm(`¿Quieres forzar la resolución del mercado y la adjudicación de pujas para la liga "${leagueName}"?\nSe cerrará el mercado actual y se generará uno nuevo.`);
    if (!confirmed) return;

    try {
        await apiFetch(`/platform-admin/leagues/${leagueId}/resolve-market`, { method: 'POST' });
        alert('Mercado resuelto y adjudicado con éxito.');
        
        // Invalidar cachés locales si corresponden a la liga
        invalidateCache(`league-market-${leagueId}-0`);
        invalidateCache(`liga-${leagueId}`);
        
        await fetchAndRenderLeagues();
    } catch (err) {
        alert(`Error al resolver mercado: ${err.message}`);
    }
}

export async function padminDarPresupuesto(leagueId, userId, username, currentBudget) {
    const input = window.prompt(`Establecer nuevo presupuesto (en euros) para "${username}":`, currentBudget);
    if (input === null) return;

    const amount = Number(input.replace(/[^\d.-]/g, ''));
    if (Number.isNaN(amount)) {
        alert('Monto de presupuesto inválido.');
        return;
    }

    try {
        await apiFetch(`/platform-admin/leagues/${leagueId}/participants/${userId}/budget`, {
            method: 'POST',
            body: JSON.stringify({ amount }),
        });
        
        // Invalidar caché del panel de la liga correspondiente
        invalidateCache(`liga-${leagueId}`);
        
        // Cerrar modal de participantes y actualizar la lista en background
        padminCerrarModal('modal-padmin-liga-participantes');
        await fetchAndRenderLeagues();
    } catch (err) {
        alert(`Error al actualizar presupuesto: ${err.message}`);
    }
}

// Inyección en window para interactividad en HTML
window.loadPlatformAdmin = loadPlatformAdmin;
window.padminAbrirModalCrearUsuario = padminAbrirModalCrearUsuario;
window.padminAbrirModalCambiarPass = padminAbrirModalCambiarPass;
window.padminAbrirModalLigaParticipantes = padminAbrirModalLigaParticipantes;
window.padminCerrarModal = padminCerrarModal;
window.padminEliminarUsuario = padminEliminarUsuario;
window.padminEliminarLiga = padminEliminarLiga;
window.padminResolverPujasLiga = padminResolverPujasLiga;
window.padminDarPresupuesto = padminDarPresupuesto;
