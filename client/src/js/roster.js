import { fetchRoster, fetchRosterLineups, fetchRosterScores, saveRosterFormation, toggleStarter } from './api.js';
import { abrirPlayerDrawer } from './player-drawer.js';
import { raiseReleaseClause, dismissPlayer, sellPlayer } from './market.js';
import { getLigaActiva } from './leagues.js';
import { createPlayerAvatar, createPlayerPortrait, createClubLogo } from './player-image.js';

let _roster = [];
let _puntos = {};
let _jornada = 0;
let _jornadaSeleccionada = null;
let _historicoData = {};
let _lineupFormations = {};
let _draggedPlayerId = null;

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

const DEFAULT_FORMATION = '4-4-2';

function getEditableJornada() {
    return _jornada + 1;
}

function isEditableJornada(jornada = _jornadaSeleccionada) {
    return Number(jornada) === getEditableJornada();
}

function isValidFormation(formationKey) {
    return Boolean(window.AVAILABLE_FORMATIONS?.[formationKey]);
}

function inferFormationFrom(players) {
    return window.inferFormation ? window.inferFormation(players ?? []) : DEFAULT_FORMATION;
}

function getFormationForJornada(jornada, playersForInference = _roster) {
    const savedFormation = _lineupFormations[Number(jornada)];
    if (isValidFormation(savedFormation)) return savedFormation;
    return inferFormationFrom(playersForInference);
}

function getCurrentFormation() {
    if (_jornadaSeleccionada <= _jornada) {
        const titulares = _historicoData[_jornadaSeleccionada]?.titulares ?? [];
        return getFormationForJornada(_jornadaSeleccionada, titulares);
    }

    return getFormationForJornada(getEditableJornada(), _roster);
}

function normalizeRosterPosition(position) {
    return POSICION_LABEL[position] ? position : 'MC';
}

function getPlayerPosition(jugador) {
    return normalizeRosterPosition(jugador?.position);
}

function countStartersInPosition(position) {
    const targetPosition = normalizeRosterPosition(position);

    return _roster.filter((item) =>
        item?.is_starter && getPlayerPosition(item) === targetPosition,
    ).length;
}

function hasStarterInPosition(position) {
    const targetPosition = normalizeRosterPosition(position);

    return _roster.some((item) =>
        item?.is_starter && getPlayerPosition(item) === targetPosition,
    );
}

function canPromoteToCurrentFormation(jugador) {
    if (!isEditableJornada()) return false;

    const layout = window.AVAILABLE_FORMATIONS?.[getCurrentFormation()];
    const position = getPlayerPosition(jugador);
    if (!layout || !Number.isFinite(Number(layout[position]))) return false;

    return countStartersInPosition(position) < Number(layout[position]);
}

function canDragBenchPlayerToLineup(jugador) {
    if (!jugador || jugador.is_starter || !isEditableJornada()) return false;

    return canPromoteToCurrentFormation(jugador) || hasStarterInPosition(getPlayerPosition(jugador));
}

function canDropPlayerOnLineupSlot(jugador, targetPosition, currentPlayer = null) {
    if (!jugador || !isEditableJornada()) return false;
    if (getPlayerPosition(jugador) !== normalizeRosterPosition(targetPosition)) return false;

    if (currentPlayer) {
        if (Number(currentPlayer.id) === Number(jugador.id)) return false;
        return !jugador.is_starter && Boolean(currentPlayer.is_starter);
    }

    return !jugador.is_starter && canPromoteToCurrentFormation(jugador);
}

function getStarterIndexInPosition(jugador, roster = _roster) {
    if (!jugador) return -1;

    const position = getPlayerPosition(jugador);
    return roster
        .filter((item) => item?.is_starter && getPlayerPosition(item) === position)
        .findIndex((item) => Number(item.id) === Number(jugador.id));
}

function placeStarterInPosition(playerId, position, targetIndex) {
    const normalizedPosition = normalizeRosterPosition(position);
    const startersInPosition = _roster.filter((item) =>
        item?.is_starter && getPlayerPosition(item) === normalizedPosition,
    );
    const movedPlayer = startersInPosition.find((item) => Number(item.id) === Number(playerId));

    if (!movedPlayer) return;

    const orderedStarters = startersInPosition.filter((item) => Number(item.id) !== Number(playerId));
    const boundedIndex = Math.max(0, Math.min(Number(targetIndex) || 0, orderedStarters.length));
    orderedStarters.splice(boundedIndex, 0, movedPlayer);

    let nextStarterIndex = 0;
    _roster = _roster.map((item) => {
        if (!item?.is_starter || getPlayerPosition(item) !== normalizedPosition) return item;
        return orderedStarters[nextStarterIndex++] ?? item;
    });
}

function getRosterPlayerById(playerId) {
    const id = Number(playerId);
    if (!Number.isFinite(id)) return null;
    return _roster.find((player) => Number(player.id) === id) ?? null;
}

function setPlayerDragData(event, jugador) {
    _draggedPlayerId = Number(jugador.id);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('application/x-retro-player-id', String(jugador.id));
    event.dataTransfer.setData('text/plain', String(jugador.id));
}

function clearPlayerDragData() {
    _draggedPlayerId = null;
}

function getDraggedPlayer(event) {
    const playerId = _draggedPlayerId
        ?? (
            event.dataTransfer.getData('application/x-retro-player-id')
            || event.dataTransfer.getData('text/plain')
        );
    return getRosterPlayerById(playerId);
}

function syncFormationSelector(formationKey = getCurrentFormation()) {
    const sel = document.getElementById('liga-formation-selector');
    if (!sel) return;

    sel.value = isValidFormation(formationKey) ? formationKey : DEFAULT_FORMATION;
    sel.disabled = !isEditableJornada();
    sel.classList.toggle('lineup-formation-select-readonly', sel.disabled);
    sel.title = sel.disabled
        ? 'Las jornadas cerradas no admiten cambios de alineacion'
        : 'Formacion de la jornada abierta';
}

export async function loadRoster() {
    const liga = getLigaActiva();
    if (!liga) return;

    try {
        const [roster, scoreSummary, lineupSummary] = await Promise.all([
            fetchRoster(liga.id).then(r => r ?? []),
            fetchRosterScores(liga.id).catch(() => ({ jornadaActual: 0, scores: [] })),
            fetchRosterLineups(liga.id).catch(() => ({ lineups: [] })),
        ]);

        _roster = roster;
        cargarPuntos(scoreSummary);
        cargarLineups(lineupSummary);
        
        // Inicializar formaciones UI si existe selector
        const sel = document.getElementById('liga-formation-selector');
        if (sel && !sel.dataset.initialized) {
            sel.dataset.initialized = 'true';
            sel.addEventListener('change', handleFormationChange);
        }
        
        renderTodo();
    } catch (err) {
        console.error('[Roster]', err.message);
    }
}

function cargarPuntos(scoreSummary) {
    try {
        _jornada = Number(scoreSummary?.jornadaActual ?? 0);
        _jornadaSeleccionada = _jornada + 1;

        if (_jornada === 0) {
            _puntos = {};
            _historicoData = {};
            return;
        }

        const scores = scoreSummary?.scores ?? [];

        _puntos = {};
        _historicoData = {};
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
            
            if (!_historicoData[s.jornada]) {
                _historicoData[s.jornada] = { titulares: [], stats: {} };
            }
            if (s.is_starter) {
                _historicoData[s.jornada].titulares.push(s);
            }
            _historicoData[s.jornada].stats[id] = Number(s.puntos_total);
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
        _historicoData = {};
    }
}

function cargarLineups(lineupSummary) {
    _lineupFormations = {};

    for (const lineup of lineupSummary?.lineups ?? []) {
        const jornada = Number(lineup?.jornada);
        const formationKey = lineup?.formation_key;
        if (Number.isInteger(jornada) && isValidFormation(formationKey)) {
            _lineupFormations[jornada] = formationKey;
        }
    }
}

async function handleFormationChange(e) {
    const liga = getLigaActiva();
    const target = e.target.value;
    const jornada = getEditableJornada();
    const previous = getFormationForJornada(jornada, _roster);

    if (!liga || !isEditableJornada() || !isValidFormation(target)) {
        syncFormationSelector(previous);
        return;
    }

    _lineupFormations[jornada] = target;
    syncFormationSelector(target);
    renderTodo();

    try {
        await saveRosterFormation(liga.id, jornada, target);

        const toDemote = window.calcFormationDemotions
            ? window.calcFormationDemotions(_roster, target)
            : [];

        for (const demoteId of toDemote) {
            const jugador = _roster.find((x) => x.id === demoteId);
            if (jugador) await moverJugador(jugador, false);
        }
    } catch (err) {
        console.error('[Roster] Error al guardar formacion:', err.message);
        _lineupFormations[jornada] = previous;
        syncFormationSelector(previous);
        renderTodo();
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

function getLineupScoreValue(jugador) {
    if (isEditableJornada()) return null;

    return jugador.jornada_pts !== undefined
        ? jugador.jornada_pts
        : getPuntosJornadaActual(jugador.player_api_id ?? jugador.id);
}

function renderTodo() {
    try {
        renderSlider();
    } catch (e) {
        console.error('[Roster] Error en renderSlider:', e);
    }

    try {
        if (_jornadaSeleccionada <= _jornada) {
            const hData = _historicoData[_jornadaSeleccionada];
            if (!hData) {
                renderCampo([], []);
                renderBanquillo([]);
                renderCampoDashboard([]);
                return;
            }

            const titularesSnapshot = hData.titulares.map((s) => ({
                id: s.player_api_id,
                player_api_id: s.player_api_id,
                name: s.name ?? 'Desconocido',
                position: s.position ?? 'MC',
                faceUrl: s.faceUrl ?? null,
                clubLogoUrl: s.clubLogoUrl ?? null,
                is_starter: true,
                jornada_pts: Number(s.puntos_total ?? s.total ?? 0),
            }));

            renderCampo(titularesSnapshot ?? [], []);
            renderBanquillo([]); 
            renderCampoDashboard(titularesSnapshot ?? []);
        } else {
            const sRoster = Array.isArray(_roster) ? _roster : [];
            const titulares = sRoster.filter((j) => j?.is_starter);
            const suplentes = sRoster.filter((j) => !j?.is_starter);

            renderCampo(titulares, suplentes);
            renderBanquillo(suplentes);
            renderCampoDashboard(titulares);
        }
    } catch (err) {
        console.error('[Roster] Error fatal en renderTodo:', err);
    }
}

function formatLineupValue(val) {
    if (val >= 1000000) return (val / 1000000).toFixed(1).replace(/\.0$/, '') + 'M €';
    if (val >= 1000) return (val / 1000).toFixed(0) + 'k €';
    return new Intl.NumberFormat('es-ES').format(val) + ' €';
}

function renderSlider() {
    const slider = document.getElementById('roster-jornadas-slider');
    if (!slider) return;
    
    slider.innerHTML = '';
    const actual = getEditableJornada();
    
    for (let j = 1; j <= actual; j++) {
        const esSeleccionada = j === _jornadaSeleccionada;
        const esEdicion = j === actual;
        
        let ptsTexto = '0 pts';
        if (esEdicion) {
            ptsTexto = '-';
        } else {
            const hData = _historicoData[j];
            if (hData && Array.isArray(hData.titulares)) {
                const total = hData.titulares.reduce((s, p) => s + (Number(p.total ?? p.puntos_total) || 0), 0);
                ptsTexto = `${Math.trunc(total)} pts`;
            }
        }
        
        const btn = document.createElement('button');
        const stateClass = esEdicion
            ? (esSeleccionada
                ? 'bg-emerald-500/20 border-emerald-400/60 ring-1 ring-emerald-400/20'
                : 'bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/15')
            : (esSeleccionada
                ? 'bg-blue-500/20 border-blue-500/50'
                : 'bg-white/5 border-white/10 hover:bg-white/10');
        const labelClass = esEdicion
            ? 'text-emerald-300'
            : (esSeleccionada ? 'text-blue-400' : 'text-slate-500');
        const pointsClass = esEdicion
            ? 'text-emerald-50'
            : (esSeleccionada ? 'text-white' : 'text-slate-400');

        btn.className = `px-3 py-1.5 rounded-xl border min-w-[70px] shrink-0 flex flex-col items-center justify-center shadow-sm transition-all text-center ${stateClass}`;
        
        btn.innerHTML = `
            <p class="text-[11px] font-black uppercase ${labelClass} tracking-wide">J${j}</p>
            <p class="text-xs font-bold ${pointsClass} mt-0.5">${ptsTexto}</p>
        `;
        
        btn.onclick = () => {
            _jornadaSeleccionada = j;
            renderTodo();
        };
        
        slider.appendChild(btn);
    }

    if (!slider.dataset.draggable) {
        let isDown = false;
        let startX, scrollLeft;
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
        slider.dataset.draggable = "true";
    }
}


function createLineupPlayerElements(jugador, options = {}) {
    const {
        draggable = false,
        draggingClass = 'lineup-player-card-dragging',
        showRemove = false,
        onRemove = null,
        onOpen = abrirPanelJugador,
    } = options;
    const jornadaPts = getLineupScoreValue(jugador);
    const card = document.createElement('div');
    card.className = `lineup-player-card ${POS_BG[jugador.position] ?? 'card-accent-MC'}`;
    card.style.cursor = draggable ? 'grab' : 'pointer';
    card.draggable = Boolean(draggable);

    if (card.draggable) {
        card.addEventListener('dragstart', (event) => {
            setPlayerDragData(event, jugador);
            card.classList.add(draggingClass);
        });
        card.addEventListener('dragend', () => {
            card.classList.remove(draggingClass);
            clearPlayerDragData();
        });
    }

    if (showRemove) {
        const removeBtn = document.createElement('button');
        removeBtn.className = 'slot-remove';
        removeBtn.title = 'Al banquillo';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            onRemove?.(jugador);
        });
        card.appendChild(removeBtn);
    }

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

    card.appendChild(title);
    card.appendChild(logoBadge);
    card.appendChild(portraitFrame);

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        onOpen?.(jugador);
    });

    return { card, scoreBadge };
}

function appendLineupPlayerToSlot(slot, jugador, options = {}) {
    const { card, scoreBadge } = createLineupPlayerElements(jugador, options);
    slot.appendChild(card);
    slot.appendChild(scoreBadge);
    return card;
}

function setupLineupSlotDropTarget(slot, posicion, currentPlayer = null, slotIndex = 0) {
    if (!isEditableJornada()) return;

    slot.addEventListener('dragover', (event) => {
        const jugador = getDraggedPlayer(event);
        if (!canDropPlayerOnLineupSlot(jugador, posicion, currentPlayer)) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        slot.classList.add('player-slot-drop-active');
    });

    slot.addEventListener('dragleave', (event) => {
        if (slot.contains(event.relatedTarget)) return;
        slot.classList.remove('player-slot-drop-active');
    });

    slot.addEventListener('drop', (event) => {
        const jugador = getDraggedPlayer(event);
        slot.classList.remove('player-slot-drop-active');

        if (!canDropPlayerOnLineupSlot(jugador, posicion, currentPlayer)) return;

        event.preventDefault();
        event.stopPropagation();
        handleLineupSlotDrop(jugador, currentPlayer, {
            position: posicion,
            index: slotIndex,
        });
        clearPlayerDragData();
    });
}

function handleLineupSlotDrop(jugador, currentPlayer = null, placement = null) {
    if (currentPlayer) {
        reemplazarTitular(jugador, currentPlayer, placement);
        return;
    }

    moverJugador(jugador, true, placement);
}

function rellenarSlot(slot, jugador, slotIndex = 0) {
    slot.className = 'player-slot';
    slot.dataset.playerId = jugador.id;
    slot.style.cursor = '';
    slot.onclick = null;
    slot.innerHTML = '';

    appendLineupPlayerToSlot(slot, jugador, {
        draggable: isEditableJornada(),
        showRemove: _jornadaSeleccionada > _jornada,
        onRemove: () => moverJugador(jugador, false),
    });
    setupLineupSlotDropTarget(slot, jugador.position, jugador, slotIndex);
}

function vaciarSlot(slot, posicion, suplentesDisponibles, slotIndex = 0) {
    slot.className = 'player-slot player-slot-empty player-slot-interactive';
    slot.dataset.playerId = '';
    slot.style.cursor = '';
    slot.innerHTML = `
        <div class="player-slot-card">
            <div class="player-slot-top">+</div>
            <div class="player-slot-bottom">
                <div class="player-slot-name">${POSICION_SHORT[posicion] ?? posicion}</div>
            </div>
        </div>`;

    if (suplentesDisponibles.length > 0 && _jornadaSeleccionada > _jornada) {
        slot.onclick = (e) => {
            e.stopPropagation();
            abrirSelectorPosicion(slot, posicion, suplentesDisponibles);
        };
    } else {
        slot.onclick = null;
        slot.style.cursor = 'default';
        slot.classList.remove('player-slot-interactive');
    }

    setupLineupSlotDropTarget(slot, posicion, null, slotIndex);
}

function buildPitchDOM(formationKey) {
    const pitch = document.getElementById('pitch-main');
    if (!pitch) return;
    
    pitch.innerHTML = `
        <div class="absolute top-1/2 left-0 w-full h-px bg-white/10 -translate-y-1/2"></div>
        <div class="absolute top-1/2 left-1/2 w-28 h-28 border border-white/10 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
    `;
    
    const layout = window.AVAILABLE_FORMATIONS ? window.AVAILABLE_FORMATIONS[formationKey] : { DF: 4, MC: 4, DL: 2, PT: 1 };
    if (!layout) return;

    const order = ['DL', 'MC', 'DF', 'PT'];
    
    for (const pos of order) {
        const count = layout[pos] || 0;
        if (count === 0) continue;
        
        const rowDiv = document.createElement('div');
        rowDiv.className = `relative z-10 flex justify-center gap-4 ${pos === 'DL' ? 'md:gap-14' : 'md:gap-10'} w-full px-4 mb-3`;
        
        for (let i = 0; i < count; i++) {
            const slot = document.createElement('div');
            slot.dataset.pos = pos;
            slot.className = 'player-slot player-slot-interactive player-slot-empty';
            const label = document.createElement('span');
            label.className = 'player-slot-label';
            label.textContent = POSICION_SHORT[pos] || pos;
            slot.appendChild(label);
            rowDiv.appendChild(slot);
        }
        pitch.appendChild(rowDiv);
    }
}

function renderCampo(titulares, suplentes) {
    let formationKey = DEFAULT_FORMATION;
    
    if (_jornadaSeleccionada <= _jornada) {
        formationKey = getFormationForJornada(_jornadaSeleccionada, titulares);
    } else {
        formationKey = getFormationForJornada(getEditableJornada(), _roster);
    }

    syncFormationSelector(formationKey);
    
    buildPitchDOM(formationKey);

    const filas = {
        DL: document.querySelectorAll('#pitch-main [data-pos="DL"]'),
        MC: document.querySelectorAll('#pitch-main [data-pos="MC"]'),
        DF: document.querySelectorAll('#pitch-main [data-pos="DF"]'),
        PT: document.querySelectorAll('#pitch-main [data-pos="PT"]'),
    };

    if (!Array.isArray(titulares)) titulares = [];
    if (!Array.isArray(suplentes)) suplentes = [];

    for (const [pos, slots] of Object.entries(filas)) {
        if (!slots) continue;
        
        const jugadoresPos = titulares.filter((j) => j?.position === pos);
        const suplentesPos = suplentes.filter((j) => j?.position === pos);

        slots.forEach((slot, i) => {
            try {
                if (jugadoresPos[i]) {
                    rellenarSlot(slot, jugadoresPos[i], i);
                } else {
                    vaciarSlot(slot, pos, suplentesPos, i);
                }
            } catch (err) {
                console.error(`[Roster] Error renderizando slot de pos ${pos} en indice ${i}:`, err);
            }
        });
    }
}

function abrirPanelJugador(jugador) {
    abrirPlayerDrawer({
        playerApiId: jugador.player_api_id ?? jugador.id,
        name: jugador.name,
        position: jugador.position,
        marketValue: jugador.purchase_price ?? 0,
        releaseClause: jugador.release_clause ?? jugador.purchase_price ?? 0,
        faceUrl: jugador.faceUrl ?? null,
        clubLogoUrl: jugador.clubLogoUrl ?? null,
        alreadyOnSale: jugador.onSale ?? false,
        onRaiseReleaseClause: async ({ playerApiId, contribution }) => {
            const errorEl = document.getElementById('pd-bid-error');
            const submitBtn = document.getElementById('pd-submit-btn');
            if (errorEl) errorEl.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Subiendo...';
            }

            try {
                const result = await raiseReleaseClause({ playerApiId, contribution });
                if (result?.data?.releaseClause) {
                    jugador.release_clause = result.data.releaseClause;
                }
                window.cerrarPlayerDrawer?.();
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message ?? 'Error al subir la clausula.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Subir Clausula';
                }
            }
        },
        onDismissPlayer: async ({ playerApiId }) => {
            const errorEl = document.getElementById('pd-bid-error');
            const submitBtn = document.getElementById('pd-submit-btn');
            if (errorEl) errorEl.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Despidiendo...';
            }

            try {
                await dismissPlayer({ playerApiId });
                _roster = _roster.filter(p => String(p.player_api_id ?? p.id) !== String(playerApiId));
                window.cerrarPlayerDrawer?.();
                renderTodo();
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message ?? 'Error al despedir al jugador.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Despedir Jugador';
                }
            }
        },
        onSellPlayer: async ({ playerApiId }) => {
            const errorEl = document.getElementById('pd-bid-error');
            const submitBtn = document.getElementById('pd-submit-btn');
            if (errorEl) errorEl.classList.add('hidden');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = 'Poniendo a la venta...';
            }

            try {
                await sellPlayer({ playerApiId });
                jugador.onSale = true;
                window.cerrarPlayerDrawer?.();
            } catch (error) {
                if (errorEl) {
                    errorEl.textContent = error.message ?? 'Error al poner a la venta al jugador.';
                    errorEl.classList.remove('hidden');
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = 'Poner a la Venta';
                }
            }
        },
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
    setupBenchDropTarget(container);

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

        const group = document.createElement('div');
        group.className = 'bench-position-grid';

        for (const jugador of jugadores) {
            group.appendChild(crearTarjetaSuplente(jugador));
        }

        fragment.appendChild(group);
    }

    container.appendChild(fragment);
}

function setupBenchDropTarget(container) {
    if (container._benchDropController) {
        container._benchDropController.abort();
    }

    const controller = new AbortController();
    container._benchDropController = controller;

    container.addEventListener('dragover', (event) => {
        const jugador = getDraggedPlayer(event);
        if (!jugador?.is_starter || !isEditableJornada()) return;

        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        container.classList.add('bench-drop-active');
    }, { signal: controller.signal });

    container.addEventListener('dragleave', (event) => {
        if (container.contains(event.relatedTarget)) return;
        container.classList.remove('bench-drop-active');
    }, { signal: controller.signal });

    container.addEventListener('drop', (event) => {
        const jugador = getDraggedPlayer(event);
        container.classList.remove('bench-drop-active');

        if (!jugador?.is_starter || !isEditableJornada()) return;

        event.preventDefault();
        event.stopPropagation();
        moverJugador(jugador, false);
        clearPlayerDragData();
    }, { signal: controller.signal });
}

function crearTarjetaSuplente(jugador) {
    const slot = document.createElement('div');
    const canDragToLineup = canDragBenchPlayerToLineup(jugador);
    slot.className = 'player-slot bench-player-slot';
    slot.dataset.playerId = jugador.id;
    slot.title = canDragToLineup
        ? 'Arrastrar al once'
        : 'Sin huecos libres: arrastra sobre otro jugador de su posicion';
    slot.classList.toggle('bench-player-slot-disabled', !canDragToLineup);

    appendLineupPlayerToSlot(slot, jugador, {
        draggable: canDragToLineup,
        draggingClass: 'bench-player-dragging',
    });

    return slot;
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

function applyStarterChanges(changes, placement = null) {
    const nextStateById = new Map(
        changes.map((change) => [Number(change.playerId), Boolean(change.isStarter)]),
    );
    const previousRoster = _roster;

    _roster = _roster.map((j) =>
        nextStateById.has(Number(j.id))
            ? { ...j, is_starter: nextStateById.get(Number(j.id)) }
            : j,
    );

    if (placement) {
        placeStarterInPosition(placement.playerId, placement.position, placement.index);
    }

    renderTodo();

    return previousRoster;
}

async function persistStarterChanges(leagueId, changes) {
    for (const change of changes) {
        await toggleStarter(leagueId, change.playerId, change.isStarter);
    }
}

async function rollbackStarterChanges(leagueId, previousRoster, changes) {
    const previousStateById = new Map(
        previousRoster.map((player) => [Number(player.id), Boolean(player.is_starter)]),
    );

    for (const change of [...changes].reverse()) {
        const previousState = previousStateById.get(Number(change.playerId));
        if (typeof previousState !== 'boolean') continue;

        try {
            await toggleStarter(leagueId, change.playerId, previousState);
        } catch (err) {
            console.warn('[Roster] No se pudo revertir el cambio de alineacion:', err.message);
        }
    }
}

async function commitStarterChanges(leagueId, changes, errorContext, placement = null) {
    const previousRoster = applyStarterChanges(changes, placement);

    try {
        await persistStarterChanges(leagueId, changes);
    } catch (err) {
        console.error(`[Roster] Error al ${errorContext}:`, err.message);
        _roster = previousRoster;
        renderTodo();
        await rollbackStarterChanges(leagueId, previousRoster, changes);
    }
}

async function reemplazarTitular(entrante, saliente, placement = null) {
    const liga = getLigaActiva();
    if (!liga) return;
    if (!canDropPlayerOnLineupSlot(entrante, saliente.position, saliente)) return;

    const targetIndex = placement?.index ?? getStarterIndexInPosition(saliente);
    await commitStarterChanges(liga.id, [
        { playerId: saliente.id, isStarter: false },
        { playerId: entrante.id, isStarter: true },
    ], 'reemplazar titular', {
        playerId: entrante.id,
        position: saliente.position,
        index: targetIndex,
    });
}

async function moverJugador(jugador, hacerTitular, placement = null) {
    const liga = getLigaActiva();
    if (!liga) return;
    if (!isEditableJornada()) return;
    if (hacerTitular && !canPromoteToCurrentFormation(jugador)) return;

    await commitStarterChanges(liga.id, [
        { playerId: jugador.id, isStarter: hacerTitular },
    ], 'mover jugador', hacerTitular && placement
        ? {
            playerId: jugador.id,
            position: placement.position ?? jugador.position,
            index: placement.index ?? getStarterIndexInPosition(jugador),
        }
        : null);
}

window.loadRoster = loadRoster;
