import { getLigaActiva } from './leagues.js';
import { getApiBaseUrl } from './env.js';

// ── Formateo ──────────────────────────────────────────────────────────────────

function formatEuros(valor) {
    return new Intl.NumberFormat('es-ES').format(valor) + ' €';
}

// ── Carga del ranking ─────────────────────────────────────────────────────────

export async function loadClasificacion(jornada = '') {
    const liga = getLigaActiva();
    if (!liga) return;

    const tbody    = document.getElementById('clasificacion-tbody');
    const subtitle = document.getElementById('liga-season-subtitle');
    if (!tbody) return;

    if (subtitle) subtitle.textContent = liga.season ?? '—';

    tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-slate-500 font-bold">Cargando clasificación...</td></tr>';

    try {
        const { supabase } = await import('./supabase.js');
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token ?? null;
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
    tr.className = 'table-row';
    const esPrimero = entry.posicion === 1;

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
    const nameSpan = document.createElement('p');
    nameSpan.className = 'font-bold text-white';
    nameSpan.textContent = entry.username;
    const teamSpan = document.createElement('p');
    teamSpan.className = 'text-xs text-slate-400 font-medium';
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
    tdValor.className = 'p-5 text-right font-mono text-slate-300 hidden md:table-cell';
    tdValor.textContent = formatEuros(entry.valorPlantilla);

    // Presupuesto restante
    const tdPresupuesto = document.createElement('td');
    tdPresupuesto.className = 'p-5 text-right font-mono text-green-400 hidden lg:table-cell';
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
