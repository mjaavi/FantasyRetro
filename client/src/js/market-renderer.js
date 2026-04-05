import { createPlayerAvatar, createClubLogo } from './player-image.js';

export function formatCurrency(value) {
    return new Intl.NumberFormat('es-ES').format(value);
}

const POS_COLOR = { PT: '#f59e0b', DF: '#22c55e', MC: '#a855f7', DL: '#ef4444' };

export function createPlayerCard(player, userBid) {
    const hasBid = Boolean(userBid);

    const card = document.createElement('div');
    card.className = [
        'bento-card group flex flex-col cursor-pointer',
        hasBid
            ? '!border-green-500/50 bg-green-500/5 shadow-[0_0_30px_rgba(74,222,128,0.1)]'
            : 'hover:border-blue-500/50 hover:-translate-y-1 hover:shadow-[0_10px_40px_rgba(37,99,235,0.15)]',
    ].join(' ');

    // ── Header ────────────────────────────────────────────────────────────────
    // Reemplazado div con iniciales por helper con foto real + fallback
    const avatar = createPlayerAvatar({
        name:     player.name,
        faceUrl:  player.faceUrl ?? null,
        playerFifaApiId: player.playerFifaApiId ?? null,
        position: player.position,
        size:     56,
    });

    const name = document.createElement('h3');
    name.className = 'font-extrabold text-white leading-tight text-xl group-hover:text-blue-400 transition-colors';
    name.textContent = player.name;

    const posTag = document.createElement('span');
    posTag.className = 'text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider';
    posTag.style.cssText = `background:${POS_COLOR[player.position] ?? '#3b82f6'}22;color:${POS_COLOR[player.position] ?? '#3b82f6'};border:1px solid ${POS_COLOR[player.position] ?? '#3b82f6'}44`;
    posTag.textContent = player.position;

    // Escudo del club a la derecha del nombre
    const clubLogo = createClubLogo({ clubLogoUrl: player.clubLogoUrl ?? null, size: 20 });

    const nameRow = document.createElement('div');
    nameRow.appendChild(name);
    nameRow.appendChild(posTag);
    nameRow.appendChild(clubLogo);
    nameRow.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap';

    const left = document.createElement('div');
    left.className = 'flex gap-4 items-center mb-5';
    left.appendChild(avatar);
    left.appendChild(nameRow);

    card.appendChild(left);

    // ── Puntos totales ────────────────────────────────────────────────────────
    const pts = player.totalPts ?? null;
    const ptsRow = document.createElement('div');
    ptsRow.className = 'flex justify-between items-center mb-5';

    const ptsLabel = document.createElement('span');
    ptsLabel.className = 'text-xs font-bold text-slate-500 uppercase tracking-wider';
    ptsLabel.textContent = 'Puntos totales';

    const ptsVal = document.createElement('span');
    ptsVal.className = 'font-black text-2xl';
    if (pts === null) {
        ptsVal.style.color = '#334155';
        ptsVal.textContent = '—';
    } else {
        ptsVal.style.color = pts >= 0 ? '#60a5fa' : '#f87171';
        ptsVal.textContent = `${pts} pts`;
    }

    ptsRow.appendChild(ptsLabel);
    ptsRow.appendChild(ptsVal);
    card.appendChild(ptsRow);

    // ── Footer ────────────────────────────────────────────────────────────────
    const footer = document.createElement('div');
    footer.className = 'mt-auto pt-4 border-t border-white/10';

    const priceRow = document.createElement('div');
    priceRow.className = 'flex justify-between items-end mb-4';

    const label = document.createElement('span');
    label.className = 'text-xs font-bold text-slate-400';

    const value = document.createElement('span');
    value.className = 'text-base font-mono font-black';

    if (userBid) {
        label.textContent = 'Tu Puja';
        value.style.color = '#4ade80';
        value.textContent = `${formatCurrency(userBid.amount)} €`;

        const btnRow = document.createElement('div');
        btnRow.className = 'flex gap-2';
        btnRow.appendChild(createBtn('btn-warning-glass flex-1 py-3', 'Modificar', 'open-bid-drawer', player));
        btnRow.appendChild(createBtn('btn-danger-glass flex-1 py-3',  'Cancelar',  'cancel-bid',      player));

        priceRow.appendChild(label);
        priceRow.appendChild(value);
        footer.appendChild(priceRow);
        footer.appendChild(btnRow);
    } else {
        label.textContent = 'Valor';
        value.style.color = '#e2e8f0';
        value.textContent = `${formatCurrency(player.market_value)} €`;

        priceRow.appendChild(label);
        priceRow.appendChild(value);
        footer.appendChild(priceRow);
        footer.appendChild(createBtn('btn-primary w-full py-3.5', 'Hacer Oferta', 'open-bid-drawer', player));
    }

    card.appendChild(footer);
    return card;
}

function createBtn(className, text, action, player) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.dataset.action      = action;
    btn.dataset.playerId    = player.id;
    btn.dataset.playerName  = player.name;
    btn.dataset.marketValue = formatCurrency(player.market_value);
    return btn;
}
