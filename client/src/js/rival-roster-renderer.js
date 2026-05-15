// ─────────────────────────────────────────────────────────────────────────────
// rival-roster-renderer.js — Drawer lateral para visualizar equipos rivales
// SRP: Solo renderiza la vista del equipo rival en un drawer.
// DRY: Reutiliza createPlayerPortrait, createClubLogo de player-image.js
//      y el patrón de slider de jornadas de roster.js
// ─────────────────────────────────────────────────────────────────────────────

import { fetchRivalRoster } from './api.js';
import { createPlayerPortrait, createClubLogo } from './player-image.js';
import { abrirPlayerDrawer } from './player-drawer.js';
import { getLigaActiva } from './leagues.js';

// ── Estado ────────────────────────────────────────────────────────────────────

const rivalState = {
    targetUserId: null,
    currentJornada: null,
    data: null,
};

// ── Constantes ────────────────────────────────────────────────────────────────

const POSICION_SHORT = { PT: 'POR', DF: 'DEF', MC: 'MED', DL: 'DEL' };

const POS_BG = {
    PT: 'card-accent-PT',
    DF: 'card-accent-DF',
    MC: 'card-accent-MC',
    DL: 'card-accent-DL',
};

// ── Abrir Drawer ──────────────────────────────────────────────────────────────

export async function abrirRivalDrawer(targetUserId, jornada) {
    rivalState.targetUserId = targetUserId;
    rivalState.currentJornada = jornada ?? null;

    const overlay = document.getElementById('rival-drawer-overlay');
    const drawer = document.getElementById('rival-drawer');
    if (!overlay || !drawer) return;

    // Show
    overlay.classList.remove('hidden');
    requestAnimationFrame(() => {
        overlay.classList.add('opacity-100');
        overlay.classList.remove('opacity-0');
        drawer.classList.remove('translate-x-full');
    });

    await loadRivalData(jornada);
}

export function cerrarRivalDrawer() {
    const overlay = document.getElementById('rival-drawer-overlay');
    const drawer = document.getElementById('rival-drawer');
    if (!overlay || !drawer) return;

    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    drawer.classList.add('translate-x-full');

    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 300);

    rivalState.targetUserId = null;
    rivalState.data = null;
}

// ── Carga de datos ────────────────────────────────────────────────────────────

async function loadRivalData(jornada) {
    const liga = getLigaActiva();
    if (!liga || !rivalState.targetUserId) return;

    const content = document.getElementById('rival-drawer-content');
    if (!content) return;

    content.innerHTML = '<div class="flex items-center justify-center py-16"><p class="text-slate-500 font-bold">Cargando equipo...</p></div>';

    try {
        const data = await fetchRivalRoster(liga.id, rivalState.targetUserId, jornada);
        if (!data) {
            content.innerHTML = '<p class="text-red-400 font-bold text-center py-8">No se pudo cargar el equipo rival.</p>';
            return;
        }

        rivalState.data = data;
        rivalState.currentJornada = jornada ?? null;
        renderRivalContent(data);
    } catch (error) {
        console.error('[RivalRoster] Error:', error);
        content.innerHTML = '<p class="text-red-400 font-bold text-center py-8">Error al cargar el equipo rival.</p>';
    }
}

// ── Renderizado ───────────────────────────────────────────────────────────────

function renderRivalContent(data) {
    const content = document.getElementById('rival-drawer-content');
    if (!content) return;

    content.innerHTML = '';

    // Header info
    const header = document.getElementById('rival-drawer-name');
    const teamLabel = document.getElementById('rival-drawer-team');
    const ptsLabel = document.getElementById('rival-drawer-pts');

    if (header) header.textContent = data.username ?? 'Rival';
    if (teamLabel) teamLabel.textContent = data.teamName ?? '—';
    if (ptsLabel) ptsLabel.textContent = `${Math.trunc(data.totalPoints ?? 0)} pts`;

    // Slider de jornadas
    const slider = renderJornadasSlider(data);
    content.appendChild(slider);

    // Formación label
    const formLabel = document.createElement('div');
    formLabel.className = 'flex items-center justify-between mb-3 mt-4';
    formLabel.innerHTML = `
        <span class="text-[10px] font-black uppercase tracking-wider text-slate-500">Formación: ${data.formationKey}</span>
        <span class="text-[10px] font-black uppercase tracking-wider text-blue-400">${data.titulares?.length ?? 0} titulares</span>
    `;
    content.appendChild(formLabel);

    // Mini campo
    const pitch = renderMiniPitch(data.titulares, data.formationKey);
    content.appendChild(pitch);

    // Suplentes
    if (data.suplentes?.length) {
        const benchTitle = document.createElement('div');
        benchTitle.className = 'flex items-center justify-between mt-5 mb-3';
        benchTitle.innerHTML = `
            <span class="font-extrabold text-white text-sm">Banquillo</span>
            <span class="px-2 py-0.5 bg-white/5 border border-white/10 rounded text-[9px] font-black text-slate-400 uppercase">
                ${data.suplentes.length} suplentes
            </span>
        `;
        content.appendChild(benchTitle);

        const benchList = renderBenchList(data.suplentes);
        content.appendChild(benchList);
    }
}

// ── Slider de jornadas ────────────────────────────────────────────────────────

function renderJornadasSlider(data) {
    const slider = document.createElement('div');
    slider.className = 'bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center gap-2 overflow-x-auto w-full max-w-full no-scrollbar shadow-inner';

    const jornadas = data.jornadasDisponibles ?? [];
    const currentJornada = rivalState.currentJornada;

    // Opción "General"
    const generalBtn = createSliderBtn('GEN', '—', currentJornada === null, () => {
        rivalState.currentJornada = null;
        loadRivalData(undefined);
    });
    slider.appendChild(generalBtn);

    for (const j of jornadas) {
        const isSelected = j === currentJornada;
        const btn = createSliderBtn(`J${j}`, '', isSelected, () => {
            rivalState.currentJornada = j;
            loadRivalData(j);
        });
        slider.appendChild(btn);
    }

    // Make draggable
    let isDown = false, startX, scrollLeft;
    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.style.cursor = 'grabbing';
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => { isDown = false; slider.style.cursor = ''; });
    slider.addEventListener('mouseup', () => { isDown = false; slider.style.cursor = ''; });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const walk = (e.pageX - slider.offsetLeft - startX) * 1.5;
        slider.scrollLeft = scrollLeft - walk;
    });

    return slider;
}

function createSliderBtn(label, subtext, isSelected, onClick) {
    const btn = document.createElement('button');
    const stateClass = isSelected
        ? 'bg-blue-500/20 border-blue-500/50'
        : 'bg-white/5 border-white/10 hover:bg-white/10';
    const labelClass = isSelected ? 'text-blue-400' : 'text-slate-500';

    btn.className = `px-3 py-1.5 rounded-xl border min-w-[56px] shrink-0 flex flex-col items-center justify-center shadow-sm transition-all text-center ${stateClass}`;
    btn.innerHTML = `<p class="text-[11px] font-black uppercase ${labelClass} tracking-wide">${label}</p>`;
    if (subtext) {
        btn.innerHTML += `<p class="text-[9px] font-bold text-slate-400 mt-0.5">${subtext}</p>`;
    }
    btn.addEventListener('click', onClick);
    return btn;
}

// ── Mini campo ────────────────────────────────────────────────────────────────

function renderMiniPitch(titulares, formationKey) {
    const pitch = document.createElement('div');
    pitch.className = 'relative w-full min-h-[380px] bg-[#0c2415] rounded-2xl border border-white/10 overflow-hidden flex flex-col justify-around py-5 gap-2 shadow-2xl';
    pitch.style.backgroundImage = 'repeating-linear-gradient(0deg, transparent, transparent 10%, rgba(0,0,0,0.2) 10%, rgba(0,0,0,0.2) 20%)';

    // Field decorations
    pitch.innerHTML = `
        <div class="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2"></div>
        <div class="absolute top-1/2 left-1/2 w-20 h-20 border border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
    `;

    // Parse formation
    const layout = parseFormation(formationKey);
    const order = ['DL', 'MC', 'DF', 'PT'];

    for (const pos of order) {
        const count = layout[pos] || 0;
        if (count === 0) continue;

        const rowDiv = document.createElement('div');
        rowDiv.className = `relative z-10 flex justify-center gap-3 w-full px-3`;

        const playersInPos = (titulares ?? []).filter(p => p.position === pos);

        for (let i = 0; i < count; i++) {
            const player = playersInPos[i];
            const slot = document.createElement('div');

            if (player) {
                slot.className = `lineup-player-card ${POS_BG[pos] ?? 'card-accent-MC'}`;
                slot.style.cursor = 'pointer';
                slot.style.transform = 'scale(0.85)';

                // Player name
                const title = document.createElement('div');
                title.className = 'lineup-player-name';
                title.textContent = player.name;
                title.style.fontSize = '9px';

                // Club badge
                const logoBadge = document.createElement('div');
                logoBadge.className = 'lineup-player-logo-clip';
                const logo = createClubLogo({ clubLogoUrl: player.clubLogoUrl ?? null, size: 72, alt: 'Club' });
                logo.style.cssText += ';width:100%;height:100%;object-fit:contain;transform:translateX(16%);';
                logoBadge.appendChild(logo);

                // Portrait
                const portraitFrame = document.createElement('div');
                portraitFrame.className = 'lineup-player-portrait-frame';
                portraitFrame.appendChild(createPlayerPortrait({
                    name: player.name,
                    faceUrl: player.faceUrl ?? null,
                    playerFifaApiId: player.playerFifaApiId ?? null,
                    position: player.position,
                    className: 'lineup-player-portrait',
                    imageClassName: 'lineup-player-portrait-media',
                }));

                // Score badge
                const scoreBadge = document.createElement('div');
                scoreBadge.className = `lineup-player-score ${player.jornadaPts !== null && player.jornadaPts < 0 ? 'lineup-player-score-negative' : ''}`;
                scoreBadge.textContent = player.jornadaPts !== null ? `${Math.trunc(player.jornadaPts)}` : '-';

                slot.appendChild(title);
                slot.appendChild(logoBadge);
                slot.appendChild(portraitFrame);

                // Append score badge as sibling
                const wrapper = document.createElement('div');
                wrapper.className = 'flex flex-col items-center';
                wrapper.appendChild(slot);
                wrapper.appendChild(scoreBadge);

                wrapper.addEventListener('click', () => {
                    abrirPlayerDrawer({
                        playerApiId: player.id,
                        name: player.name,
                        position: player.position,
                        marketValue: player.purchase_price ?? 0,
                        faceUrl: player.faceUrl ?? null,
                        clubLogoUrl: player.clubLogoUrl ?? null,
                        readOnly: true,
                    });
                });

                rowDiv.appendChild(wrapper);
            } else {
                slot.className = 'player-slot player-slot-empty';
                slot.style.transform = 'scale(0.85)';
                slot.innerHTML = `
                    <div class="player-slot-card">
                        <div class="player-slot-top">—</div>
                        <div class="player-slot-bottom">
                            <div class="player-slot-name">${POSICION_SHORT[pos] ?? pos}</div>
                        </div>
                    </div>`;
                rowDiv.appendChild(slot);
            }
        }

        pitch.appendChild(rowDiv);
    }

    return pitch;
}

// ── Banquillo ─────────────────────────────────────────────────────────────────

function renderBenchList(suplentes) {
    const list = document.createElement('div');
    list.className = 'flex flex-col gap-2';

    for (const player of suplentes) {
        const row = document.createElement('div');
        row.className = 'flex items-center gap-3 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl cursor-pointer hover:bg-white/[0.06] transition-colors';

        // Position tag
        const posTag = document.createElement('span');
        posTag.className = `inline-flex items-center justify-center w-8 h-8 rounded-lg text-[10px] font-black uppercase tracking-wider ${POS_BG[player.position] ?? 'card-accent-MC'}`;
        posTag.style.cssText = 'background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.1);';
        posTag.textContent = POSICION_SHORT[player.position] ?? player.position;

        // Player info
        const info = document.createElement('div');
        info.className = 'flex-1 min-w-0';
        const name = document.createElement('p');
        name.className = 'text-xs font-bold text-white truncate';
        name.textContent = player.name;
        const team = document.createElement('p');
        team.className = 'text-[10px] text-slate-500 truncate';
        team.textContent = player.real_team ?? '—';
        info.appendChild(name);
        info.appendChild(team);

        // Points
        const pts = document.createElement('span');
        pts.className = 'text-xs font-black text-slate-400 shrink-0';
        pts.textContent = player.jornadaPts !== null ? `${Math.trunc(player.jornadaPts)} pts` : '—';

        row.appendChild(posTag);
        row.appendChild(info);
        row.appendChild(pts);

        row.addEventListener('click', () => {
            abrirPlayerDrawer({
                playerApiId: player.id,
                name: player.name,
                position: player.position,
                marketValue: player.purchase_price ?? 0,
                faceUrl: player.faceUrl ?? null,
                clubLogoUrl: player.clubLogoUrl ?? null,
                readOnly: true,
            });
        });

        list.appendChild(row);
    }

    return list;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseFormation(formationKey) {
    // e.g. "4-4-2" → { PT: 1, DF: 4, MC: 4, DL: 2 }
    if (window.AVAILABLE_FORMATIONS?.[formationKey]) {
        return window.AVAILABLE_FORMATIONS[formationKey];
    }

    const parts = (formationKey ?? '4-4-2').split('-').map(Number);
    return {
        PT: 1,
        DF: parts[0] || 4,
        MC: parts[1] || 4,
        DL: parts[2] || 2,
    };
}

// ── Init ──────────────────────────────────────────────────────────────────────

function init() {
    // Overlay click to close
    const overlay = document.getElementById('rival-drawer-overlay');
    if (overlay) {
        overlay.addEventListener('click', cerrarRivalDrawer);
    }

    // Close button
    const closeBtn = document.getElementById('rival-drawer-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', cerrarRivalDrawer);
    }
}

init();

// Expose for clasificacion.js
window.abrirRivalDrawer = abrirRivalDrawer;
window.cerrarRivalDrawer = cerrarRivalDrawer;
