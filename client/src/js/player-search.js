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
    const tabs = {
        mercado: document.getElementById('market-tab-mercado'),
        pujas: document.getElementById('market-tab-pujas'),
        historico: document.getElementById('market-tab-historico'),
        buscar: document.getElementById('market-tab-buscar'),
    };
    const panels = {
        mercado: document.getElementById('market-panel-mercado'),
        pujas: document.getElementById('market-panel-pujas'),
        historico: document.getElementById('market-panel-historico'),
        buscar: document.getElementById('market-panel-buscar'),
    };
    const headerCountdown = document.getElementById('market-header-countdown');

    if (!tabs.mercado || !tabs.buscar || !panels.mercado || !panels.buscar) return;

    Object.entries(tabs).forEach(([tabName, tabEl]) => {
        tabEl?.addEventListener('click', () => switchTab(tabName));
    });

    function switchTab(tab) {
        Object.entries(tabs).forEach(([name, tabEl]) => {
            if (!tabEl) return;
            const isActive = name === tab;
            tabEl.className = `flex-1 min-w-[110px] text-xs font-bold py-2.5 px-3 rounded-lg transition-all duration-200 flex items-center justify-center gap-1.5 ${isActive ? TAB_ACTIVE_CLS : TAB_INACTIVE_CLS}`;
        });

        Object.entries(panels).forEach(([name, panelEl]) => {
            if (panelEl) panelEl.style.display = name === tab ? '' : 'none';
        });

        // Hide countdown on search tab
        if (headerCountdown) {
            headerCountdown.style.display = tab === 'mercado' ? '' : 'none';
        }

        if (tab === 'pujas' && window.loadReceivedTransferOffers) {
            window.loadReceivedTransferOffers();
        }
        if (tab === 'historico' && window.loadTransferHistory) {
            window.loadTransferHistory();
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
        market_value: player.marketValue ?? 0,
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

    // NOT in market: render card without action buttons (clean, read-only)
    const card = createPlayerCard(playerForRenderer, null);
    card.dataset.searchIsInMarket = 'false';

    // Remove the action buttons entirely — player is not biddable
    const footerEl = card.querySelector('.market-player-footer');
    if (footerEl) {
        footerEl.remove();
    }

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
