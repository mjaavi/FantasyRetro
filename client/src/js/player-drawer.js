// ─────────────────────────────────────────────────────────────────────────────
// player-drawer.js
// Drawer lateral reutilizable para ver el historial de puntos de un jugador.
// Se usa desde market.js (scouting) y roster.js (plantilla).
// ─────────────────────────────────────────────────────────────────────────────

import { apiFetch }    from './api.js';
import { getLigaActiva } from './leagues.js';

const PICAS_LABEL    = { NEG: '👎 Negativo', SC: 'S.C.', P1: '★ 1 Pica', P2: '★★ 2 Picas', P3: '★★★ 3 Picas', P4: '★★★★ 4 Picas' };
const CRONISTA_COLOR = { analitico: '#60a5fa', exigente: '#f59e0b', pasional: '#a855f7' };
const POS_LABEL      = { PT: 'Portero', DF: 'Defensa', MC: 'Centrocampista', DL: 'Delantero' };
const BID_STEP = 100_000;

function formatCurrency(value) {
    return `${new Intl.NumberFormat('es-ES').format(Number(value ?? 0))} €`;
}

function parseCurrency(value) {
    return parseInt(String(value ?? '').replace(/\D/g, ''), 10) || 0;
}

function getAvailableBidBudget(currentBid) {
    const budgetText = document.getElementById('user-budget')?.textContent ?? '';
    return parseCurrency(budgetText) + Number(currentBid?.amount ?? 0);
}

/**
 * Abre el drawer con el historial de puntos de un jugador.
 * @param {object} opts
 * @param {number} opts.playerApiId
 * @param {string} opts.name
 * @param {string} opts.position
 * @param {number} opts.marketValue
 * @param {function} [opts.onBid]        - Si se pasa, muestra sección de puja
 * @param {object}   [opts.currentBid]   - Puja actual del usuario (si existe)
 */
export async function abrirPlayerDrawer({ playerApiId, name, position, marketValue, onBid, currentBid }) {
    const drawer  = document.getElementById('player-drawer');
    const overlay = document.getElementById('player-drawer-overlay');
    if (!drawer || !overlay) return;

    // Rellenar header
    document.getElementById('pd-name').textContent     = name;
    document.getElementById('pd-position').textContent = POS_LABEL[position] ?? position;
    document.getElementById('pd-value').textContent    = formatCurrency(marketValue);
    document.getElementById('pd-pts').textContent      = '—';
    document.getElementById('pd-pts').style.color      = '#60a5fa';

    // Mostrar/ocultar sección de puja
    const bidSection = document.getElementById('pd-bid-section');
    if (bidSection) {
        if (onBid) {
            bidSection.style.display = '';
            _setupBidSection(playerApiId, name, marketValue, onBid, currentBid);
        } else {
            bidSection.style.display = 'none';
        }
    }

    // Abrir drawer
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-x-full');
    });

    // Cargar historial
    const barsEl = document.getElementById('pd-bars');
    barsEl.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Cargando rendimiento...</p>';

    try {
        const liga = getLigaActiva();
        const res  = await apiFetch(`/admin/ligas/${liga.id}/jugador/${playerApiId}/historial`);
        const h    = res.data;

        const ptsEl = document.getElementById('pd-pts');
        ptsEl.textContent = `${h.total} pts`;
        ptsEl.style.color = h.total >= 0 ? '#60a5fa' : '#f87171';

        _renderBarras(barsEl, h);
    } catch (e) {
        barsEl.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Sin datos disponibles</p>';
    }
}

function _renderBarras(container, h) {
    if (!h.historial.length) {
        container.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Sin jornadas procesadas</p>';
        return;
    }

    const maxAbs = Math.max(...h.historial.filter(j => j.jugo).map(j => Math.abs(j.puntos_total)), 1);

    container.innerHTML = '';

    // Contenedor de barras con scroll horizontal
    const wrap = document.createElement('div');
    wrap.style.cssText = `
        display: flex;
        align-items: flex-end;
        gap: 8px;
        min-height: 140px;
        padding-bottom: 8px;
        overflow-x: auto;
        padding: 0 4px 8px;
        scrollbar-width: none;
    `;

    const detailEl = document.createElement('div');
    detailEl.id = 'pd-bar-detail';
    detailEl.style.cssText = `
        margin-top: 16px;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 14px;
        padding: 14px 16px;
        min-height: 64px;
        transition: all .2s;
    `;
    detailEl.innerHTML = '<p style="color:#334155;font-size:12px;text-align:center">Toca una jornada para ver el desglose</p>';

    for (const j of h.historial) {
        const col = document.createElement('div');
        col.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:4px;cursor:pointer;flex-shrink:0;width:36px';

        if (!j.jugo) {
            // Barra vacía
            col.innerHTML = `
                <div style="width:28px;height:120px;display:flex;align-items:flex-end;justify-content:center">
                    <div style="width:28px;height:4px;background:rgba(255,255,255,0.06);border-radius:4px"></div>
                </div>
                <span style="font-size:9px;font-weight:700;color:#334155">J${j.jornada}</span>`;
        } else {
            const pts    = j.puntos_total;
            const pct    = Math.max(4, (Math.abs(pts) / maxAbs) * 110);
            const color  = pts >= 0 ? '#3b82f6' : '#ef4444';
            const glow   = pts >= 0 ? 'rgba(59,130,246,0.4)' : 'rgba(239,68,68,0.4)';

            col.innerHTML = `
                <span style="font-size:9px;font-weight:900;color:${color}">${pts}</span>
                <div style="width:28px;height:120px;display:flex;align-items:flex-end;justify-content:center">
                    <div class="pd-bar" data-jornada="${j.jornada}" style="
                        width:28px;
                        height:0px;
                        background:${color};
                        border-radius:6px 6px 3px 3px;
                        box-shadow:0 0 8px ${glow};
                        transition:height .5s cubic-bezier(0.34,1.56,0.64,1), box-shadow .2s;
                        --target:${pct}px;
                    "></div>
                </div>
                <span style="font-size:9px;font-weight:700;color:#475569">J${j.jornada}</span>`;

            // Click → mostrar detalle
            const base    = Number(j.puntos_base);
            const cronista = j.puntos_total - Math.round(base); // aproximación
            col.addEventListener('click', () => {
                // Resaltar barra seleccionada
                wrap.querySelectorAll('.pd-bar').forEach(b => b.style.opacity = '0.4');
                col.querySelector('.pd-bar').style.opacity = '1';
                col.querySelector('.pd-bar').style.boxShadow = `0 0 16px ${glow}`;

                detailEl.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                        <span style="font-size:12px;font-weight:700;color:#94a3b8">Jornada ${j.jornada}</span>
                        <span style="font-size:20px;font-weight:900;color:${pts >= 0 ? '#60a5fa' : '#f87171'}">${pts} pts</span>
                    </div>
                    <div style="display:flex;gap:8px;flex-wrap:wrap">
                        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:8px 10px;text-align:center">
                            <p style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Base</p>
                            <p style="font-size:15px;font-weight:900;color:#e2e8f0">${base.toFixed(1)}</p>
                        </div>
                        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:8px 10px;text-align:center">
                            <p style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Picas</p>
                            <p style="font-size:12px;font-weight:900;color:${CRONISTA_COLOR[j.cronista_type] ?? '#94a3b8'}">${PICAS_LABEL[j.picas] ?? j.picas}</p>
                        </div>
                        <div style="flex:1;background:rgba(255,255,255,0.04);border-radius:10px;padding:8px 10px;text-align:center">
                            <p style="font-size:9px;font-weight:700;color:#475569;text-transform:uppercase;letter-spacing:.06em;margin-bottom:2px">Cronista</p>
                            <p style="font-size:12px;font-weight:900;color:${CRONISTA_COLOR[j.cronista_type] ?? '#94a3b8'};text-transform:capitalize">${j.cronista_type}</p>
                        </div>
                    </div>`;
            });
        }

        wrap.appendChild(col);
    }

    container.appendChild(wrap);
    container.appendChild(detailEl);

    // Animar barras al renderizar
    requestAnimationFrame(() => {
        setTimeout(() => {
            container.querySelectorAll('.pd-bar').forEach((bar, i) => {
                setTimeout(() => {
                    bar.style.height = bar.style.getPropertyValue('--target') || '4px';
                }, i * 40);
            });
        }, 50);
    });
}

function _setupBidSection(playerApiId, name, marketValue, onBid, currentBid) {
    const amountInput = document.getElementById('pd-bid-amount');
    const errorEl     = document.getElementById('pd-bid-error');
    const submitBtn   = document.getElementById('pd-submit-btn');
    const cancelBtn   = document.getElementById('pd-cancel-btn');
    const minEl       = document.getElementById('pd-bid-min');
    const currentEl   = document.getElementById('pd-bid-current');
    const availableEl = document.getElementById('pd-bid-available');
    const bidSection  = document.getElementById('pd-bid-section');

    const minimumAmount = Number(marketValue ?? 0);
    const availableBudget = getAvailableBidBudget(currentBid);

    const setAmount = (nextAmount) => {
        if (!amountInput) return;

        const normalized = Math.max(minimumAmount, Math.trunc(Number(nextAmount) || minimumAmount));
        amountInput.dataset.amount = String(normalized);
        amountInput.value = formatCurrency(normalized);
    };

    const getAmount = () => parseCurrency(amountInput?.dataset.amount ?? amountInput?.value);

    if (amountInput) {
        setAmount(currentBid?.amount ?? minimumAmount);
        amountInput.onfocus = () => {
            amountInput.value = String(getAmount());
            amountInput.select();
        };
        amountInput.oninput = () => {
            amountInput.dataset.amount = String(parseCurrency(amountInput.value));
        };
        amountInput.onblur = () => {
            setAmount(getAmount());
        };
    }

    if (minEl) minEl.textContent = `Min. ${formatCurrency(minimumAmount)}`;
    if (currentEl) currentEl.textContent = currentBid ? `Actual ${formatCurrency(currentBid.amount)}` : 'Sin puja activa';
    if (availableEl) availableEl.textContent = `Disponible ${formatCurrency(availableBudget)}`;
    if (errorEl) errorEl.classList.add('hidden');

    bidSection?.querySelectorAll('[data-bid-action]').forEach((button) => {
        button.onclick = () => {
            const action = button.dataset.bidAction;
            const currentAmount = getAmount();

            if (action === 'decrease') setAmount(currentAmount - BID_STEP);
            if (action === 'increase') setAmount(currentAmount + BID_STEP);
            if (action === 'market-value') setAmount(minimumAmount);
            if (action === 'plus-100k') setAmount(currentAmount + BID_STEP);
            if (action === 'plus-1m') setAmount(currentAmount + 1_000_000);
            if (action === 'max' && availableBudget >= minimumAmount) setAmount(availableBudget);
        };
    });

    if (submitBtn) {
        submitBtn.onclick = () => {
            const amount = getAmount();
            if (!amount || amount < minimumAmount) {
                if (errorEl) {
                    errorEl.textContent = 'La puja no puede ser inferior al valor del jugador.';
                    errorEl.classList.remove('hidden');
                }
                return;
            }
            onBid({ playerApiId, name, marketValue, amount });
        };
    }

    if (cancelBtn) {
        cancelBtn.style.display = currentBid ? '' : 'none';
        cancelBtn.onclick = currentBid
            ? () => onBid({ playerApiId, name, marketValue, amount: null, cancel: true })
            : null;
    }
}

export function cerrarPlayerDrawer() {
    const drawer  = document.getElementById('player-drawer');
    const overlay = document.getElementById('player-drawer-overlay');
    if (!drawer || !overlay) return;
    overlay.classList.add('opacity-0');
    drawer.classList.add('translate-x-full');
    setTimeout(() => overlay.classList.add('hidden'), 300);
}

window.cerrarPlayerDrawer = cerrarPlayerDrawer;
