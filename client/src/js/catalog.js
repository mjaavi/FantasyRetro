import { fetchCatalogImportJobs, fetchCatalogMe, fetchLeagueCreationOptions } from './api.js';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

export async function actualizarBotonCatalogo() {
    const btn = document.getElementById('btn-catalogo');
    if (!btn) {
        return;
    }

    try {
        const me = await fetchCatalogMe();
        if (me.isCatalogAdmin) {
            btn.classList.remove('hidden');
            return;
        }
    } catch (_err) {
        // Si falla, ocultamos el acceso y no rompemos el resto de la app.
    }

    btn.classList.add('hidden');

    const view = document.getElementById('view-catalogo');
    if (view && view.style.display !== 'none') {
        window.switchView?.('view-dashboard', document.getElementById('btn-dashboard'));
    }
}

export async function loadCatalog() {
    const titleEl = document.getElementById('catalog-access-badge');
    const statusEl = document.getElementById('catalog-status');
    const jobsEl = document.getElementById('catalog-jobs-table');
    const competitionsEl = document.getElementById('catalog-competitions-list');
    const seasonsEl = document.getElementById('catalog-seasons-list');
    const importsCountEl = document.getElementById('catalog-imports-count');
    const competitionsCountEl = document.getElementById('catalog-competitions-count');
    const seasonsCountEl = document.getElementById('catalog-seasons-count');

    if (jobsEl) {
        jobsEl.innerHTML = '<p class="text-slate-500 text-sm">Cargando import jobs...</p>';
    }

    try {
        const me = await fetchCatalogMe();
        if (!me.isCatalogAdmin) {
            if (statusEl) {
                statusEl.textContent = 'No tienes permisos de catalog_admin.';
            }
            await actualizarBotonCatalogo();
            return;
        }

        if (titleEl) {
            titleEl.textContent = 'Catalog Admin';
        }

        if (statusEl) {
            statusEl.textContent = 'Acceso global activo. Puedes revisar el catálogo y el estado de los imports.';
        }

        const [options, jobs] = await Promise.all([
            fetchLeagueCreationOptions(),
            fetchCatalogImportJobs(20),
        ]);

        renderCompetitions(competitionsEl, options.competitions ?? []);
        renderSeasons(seasonsEl, options.seasons ?? []);
        renderImportJobs(jobsEl, jobs);

        if (importsCountEl) importsCountEl.textContent = String(jobs.length);
        if (competitionsCountEl) competitionsCountEl.textContent = String((options.competitions ?? []).length);
        if (seasonsCountEl) seasonsCountEl.textContent = String((options.seasons ?? []).length);
    } catch (err) {
        if (statusEl) {
            statusEl.textContent = `Error cargando el catálogo: ${err.message}`;
        }
        if (jobsEl) {
            jobsEl.innerHTML = `<p class="text-red-400 text-sm font-bold">${err.message}</p>`;
        }
    }
}

function renderCompetitions(container, competitions) {
    if (!container) {
        return;
    }

    if (!competitions.length) {
        container.innerHTML = '<p class="text-slate-500 text-sm">No hay competiciones activas.</p>';
        return;
    }

    container.innerHTML = competitions.map(item => `
        <div class="flex items-center justify-between gap-4 p-3 rounded-2xl bg-black/20 border border-white/5">
            <div>
                <p class="text-white font-extrabold">${item.name}</p>
                <p class="text-slate-500 text-xs uppercase tracking-widest">${item.provider} · source ${item.sourceCompetitionId}</p>
            </div>
            <span class="text-xs font-black px-2.5 py-1 rounded-xl ${item.isActive ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-slate-500/10 text-slate-400 border border-white/10'}">
                ${item.isActive ? 'activa' : 'inactiva'}
            </span>
        </div>
    `).join('');
}

function renderSeasons(container, seasons) {
    if (!container) {
        return;
    }

    if (!seasons.length) {
        container.innerHTML = '<p class="text-slate-500 text-sm">No hay temporadas activas.</p>';
        return;
    }

    container.innerHTML = seasons.map(item => `
        <div class="flex items-center justify-between gap-3 p-3 rounded-2xl bg-black/20 border border-white/5">
            <span class="text-white font-extrabold">${item.season}</span>
            <span class="text-slate-500 text-xs uppercase tracking-widest">orden ${item.sortOrder}</span>
        </div>
    `).join('');
}

function renderImportJobs(container, jobs) {
    if (!container) {
        return;
    }

    if (!jobs.length) {
        container.innerHTML = `
            <div class="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5">
                <p class="text-white font-bold mb-1">Aun no hay import jobs</p>
                <p class="text-slate-400 text-sm">La subida de CSV sera el siguiente paso. Esta vista ya queda preparada para mostrar la trazabilidad.</p>
            </div>
        `;
        return;
    }

    const rows = jobs.map(job => `
        <tr class="border-b border-white/5">
            <td class="p-3 text-slate-300 font-bold">${job.filename ?? '-'}</td>
            <td class="p-3 text-slate-400 text-xs uppercase tracking-widest">${job.jobType}</td>
            <td class="p-3">${renderStatusBadge(job.status)}</td>
            <td class="p-3 text-slate-400">${Number(job.errorCount ?? 0)}</td>
            <td class="p-3 text-slate-500 text-xs">${formatDate(job.createdAt)}</td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="w-full text-sm">
            <thead>
                <tr class="text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                    <th class="p-3 text-left">Archivo</th>
                    <th class="p-3 text-left">Tipo</th>
                    <th class="p-3 text-left">Estado</th>
                    <th class="p-3 text-left">Errores</th>
                    <th class="p-3 text-left">Creado</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderStatusBadge(status) {
    const normalized = String(status ?? '').toLowerCase();

    if (normalized === 'published' || normalized === 'validated') {
        return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">${normalized}</span>`;
    }

    if (normalized === 'failed' || normalized === 'cancelled') {
        return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">${normalized}</span>`;
    }

    return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">${normalized || 'unknown'}</span>`;
}

function formatDate(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value ?? '-';
    }

    return DATE_FORMATTER.format(date);
}

window.loadCatalog = loadCatalog;
window.actualizarBotonCatalogo = actualizarBotonCatalogo;

void actualizarBotonCatalogo();
