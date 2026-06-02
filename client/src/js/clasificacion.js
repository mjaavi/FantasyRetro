import { getLigaActiva } from './leagues.js';
import { getApiBaseUrl } from './env.js';

// ── Formateo ──────────────────────────────────────────────────────────────────

function formatEuros(valor) {
    return new Intl.NumberFormat('es-ES').format(valor) + ' €';
}

// ── Estado ────────────────────────────────────────────────────────────────────

let _currentUserId = null;
let _jornadaSeleccionada = '';

// ── Carga del ranking ─────────────────────────────────────────────────────────

export async function loadClasificacion(jornada = '') {
    const liga = getLigaActiva();
    if (!liga) return;

    _jornadaSeleccionada = jornada;

    const tbody    = document.getElementById('clasificacion-tbody');
    const subtitle = document.getElementById('liga-season-subtitle');
    if (!tbody) return;

    if (subtitle) subtitle.textContent = liga.season ?? '—';

    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 font-bold">Cargando clasificación...</td></tr>';

    try {
        const { supabase } = await import('./supabase.js');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
        _currentUserId = session?.user?.id ?? null;
        const apiUrl = await getApiBaseUrl();

        const url = jornada
            ? `${apiUrl}/ranking/${liga.id}?jornada=${jornada}`
            : `${apiUrl}/ranking/${liga.id}`;

        const res  = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();

        if (!res.ok) throw new Error(json.message ?? 'Error del servidor');

        const { ranking, jornadasDisponibles } = json.data;

        poblarFiltroJornadas(jornadasDisponibles, jornada);

        if (!ranking?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 font-bold">Sin datos de clasificación aún.</td></tr>';
            return;
        }

        tbody.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (const entry of ranking) {
            fragment.appendChild(crearFilaRanking(entry));
        }
        tbody.appendChild(fragment);

    } catch (err) {
        console.error('[Clasificacion]', err);
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-red-400 font-bold">Error al cargar la clasificación.</td></tr>';
    }
}

// ── Filtro de jornadas ────────────────────────────────────────────────────────

function poblarFiltroJornadas(jornadas, jornadaActiva) {
    const select = document.getElementById('ranking-jornada-select');
    if (!select || select.dataset.poblado === 'true') return;

    const fragment = document.createDocumentFragment();

    const optGeneral = document.createElement('option');
    optGeneral.value = '';
    optGeneral.textContent = 'General';
    fragment.appendChild(optGeneral);

    for (const j of jornadas) {
        const opt = document.createElement('option');
        opt.value = j;
        opt.textContent = `Jornada ${j}`;
        if (String(j) === String(jornadaActiva)) opt.selected = true;
        fragment.appendChild(opt);
    }

    select.innerHTML = '';
    select.appendChild(fragment);
    select.dataset.poblado = 'true';
}

// ── Fila de la tabla ──────────────────────────────────────────────────────────

function crearFilaRanking(entry) {
    const tr = document.createElement('tr');
    const esPrimero = entry.posicion === 1;
    const esPropio = entry.userId === _currentUserId;

    tr.className = esPropio
        ? 'table-row bg-blue-500/[0.04]'
        : 'table-row cursor-pointer hover:bg-white/[0.04] transition-colors';

    if (!esPropio) {
        tr.title = 'Ver equipo de ' + (entry.username ?? 'rival');
        tr.addEventListener('click', async () => {
            const jornada = _jornadaSeleccionada ? Number(_jornadaSeleccionada) : undefined;
            try {
                const module = window.abrirRivalDrawer
                    ? null
                    : await import('./rival-roster-renderer.js');
                const abrirRivalDrawer = window.abrirRivalDrawer ?? module?.abrirRivalDrawer;
                await abrirRivalDrawer?.(entry.userId, jornada);
            } catch (error) {
                console.error('[Clasificacion] Error cargando equipo rival:', error.message ?? error);
            }
        });
    }

    // Posición
    const tdPos = document.createElement('td');
    tdPos.className = 'p-5 text-center';
    const badge = document.createElement('span');
    badge.className = esPrimero ? 'ranking-badge-first' : 'text-slate-500 font-black text-lg';
    badge.textContent = entry.posicion;
    tdPos.appendChild(badge);

    // Mánager
    const tdManager = document.createElement('td');
    tdManager.className = 'p-5';
    const wrap = document.createElement('div');
    wrap.className = 'flex items-center gap-3';
    const avatar = document.createElement('div');
    avatar.className = 'user-avatar shrink-0';
    avatar.textContent = (entry.username ?? '?').substring(0, 2).toUpperCase();
    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';
    const nameSpan = document.createElement('p');
    nameSpan.className = esPropio
        ? 'font-bold text-blue-400 flex items-center gap-2'
        : 'font-bold text-white flex items-center gap-2';
    nameSpan.textContent = entry.username;

    if (!esPropio) {
        // Eye icon for rival rows
        const eye = document.createElement('svg');
        eye.setAttribute('class', 'w-3.5 h-3.5 text-slate-600 shrink-0');
        eye.setAttribute('fill', 'none');
        eye.setAttribute('stroke', 'currentColor');
        eye.setAttribute('viewBox', '0 0 24 24');
        eye.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>';
        nameSpan.appendChild(eye);
    }

    const teamSpan = document.createElement('p');
    teamSpan.className = 'text-xs text-slate-400 font-medium truncate';
    teamSpan.textContent = entry.teamName;
    info.appendChild(nameSpan);
    info.appendChild(teamSpan);
    wrap.appendChild(avatar);
    wrap.appendChild(info);
    tdManager.appendChild(wrap);

    // Jugadores
    const tdJugadores = document.createElement('td');
    tdJugadores.className = 'p-5 text-center text-slate-400 font-bold hidden md:table-cell';
    tdJugadores.textContent = entry.jugadoresPuntuados;

    // Valor plantilla
    const tdValor = document.createElement('td');
    tdValor.className = 'p-5 text-right text-slate-300 hidden md:table-cell';
    tdValor.textContent = formatEuros(entry.valorPlantilla);

    // Presupuesto restante
    const tdPresupuesto = document.createElement('td');
    tdPresupuesto.className = 'p-5 text-right text-green-400 hidden lg:table-cell';
    tdPresupuesto.textContent = formatEuros(entry.presupuestoRestante);

    // Puntos
    const tdPuntos = document.createElement('td');
    tdPuntos.className = `p-5 text-right font-black text-lg ${esPrimero ? 'text-blue-400' : 'text-white'}`;
    tdPuntos.textContent = entry.puntosTotales;

    tr.appendChild(tdPos);
    tr.appendChild(tdManager);
    tr.appendChild(tdJugadores);
    tr.appendChild(tdValor);
    tr.appendChild(tdPresupuesto);
    tr.appendChild(tdPuntos);

    return tr;
}

// ── Event listeners ───────────────────────────────────────────────────────────
// El select de jornada recarga la clasificación al cambiar

document.getElementById('ranking-jornada-select')?.addEventListener('change', (e) => {
    loadClasificacion(e.target.value);
});

// Expuesto para que navigation.js pueda llamarlo cuando se muestra la vista
window.loadClasificacion = loadClasificacion;
