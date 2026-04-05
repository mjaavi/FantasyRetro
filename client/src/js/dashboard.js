import { apiFetch } from './api.js';
import { getLigaActiva } from './leagues.js';
import { createClubLogo, createPlayerAvatar } from './player-image.js';

const POS_COLOR = { PT: '#f59e0b', DF: '#22c55e', MC: '#a855f7', DL: '#ef4444' };

export async function loadDashboard() {
    const liga = getLigaActiva();
    if (!liga) return;

    try {
        const res = await apiFetch(`/dashboard/${liga.id}`);
        const data = res.data;

        document.getElementById('dashboard-total-pts').textContent = data.totalPts ?? 0;

        renderRival(data.rival);
        renderMVP(data.mvp);
        renderChart(data.chart);
        renderFixtures(data.fixtures, data.jornada);
        renderTopGlobales(data.topGlobales);
    } catch (error) {
        console.error('[Dashboard]', error.message ?? error);
    }
}

function renderRival(rival) {
    if (!rival) return;

    const diff = rival.diff;
    document.getElementById('dash-rival-pts').textContent = rival.puntos;
    document.getElementById('dash-rival-diff').textContent = diff > 0
        ? `${diff} pts atras`
        : diff < 0
            ? `${Math.abs(diff)} pts delante`
            : 'Empatados';
    document.getElementById('dash-rival-diff').style.color = diff > 0 ? '#f87171' : diff < 0 ? '#4ade80' : '#94a3b8';

    const total = (rival.puntos + (rival.puntos - diff)) || 1;
    const pctYo = Math.round(((rival.puntos - diff) / total) * 100);
    document.getElementById('dash-rival-bar-yo').style.width = `${pctYo}%`;
    document.getElementById('dash-rival-bar-rival').style.width = `${100 - pctYo}%`;
}

function createPositionBadge(position) {
    const color = POS_COLOR[position] ?? '#3b82f6';
    const badge = document.createElement('span');
    badge.className = 'text-[9px] font-black uppercase px-1.5 py-0.5 rounded';
    badge.style.background = `${color}22`;
    badge.style.color = color;
    badge.textContent = position;
    return badge;
}

function getShortName(name) {
    const parts = String(name ?? '').trim().split(/\s+/).filter(Boolean);
    return parts.at(-1) ?? name ?? '—';
}

function createPointsValue(points, compact = false) {
    const value = document.createElement('span');
    value.className = compact ? 'font-black text-base text-blue-400 shrink-0' : 'font-black text-lg shrink-0';
    value.style.color = Number(points) >= 0 ? '#60a5fa' : '#f87171';

    if (compact) {
        value.innerHTML = `${points} <span class="text-xs font-bold text-slate-500">pts</span>`;
    } else {
        value.textContent = String(points);
    }

    return value;
}

function createDashboardPlayerRow(player, index, options = {}) {
    const { compact = false } = options;

    const row = document.createElement('div');
    row.className = compact
        ? 'flex items-center gap-3 py-2.5 border-b border-white/5 last:border-0'
        : 'flex items-center gap-3 p-3 bg-white/[0.03] rounded-xl border border-white/5';

    const rank = document.createElement('span');
    rank.className = compact
        ? 'text-xs font-black text-slate-600 w-4 shrink-0'
        : 'text-[11px] font-black text-slate-500 w-5 shrink-0';
    rank.textContent = String(index + 1);

    const avatar = createPlayerAvatar({
        name: player.player_name,
        faceUrl: player.faceUrl ?? null,
        playerFifaApiId: player.playerFifaApiId ?? null,
        position: player.position ?? 'MC',
        size: compact ? 28 : 32,
    });

    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';

    const name = document.createElement('p');
    name.className = 'font-bold text-sm text-white truncate';
    name.textContent = getShortName(player.player_name);

    const meta = document.createElement('div');
    meta.className = 'flex items-center gap-2 mt-1';
    meta.appendChild(createPositionBadge(player.position ?? 'MC'));
    meta.appendChild(
        createClubLogo({
            clubLogoUrl: player.clubLogoUrl ?? null,
            size: compact ? 14 : 16,
            alt: player.player_name ?? '',
        }),
    );

    info.appendChild(name);
    info.appendChild(meta);

    row.appendChild(rank);
    row.appendChild(avatar);
    row.appendChild(info);
    row.appendChild(createPointsValue(player.puntos_total, compact));

    return row;
}

function renderMVP(mvp) {
    const container = document.getElementById('dash-mvp-list');
    if (!container) return;

    if (!mvp?.length) {
        container.innerHTML = '<p class="text-slate-600 text-sm text-center py-4">Sin jornadas procesadas</p>';
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    mvp.forEach((player, index) => {
        fragment.appendChild(createDashboardPlayerRow(player, index));
    });

    container.appendChild(fragment);
}

function renderChart({ jornadas, yo, rival }) {
    const lineYo = document.getElementById('dash-line-yo');
    const lineRival = document.getElementById('dash-line-rival');
    const areaYo = document.getElementById('dash-area-yo');
    const dotsYo = document.getElementById('dash-dots-yo');
    const labelsEl = document.getElementById('dash-chart-labels');
    if (!lineYo || !jornadas?.length) return;

    const W = 500;
    const H = 100;
    const PAD = 12;
    const allVals = [...yo, ...rival].filter(value => !Number.isNaN(value));
    const minV = Math.min(0, ...allVals);
    const maxV = Math.max(1, ...allVals);
    const n = jornadas.length;

    const xOf = index => PAD + (n > 1 ? (index / (n - 1)) * (W - PAD * 2) : (W - PAD * 2) / 2);
    const yOf = value => PAD + (1 - (value - minV) / (maxV - minV || 1)) * (H - PAD * 2);

    const ptsYo = yo.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ');
    const ptsRival = rival.map((value, index) => `${xOf(index)},${yOf(value)}`).join(' ');
    const areaPath = `M${xOf(0)},${H} L${ptsYo.split(' ').join(' L')} L${xOf(n - 1)},${H} Z`;

    lineYo.setAttribute('points', ptsYo);
    lineRival.setAttribute('points', ptsRival);
    areaYo.setAttribute('d', areaPath);

    dotsYo.innerHTML = yo.map((value, index) => `
        <circle class="dash-dot" cx="${xOf(index)}" cy="${yOf(value)}" r="4"
            fill="#0b1120" stroke="#3b82f6" stroke-width="2.5"
            style="animation-delay:${0.8 + index * 0.06}s;transform-origin:${xOf(index)}px ${yOf(value)}px"/>`
    ).join('');

    if (labelsEl) {
        labelsEl.innerHTML = jornadas.map(jornada => (
            `<span class="text-[9px] font-bold text-slate-600 uppercase tracking-wider">J${jornada}</span>`
        )).join('');
    }

    lineYo.classList.remove('dash-draw-line');
    void lineYo.offsetWidth;
    lineYo.classList.add('dash-draw-line');
}

function renderFixtures(fixtures, jornadaActual) {
    const container = document.getElementById('dash-fixtures-list');
    if (!container) return;

    const nextJornada = jornadaActual + 1;

    if (!fixtures?.length) {
        container.innerHTML = `<p class="text-slate-500 text-xs font-bold text-center py-3">J${nextJornada} sin datos aun</p>`;
        return;
    }

    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'space-y-1';

    fixtures.forEach(fixture => {
        const row = document.createElement('div');
        row.className = `grid items-center py-2 border-b border-white/5 last:border-0 ${fixture.has_my_player ? '' : 'opacity-50'}`;
        row.style.gridTemplateColumns = '1fr auto 1fr auto';
        row.style.gap = '6px';

        const home = document.createElement('div');
        home.className = 'flex items-center gap-2 min-w-0';
        home.appendChild(createClubLogo({ clubLogoUrl: fixture.home_club_logo_url ?? null, size: 18, alt: fixture.home_team }));
        const homeName = document.createElement('span');
        homeName.className = 'text-xs font-bold text-white truncate';
        homeName.textContent = fixture.home_team;
        home.appendChild(homeName);

        const versus = document.createElement('span');
        versus.className = 'text-[9px] font-black text-slate-600 px-1';
        versus.textContent = 'vs';

        const away = document.createElement('div');
        away.className = 'flex items-center gap-2 min-w-0 justify-end';
        const awayName = document.createElement('span');
        awayName.className = 'text-xs font-bold text-white truncate text-right';
        awayName.textContent = fixture.away_team;
        away.appendChild(awayName);
        away.appendChild(createClubLogo({ clubLogoUrl: fixture.away_club_logo_url ?? null, size: 18, alt: fixture.away_team }));

        const mark = document.createElement('div');
        mark.className = 'w-4 flex justify-center';
        mark.innerHTML = fixture.has_my_player ? '<span class="text-blue-400 text-xs">*</span>' : '';

        row.appendChild(home);
        row.appendChild(versus);
        row.appendChild(away);
        row.appendChild(mark);
        wrapper.appendChild(row);
    });

    container.appendChild(wrapper);
}

function renderTopGlobales(top) {
    const container = document.getElementById('dash-top-globales-list');
    if (!container) return;

    if (!top?.length) {
        container.innerHTML = '<p class="text-slate-600 text-sm text-center py-4">Sin datos</p>';
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();

    top.forEach((player, index) => {
        fragment.appendChild(createDashboardPlayerRow(player, index, { compact: true }));
    });

    container.appendChild(fragment);
}

window.loadDashboard = loadDashboard;
