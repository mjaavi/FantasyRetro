// ─────────────────────────────────────────────────────────────────────────────
// player-search.js — Módulo de búsqueda de jugadores en el mercado
// SRP: Solo gestiona la pestaña de búsqueda, filtros y renderizado de resultados.
// DRY: Reutiliza createPlayerCard de market-renderer.js y abrirPlayerDrawer.
// ─────────────────────────────────────────────────────────────────────────────

import { fetchSearchPlayers } from './api.js';
import { createPlayerCard } from './market-renderer.js';
import { abrirPlayerDrawer } from './player-drawer.js';
import { getLigaActiva } from './leagues.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const searchState = {
    currentPage: 0,
    totalCount: 0,
    isLoading: false,
    lastFilters: {},
};

// ── Pestaña ───────────────────────────────────────────────────────────────────

const TAB_ACTIVE_CLS = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
const TAB_INACTIVE_CLS = 'text-slate-500 hover:text-slate-300 border border-transparent';

export function initMarketTabs() {
    const tabMarket = document.getElementById('market-tab-mercado');
    const tabSearch = document.getElementById('market-tab-buscar');
    const panelMarket = document.getElementById('market-panel-mercado');
    const panelSearch = document.getElementById('market-panel-buscar');
    const headerCountdown = document.getElementById('market-header-countdown');

    if (!tabMarket || !tabSearch || !panelMarket || !panelSearch) return;

    tabMarket.addEventListener('click', () => {
        switchTab('mercado');
    });

    tabSearch.addEventListener('click', () => {
        switchTab('buscar');
    });

    function switchTab(tab) {
        const isMarket = tab === 'mercado';

        // Tabs
        tabMarket.className = `flex-1 text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${isMarket ? TAB_ACTIVE_CLS : TAB_INACTIVE_CLS}`;
        tabSearch.className = `flex-1 text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${!isMarket ? TAB_ACTIVE_CLS : TAB_INACTIVE_CLS}`;

        // Panels
        panelMarket.style.display = isMarket ? '' : 'none';
        panelSearch.style.display = isMarket ? 'none' : '';

        // Hide countdown on search tab
        if (headerCountdown) {
            headerCountdown.style.display = isMarket ? '' : 'none';
        }
    }

    // Filtros
    const searchBtn = document.getElementById('search-players-btn');
    const searchInput = document.getElementById('search-players-input');
    const searchPosition = document.getElementById('search-players-position');

    if (searchBtn) {
        searchBtn.addEventListener('click', () => executeSearch());
    }

    if (searchInput) {
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                executeSearch();
            }
        });
    }

    if (searchPosition) {
        searchPosition.addEventListener('change', () => executeSearch());
    }
}

// ── Búsqueda ──────────────────────────────────────────────────────────────────

async function executeSearch(page = 0) {
    const liga = getLigaActiva();
    if (!liga) return;

    const grid = document.getElementById('search-results-grid');
    const paginationEl = document.getElementById('search-pagination');
    if (!grid) return;

    const query = document.getElementById('search-players-input')?.value?.trim() ?? '';
    const position = document.getElementById('search-players-position')?.value ?? '';

    searchState.currentPage = page;
    searchState.lastFilters = { query, position };
    searchState.isLoading = true;

    grid.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">Buscando jugadores...</p>';

    try {
        const result = await fetchSearchPlayers(liga.id, { query, position, page });
        searchState.totalCount = result.totalCount;
        searchState.isLoading = false;

        grid.innerHTML = '';
        const fragment = document.createDocumentFragment();

        if (!result.players?.length) {
            const empty = document.createElement('p');
            empty.className = 'text-slate-500 font-bold col-span-full text-center py-10';
            empty.textContent = query
                ? `No se encontraron jugadores para "${query}".`
                : 'No se encontraron jugadores con esos filtros.';
            fragment.appendChild(empty);
        } else {
            for (const player of result.players) {
                const card = createSearchPlayerCard(player);
                fragment.appendChild(card);
            }
        }

        grid.appendChild(fragment);

        // Pagination
        renderPagination(paginationEl, result);

        // Event delegation for click on cards
        if (grid._searchAbort) grid._searchAbort.abort();
        grid._searchAbort = new AbortController();
        grid.addEventListener('click', handleSearchGridClick, { signal: grid._searchAbort.signal });

    } catch (error) {
        console.error('[PlayerSearch] Error:', error);
        searchState.isLoading = false;
        grid.innerHTML = '<p class="text-red-500 font-bold col-span-full text-center py-10">Error al buscar jugadores.</p>';
    }
}

// ── Renderizado ───────────────────────────────────────────────────────────────

function createSearchPlayerCard(player) {
    // Map DTO to the format expected by createPlayerCard
    const playerForRenderer = {
        id: player.playerApiId,
        name: player.name,
        realTeam: player.realTeam,
        position: player.position,
        market_value: player.marketValue ?? player.overall * 100000,
        previous_market_value: player.previousMarketValue ?? null,
        market_value_delta: player.marketValueDelta ?? 0,
        market_value_change_pct: player.marketValueChangePct ?? 0,
        last_average_points: player.lastAveragePoints ?? null,
        last_jornada_processed: player.lastJornadaProcessed ?? null,
        playerFifaApiId: player.playerFifaApiId ?? null,
        faceUrl: player.faceUrl ?? null,
        clubLogoUrl: player.clubLogoUrl ?? null,
    };

    if (player.isInMarket) {
        // In market: render with bid button (no existing bid from search context)
        const card = createPlayerCard(playerForRenderer, null);
        card.dataset.searchIsInMarket = 'true';
        return card;
    }

    // NOT in market: render card with disabled button
    const card = createPlayerCard(playerForRenderer, null);
    card.dataset.searchIsInMarket = 'false';

    // Replace the action button with a disabled "No disponible" button
    const actionsEl = card.querySelector('.market-player-actions');
    if (actionsEl) {
        actionsEl.innerHTML = '';
        const disabledBtn = document.createElement('button');
        disabledBtn.className = 'market-player-button market-player-button-disabled';
        disabledBtn.textContent = 'No disponible';
        disabledBtn.disabled = true;
        disabledBtn.style.cssText = 'opacity:0.4; cursor:not-allowed; pointer-events:none;';
        actionsEl.appendChild(disabledBtn);
    }

    // Add a subtle badge
    const badge = document.createElement('span');
    badge.className = 'search-not-in-market-badge';
    badge.textContent = 'No en mercado';
    badge.style.cssText = `
        position:absolute; top:10px; right:10px; z-index:5;
        font-size:9px; font-weight:800; text-transform:uppercase;
        letter-spacing:0.05em; padding:3px 8px; border-radius:6px;
        background:rgba(248,113,113,0.15); border:1px solid rgba(248,113,113,0.3);
        color:#f87171;
    `;
    card.style.position = 'relative';
    card.appendChild(badge);

    return card;
}

function renderPagination(container, result) {
    if (!container) return;
    container.innerHTML = '';

    const { totalCount, page, pageSize } = result;
    const totalPages = Math.ceil(totalCount / pageSize);

    if (totalPages <= 1) return;

    const wrap = document.createElement('div');
    wrap.className = 'flex items-center justify-center gap-3 mt-6';

    // Prev
    if (page > 0) {
        const prev = createPaginationBtn('← Anterior', () => executeSearch(page - 1));
        wrap.appendChild(prev);
    }

    // Info
    const info = document.createElement('span');
    info.className = 'text-xs font-bold text-slate-500';
    info.textContent = `Página ${page + 1} de ${totalPages} · ${totalCount} jugadores`;
    wrap.appendChild(info);

    // Next
    if (page < totalPages - 1) {
        const next = createPaginationBtn('Siguiente →', () => executeSearch(page + 1));
        wrap.appendChild(next);
    }

    container.appendChild(wrap);
}

function createPaginationBtn(text, onClick) {
    const btn = document.createElement('button');
    btn.className = 'px-3 py-1.5 text-xs font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors';
    btn.textContent = text;
    btn.addEventListener('click', onClick);
    return btn;
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleSearchGridClick(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) {
        // Click on card body → open drawer (stats only if not in market)
        const card = event.target.closest('.market-player-card');
        if (card) {
            openSearchPlayerDrawer(card);
        }
        return;
    }

    const { action, playerId } = btn.dataset;
    if (action === 'open-bid-drawer') {
        // Only if player is in market
        const card = btn.closest('.market-player-card');
        if (card?.dataset.searchIsInMarket === 'true') {
            openSearchPlayerBidDrawer(Number(playerId), card);
        }
    }
}

function openSearchPlayerDrawer(card) {
    const playerApiId = Number(card.dataset.playerId);
    const nameEl = card.querySelector('.market-player-name');
    const posEl = card.querySelector('.market-player-pos');

    abrirPlayerDrawer({
        playerApiId,
        name: nameEl?.textContent ?? 'Jugador',
        position: posEl?.textContent ?? '',
        marketValue: 0,
        readOnly: true, // No bid section for search-only results
    });
}

function openSearchPlayerBidDrawer(playerApiId, card) {
    const nameEl = card.querySelector('.market-player-name');
    const posEl = card.querySelector('.market-player-pos');

    // Use loadMarket's openBidDrawer via importing market.js
    // Since market already handles bidding, we delegate
    import('./market.js').then(({ submitBid, closeBidDrawer }) => {
        abrirPlayerDrawer({
            playerApiId,
            name: nameEl?.textContent ?? 'Jugador',
            position: posEl?.textContent ?? '',
            marketValue: Number(card.querySelector('.market-player-price-value')?.textContent?.replace(/[^\d]/g, '') ?? 0),
            onBid: async ({ playerApiId: pid, amount, cancel }) => {
                if (cancel) {
                    // Delegate to market's cancel
                    const { cancelBidRequest } = await import('./api.js');
                    const liga = getLigaActiva();
                    if (liga) {
                        await cancelBidRequest(liga.id, pid);
                        closeBidDrawer();
                    }
                } else {
                    await submitBid(amount);
                }
            },
        });
    });
}

// ── Arranque ──────────────────────────────────────────────────────────────────

initMarketTabs();
