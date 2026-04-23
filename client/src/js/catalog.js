import {
    createCatalogImportJob,
    fetchCatalogImportJob,
    fetchCatalogImportJobs,
    fetchCatalogImportTemplates,
    fetchCatalogMe,
    fetchLeagueCreationOptions,
    publishCatalogImportJob,
} from './api.js';

const DATE_FORMATTER = new Intl.DateTimeFormat('es-ES', {
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    month: '2-digit',
    year: 'numeric',
});

const catalogState = {
    bindingsReady: false,
    isLoading: false,
    jobs: [],
    selectedJobId: null,
    selectedJobReview: null,
    templates: [],
};

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

export async function loadCatalog(options = {}) {
    ensureBindings();

    const titleEl = document.getElementById('catalog-access-badge');
    const statusEl = document.getElementById('catalog-status');
    const jobsEl = document.getElementById('catalog-jobs-table');
    const competitionsEl = document.getElementById('catalog-competitions-list');
    const seasonsEl = document.getElementById('catalog-seasons-list');
    const templatesEl = document.getElementById('catalog-templates-list');
    const detailEl = document.getElementById('catalog-job-detail');
    const importsCountEl = document.getElementById('catalog-imports-count');
    const competitionsCountEl = document.getElementById('catalog-competitions-count');
    const seasonsCountEl = document.getElementById('catalog-seasons-count');

    if (jobsEl) {
        jobsEl.innerHTML = '<p class="text-slate-500 text-sm">Cargando import jobs...</p>';
    }
    if (detailEl) {
        detailEl.innerHTML = '<p class="text-slate-500 text-sm">Cargando detalle del import...</p>';
    }

    catalogState.isLoading = true;

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

        const [optionsData, jobs, templates] = await Promise.all([
            fetchLeagueCreationOptions(),
            fetchCatalogImportJobs(20),
            fetchCatalogImportTemplates(),
        ]);

        catalogState.jobs = jobs;
        catalogState.templates = templates;

        const requestedJobId = normalizePositiveInteger(options.selectedJobId);
        const fallbackJobId = jobs[0]?.id ?? null;
        const selectedJobId = requestedJobId
            ?? (jobs.some(job => job.id === catalogState.selectedJobId) ? catalogState.selectedJobId : null)
            ?? fallbackJobId;

        let selectedReview = null;
        if (selectedJobId) {
            if (options.preloadedReview?.job?.id === selectedJobId) {
                selectedReview = options.preloadedReview;
            } else {
                selectedReview = await fetchCatalogImportJob(selectedJobId);
            }
        }

        catalogState.selectedJobId = selectedJobId;
        catalogState.selectedJobReview = selectedReview;

        renderTemplateOptions(document.getElementById('catalog-template-select'), templates);
        renderTemplates(templatesEl, templates);
        renderCompetitions(competitionsEl, optionsData.competitions ?? []);
        renderSeasons(seasonsEl, optionsData.seasons ?? []);
        renderImportJobs(jobsEl, jobs, selectedJobId);
        renderJobReview(detailEl, selectedReview);
        updatePublishButton(selectedReview);

        if (importsCountEl) importsCountEl.textContent = String(jobs.length);
        if (competitionsCountEl) competitionsCountEl.textContent = String((optionsData.competitions ?? []).length);
        if (seasonsCountEl) seasonsCountEl.textContent = String((optionsData.seasons ?? []).length);

        if (statusEl) {
            statusEl.textContent = selectedReview
                ? buildStatusCopy(selectedReview)
                : 'Sube un CSV o selecciona un import job para revisar su preview.';
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Error cargando el catalogo.';
        if (statusEl) {
            statusEl.textContent = `Error cargando el catalogo: ${message}`;
        }
        if (jobsEl) {
            jobsEl.innerHTML = `<p class="text-red-400 text-sm font-bold">${escapeHtml(message)}</p>`;
        }
        const detailEl = document.getElementById('catalog-job-detail');
        if (detailEl) {
            detailEl.innerHTML = `<p class="text-red-400 text-sm font-bold">${escapeHtml(message)}</p>`;
        }
    } finally {
        catalogState.isLoading = false;
    }
}

function ensureBindings() {
    if (catalogState.bindingsReady) {
        return;
    }

    const form = document.getElementById('catalog-import-form');
    if (form) {
        form.addEventListener('submit', handleImportSubmit);
    }

    const jobsTable = document.getElementById('catalog-jobs-table');
    if (jobsTable) {
        jobsTable.addEventListener('click', handleJobsTableClick);
    }

    const publishSelected = document.getElementById('catalog-publish-selected');
    if (publishSelected) {
        publishSelected.addEventListener('click', () => {
            if (catalogState.selectedJobId) {
                void publishSelectedJob(catalogState.selectedJobId);
            }
        });
    }

    catalogState.bindingsReady = true;
}

async function handleImportSubmit(event) {
    event.preventDefault();

    const templateSelect = document.getElementById('catalog-template-select');
    const fileInput = document.getElementById('catalog-csv-file');
    const feedbackEl = document.getElementById('catalog-import-feedback');
    const submitBtn = document.getElementById('catalog-import-submit');

    const templateKey = templateSelect?.value?.trim();
    const file = fileInput?.files?.[0];

    if (!templateKey) {
        setImportFeedback('Selecciona una plantilla antes de validar.', true);
        return;
    }

    if (!file) {
        setImportFeedback('Selecciona un archivo CSV.', true);
        return;
    }

    if (file.size > 1024 * 1024) {
        setImportFeedback('El archivo supera el limite recomendado de 1 MB para esta primera version.', true);
        return;
    }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Validando...';
    }

    setImportFeedback(`Leyendo ${file.name}...`, false);

    try {
        const csvContent = await file.text();
        const review = await createCatalogImportJob({
            templateKey,
            filename: file.name,
            csvContent,
        });

        catalogState.selectedJobId = review.job.id;
        setImportFeedback(`Validacion completada para ${file.name}.`, false);

        if (fileInput) {
            fileInput.value = '';
        }

        await loadCatalog({
            selectedJobId: review.job.id,
            preloadedReview: review,
        });
    } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo validar el CSV.';
        setImportFeedback(message, true);
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Validar CSV';
        }
    }

    if (feedbackEl) {
        feedbackEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function handleJobsTableClick(event) {
    const button = event.target instanceof Element
        ? event.target.closest('button[data-job-action]')
        : null;

    if (!button) {
        return;
    }

    const jobId = normalizePositiveInteger(button.getAttribute('data-job-id'));
    const action = button.getAttribute('data-job-action');
    if (!jobId || !action) {
        return;
    }

    if (action === 'view') {
        void loadCatalog({ selectedJobId: jobId });
        return;
    }

    if (action === 'publish') {
        void publishSelectedJob(jobId);
    }
}

async function publishSelectedJob(jobId) {
    const review = catalogState.selectedJobReview;
    const statusEl = document.getElementById('catalog-status');

    if (!window.confirm(`Vas a publicar el import job #${jobId}. Esta accion actualiza el catalogo global. Continuar?`)) {
        return;
    }

    try {
        if (statusEl) {
            statusEl.textContent = `Publicando import job #${jobId}...`;
        }

        await publishCatalogImportJob(jobId);
        await loadCatalog({ selectedJobId: jobId });

        if (statusEl) {
            statusEl.textContent = `Import job #${jobId} publicado correctamente.`;
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'No se pudo publicar el import job.';
        if (statusEl) {
            statusEl.textContent = `Error publicando el import job #${jobId}: ${message}`;
        }
        if (review?.job?.id === jobId) {
            updatePublishButton(review);
        }
    }
}

function renderTemplateOptions(selectEl, templates) {
    if (!selectEl) {
        return;
    }

    const currentValue = selectEl.value;

    if (!templates.length) {
        selectEl.innerHTML = '<option value="">No hay plantillas disponibles</option>';
        return;
    }

    selectEl.innerHTML = [
        '<option value="">Selecciona una plantilla</option>',
        ...templates.map(template => `<option value="${escapeAttribute(template.key)}">${escapeHtml(template.label)}</option>`),
    ].join('');

    if (templates.some(template => template.key === currentValue)) {
        selectEl.value = currentValue;
    }
}

function renderTemplates(container, templates) {
    if (!container) {
        return;
    }

    if (!templates.length) {
        container.innerHTML = '<p class="text-slate-500 text-sm">No hay plantillas publicadas.</p>';
        return;
    }

    container.innerHTML = templates.map(template => `
        <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <p class="text-white font-extrabold">${escapeHtml(template.label)}</p>
                    <p class="text-slate-400 text-sm mt-1">${escapeHtml(template.description)}</p>
                </div>
                <span class="text-[10px] font-black uppercase tracking-widest text-slate-500">${escapeHtml(template.key)}</span>
            </div>
            <p class="text-slate-500 text-xs uppercase tracking-widest mt-3 mb-2">Cabeceras requeridas</p>
            <div class="flex flex-wrap gap-2">
                ${template.expectedHeaders.map(header => `
                    <span class="px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-bold">
                        ${escapeHtml(header)}
                    </span>
                `).join('')}
            </div>
            <p class="text-slate-500 text-xs mt-3">Ejemplo: ${escapeHtml(template.sampleFilename)}</p>
        </div>
    `).join('');
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
                <p class="text-white font-extrabold">${escapeHtml(item.name)}</p>
                <p class="text-slate-500 text-xs uppercase tracking-widest">${escapeHtml(item.provider)} - source ${escapeHtml(String(item.sourceCompetitionId))}</p>
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
            <span class="text-white font-extrabold">${escapeHtml(item.season)}</span>
            <span class="text-slate-500 text-xs uppercase tracking-widest">orden ${escapeHtml(String(item.sortOrder))}</span>
        </div>
    `).join('');
}

function renderImportJobs(container, jobs, selectedJobId) {
    if (!container) {
        return;
    }

    if (!jobs.length) {
        container.innerHTML = `
            <div class="rounded-2xl border border-dashed border-white/10 bg-black/20 p-5">
                <p class="text-white font-bold mb-1">Aun no hay import jobs</p>
                <p class="text-slate-400 text-sm">Sube un CSV con una plantilla soportada para generar el primer preview.</p>
            </div>
        `;
        return;
    }

    const rows = jobs.map(job => `
        <tr class="border-b border-white/5 ${job.id === selectedJobId ? 'bg-white/[0.03]' : ''}">
            <td class="p-3 text-slate-300 font-bold">${escapeHtml(job.filename ?? '-')}</td>
            <td class="p-3 text-slate-400 text-xs uppercase tracking-widest">${escapeHtml(job.templateKey ?? job.jobType)}</td>
            <td class="p-3">${renderStatusBadge(job.status)}</td>
            <td class="p-3 text-slate-400">${escapeHtml(String(Number(job.errorCount ?? 0)))}</td>
            <td class="p-3 text-slate-500 text-xs">${formatDate(job.createdAt)}</td>
            <td class="p-3">
                <div class="flex flex-wrap gap-2">
                    <button type="button" data-job-action="view" data-job-id="${escapeAttribute(String(job.id))}" class="btn-glass px-3 py-2 text-[11px]">
                        Revisar
                    </button>
                    ${job.status === 'validated' && Number(job.errorCount ?? 0) === 0 ? `
                        <button type="button" data-job-action="publish" data-job-id="${escapeAttribute(String(job.id))}" class="btn-primary px-3 py-2 text-[11px]">
                            Publicar
                        </button>
                    ` : ''}
                </div>
            </td>
        </tr>
    `).join('');

    container.innerHTML = `
        <table class="w-full text-sm">
            <thead>
                <tr class="text-xs uppercase tracking-wider text-slate-500 border-b border-white/10">
                    <th class="p-3 text-left">Archivo</th>
                    <th class="p-3 text-left">Plantilla</th>
                    <th class="p-3 text-left">Estado</th>
                    <th class="p-3 text-left">Errores</th>
                    <th class="p-3 text-left">Creado</th>
                    <th class="p-3 text-left">Acciones</th>
                </tr>
            </thead>
            <tbody>${rows}</tbody>
        </table>
    `;
}

function renderJobReview(container, review) {
    if (!container) {
        return;
    }

    if (!review) {
        container.innerHTML = '<p class="text-slate-500 text-sm">Aun no hay un import job seleccionado.</p>';
        return;
    }

    const summary = review.job.validationSummary ?? {};
    const rowsPreview = Array.isArray(review.rowsPreview) ? review.rowsPreview : [];
    const errors = Array.isArray(review.errors) ? review.errors : [];
    const previewRows = rowsPreview.slice(0, 10);
    const previewErrors = errors.slice(0, 10);

    container.innerHTML = `
        <div class="space-y-5">
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div>
                    <p class="text-white font-extrabold text-lg">${escapeHtml(review.job.filename ?? 'Sin nombre')}</p>
                    <p class="text-slate-500 text-xs uppercase tracking-widest mt-1">
                        ${escapeHtml(review.job.templateKey ?? review.job.jobType)} - checksum ${escapeHtml(shortHash(review.job.checksumSha256))}
                    </p>
                </div>
                <div class="flex flex-wrap gap-2">
                    ${renderStatusBadge(review.job.status)}
                    <span class="text-xs font-black px-2.5 py-1 rounded-xl bg-white/5 border border-white/10 text-slate-300">filas ${escapeHtml(String(readSummaryNumber(summary, 'totalRows', review.totalRowsStored)))}</span>
                    <span class="text-xs font-black px-2.5 py-1 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">validas ${escapeHtml(String(readSummaryNumber(summary, 'validRows', 0)))}</span>
                    <span class="text-xs font-black px-2.5 py-1 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">errores ${escapeHtml(String(readSummaryNumber(summary, 'errorCount', review.job.errorCount ?? 0)))}</span>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p class="stat-label mb-1">Creado</p>
                    <p class="text-white font-black">${escapeHtml(formatDate(review.job.createdAt))}</p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p class="stat-label mb-1">Finalizado</p>
                    <p class="text-white font-black">${escapeHtml(formatDate(review.job.finishedAt))}</p>
                </div>
                <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                    <p class="stat-label mb-1">Publicado</p>
                    <p class="text-white font-black">${escapeHtml(formatDate(review.job.publishedAt))}</p>
                </div>
            </div>

            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p class="text-white font-bold mb-3">Preview de filas normalizadas</p>
                ${previewRows.length ? `
                    <div class="space-y-3">
                        ${previewRows.map(row => `
                            <div class="rounded-2xl border ${row.isValid ? 'border-green-500/20 bg-green-500/5' : 'border-red-500/20 bg-red-500/5'} p-3">
                                <div class="flex items-center justify-between gap-3 mb-2">
                                    <span class="text-xs font-black uppercase tracking-widest ${row.isValid ? 'text-green-400' : 'text-red-400'}">
                                        fila ${escapeHtml(String(row.rowNumber))} - ${row.isValid ? 'valida' : 'con errores'}
                                    </span>
                                </div>
                                <pre class="text-xs text-slate-300 whitespace-pre-wrap break-words">${escapeHtml(formatPayload(row.normalizedPayload ?? row.rawPayload ?? {}))}</pre>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-slate-500 text-sm">No hay filas almacenadas para mostrar.</p>'}
                ${review.totalRowsStored > previewRows.length ? `
                    <p class="text-slate-500 text-xs mt-3">Mostrando ${escapeHtml(String(previewRows.length))} de ${escapeHtml(String(review.totalRowsStored))} filas almacenadas.</p>
                ` : ''}
            </div>

            <div class="rounded-2xl border border-white/10 bg-black/20 p-4">
                <p class="text-white font-bold mb-3">Errores de validacion</p>
                ${previewErrors.length ? `
                    <div class="space-y-3">
                        ${previewErrors.map(error => `
                            <div class="rounded-2xl border border-red-500/20 bg-red-500/5 p-3">
                                <div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-widest text-red-300 mb-2">
                                    <span>fila ${escapeHtml(String(error.rowNumber ?? '-'))}</span>
                                    <span>${escapeHtml(error.fieldName ?? 'general')}</span>
                                    <span>${escapeHtml(error.errorCode)}</span>
                                </div>
                                <p class="text-sm text-red-100 font-semibold">${escapeHtml(error.message)}</p>
                            </div>
                        `).join('')}
                    </div>
                ` : '<p class="text-green-400 text-sm font-bold">Sin errores. El import job puede publicarse.</p>'}
                ${errors.length > previewErrors.length ? `
                    <p class="text-slate-500 text-xs mt-3">Mostrando ${escapeHtml(String(previewErrors.length))} de ${escapeHtml(String(errors.length))} errores.</p>
                ` : ''}
            </div>
        </div>
    `;
}

function updatePublishButton(review) {
    const button = document.getElementById('catalog-publish-selected');
    if (!button) {
        return;
    }

    if (!review?.canPublish) {
        button.classList.add('hidden');
        button.removeAttribute('data-job-id');
        return;
    }

    button.classList.remove('hidden');
    button.setAttribute('data-job-id', String(review.job.id));
}

function buildStatusCopy(review) {
    if (!review) {
        return 'Selecciona un import job para ver su resumen.';
    }

    if (review.canPublish) {
        return `El import job #${review.job.id} esta validado y listo para publicar.`;
    }

    if (review.job.status === 'published') {
        return `El import job #${review.job.id} ya fue publicado en el catalogo global.`;
    }

    if (review.job.errorCount > 0) {
        return `El import job #${review.job.id} tiene ${review.job.errorCount} errores y necesita correccion antes de publicarse.`;
    }

    return `Estado actual del import job #${review.job.id}: ${review.job.status}.`;
}

function renderStatusBadge(status) {
    const normalized = String(status ?? '').toLowerCase();

    if (normalized === 'published' || normalized === 'validated') {
        return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-green-500/10 text-green-400 border border-green-500/20">${escapeHtml(normalized)}</span>`;
    }

    if (normalized === 'failed' || normalized === 'cancelled') {
        return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">${escapeHtml(normalized)}</span>`;
    }

    return `<span class="text-xs font-black px-2.5 py-1 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">${escapeHtml(normalized || 'unknown')}</span>`;
}

function setImportFeedback(message, isError) {
    const feedbackEl = document.getElementById('catalog-import-feedback');
    if (!feedbackEl) {
        return;
    }

    feedbackEl.textContent = message;
    feedbackEl.className = isError
        ? 'text-sm text-red-400 font-bold'
        : 'text-sm text-slate-400';
}

function readSummaryNumber(summary, key, fallback) {
    const value = summary?.[key];
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function formatPayload(payload) {
    try {
        return JSON.stringify(payload, null, 2);
    } catch (_err) {
        return '{}';
    }
}

function shortHash(hash) {
    const normalized = String(hash ?? '').trim();
    return normalized ? normalized.slice(0, 10) : '-';
}

function formatDate(value) {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return DATE_FORMATTER.format(date);
}

function normalizePositiveInteger(value) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
    return escapeHtml(value);
}

window.loadCatalog = loadCatalog;
window.actualizarBotonCatalogo = actualizarBotonCatalogo;

ensureBindings();
void actualizarBotonCatalogo();
