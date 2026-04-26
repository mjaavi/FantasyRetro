import { fetchLeagueCreationOptions, fetchMisLigas, crearLiga, unirseALiga } from './api.js';
import { refreshNavbarBudget } from './navbar-budget.js';

// Estado

export function getLigaActiva() {
    const raw = sessionStorage.getItem('ligaActiva');
    return raw ? JSON.parse(raw) : null;
}

function setLigaActiva(liga) {
    sessionStorage.setItem('ligaActiva', JSON.stringify(liga));
    // Mostrar/ocultar boton admin segun si el usuario es admin de la liga
    if (typeof window.actualizarBotonAdmin === 'function') {
        window.actualizarBotonAdmin(liga);
    }
}

// Inicializacion

export async function inicializar() {
    const ligaActiva = getLigaActiva();
    if (ligaActiva) {
        activarLiga(ligaActiva);
        return;
    }

    try {
        const ligas = await fetchMisLigas();
        if (ligas.length === 1) {
            setLigaActiva(ligas[0]);
            activarLiga(ligas[0]);
        } else {
            await mostrarSelector(ligas);
        }
    } catch {
        await mostrarSelector([]);
    }
}

// Pantalla selectora
// Muestra lista de ligas + panel de crear/unirse todo en una pantalla.

async function mostrarSelector(ligas = []) {
    document.getElementById('league-selector-screen')?.classList.remove('hidden');
    document.getElementById('main-app')?.classList.add('hidden');

    renderListaSelector(ligas);
    await cargarOpcionesCreacionLiga();
}

function renderListaSelector(ligas) {
    const container = document.getElementById('selector-leagues-list');
    if (!container) return;

    if (ligas.length === 0) {
        container.innerHTML = `
            <div class="text-center py-6">
                <p class="text-slate-400 text-sm">Aun no perteneces a ninguna liga. Crea una o unete con un codigo.</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    for (const liga of ligas) {
        fragment.appendChild(crearTarjetaSelector(liga));
    }
    container.appendChild(fragment);
}

function crearTarjetaSelector(liga) {
    const btn = document.createElement('button');
    btn.className = 'w-full text-left bento-card flex items-center justify-between hover:border-blue-500/50 hover:-translate-y-0.5 transition-all';

    const info = document.createElement('div');

    const nombre = document.createElement('p');
    nombre.className = 'font-extrabold text-white text-lg';
    nombre.textContent = liga.name;

    const meta = document.createElement('div');
    meta.className = 'flex gap-4 mt-1';

    const temporada = document.createElement('span');
    temporada.className = 'stat-label';
    temporada.textContent = liga.season;

    const codigo = document.createElement('span');
    codigo.className = 'stat-label font-mono';
    codigo.textContent = liga.invite_code;

    meta.appendChild(temporada);
    meta.appendChild(codigo);
    info.appendChild(nombre);
    info.appendChild(meta);

    const arrow = document.createElement('span');
    arrow.className = 'text-blue-400 text-2xl font-bold ml-4 shrink-0';
    arrow.textContent = '->';

    btn.appendChild(info);
    btn.appendChild(arrow);
    btn.addEventListener('click', () => {
        setLigaActiva(liga);
        activarLiga(liga);
    });

    return btn;
}

// Activar liga -> mostrar app con esa liga

function activarLiga(liga) {
    document.getElementById('league-selector-screen')?.classList.add('hidden');
    document.getElementById('main-app')?.classList.remove('hidden');

    const nameEl = document.getElementById('dashboard-league-name');
    const seasonEl = document.getElementById('dashboard-season-label');
    if (nameEl) nameEl.textContent = liga.name;
    if (seasonEl) seasonEl.textContent = liga.season ?? '-';
    void refreshNavbarBudget();

    // Actualizamos visibilidad del admin tras refrescar el navegador (importante!)
    setTimeout(() => {
        if (typeof window.actualizarBotonAdmin === 'function') {
            window.actualizarBotonAdmin(liga);
        }
    }, 100);

    // Boton "cambiar" -> vuelve al selector con todas las ligas
    const cambiarBtn = document.getElementById('btn-cambiar-liga-dashboard');
    if (cambiarBtn) {
        const clone = cambiarBtn.cloneNode(true);
        cambiarBtn.replaceWith(clone);
        clone.addEventListener('click', async () => {
            sessionStorage.removeItem('ligaActiva');
            const ligas = await fetchMisLigas().catch(() => []);
            await mostrarSelector(ligas);
        });
    }

    setDashboardPanel('active');
    irADashboard();
}

function setDashboardPanel(panel) {
    const onboarding = document.getElementById('dashboard-onboarding');
    const active = document.getElementById('dashboard-active');
    const backBtn = document.getElementById('btn-back-to-active');

    if (panel === 'onboarding') {
        if (onboarding) onboarding.style.display = '';
        if (active) active.style.display = 'none';
        if (backBtn) backBtn.style.display = '';
    } else {
        if (onboarding) onboarding.style.display = 'none';
        if (active) active.style.display = '';
        if (backBtn) backBtn.style.display = 'none';
    }
}

function irADashboard() {
    if (typeof switchView === 'function') {
        switchView('view-dashboard', document.getElementById('btn-dashboard'));
    } else {
        document.querySelectorAll('section[id^="view-"]').forEach(s => s.style.display = 'none');
        const d = document.getElementById('view-dashboard');
        if (d) d.style.display = '';
    }
}

// Formularios del selector

async function handleSelectorCrear(event) {
    event.preventDefault();

    const nombre = document.getElementById('selector-league-name')?.value.trim();
    const season = document.getElementById('selector-league-season')?.value;
    const competitionId = document.getElementById('selector-league-competition')?.value;
    const errorEl = document.getElementById('selector-crear-error');
    const btn = event.target.querySelector('[type="submit"]');

    if (errorEl) errorEl.classList.add('hidden');
    if (!nombre) { showError(errorEl, 'El nombre es obligatorio.'); return; }
    if (!season) { showError(errorEl, 'Selecciona una temporada.'); return; }
    if (!competitionId) { showError(errorEl, 'Selecciona una competicion.'); return; }

    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        const liga = await crearLiga(nombre, season, Number(competitionId));
        if (!liga?.id) throw new Error('Respuesta inesperada del servidor.');
        setLigaActiva(liga);
        activarLiga(liga);
        event.target.reset();
    } catch (err) {
        showError(errorEl, err.message ?? 'Error al crear la liga.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Fundar Liga';
    }
}

async function handleSelectorUnirse(event) {
    event.preventDefault();

    const codigo = document.getElementById('selector-invite-code')?.value.trim().toUpperCase();
    const errorEl = document.getElementById('selector-unirse-error');
    const btn = event.target.querySelector('[type="submit"]');

    if (errorEl) errorEl.classList.add('hidden');
    if (!codigo) { showError(errorEl, 'Introduce el codigo.'); return; }

    btn.disabled = true;
    btn.textContent = 'Uniendose...';

    try {
        const liga = await unirseALiga(codigo);
        if (!liga?.id) throw new Error('Respuesta inesperada del servidor.');
        setLigaActiva(liga);
        activarLiga(liga);
        event.target.reset();
    } catch (err) {
        showError(errorEl, err.message ?? 'Error al unirse a la liga.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verificar y Unirse';
    }
}

// Formularios del panel onboarding (dentro de la app, boton "cambiar")

async function handleOnboardingCrear(event) {
    event.preventDefault();

    const nombre = document.getElementById('onboarding-league-name')?.value.trim();
    const season = document.getElementById('onboarding-league-season')?.value;
    const competitionId = document.getElementById('onboarding-league-competition')?.value;
    const errorEl = document.getElementById('onboarding-crear-error');
    const btn = event.target.querySelector('[type="submit"]');

    if (errorEl) errorEl.classList.add('hidden');
    if (!nombre) { showError(errorEl, 'El nombre es obligatorio.'); return; }
    if (!season) { showError(errorEl, 'Selecciona una temporada.'); return; }
    if (!competitionId) { showError(errorEl, 'Selecciona una competicion.'); return; }

    btn.disabled = true;
    btn.textContent = 'Creando...';

    try {
        const liga = await crearLiga(nombre, season, Number(competitionId));
        if (!liga?.id) throw new Error('Respuesta inesperada del servidor.');
        setLigaActiva(liga);
        activarLiga(liga);
        event.target.reset();
    } catch (err) {
        showError(errorEl, err.message ?? 'Error al crear la liga.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Fundar Liga';
    }
}

async function handleOnboardingUnirse(event) {
    event.preventDefault();

    const codigo = document.getElementById('onboarding-invite-code')?.value.trim().toUpperCase();
    const errorEl = document.getElementById('onboarding-unirse-error');
    const btn = event.target.querySelector('[type="submit"]');

    if (errorEl) errorEl.classList.add('hidden');
    if (!codigo) { showError(errorEl, 'Introduce el codigo.'); return; }

    btn.disabled = true;
    btn.textContent = 'Uniendose...';

    try {
        const liga = await unirseALiga(codigo);
        if (!liga?.id) throw new Error('Respuesta inesperada del servidor.');
        setLigaActiva(liga);
        activarLiga(liga);
        event.target.reset();
    } catch (err) {
        showError(errorEl, err.message ?? 'Error al unirse a la liga.');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Verificar y Unirse';
    }
}

// Opciones de creacion de liga

async function cargarOpcionesCreacionLiga() {
    try {
        const options = await fetchLeagueCreationOptions();

        renderSeasonOptions('selector-league-season', options.seasons ?? []);
        renderSeasonOptions('onboarding-league-season', options.seasons ?? []);
        renderCompetitionOptions('selector-league-competition', options.competitions ?? []);
        renderCompetitionOptions('onboarding-league-competition', options.competitions ?? []);
    } catch {
        renderSeasonError('selector-league-season');
        renderSeasonError('onboarding-league-season');
        renderCompetitionError('selector-league-competition');
        renderCompetitionError('onboarding-league-competition');
    }
}

function renderSeasonOptions(selectId, seasons) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (!Array.isArray(seasons) || !seasons.length) {
        renderSeasonError(selectId);
        return;
    }

    select.innerHTML = seasons
        .map(item => `<option value="${item.season}">${item.season}</option>`)
        .join('');
}

function renderCompetitionOptions(selectId, competitions) {
    const select = document.getElementById(selectId);
    if (!select) return;

    if (!Array.isArray(competitions) || !competitions.length) {
        renderCompetitionError(selectId);
        return;
    }

    select.innerHTML = competitions
        .map(item => `<option value="${item.id}">${item.name}</option>`)
        .join('');
}

function renderSeasonError(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Error al cargar temporadas</option>';
}

function renderCompetitionError(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    select.innerHTML = '<option value="">Error al cargar competiciones</option>';
}

// Clasificacion

export async function loadClasificacion() {
    const liga = getLigaActiva();
    if (!liga) return;
    if (typeof window.loadClasificacion === 'function') window.loadClasificacion();
}

// Utilidades

function showError(el, message) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
}

window.cerrarModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    modal.classList.remove('opacity-100');
    setTimeout(() => modal.classList.add('hidden'), 200);
};

// Event listeners

document.getElementById('form-selector-crear')?.addEventListener('submit', handleSelectorCrear);
document.getElementById('form-selector-unirse')?.addEventListener('submit', handleSelectorUnirse);
document.getElementById('form-onboarding-crear')?.addEventListener('submit', handleOnboardingCrear);
document.getElementById('form-onboarding-unirse')?.addEventListener('submit', handleOnboardingUnirse);

// Arranque
inicializar();
