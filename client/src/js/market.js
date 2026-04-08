import { fetchMarketPlayers, fetchUserBids, submitBidRequest, cancelBidRequest, invalidateCache, apiFetch } from './api.js';
import { abrirPlayerDrawer, cerrarPlayerDrawer } from './player-drawer.js';
import { createPlayerCard } from './market-renderer.js';
import { getLigaActiva } from './leagues.js';
import { syncNavbarBudget } from './navbar-budget.js';
import { getApiBaseUrl } from './env.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const state = {
    currentPlayerApiId: null,
    pendingBidAmount: null,
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

    // Limpiar caché para forzar datos frescos del servidor
    invalidateCache(`league-market-${liga.id}-0`);

    grid.innerHTML = '<p class="text-slate-500 font-bold col-span-full text-center py-10">Cargando mercado...</p>';

    try {
        const [players, bids] = await Promise.all([
            fetchMarketPlayers(liga.id),
            fetchUserBids(liga.id).catch(() => []),
        ]);

        // Map para lookup O(1): playerApiId → puja del usuario
        const bidsByPlayerId = new Map(bids.map(bid => [bid.playerApiId, bid]));

        // Cargar puntos globales de TODOS los jugadores de la liga
        let puntosMap = new Map();
        try {
            const liga = getLigaActiva();
            if (liga) {
                const res = await apiFetch(`/admin/ligas/${liga.id}/global-scores`);
                const totals = res.data ?? {};
                for (const [id, pts] of Object.entries(totals)) {
                    puntosMap.set(Number(id), pts);
                }
            }
        } catch (_) {}

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
                    playerFifaApiId: player.playerFifaApiId ?? null,
                    faceUrl:      player.faceUrl ?? null,
                    clubLogoUrl:  player.clubLogoUrl ?? null,
                    totalPts:     puntosMap.has(player.playerApiId) ? puntosMap.get(player.playerApiId) : null,
                };
                fragment.appendChild(createPlayerCard(playerForRenderer, bidsByPlayerId.get(player.playerApiId)));
            }
        }

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
    const marketValue = parseInt(formattedValue.replace(/\D/g, ''), 10) || 0;

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

export async function submitBid(amountOverride = null) {
    const liga = getLigaActiva();
    if (!liga) return;

    const { amountInput, errorEl, submitBtn } = getBidDrawerElements();
    const rawAmount   = amountOverride ?? state.pendingBidAmount ?? amountInput?.value ?? '0';
    const amount      = parseInt(rawAmount, 10);

    if (errorEl) errorEl.classList.add('hidden');

    if (!amount || amount <= 0) {
        if (errorEl) { errorEl.textContent = 'Introduce una cantidad válida.'; errorEl.classList.remove('hidden'); }
        return;
    }

    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Enviando...'; }

    try {
        const result = await submitBidRequest(liga.id, state.currentPlayerApiId, amount);
        await syncNavbarBudget(result.data?.newBudget);
        closeBidDrawer();
        loadMarket();
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
        loadMarket();
    } catch (error) {
        console.error('[Market] Error al cancelar puja:', error.message);
    }
}

// ── UI ────────────────────────────────────────────────────────────────────────


// ── Global ────────────────────────────────────────────────────────────────────

window.closeBidDrawer = closeBidDrawer;
window.submitBid      = submitBid;
window.loadMarket     = loadMarket;

// ── Arranque ──────────────────────────────────────────────────────────────────
loadMarket();
