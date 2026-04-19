import { fetchRoster, fetchRosterScores, toggleStarter } from './api.js';
import { abrirPlayerDrawer } from './player-drawer.js';
import { getLigaActiva } from './leagues.js';
import { createPlayerAvatar, createPlayerPortrait, createClubLogo } from './player-image.js';

let _roster = [];
let _puntos = {};
let _jornada = 0;

const POSICION_LABEL = {
    PT: 'Portero',
    DF: 'Defensa',
    MC: 'Centrocampista',
    DL: 'Delantero',
};

const POSICION_SHORT = {
    PT: 'POR',
    DF: 'DEF',
    MC: 'MED',
    DL: 'DEL',
};

const POS_BG = {
    PT: 'card-accent-PT',
    DF: 'card-accent-DF',
    MC: 'card-accent-MC',
    DL: 'card-accent-DL',
};

export async function loadRoster() {
    const liga = getLigaActiva();
    if (!liga) return;

    try {
        const [roster, scoreSummary] = await Promise.all([
            fetchRoster(liga.id).then(r => r ?? []),
            fetchRosterScores(liga.id).catch(() => ({ jornadaActual: 0, scores: [] })),
        ]);

        _roster = roster;
        cargarPuntos(scoreSummary);
        renderTodo();
    } catch (err) {
        console.error('[Roster]', err.message);
    }
}

function cargarPuntos(scoreSummary) {
    try {
        _jornada = Number(scoreSummary?.jornadaActual ?? 0);

        if (_jornada === 0) {
            _puntos = {};
            return;
        }

        const scores = scoreSummary?.scores ?? [];

        _puntos = {};
        const porJugador = {};

        for (const s of scores) {
            const id = s.player_api_id;
            if (!porJugador[id]) {
                porJugador[id] = { total: 0, jornadas: {} };
            }

            porJugador[id].total += Number(s.puntos_total);
            porJugador[id].jornadas[s.jornada] = {
                base: Number(s.puntos_base).toFixed(1),
                cronista: Number(s.puntos_cronista),
                total: Number(s.puntos_total),
                picas: s.picas,
                tipo: s.cronista_type,
                jugo: true,
            };
        }

        for (const [id, datos] of Object.entries(porJugador)) {
            const porJornada = [];
            for (let j = 1; j <= _jornada; j++) {
                porJornada.push(
                    datos.jornadas[j]
                        ? { jornada: j, ...datos.jornadas[j] }
                        : { jornada: j, jugo: false },
                );
            }
            _puntos[id] = { total: datos.total, porJornada };
        }
    } catch (err) {
        console.warn('[Roster] No se pudieron cargar puntos:', err.message);
        _puntos = {};
    }
}

function getPuntosJugador(playerApiId) {
    return _puntos[playerApiId] ?? { total: 0, porJornada: [] };
}

function getPuntosJornadaActual(playerApiId) {
    const puntos = getPuntosJugador(playerApiId);
    if (!_jornada || !Array.isArray(puntos.porJornada)) return null;

    const jornadaActual = puntos.porJornada.find((item) => Number(item.jornada) === Number(_jornada));
    if (!jornadaActual) return null;
    if (jornadaActual.jugo === false) return 0;

    return Number.isFinite(Number(jornadaActual.total)) ? Number(jornadaActual.total) : null;
}

function formatScoreBadge(value) {
    if (value === null || Number.isNaN(value)) return '-';
    return `${Math.trunc(value)}`;
}

function createClippedClubBadge(clubLogoUrl, className, size = 92) {
    const badge = document.createElement('div');
    badge.className = className;

    const logo = createClubLogo({
        clubLogoUrl: clubLogoUrl ?? null,
        size,
        alt: 'Escudo del club',
    });

    logo.style.cssText += ';width:100%;height:100%;object-fit:contain;transform:translateX(16%);';
    badge.appendChild(logo);

    return badge;
}

function renderTodo() {
    const titulares = _roster.filter((j) => j.is_starter);
    const suplentes = _roster.filter((j) => !j.is_starter);

    renderCampo(titulares, suplentes);
    renderBanquillo(suplentes);
    renderCampoDashboard(titulares);
}

function rellenarSlot(slot, jugador) {
    const jornadaPts = getPuntosJornadaActual(jugador.player_api_id ?? jugador.id);

    slot.className = 'player-slot';
    slot.dataset.playerId = jugador.id;
    slot.onclick = null;
    slot.innerHTML = '';

    const card = document.createElement('div');
    card.className = `lineup-player-card ${POS_BG[jugador.position] ?? 'card-accent-MC'}`;
    card.style.cursor = 'pointer';

    const removeBtn = document.createElement('button');
    removeBtn.className = 'slot-remove';
    removeBtn.title = 'Al banquillo';
    removeBtn.textContent = '×';
    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moverJugador(jugador, false);
    });

    const title = document.createElement('div');
    title.className = 'lineup-player-name';
    title.textContent = jugador.name;

    const logoBadge = createClippedClubBadge(jugador.clubLogoUrl ?? null, 'lineup-player-logo-clip');

    const portraitFrame = document.createElement('div');
    portraitFrame.className = 'lineup-player-portrait-frame';
    portraitFrame.appendChild(createPlayerPortrait({
        name: jugador.name,
        faceUrl: jugador.faceUrl ?? null,
        playerFifaApiId: jugador.playerFifaApiId ?? null,
        position: jugador.position,
        className: 'lineup-player-portrait',
        imageClassName: 'lineup-player-portrait-media',
    }));

    const scoreBadge = document.createElement('div');
    scoreBadge.className = [
        'lineup-player-score',
        jornadaPts !== null && jornadaPts < 0 ? 'lineup-player-score-negative' : '',
    ].join(' ').trim();
    scoreBadge.textContent = formatScoreBadge(jornadaPts);

    card.appendChild(removeBtn);
    card.appendChild(title);
    card.appendChild(logoBadge);
    card.appendChild(portraitFrame);

    slot.appendChild(card);
    slot.appendChild(scoreBadge);

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        abrirPanelJugador(jugador);
    });
}

function vaciarSlot(slot, posicion, suplentesDisponibles) {
    slot.className = 'player-slot player-slot-empty player-slot-interactive';
    slot.dataset.playerId = '';
    slot.innerHTML = `
        <div class="player-slot-card">
            <div class="player-slot-top">+</div>
            <div class="player-slot-bottom">
                <div class="player-slot-name">${POSICION_SHORT[posicion] ?? posicion}</div>
            </div>
        </div>`;

    if (suplentesDisponibles.length > 0) {
        slot.onclick = (e) => {
            e.stopPropagation();
            abrirSelectorPosicion(slot, posicion, suplentesDisponibles);
        };
    } else {
        slot.onclick = null;
        slot.style.cursor = 'default';
        slot.classList.remove('player-slot-interactive');
    }
}

function renderCampo(titulares, suplentes) {
    const filas = {
        DL: document.querySelectorAll('#pitch-main [data-pos="DL"]'),
        MC: document.querySelectorAll('#pitch-main [data-pos="MC"]'),
        DF: document.querySelectorAll('#pitch-main [data-pos="DF"]'),
        PT: document.querySelectorAll('#pitch-main [data-pos="PT"]'),
    };

    for (const [pos, slots] of Object.entries(filas)) {
        const jugadoresPos = titulares.filter((j) => j.position === pos);
        const suplentesPos = suplentes.filter((j) => j.position === pos);

        slots.forEach((slot, i) => {
            if (jugadoresPos[i]) rellenarSlot(slot, jugadoresPos[i]);
            else vaciarSlot(slot, pos, suplentesPos);
        });
    }
}

function abrirPanelJugador(jugador) {
    abrirPlayerDrawer({
        playerApiId: jugador.player_api_id ?? jugador.id,
        name: jugador.name,
        position: jugador.position,
        marketValue: jugador.purchase_price ?? 0,
        faceUrl: jugador.faceUrl ?? null,
        clubLogoUrl: jugador.clubLogoUrl ?? null,
    });
}

function abrirSelectorPosicion(slotEl, posicion, suplentes) {
    cerrarTodosLosSelectores();

    const popup = document.createElement('div');
    popup.id = 'position-selector-popup';
    popup.style.cssText = `
        position:fixed; z-index:9999;
        background:#0f172a; border:1px solid rgba(59,130,246,0.4);
        border-radius:12px; padding:10px; min-width:180px;
        box-shadow:0 8px 32px rgba(0,0,0,0.7);
    `;

    const titulo = document.createElement('p');
    titulo.style.cssText = 'font-size:9px;font-weight:700;color:#3b82f6;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px';
    titulo.textContent = `Anadir ${POSICION_LABEL[posicion] ?? posicion}`;
    popup.appendChild(titulo);

    for (const jugador of suplentes) {
        const pts = getPuntosJugador(jugador.player_api_id ?? jugador.id);
        const btn = document.createElement('button');
        btn.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;width:100%;background:transparent;border:none;cursor:pointer';
        btn.onmouseenter = () => {
            btn.style.background = 'rgba(255,255,255,0.07)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'transparent';
        };

        const avatar = createPlayerAvatar({
            name: jugador.name,
            faceUrl: jugador.faceUrl ?? null,
            playerFifaApiId: jugador.playerFifaApiId ?? null,
            position: jugador.position,
            size: 28,
        });

        const info = document.createElement('div');
        info.style.cssText = 'text-align:left;min-width:0;overflow:hidden;flex:1';

        const nombre = document.createElement('p');
        nombre.style.cssText = 'font-size:11px;font-weight:600;color:#e2e8f0;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:110px';
        nombre.textContent = jugador.name;

        const ovr = document.createElement('p');
        ovr.style.cssText = `font-size:9px;margin:0;font-weight:700;color:${pts.total >= 0 ? '#60a5fa' : '#f87171'}`;
        ovr.textContent = `${pts.total} pts`;

        info.appendChild(nombre);
        info.appendChild(ovr);
        btn.appendChild(avatar);
        btn.appendChild(info);

        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            cerrarTodosLosSelectores();
            moverJugador(jugador, true);
        });

        popup.appendChild(btn);
    }

    document.body.appendChild(popup);
    const rect = slotEl.getBoundingClientRect();
    const popupH = suplentes.length * 44 + 32;
    popup.style.top = `${Math.max(8, rect.top - popupH - 8)}px`;
    popup.style.left = `${Math.max(8, Math.min(rect.left + rect.width / 2 - 90, window.innerWidth - 196))}px`;

    setTimeout(() => {
        document.addEventListener('click', cerrarTodosLosSelectores, { once: true });
    }, 10);
}

function cerrarTodosLosSelectores() {
    document.getElementById('position-selector-popup')?.remove();
}

function renderBanquillo(suplentes) {
    const container = document.getElementById('bench-players');
    if (!container) return;

    if (!suplentes.length) {
        container.innerHTML = `
            <div class="flex-1 border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center text-center p-8 bg-white/5">
                <p class="text-sm font-bold text-slate-300">Banquillo vacio</p>
                <p class="text-xs text-slate-500 mt-2">Todos tus jugadores estan en el once.</p>
            </div>`;
        return;
    }

    container.innerHTML = '';
    const fragment = document.createDocumentFragment();
    const porPosicion = { PT: [], DF: [], MC: [], DL: [] };

    for (const j of suplentes) {
        (porPosicion[j.position] ?? porPosicion.MC).push(j);
    }

    for (const [pos, jugadores] of Object.entries(porPosicion)) {
        if (!jugadores.length) continue;

        const label = document.createElement('p');
        label.className = 'text-[10px] font-black text-slate-500 uppercase tracking-widest mt-3 mb-1 first:mt-0';
        label.textContent = POSICION_LABEL[pos];
        fragment.appendChild(label);

        for (const jugador of jugadores) {
            fragment.appendChild(crearTarjetaSuplente(jugador));
        }
    }

    container.appendChild(fragment);
}

function crearTarjetaSuplente(jugador) {
    const pts = getPuntosJugador(jugador.player_api_id ?? jugador.id);
    const div = document.createElement('div');
    div.className = 'flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/5 hover:border-blue-500/30 transition-colors cursor-pointer';

    const avatar = createPlayerAvatar({
        name: jugador.name,
        faceUrl: jugador.faceUrl ?? null,
        playerFifaApiId: jugador.playerFifaApiId ?? null,
        position: jugador.position,
        size: 40,
    });

    const info = document.createElement('div');
    info.className = 'flex-1 min-w-0';

    const nombre = document.createElement('p');
    nombre.className = 'font-bold text-sm text-white truncate';
    nombre.textContent = jugador.name;

    const meta = document.createElement('p');
    meta.className = 'text-xs text-slate-500';
    meta.textContent = `${POSICION_SHORT[jugador.position] ?? jugador.position} · `;

    const ptsSpan = document.createElement('span');
    ptsSpan.style.color = pts.total >= 0 ? '#60a5fa' : '#f87171';
    ptsSpan.style.fontWeight = '700';
    ptsSpan.textContent = `${pts.total} pts`;
    meta.appendChild(ptsSpan);

    info.appendChild(nombre);
    info.appendChild(meta);

    const addBtn = document.createElement('button');
    addBtn.className = 'text-blue-400 hover:text-blue-300 text-xs font-bold shrink-0 px-2 py-1 bg-blue-500/10 rounded-lg border border-blue-500/20 hover:bg-blue-500/20 transition-all';
    addBtn.textContent = '+ Once';
    addBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        moverJugador(jugador, true);
    });

    div.appendChild(avatar);
    div.appendChild(info);
    div.appendChild(addBtn);

    div.addEventListener('click', () => abrirPanelJugador(jugador));

    return div;
}

function renderCampoDashboard(titulares) {
    const campo = document.getElementById('pitch-field');
    if (!campo) return;

    campo.querySelectorAll('.fila-delanteros').forEach((el) => el.remove());

    const delanteros = titulares.filter((j) => j.position === 'DL').slice(0, 3);
    if (!delanteros.length) return;

    const fila = document.createElement('div');
    fila.className = 'fila-delanteros flex justify-around items-center px-4 md:px-20 z-10';

    for (const jugador of delanteros) {
        const pts = getPuntosJugador(jugador.player_api_id ?? jugador.id);
        const div = document.createElement('div');
        div.className = 'player-card flex flex-col items-center';

        const wrapper = document.createElement('div');
        wrapper.className = 'relative';

        const avatar = createPlayerAvatar({
            name: jugador.name,
            faceUrl: jugador.faceUrl ?? null,
            playerFifaApiId: jugador.playerFifaApiId ?? null,
            position: jugador.position,
            size: 48,
            className: 'pitch-player-avatar',
        });

        const badge = document.createElement('div');
        badge.className = 'player-score-badge';
        badge.textContent = pts.total;

        wrapper.appendChild(avatar);
        wrapper.appendChild(badge);

        const nombre = document.createElement('span');
        nombre.className = 'player-name-tag';
        nombre.textContent = jugador.name.split(' ').pop();

        div.appendChild(wrapper);
        div.appendChild(nombre);
        fila.appendChild(div);
    }

    campo.insertBefore(fila, campo.firstChild);
}

async function moverJugador(jugador, hacerTitular) {
    const liga = getLigaActiva();
    if (!liga) return;

    _roster = _roster.map((j) => (j.id === jugador.id ? { ...j, is_starter: hacerTitular } : j));
    renderTodo();

    try {
        await toggleStarter(liga.id, jugador.id, hacerTitular);
    } catch (err) {
        console.error('[Roster] Error al mover jugador:', err.message);
        _roster = _roster.map((j) => (j.id === jugador.id ? { ...j, is_starter: !hacerTitular } : j));
        renderTodo();
    }
}

window.loadRoster = loadRoster;
