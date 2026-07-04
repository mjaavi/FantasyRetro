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

// -- Tab state ----------------------------------------------------------------
const TAB_ACTIVE_CLS  = 'bg-blue-500/20 text-blue-400 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]';
const TAB_INACTIVE_CLS = 'text-slate-500 hover:text-slate-300 border border-transparent';
let _currentDrawerContext = null;
let _marketDataLoaded = false;

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

// -- Tab switching ------------------------------------------------------------

function _switchTab(tabName) {
    const rendBtn = document.getElementById('pd-tab-rendimiento-btn');
    const mercBtn = document.getElementById('pd-tab-mercado-btn');
    const rendTab = document.getElementById('pd-tab-rendimiento');
    const mercTab = document.getElementById('pd-tab-mercado');
    if (!rendBtn || !mercBtn || !rendTab || !mercTab) return;

    if (tabName === 'rendimiento') {
        rendBtn.className = `flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 ${TAB_ACTIVE_CLS}`;
        mercBtn.className = `flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 ${TAB_INACTIVE_CLS}`;
        rendTab.style.display = '';
        mercTab.style.display = 'none';
    } else {
        mercBtn.className = `flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 ${TAB_ACTIVE_CLS}`;
        rendBtn.className = `flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 ${TAB_INACTIVE_CLS}`;
        rendTab.style.display = 'none';
        mercTab.style.display = '';
        if (!_marketDataLoaded && _currentDrawerContext) {
            _marketDataLoaded = true;
            _loadMarketChart();
        }
    }
}

function _initTabListeners() {
    document.getElementById('pd-tab-rendimiento-btn')?.addEventListener('click', () => _switchTab('rendimiento'));
    document.getElementById('pd-tab-mercado-btn')?.addEventListener('click', () => _switchTab('mercado'));
}
_initTabListeners();

// -- Market chart (SVG) -------------------------------------------------------

async function _loadMarketChart() {
    const chartEl = document.getElementById('pd-market-chart');
    if (!chartEl || !_currentDrawerContext) return;
    chartEl.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Cargando datos de mercado...</p>';
    try {
        const { leagueId, playerApiId } = _currentDrawerContext;
        const res = await apiFetch(`/admin/ligas/${leagueId}/jugador/${playerApiId}/valor-mercado-historial`);
        const data = res.data;
        if (!data.history || data.history.length < 2) {
            chartEl.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Sin datos de mercado disponibles</p>';
            return;
        }
        _renderMarketChart(chartEl, data);
    } catch (e) {
        chartEl.innerHTML = '<p style="color:#475569;font-size:12px;text-align:center;padding:32px 0">Error al cargar datos de mercado</p>';
    }
}

function _renderMarketChart(container, data) {
    const { history, initialPrice } = data;
    const W = 320, H = 160, PAD_X = 10, PAD_Y = 20, PAD_B = 28;
    const prices = history.map(h => h.price);
    const minP = Math.min(...prices) * 0.95;
    const maxP = Math.max(...prices) * 1.05;
    const rangeP = maxP - minP || 1;
    const n = history.length;
    const stepX = (W - PAD_X * 2) / Math.max(n - 1, 1);
    const toX = i => PAD_X + i * stepX;
    const toY = p => PAD_Y + (1 - (p - minP) / rangeP) * (H - PAD_Y - PAD_B);
    const pts = history.map((h, i) => `${toX(i).toFixed(1)},${toY(h.price).toFixed(1)}`).join(' ');
    const areaD = `M${toX(0).toFixed(1)},${toY(history[0].price).toFixed(1)} ` +
        history.map((h, i) => `L${toX(i).toFixed(1)},${toY(h.price).toFixed(1)}`).join(' ') +
        ` L${toX(n - 1).toFixed(1)},${H - PAD_B} L${toX(0).toFixed(1)},${H - PAD_B} Z`;
    const dots = history.map((h, i) => {
        const cx = toX(i).toFixed(1), cy = toY(h.price).toFixed(1);
        return `<circle cx="${cx}" cy="${cy}" r="4" fill="#3b82f6" stroke="#0b1120" stroke-width="2" class="pd-market-dot" data-idx="${i}" style="cursor:pointer"/>`;
    }).join('');
    const labels = history.map((h, i) => {
        const label = h.jornada === 0 ? 'INI' : `J${h.jornada}`;
        return `<text x="${toX(i).toFixed(1)}" y="${H - 6}" text-anchor="middle" fill="#475569" font-size="9" font-weight="700">${label}</text>`;
    }).join('');
    const gridLines = [0.25, 0.5, 0.75].map(pct => {
        const y = PAD_Y + (1 - pct) * (H - PAD_Y - PAD_B);
        return `<line x1="${PAD_X}" y1="${y.toFixed(1)}" x2="${W - PAD_X}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>`;
    }).join('');
    container.innerHTML = `
        <svg viewBox="0 0 ${W} ${H}" class="w-full" preserveAspectRatio="xMidYMid meet" style="height:${H}px">
            <defs><linearGradient id="pdMarketGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
            </linearGradient></defs>
            ${gridLines}
            <path d="${areaD}" fill="url(#pdMarketGrad)"/>
            <polyline points="${pts}" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
            ${dots}${labels}
        </svg>`;
    const detailEl = document.createElement('div');
    detailEl.style.cssText = 'margin-top:12px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:14px;padding:14px 16px;min-height:50px;transition:all .2s;';
    const lastH = history[history.length - 1];
    const variation = initialPrice > 0 ? (((lastH.price - initialPrice) / initialPrice) * 100).toFixed(1) : '0.0';
    const varColor = variation >= 0 ? '#60a5fa' : '#f87171';
    const varSign = variation >= 0 ? '+' : '';
    detailEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
        <div><p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Valor Actual</p>
            <p style="font-size:18px;font-weight:900;color:#e2e8f0">${formatCurrency(lastH.price)}</p></div>
        <div style="text-align:right"><p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Variación</p>
            <p style="font-size:18px;font-weight:900;color:${varColor}">${varSign}${variation}%</p></div>
    </div>`;
    container.appendChild(detailEl);
    container.querySelectorAll('.pd-market-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const idx = Number(dot.dataset.idx);
            const h = history[idx];
            const prev = idx > 0 ? history[idx - 1].price : initialPrice;
            const chg = prev > 0 ? (((h.price - prev) / prev) * 100).toFixed(1) : '0.0';
            const chgColor = chg >= 0 ? '#60a5fa' : '#f87171';
            const chgSign = chg >= 0 ? '+' : '';
            const lbl = h.jornada === 0 ? 'Precio Inicial' : `Jornada ${h.jornada}`;
            detailEl.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
                <div><p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">${lbl}</p>
                    <p style="font-size:18px;font-weight:900;color:#e2e8f0">${formatCurrency(h.price)}</p></div>
                <div style="text-align:right"><p style="font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.05em;margin-bottom:2px">Cambio</p>
                    <p style="font-size:18px;font-weight:900;color:${chgColor}">${chgSign}${chg}%</p></div>
            </div>`;
        });
    });
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
export async function abrirPlayerDrawer({
    playerApiId,
    name,
    position,
    marketValue,
    onBid,
    currentBid,
    releaseClause,
    onReleaseClause,
    onRaiseReleaseClause,
    onDismissPlayer,
    onSellPlayer,
    alreadyOnSale,
}) {
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
        if (onBid || onReleaseClause || onRaiseReleaseClause || onDismissPlayer || onSellPlayer) {
            bidSection.style.display = '';
            _setupBidSection(playerApiId, name, marketValue, onBid, currentBid, {
                releaseClause,
                onReleaseClause,
                onRaiseReleaseClause,
                onDismissPlayer,
                onSellPlayer,
                alreadyOnSale,
            });
        } else {
            bidSection.style.display = 'none';
        }
    }

    // Reset tabs al abrir
    _currentDrawerContext = { playerApiId, leagueId: getLigaActiva()?.id };
    _marketDataLoaded = false;
    _switchTab('rendimiento');
    const marketChart = document.getElementById('pd-market-chart');
    if (marketChart) marketChart.innerHTML = '';

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
            col.addEventListener('click', () => {
                // Resaltar barra seleccionada
                wrap.querySelectorAll('.pd-bar').forEach(b => b.style.opacity = '0.4');
                col.querySelector('.pd-bar').style.opacity = '1';
                col.querySelector('.pd-bar').style.boxShadow = `0 0 16px ${glow}`;

                let html = `
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding-bottom:10px;border-bottom:1px solid rgba(255,255,255,0.05)">
                        <span style="font-size:14px;font-weight:700;color:#94a3b8">Jornada ${j.jornada}</span>
                        <span style="font-size:24px;font-weight:900;color:${pts >= 0 ? '#60a5fa' : '#f87171'}">${pts} <span style="font-size:12px;color:#64748b">pts</span></span>
                    </div>`;

                if (j.raw_stats) {
                    const rs = j.raw_stats;
                    const pos = rs.position || 'MC';
                    
                    const MATRIX = {
                        goles: { 'PT': 6, 'DF': 5, 'MC': 4, 'DL': 3 },
                        asistencias: { 'PT': 2, 'DF': 2, 'MC': 2, 'DL': 2 },
                        tirosAPuerta: { 'PT': 0.5, 'DF': 0.5, 'MC': 0.5, 'DL': 0.5 },
                        tirosAlPalo: { 'PT': 1, 'DF': 1, 'MC': 1, 'DL': 1 },
                        centrosAlArea: { 'PT': 0, 'DF': 0.5, 'MC': 0.5, 'DL': 0 },
                        posesionSuperior60: { 'PT': 0, 'DF': 0, 'MC': 1, 'DL': 0 },
                        faltasCometidas: { 'PT': -0.2, 'DF': -0.1, 'MC': -0.2, 'DL': -0.2 },
                        tarjetasAmarillas: { 'PT': -1, 'DF': -1, 'MC': -1, 'DL': -1 },
                        tarjetasRojas: { 'PT': -3, 'DF': -3, 'MC': -3, 'DL': -3 },
                        paradasDeducidas: { 'PT': 0.5, 'DF': 0, 'MC': 0, 'DL': 0 },
                        tirosRivalesBloqueados: { 'PT': 0, 'DF': 0.5, 'MC': 0, 'DL': 0 }
                    };

                    // Bonus gradual por goles encajados (sustituye porteriaACero)
                    const GOLES_ENCAJADOS_BONUS = {
                        0: { 'PT': 4, 'DF': 3, 'MC': 0, 'DL': 0 },
                        1: { 'PT': 2, 'DF': 1.5, 'MC': 0, 'DL': 0 },
                        2: { 'PT': 0.5, 'DF': 0.5, 'MC': 0, 'DL': 0 },
                    };

                    const PICAS_A_PUNTOS = {
                        'NEG': -1,
                        'SC': 0,
                        'P1': 1,
                        'P2': 4,
                        'P3': 8,
                        'P4': 12
                    };

                    const PICAS_SYMBOL = {
                        'NEG': '-',
                        'SC': '-',
                        'P1': '★',
                        'P2': '★★',
                        'P3': '★★★',
                        'P4': '★★★★'
                    };

                    const statRows = [
                        { label: 'Goles', val: rs.goles, pts: rs.goles * MATRIX.goles[pos] },
                        { label: 'Asistencias de gol', val: rs.asistencias, pts: rs.asistencias * MATRIX.asistencias[pos] },
                        { label: 'Tiros a puerta', val: rs.tirosAPuerta, pts: rs.tirosAPuerta * MATRIX.tirosAPuerta[pos] },
                        { label: 'Tiros al palo', val: rs.tirosAlPalo, pts: rs.tirosAlPalo * MATRIX.tirosAlPalo[pos] },
                        { label: 'Centros al área', val: rs.centrosAlArea, pts: rs.centrosAlArea * MATRIX.centrosAlArea[pos] },
                        { label: 'Faltas cometidas', val: rs.faltasCometidas, pts: rs.faltasCometidas * MATRIX.faltasCometidas[pos] },
                        { label: 'Tarjetas amarillas', val: rs.tarjetasAmarillas, pts: rs.tarjetasAmarillas * MATRIX.tarjetasAmarillas[pos] },
                        { label: 'Tarjetas rojas', val: rs.tarjetasRojas, pts: rs.tarjetasRojas * MATRIX.tarjetasRojas[pos] },
                    ];

                    // Goles encajados (sistema gradual)
                    const ge = rs.golesEncajados ?? (rs.porteriaACero ? 0 : 99);
                    const geKey = Math.min(ge, 2);
                    const geBonus = (GOLES_ENCAJADOS_BONUS[geKey] || {})[pos] || 0;
                    if (geBonus !== 0 || ge <= 2) {
                        statRows.push({ label: `Goles encajados (${ge})`, val: ge, pts: geBonus });
                    }

                    statRows.push(
                        { label: 'Paradas', val: rs.paradasDeducidas, pts: rs.paradasDeducidas * MATRIX.paradasDeducidas[pos] },
                        { label: 'Tiros bloqueados', val: rs.tirosRivalesBloqueados, pts: rs.tirosRivalesBloqueados * MATRIX.tirosRivalesBloqueados[pos] },
                        { label: 'Posesión > 60%', val: rs.posesionSuperior60 ? 1 : 0, pts: rs.posesionSuperior60 ? MATRIX.posesionSuperior60[pos] : 0, hideZero: true }
                    );

                    let resultPts = 0;
                    if (rs.resultado === 'victoria') resultPts = 1;
                    if (rs.resultado === 'derrota') resultPts = -1;
                    statRows.push({ label: `Resultado (${rs.resultado})`, val: 1, pts: resultPts });
                    
                    // Add explicitly the conversion to final points so it's clear
                    statRows.push({ label: 'Total Puntos Base', val: '-', pts: base, isTotal: true });
                    const ptsCronista = PICAS_A_PUNTOS[j.picas] ?? 0;
                    const cronistaName = j.cronista_type ? j.cronista_type.charAt(0).toUpperCase() + j.cronista_type.slice(1) : 'Desconocido';
                    statRows.push({ label: `Valoración Cronista (${cronistaName})`, val: PICAS_SYMBOL[j.picas] || '-', pts: ptsCronista, isTotal: true });
                    statRows.push({ label: 'Total', val: '', pts: pts, isFinalTotal: true });

                    html += `
                    <div style="background:rgba(15, 23, 42, 0.6); border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.05)">
                        <div style="display:flex; padding:10px 16px; background:rgba(255,255,255,0.03); border-bottom:1px solid rgba(255,255,255,0.05);">
                            <div style="flex:1; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; text-align:center;">Cantidad</div>
                            <div style="flex:2; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; text-align:center;">Estadísticas</div>
                            <div style="flex:1; font-size:10px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.05em; text-align:center;">Puntos</div>
                        </div>
                        <div style="max-height:280px; overflow-y:auto; scrollbar-width:thin;">
                    `;
                    
                    statRows.forEach((s, idx) => {
                        if (s.hideZero && s.val === 0) return;
                        
                        let ptsColor = '#94a3b8';
                        if (s.pts > 0) ptsColor = '#60a5fa'; // Blue for positive
                        if (s.pts < 0) ptsColor = '#f87171'; // Red for negative
                        if (s.pts === 0) ptsColor = '#eab308'; // Yellow for 0
                        
                        // Diferenciar filas de resumen
                        let bgStyle = `background:${idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)'}`;
                        let colorLabel = '#cbd5e1';
                        if (s.isTotal) {
                            bgStyle = 'background:rgba(255,255,255,0.02); border-top:1px solid rgba(255,255,255,0.1)';
                            colorLabel = '#e2e8f0';
                        }
                        if (s.isFinalTotal) {
                            bgStyle = 'background:rgba(255,255,255,0.05); border-top:1px solid rgba(255,255,255,0.2)';
                            colorLabel = '#ffffff';
                        }
                        
                        let valColor = '#e2e8f0';
                        if (typeof s.val === 'string' && s.val.includes('★')) {
                            valColor = '#eab308'; // Yellow stars
                        }
                        
                        html += `
                            <div style="display:flex; padding:12px 16px; border-bottom:1px solid rgba(255,255,255,0.02); ${bgStyle}">
                                <div style="flex:1; font-size:13px; font-weight:900; color:${valColor}; text-align:center;">${s.val}</div>
                                <div style="flex:2; font-size:13px; font-weight:700; color:${colorLabel}; text-align:center;">${s.label}</div>
                                <div style="flex:1; font-size:13px; font-weight:900; color:${ptsColor}; text-align:center;">${s.pts > 0 ? '+' : ''}${s.pts === 0 ? '0' : s.pts.toFixed(1).replace('.0', '')}</div>
                            </div>
                        `;
                    });
                    
                    html += `</div></div>`;

                } else {
                    html += `
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
                }

                detailEl.innerHTML = html;
            });
        }

        wrap.appendChild(col);
    }

    container.appendChild(wrap);
    container.appendChild(detailEl);

    // Permitir deslizar las barras con el ratón
    let isDown = false;
    let startX;
    let scrollLeft;

    wrap.addEventListener('mousedown', (e) => {
        isDown = true;
        wrap.style.cursor = 'grabbing';
        startX = e.pageX - wrap.offsetLeft;
        scrollLeft = wrap.scrollLeft;
    });
    wrap.addEventListener('mouseleave', () => {
        isDown = false;
        wrap.style.cursor = '';
    });
    wrap.addEventListener('mouseup', () => {
        isDown = false;
        wrap.style.cursor = '';
    });
    wrap.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - wrap.offsetLeft;
        const walk = (x - startX) * 2;
        wrap.scrollLeft = scrollLeft - walk;
    });

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

function _setupBidSection(playerApiId, name, marketValue, onBid, currentBid, clauseOptions = {}) {
    const amountInput = document.getElementById('pd-bid-amount');
    const errorEl     = document.getElementById('pd-bid-error');
    const submitBtn   = document.getElementById('pd-submit-btn');
    const cancelBtn   = document.getElementById('pd-cancel-btn');
    const minEl       = document.getElementById('pd-bid-min');
    const currentEl   = document.getElementById('pd-bid-current');
    const availableEl = document.getElementById('pd-bid-available');
    const bidSection  = document.getElementById('pd-bid-section');
    const titleLabel  = bidSection?.querySelector('label');

    const minimumAmount = Number(marketValue ?? 0);
    const releaseClause = Number(clauseOptions.releaseClause ?? minimumAmount);
    const canOffer = Boolean(onBid);
    const canPayClause = Boolean(clauseOptions.onReleaseClause);
    const canRaiseClause = Boolean(clauseOptions.onRaiseReleaseClause);
    const canDismiss = Boolean(clauseOptions.onDismissPlayer);
    const canSell = Boolean(clauseOptions.onSellPlayer);
    let mode = canOffer ? 'offer' : 'clause';
    const availableBudget = getAvailableBidBudget(currentBid);

    const setAmount = (nextAmount) => {
        if (!amountInput) return;

        if (mode === 'dismiss') {
            const normalized = Math.floor(minimumAmount * 0.5);
            amountInput.dataset.amount = String(normalized);
            amountInput.value = formatCurrency(normalized);
            return;
        }

        if (mode === 'sell') {
            amountInput.dataset.amount = String(minimumAmount);
            amountInput.value = formatCurrency(minimumAmount);
            return;
        }

        const minAmount = mode === 'offer'
            ? minimumAmount
            : canRaiseClause
                ? 1
                : releaseClause;
        const normalized = Math.max(minAmount, Math.trunc(Number(nextAmount) || minAmount));
        amountInput.dataset.amount = String(normalized);
        amountInput.value = formatCurrency(normalized);
    };

    const getAmount = () => parseCurrency(amountInput?.dataset.amount ?? amountInput?.value);

    if (amountInput) {
        setAmount(currentBid?.amount ?? (mode === 'clause' ? releaseClause : minimumAmount));
        amountInput.onfocus = () => {
            if (mode === 'dismiss') return;
            if (mode === 'clause' && canPayClause && !canRaiseClause) return;
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

    setupBidModeTabs();
    applyBidMode();
    if (errorEl) errorEl.classList.add('hidden');

    bidSection?.querySelectorAll('[data-bid-action]').forEach((button) => {
        button.onclick = () => {
            if (mode === 'dismiss' || mode === 'sell') return;
            const action = button.dataset.bidAction;
            const currentAmount = getAmount();
            if (mode === 'clause' && canPayClause && !canRaiseClause && action !== 'max') {
                setAmount(releaseClause);
                return;
            }

            if (action === 'decrease') setAmount(currentAmount - BID_STEP);
            if (action === 'increase') setAmount(currentAmount + BID_STEP);
            if (action === 'market-value') setAmount(mode === 'clause' ? releaseClause : minimumAmount);
            if (action === 'plus-100k') setAmount(currentAmount + BID_STEP);
            if (action === 'plus-1m') setAmount(currentAmount + 1_000_000);
            if (action === 'max' && availableBudget >= minimumAmount) setAmount(availableBudget);
        };
    });

    if (submitBtn) {
        submitBtn.onclick = () => {
            const amount = getAmount();
            if (mode === 'dismiss') {
                if (clauseOptions.onDismissPlayer) {
                    clauseOptions.onDismissPlayer({ playerApiId, name, marketValue });
                }
                return;
            }
            if (mode === 'sell') {
                if (clauseOptions.onSellPlayer) {
                    clauseOptions.onSellPlayer({ playerApiId, name, marketValue });
                }
                return;
            }
            if (mode === 'clause') {
                if (canPayClause) {
                    clauseOptions.onReleaseClause({ playerApiId, name, marketValue, amount: releaseClause });
                    return;
                }
                if (canRaiseClause) {
                    if (!amount || amount <= 0) {
                        if (errorEl) {
                            errorEl.textContent = 'Introduce una cantidad valida.';
                            errorEl.classList.remove('hidden');
                        }
                        return;
                    }
                    clauseOptions.onRaiseReleaseClause({ playerApiId, name, marketValue, contribution: amount });
                    return;
                }
            }

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

    function setupBidModeTabs() {
        bidSection?.querySelector('[data-pd-bid-tabs]')?.remove();
        
        const modes = [];
        if (canOffer) modes.push({ id: 'offer', label: 'Oferta' });
        if (canPayClause || canRaiseClause) modes.push({ id: 'clause', label: 'Clausula' });
        if (canSell || clauseOptions.alreadyOnSale) modes.push({ id: 'sell', label: 'Vender' });
        if (canDismiss) modes.push({ id: 'dismiss', label: 'Despedir' });

        if (modes.length <= 1) return;

        const tabs = document.createElement('div');
        tabs.dataset.pdBidTabs = 'true';
        tabs.className = 'flex bg-white/5 rounded-xl p-1 border border-white/10 gap-1 mb-3';

        modes.forEach(m => {
            tabs.appendChild(createModeBtn(m.id, m.label));
        });
        bidSection.prepend(tabs);
    }

    function createModeBtn(nextMode, text) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200';
        btn.textContent = text;
        btn.addEventListener('click', () => {
            mode = nextMode;
            applyBidMode();
        });
        return btn;
    }

    function applyBidMode() {
        bidSection?.querySelectorAll('[data-pd-bid-tabs] button').forEach((btn) => {
            const label = btn.textContent;
            const btnMode = label === 'Oferta' ? 'offer' : (label === 'Clausula' ? 'clause' : (label === 'Vender' ? 'sell' : 'dismiss'));
            const active = (mode === btnMode);
            btn.className = `flex-1 text-xs font-bold py-2 px-3 rounded-lg transition-all duration-200 ${active ? TAB_ACTIVE_CLS : TAB_INACTIVE_CLS}`;
        });

        const stepperContainer = bidSection?.querySelector('.bid-stepper');
        const quickActions = bidSection?.querySelector('.bid-quick-actions');

        if (mode === 'dismiss' || mode === 'sell') {
            if (stepperContainer) {
                stepperContainer.querySelectorAll('button').forEach(btn => btn.style.display = 'none');
                stepperContainer.style.gridTemplateColumns = '1fr';
            }
            if (quickActions) quickActions.style.display = 'none';
        } else {
            if (stepperContainer) {
                stepperContainer.querySelectorAll('button').forEach(btn => btn.style.display = '');
                stepperContainer.style.gridTemplateColumns = '';
            }
            if (quickActions) quickActions.style.display = '';
        }

        if (titleLabel) {
            titleLabel.textContent = mode === 'offer'
                ? 'Tu oferta'
                : mode === 'clause'
                    ? (canRaiseClause ? 'Subir clausula' : 'Clausula')
                    : mode === 'sell'
                        ? 'Vender jugador'
                        : 'Despedir jugador';
        }
        if (minEl) {
            minEl.textContent = mode === 'offer'
                ? `Min. ${formatCurrency(minimumAmount)}`
                : mode === 'clause'
                    ? (canRaiseClause ? 'Cada euro suma x2' : 'Fichaje inmediato')
                    : mode === 'sell'
                        ? (clauseOptions.alreadyOnSale ? 'Este jugador ya está puesto a la venta en el mercado.' : 'El jugador se pondrá a la venta en el mercado actual.')
                        : 'Recuperas el 50% de su valor de mercado de forma inmediata.';
        }
        if (currentEl) {
            currentEl.textContent = mode === 'offer'
                ? (currentBid ? `Actual ${formatCurrency(currentBid.amount)}` : 'Sin puja activa')
                : mode === 'clause'
                    ? `Clausula ${formatCurrency(releaseClause)}`
                    : mode === 'sell'
                        ? `Valor de mercado: ${formatCurrency(minimumAmount)}`
                        : `Recuperas: ${formatCurrency(Math.floor(minimumAmount * 0.5))}`;
        }
        if (availableEl) {
            availableEl.textContent = mode === 'dismiss'
                ? `Valor: ${formatCurrency(minimumAmount)}`
                : mode === 'sell'
                    ? `Cláusula: ${formatCurrency(releaseClause)}`
                    : `Disponible ${formatCurrency(availableBudget)}`;
        }
        if (submitBtn) {
            if (mode === 'dismiss') {
                submitBtn.className = 'flex-1 py-3 bg-red-500/20 text-red-300 border border-red-500/30 hover:bg-red-500/30 rounded-xl font-bold transition-all duration-200';
                submitBtn.textContent = 'Despedir Jugador';
                submitBtn.disabled = false;
            } else if (mode === 'sell') {
                if (clauseOptions.alreadyOnSale) {
                    submitBtn.className = 'flex-1 py-3 bg-slate-500/20 text-slate-400 border border-slate-500/30 rounded-xl font-bold transition-all duration-200 cursor-not-allowed';
                    submitBtn.textContent = 'Ya a la venta';
                    submitBtn.disabled = true;
                } else {
                    submitBtn.className = 'flex-1 py-3 bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 hover:bg-yellow-500/30 rounded-xl font-bold transition-all duration-200';
                    submitBtn.textContent = 'Poner a la Venta';
                    submitBtn.disabled = false;
                }
            } else {
                submitBtn.className = 'btn-primary flex-1 py-3';
                submitBtn.textContent = mode === 'offer'
                    ? 'Confirmar Oferta'
                    : canRaiseClause
                        ? 'Subir Clausula'
                        : 'Pagar Clausula';
                submitBtn.disabled = false;
            }
        }
        if (amountInput) {
            amountInput.readOnly = (mode === 'clause' && canPayClause && !canRaiseClause) || mode === 'dismiss' || mode === 'sell';
            setAmount(mode === 'offer'
                ? (currentBid?.amount ?? minimumAmount)
                : mode === 'clause'
                    ? (canRaiseClause ? 1_000_000 : releaseClause)
                    : mode === 'sell'
                        ? minimumAmount
                        : Math.floor(minimumAmount * 0.5));
        }
        if (cancelBtn) {
            cancelBtn.style.display = mode === 'offer' && currentBid ? '' : 'none';
        }
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
