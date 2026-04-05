import { apiFetch, invalidateCache } from './api.js';
import { getLigaActiva } from './leagues.js';
import { supabase } from './supabase.js';

const NUMBER_FORMATTER = new Intl.NumberFormat('es-ES');

export async function actualizarBotonAdmin(liga) {
    const btn = document.getElementById('btn-admin');
    if (!btn) {
        return;
    }

    if (!liga) {
        btn.classList.add('hidden');
        return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
        btn.classList.add('hidden');
        return;
    }

    if (liga.admin_id === session.user.id) {
        btn.classList.remove('hidden');
        return;
    }

    btn.classList.add('hidden');

    const viewAdmin = document.getElementById('view-admin');
    if (viewAdmin && viewAdmin.style.display !== 'none') {
        window.switchView?.('view-dashboard', null);
    }
}

export async function loadAdmin() {
    const liga = getLigaActiva();
    if (!liga) {
        return;
    }

    try {
        const response = await apiFetch('/admin/ligas');
        const ligaInfo = (response.data ?? []).find(item => item.id === liga.id);
        if (!ligaInfo) {
            return;
        }

        const jornadaActual = ligaInfo.jornada_actual ?? 0;
        const jornadaSiguiente = jornadaActual + 1;

        const seasonEl = document.getElementById('admin-season');
        const actualEl = document.getElementById('admin-jornada-actual');
        const siguienteEl = document.getElementById('admin-jornada-siguiente');
        const inputEl = document.getElementById('admin-jornada-input');

        if (seasonEl) {
            seasonEl.textContent = ligaInfo.season;
        }

        if (actualEl) {
            actualEl.textContent = `J${jornadaActual}`;
        }

        if (siguienteEl) {
            siguienteEl.textContent = `J${jornadaSiguiente}`;
        }

        if (inputEl) {
            inputEl.value = jornadaSiguiente;
        }

        adminLog(`Liga "${ligaInfo.name}" - Jornada actual: ${jornadaActual}`, 'info');
    } catch (err) {
        adminLog(`Error cargando estado: ${err.message}`, 'err');
    }
}

export async function procesarJornada() {
    const liga = getLigaActiva();
    const jornada = Number(document.getElementById('admin-jornada-input')?.value);
    const btn = document.getElementById('admin-procesar-btn');
    const msgEl = document.getElementById('admin-procesar-msg');
    const errEl = document.getElementById('admin-procesar-err');

    toggleFeedback(msgEl, false);
    toggleFeedback(errEl, false);

    if (!liga) {
        adminLog('No hay liga activa.', 'err');
        return;
    }

    if (!jornada || jornada < 1 || jornada > 38) {
        adminLog('Jornada invalida (1-38).', 'err');
        return;
    }

    setButtonState(btn, true, 'Procesando...');
    adminLog(`Procesando jornada ${jornada} para liga #${liga.id}...`, 'info');

    try {
        const result = await apiFetch(`/admin/ligas/${liga.id}/procesar`, {
            method: 'POST',
            body: JSON.stringify({ jornada }),
        });

        const data = result.data;
        adminLog(`Jornada ${data.jornada} procesada. ${data.jugadoresPuntuados} jugadores puntuados.`, 'ok');
        data.errores?.forEach(error => adminLog(`Aviso: ${error}`, 'err'));

        if (msgEl) {
            msgEl.textContent = `Jornada ${data.jornada} procesada - ${data.jugadoresPuntuados} jugadores puntuados`;
            toggleFeedback(msgEl, true);
        }

        await mostrarResultados(liga.id, jornada);
        await loadAdmin();
    } catch (err) {
        adminLog(`Error: ${err.message}`, 'err');
        if (errEl) {
            errEl.textContent = err.message;
            toggleFeedback(errEl, true);
        }
    } finally {
        setButtonState(btn, false, 'Procesar');
    }
}

export async function regenerarMercado() {
    const liga = getLigaActiva();
    const btn = document.getElementById('admin-regenerar-mercado-btn');
    const msgEl = document.getElementById('admin-regenerar-mercado-msg');
    const errEl = document.getElementById('admin-regenerar-mercado-err');

    toggleFeedback(msgEl, false);
    toggleFeedback(errEl, false);

    if (!liga) {
        adminLog('No hay liga activa.', 'err');
        return;
    }

    const confirmed = window.confirm(
        'Se devolvera cualquier puja activa y se reemplazara el mercado actual. Quieres continuar?',
    );

    if (!confirmed) {
        adminLog('Regeneracion de mercado cancelada por el admin.', 'info');
        return;
    }

    setButtonState(btn, true, 'Regenerando...');
    adminLog(`Regenerando mercado para liga #${liga.id}...`, 'info');

    try {
        const result = await apiFetch(`/admin/ligas/${liga.id}/regenerar-mercado`, {
            method: 'POST',
        });

        const data = result.data;
        invalidateCache(`league-market-${liga.id}-0`);

        adminLog(
            `Mercado regenerado. Retirados: ${data.jugadoresRetirados}. Nuevos: ${data.jugadoresNuevos}.`,
            'ok',
        );

        if (data.pujasDevueltas > 0) {
            adminLog(
                `Pujas devueltas: ${data.pujasDevueltas}. Importe: ${formatAmount(data.importeDevuelto)}. Usuarios: ${data.usuariosReembolsados}.`,
                'info',
            );
        }

        if (msgEl) {
            msgEl.textContent =
                `Mercado regenerado - ${data.jugadoresNuevos} jugadores disponibles hasta ${formatExpiry(data.expiresAt)}`;
            toggleFeedback(msgEl, true);
        }

        await loadAdmin();
    } catch (err) {
        adminLog(`Error regenerando mercado: ${err.message}`, 'err');
        if (errEl) {
            errEl.textContent = err.message;
            toggleFeedback(errEl, true);
        }
    } finally {
        setButtonState(btn, false, 'Regenerar mercado');
    }
}

async function mostrarResultados(leagueId, jornada) {
    try {
        const result = await apiFetch(`/admin/ligas/${leagueId}/jornada/${jornada}`);
        const data = result.data ?? [];

        const card = document.getElementById('admin-resultados-card');
        const jornadaEl = document.getElementById('admin-res-jornada');
        const tablaEl = document.getElementById('admin-resultados-tabla');

        if (card) {
            card.style.display = '';
        }

        if (jornadaEl) {
            jornadaEl.textContent = jornada;
        }

        if (!tablaEl) {
            return;
        }

        if (!data.length) {
            tablaEl.innerHTML = '<p class="text-slate-500 text-sm">Sin datos para esta jornada.</p>';
            return;
        }

        const porUsuario = new Map();
        for (const row of data) {
            if (!porUsuario.has(row.user_id)) {
                porUsuario.set(row.user_id, { total: 0, jugadores: 0 });
            }

            porUsuario.get(row.user_id).total += row.puntos_total;
            porUsuario.get(row.user_id).jugadores += 1;
        }

        const filas = Array.from(porUsuario.entries())
            .sort((a, b) => b[1].total - a[1].total)
            .map(([userId, summary], index) => `
                <tr class="border-b border-white/5">
                    <td class="p-3 text-slate-500 font-bold">${index + 1}o</td>
                    <td class="p-3 font-mono text-xs text-slate-400">${userId.substring(0, 8)}...</td>
                    <td class="p-3 font-black text-blue-400 text-lg">${summary.total} pts</td>
                    <td class="p-3 text-slate-400">${summary.jugadores} jugadores</td>
                </tr>`)
            .join('');

        tablaEl.innerHTML = `
            <table class="w-full text-sm">
                <thead>
                    <tr class="text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                        <th class="p-3 text-left">Pos</th>
                        <th class="p-3 text-left">Usuario</th>
                        <th class="p-3 text-left">Puntos</th>
                        <th class="p-3 text-left">Jugadores</th>
                    </tr>
                </thead>
                <tbody>${filas}</tbody>
            </table>`;
    } catch (err) {
        adminLog(`Error cargando resultados: ${err.message}`, 'err');
    }
}

function toggleFeedback(element, show) {
    if (!element) {
        return;
    }

    element.classList.toggle('hidden', !show);
}

function setButtonState(button, disabled, text) {
    if (!button) {
        return;
    }

    button.disabled = disabled;
    button.textContent = text;
}

function formatAmount(amount) {
    return `${NUMBER_FORMATTER.format(Number(amount ?? 0))} EUR`;
}

function formatExpiry(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString('es-ES', {
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        month: '2-digit',
    });
}

function adminLog(message, type = 'info') {
    const container = document.getElementById('admin-log');
    if (!container) {
        return;
    }

    const color = type === 'ok'
        ? 'text-green-400'
        : type === 'err'
            ? 'text-red-400'
            : 'text-blue-400';

    const line = document.createElement('p');
    line.className = color;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    container.appendChild(line);
    container.scrollTop = container.scrollHeight;
}

window.procesarJornada = procesarJornada;
window.regenerarMercado = regenerarMercado;
window.loadAdmin = loadAdmin;
window.actualizarBotonAdmin = actualizarBotonAdmin;
