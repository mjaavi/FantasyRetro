import {
    fetchMarketPlayers,
    fetchUserBids,
    submitBidRequest,
    cancelBidRequest,
    submitDirectOfferRequest,
    fetchReceivedTransferOffers,
    acceptTransferOfferRequest,
    rejectTransferOfferRequest,
    fetchTransferHistory,
    payReleaseClauseRequest,
    raiseReleaseClauseRequest,
    dismissPlayerRequest,
    sellPlayerRequest,
} from './api.js';
import { abrirPlayerDrawer, cerrarPlayerDrawer } from './player-drawer.js';
import { createPlayerCard } from './market-renderer.js';
import { getLigaActiva } from './leagues.js';
import { syncNavbarBudget } from './navbar-budget.js';
import { getApiBaseUrl } from './env.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const state = {
    currentPlayerApiId: null,
    pendingBidAmount: null,
    currentBids: new Map(),
    marketPlayers: new Map(),
    playerPositions: new Map(),
};

// ── Carga del mercado ─────────────────────────────────────────────────────────

export async function loadMarket() {
    const grid = document.getElementById('market-players-grid');
    if (!grid) return;

    const liga = getLigaActiva();
    if (!liga) {
        grid.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">Selecciona una liga para ver el mercado.</p>';
        return;
    }

    grid.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">Cargando mercado...</p>';

    try {
        const [players, bids] = await Promise.all([
            fetchMarketPlayers(liga.id),
            fetchUserBids(liga.id).catch(() => []),
        ]);

        // Map para lookup O(1): playerApiId → puja del usuario
        const bidsByPlayerId = new Map(bids.map(bid => [bid.playerApiId, bid]));
        const marketPlayers = new Map();
        const playerPositions = new Map();

        const fragment = document.createDocumentFragment();

        if (!players.length) {
            const empty = document.createElement('p');
            empty.className = 'text-slate-500 font-bold col-span-full text-center py-10';
            empty.textContent = 'No hay jugadores disponibles en el mercado hoy.';
            fragment.appendChild(empty);
        } else {
            for (const player of players) {
                const playerForRenderer = {
                    id:           player.playerApiId,
                    name:         player.playerName,
                    realTeam:     player.realTeam ?? player.real_team ?? 'Sin equipo',
                    position:     player.position,
                    market_value: player.marketValue,
                    previous_market_value: player.previousMarketValue ?? null,
                    market_value_delta: player.marketValueDelta ?? 0,
                    market_value_change_pct: player.marketValueChangePct ?? 0,
                    last_average_points: player.lastAveragePoints ?? null,
                    last_jornada_processed: player.lastJornadaProcessed ?? null,
                    playerFifaApiId: player.playerFifaApiId ?? null,
                    faceUrl:      player.faceUrl ?? null,
                    clubLogoUrl:  player.clubLogoUrl ?? null,
                    totalBids:    player.totalBids ?? 0,
                };
                marketPlayers.set(player.playerApiId, playerForRenderer);
                playerPositions.set(player.playerApiId, player.position);
                fragment.appendChild(createPlayerCard(playerForRenderer, bidsByPlayerId.get(player.playerApiId)));
            }
        }

        state.currentBids = bidsByPlayerId;
        state.marketPlayers = marketPlayers;
        state.playerPositions = playerPositions;

        grid.innerHTML = '';
        grid.appendChild(fragment);

        // AbortController para limpiar listeners entre recargas
        if (grid._abortController) grid._abortController.abort();
        grid._abortController = new AbortController();
        grid.addEventListener('click', handleGridClick, { signal: grid._abortController.signal });

        // Mostrar tiempo restante del mercado
        if (players.length) {
            actualizarCuentaAtras(players[0].expiresAt);
        }

    } catch (error) {
        console.error('[Market] Error al cargar:', error);
        grid.innerHTML = '<p class="text-red-500 font-bold col-span-full text-center py-10">Error al cargar el mercado.</p>';
    }
}

// ── Cuenta atrás ──────────────────────────────────────────────────────────────

function actualizarCuentaAtras(expiresAt) {
    const el = document.getElementById('market-countdown');
    if (!el) return;

    // Limpiar intervalo anterior
    if (el._countdownInterval) {
        clearInterval(el._countdownInterval);
        el._countdownInterval = null;
    }

    // Evitar recargar más de una vez por ciclo
    let reloadTriggered = false;

    const actualizar = () => {
        const diff = new Date(expiresAt) - new Date();
        if (diff <= 0) {
            el.textContent = 'Cerrando...';
            clearInterval(el._countdownInterval);
            el._countdownInterval = null;

            if (!reloadTriggered) {
                reloadTriggered = true;
                el.textContent = 'Cerrando...';

                // Cerrar el mercado desde el cliente al expirar
                // El servidor resolverá las pujas y abrirá uno nuevo
                const liga = JSON.parse(sessionStorage.getItem('ligaActiva') ?? '{}');
                if (liga?.id) {
                    import('./supabase.js').then(async ({ supabase }) => {
                        const apiUrl = await getApiBaseUrl();
                        const { data: { session } } = await supabase.auth.getSession();
                        if (!session) return;

                        fetch(`${apiUrl}/leagues/${liga.id}/market/close`, {
                            method: 'POST',
                            headers: { Authorization: `Bearer ${session.access_token}` }
                        }).catch(() => {}).finally(() => {
                            setTimeout(() => loadMarket(), 1000);
                        });
                    }).catch(() => {
                        setTimeout(() => loadMarket(), 3000);
                    });
                } else {
                    setTimeout(() => loadMarket(), 3000);
                }
            }
            return;
        }

        const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
        const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
        const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
        el.textContent = `${h}:${m}:${s}`;
    };

    actualizar();
    el._countdownInterval = setInterval(actualizar, 1000);
}

// ── Event delegation ──────────────────────────────────────────────────────────

function handleGridClick(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const { action, playerId, playerName, marketValue } = btn.dataset;

    if (action === 'open-bid-drawer') openBidDrawer(Number(playerId), playerName, marketValue);
    if (action === 'cancel-bid')      handleCancelBid(Number(playerId));
}

// ── Drawer de pujas ───────────────────────────────────────────────────────────

async function openBidDrawer(playerApiId, playerName, formattedValue) {
    state.currentPlayerApiId = playerApiId;
    const marketValue = Number(formattedValue) || 0;

    // Obtener puja actual si existe
    const currentBid = state.currentBids?.get(playerApiId) ?? null;

    await abrirPlayerDrawer({
        playerApiId,
        name:        playerName,
        position:    state.playerPositions?.get(playerApiId) ?? '—',
        marketValue,
        onBid: async ({ playerApiId: pid, amount, cancel }) => {
            if (cancel) {
                await handleCancelBid(pid);
            } else {
                state.pendingBidAmount = amount;
                await submitBid(amount);
            }
        },
        currentBid: currentBid ? { amount: currentBid.amount } : null,
    });
}

export function closeBidDrawer() {
    cerrarPlayerDrawer();
    state.currentPlayerApiId = null;
    state.pendingBidAmount = null;
}

function getBidDrawerElements() {
    return {
        amountInput: document.getElementById('pd-bid-amount') ?? document.getElementById('drawer-bid-amount'),
        errorEl: document.getElementById('pd-bid-error') ?? document.getElementById('drawer-bid-error'),
        submitBtn: document.getElementById('pd-submit-btn') ?? document.getElementById('drawer-submit-btn'),
    };
}

// ── Acciones de puja ──────────────────────────────────────────────────────────

function parseBidAmount(rawValue) {
    return parseInt(String(rawValue ?? '').replace(/\D/g, ''), 10) || 0;
}

function formatCurrency(value) {
    return new Intl.NumberFormat('es-ES').format(Number(value ?? 0));
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    }[char]));
}

function refreshMarketCard(playerApiId) {
    const player = state.marketPlayers?.get(playerApiId);
    const grid = document.getElementById('market-players-grid');
    const currentCard = grid?.querySelector(`[data-player-id="${playerApiId}"]`);

    if (!player || !currentCard) return;

    currentCard.replaceWith(createPlayerCard(player, state.currentBids?.get(playerApiId)));
}

export async function submitBid(amountOverride = null) {
    const liga = getLigaActiva();
    if (!liga) return;

    const { amountInput, errorEl, submitBtn } = getBidDrawerElements();
    const rawAmount = amountOverride ?? state.pendingBidAmount ?? amountInput?.dataset.amount ?? amountInput?.value ?? '0';
    const amount = parseBidAmount(rawAmount);
    const player = state.marketPlayers?.get(state.currentPlayerApiId);
    const minimumAmount = Number(player?.market_value ?? 0);

    if (errorEl) errorEl.classList.add('hidden');

    if (!amount || amount <= 0) {
        if (errorEl) { errorEl.textContent = 'Introduce una cantidad válida.'; errorEl.classList.remove('hidden'); }
        return;
    }

    if (amount < minimumAmount) {
        if (errorEl) { errorEl.textContent = 'La puja no puede ser inferior al valor del jugador.'; errorEl.classList.remove('hidden'); }
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

    try {
        const result = await submitBidRequest(liga.id, state.currentPlayerApiId, amount);
        await syncNavbarBudget(result.data?.newBudget);
        state.currentBids.set(state.currentPlayerApiId, {
            ...(state.currentBids.get(state.currentPlayerApiId) ?? {}),
            playerApiId: state.currentPlayerApiId,
            amount,
        });
        refreshMarketCard(state.currentPlayerApiId);
        closeBidDrawer();
    } catch (error) {
        if (errorEl) { errorEl.textContent = error.message ?? 'Error al pujar.'; errorEl.classList.remove('hidden'); }
    } finally {
        state.pendingBidAmount = null;
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Confirmar Oferta'; }
    }
}

async function handleCancelBid(playerApiId) {
    const liga = getLigaActiva();
    if (!liga) return;

    try {
        const result = await cancelBidRequest(liga.id, playerApiId);
        await syncNavbarBudget(result.data?.newBudget);
        state.currentBids.delete(playerApiId);
        refreshMarketCard(playerApiId);

        if (state.currentPlayerApiId === playerApiId) {
            closeBidDrawer();
        }
    } catch (error) {
        console.error('[Market] Error al cancelar puja:', error.message);
    }
}

export async function submitDirectOffer({ sellerUserId, playerApiId, amount }) {
    const liga = getLigaActiva();
    if (!liga) return;

    const result = await submitDirectOfferRequest(liga.id, sellerUserId, playerApiId, parseBidAmount(amount));
    await syncNavbarBudget(result.data?.newBudget);
    return result;
}

export async function payReleaseClause({ sellerUserId, playerApiId }) {
    const liga = getLigaActiva();
    if (!liga) return;

    const result = await payReleaseClauseRequest(liga.id, sellerUserId, playerApiId);
    await syncNavbarBudget(result.data?.newBudget);
    return result;
}

export async function raiseReleaseClause({ playerApiId, contribution }) {
    const liga = getLigaActiva();
    if (!liga) return;

    const result = await raiseReleaseClauseRequest(liga.id, playerApiId, parseBidAmount(contribution));
    await syncNavbarBudget(result.data?.newBudget);
    return result;
}

export async function dismissPlayer({ playerApiId }) {
    const liga = getLigaActiva();
    if (!liga) return;

    const result = await dismissPlayerRequest(liga.id, playerApiId);
    await syncNavbarBudget(result.data?.newBudget);
    return result;
}

export async function sellPlayer({ playerApiId }) {
    const liga = getLigaActiva();
    if (!liga) return;

    const result = await sellPlayerRequest(liga.id, playerApiId);
    return result;
}

export async function loadReceivedTransferOffers() {
    const list = document.getElementById('market-received-offers-list');
    const liga = getLigaActiva();
    if (!list || !liga) return;

    list.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">Cargando ofertas...</p>';

    try {
        const offers = await fetchReceivedTransferOffers(liga.id);
        list.innerHTML = '';

        if (!offers.length) {
            list.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">No tienes ofertas pendientes por jugadores de tu equipo.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const offer of offers) {
            fragment.appendChild(createReceivedOfferCard(offer));
        }
        list.appendChild(fragment);

        if (list._offersAbort) list._offersAbort.abort();
        list._offersAbort = new AbortController();
        list.addEventListener('click', handleOfferAction, { signal: list._offersAbort.signal });
    } catch (error) {
        console.error('[Market] Error al cargar ofertas recibidas:', error);
        list.innerHTML = '<p class="text-red-400 font-bold col-span-full text-center py-10">Error al cargar tus ofertas.</p>';
    }
}

function createReceivedOfferCard(offer) {
    const card = document.createElement('div');
    card.className = 'bg-white/[0.04] border border-white/10 rounded-xl p-4 flex items-center gap-4';

    card.innerHTML = `
        <div class="w-12 h-12 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 font-black shrink-0">
            ${escapeHtml(offer.position ?? 'JUG')}
        </div>
        <div class="flex-1 min-w-0">
            <p class="text-white font-extrabold truncate">${escapeHtml(offer.playerName)}</p>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(offer.buyerTeamName)} ofrece</p>
            <p class="text-lg text-green-400 font-black">${formatCurrency(offer.amount)} €</p>
        </div>
        <div class="flex gap-2 shrink-0">
            <button data-action="accept-direct-offer" data-offer-id="${offer.id}" class="px-3 py-2 rounded-lg bg-green-500/15 border border-green-500/25 text-green-300 text-xs font-black hover:bg-green-500/25">Aceptar</button>
            <button data-action="reject-direct-offer" data-offer-id="${offer.id}" class="px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-300 text-xs font-black hover:bg-red-500/20">Rechazar</button>
        </div>
    `;

    return card;
}

async function handleOfferAction(event) {
    const btn = event.target.closest('[data-action]');
    if (!btn) return;

    const liga = getLigaActiva();
    if (!liga) return;

    const { action, offerId } = btn.dataset;
    btn.disabled = true;
    const originalText = btn.textContent;
    btn.textContent = '...';

    try {
        const result = action === 'accept-direct-offer'
            ? await acceptTransferOfferRequest(liga.id, offerId)
            : await rejectTransferOfferRequest(liga.id, offerId);

        if (result.data?.newBudget !== undefined) {
            await syncNavbarBudget(result.data.newBudget);
        }
        await loadReceivedTransferOffers();
        await loadTransferHistory();
    } catch (error) {
        console.error('[Market] Error resolviendo oferta:', error);
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

export async function loadTransferHistory() {
    const list = document.getElementById('market-transfer-history-list');
    const liga = getLigaActiva();
    if (!list || !liga) return;

    list.innerHTML = '<p class="text-slate-500 font-bold text-center py-10">Cargando historico...</p>';

    try {
        const history = await fetchTransferHistory(liga.id);
        list.innerHTML = '';

        if (!history.length) {
            list.innerHTML = '<p class="text-slate-500 font-bold text-center py-10">Todavia no hay fichajes registrados en esta liga.</p>';
            return;
        }

        const fragment = document.createDocumentFragment();
        for (const item of history) {
            fragment.appendChild(createTransferHistoryRow(item));
        }
        list.appendChild(fragment);
    } catch (error) {
        console.error('[Market] Error al cargar historico:', error);
        list.innerHTML = '<p class="text-red-400 font-bold text-center py-10">Error al cargar el historico.</p>';
    }
}

function createTransferHistoryRow(item) {
    const row = document.createElement('div');
    row.className = 'bg-white/[0.04] border border-white/10 rounded-xl p-4 flex flex-col md:flex-row md:items-center gap-3';
    const source = item.transferType === 'market' ? 'Mercado' : item.fromTeamName;

    row.innerHTML = `
        <div class="flex-1 min-w-0">
            <p class="text-white font-extrabold truncate">${escapeHtml(item.playerName)}</p>
            <p class="text-xs text-slate-400 truncate">${escapeHtml(source)} -> ${escapeHtml(item.toTeamName)}</p>
        </div>
        <div class="flex items-center justify-between md:justify-end gap-4">
            <span class="text-xs font-bold text-slate-500">${new Date(item.createdAt).toLocaleDateString('es-ES')}</span>
            <span class="text-green-400 font-black">${formatCurrency(item.amount)} €</span>
        </div>
    `;
    return row;
}

// ── UI ────────────────────────────────────────────────────────────────────────


// ── Global ────────────────────────────────────────────────────────────────────

window.closeBidDrawer = closeBidDrawer;
window.submitBid      = submitBid;
window.loadMarket     = loadMarket;
window.submitDirectOffer = submitDirectOffer;
window.payReleaseClause = payReleaseClause;
window.raiseReleaseClause = raiseReleaseClause;
window.dismissPlayer = dismissPlayer;
window.sellPlayer = sellPlayer;
window.loadReceivedTransferOffers = loadReceivedTransferOffers;
window.loadTransferHistory = loadTransferHistory;

// ── Arranque ──────────────────────────────────────────────────────────────────
// loadMarket() is driven by navigation.js to avoid redundant requests.
