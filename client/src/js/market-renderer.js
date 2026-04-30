import { createPlayerPortrait, createClubLogo } from './player-image.js';

export function formatCurrency(value) {
    return new Intl.NumberFormat('es-ES').format(value);
}

const POS_LABEL = { PT: 'POR', DF: 'DEF', MC: 'MED', DL: 'DEL' };
const POS_ACCENT_CLASS = {
    PT: 'card-accent-PT',
    DF: 'card-accent-DF',
    MC: 'card-accent-MC',
    DL: 'card-accent-DL',
};

function createClippedClubBadge(clubLogoUrl, className, size = 98) {
    const badge = document.createElement('div');
    badge.className = className;

    const logo = createClubLogo({ clubLogoUrl: clubLogoUrl ?? null, size, alt: 'Escudo del club' });
    logo.style.cssText += ';width:100%;height:100%;object-fit:contain;transform:translateX(16%);';
    badge.appendChild(logo);

    return badge;
}

function createBtn(className, text, action, player) {
    const btn = document.createElement('button');
    btn.className = className;
    btn.textContent = text;
    btn.dataset.action = action;
    btn.dataset.playerId = player.id;
    btn.dataset.playerName = player.name;
    btn.dataset.marketValue = String(player.market_value ?? 0);
    return btn;
}

export function createPlayerCard(player, userBid) {
    const hasBid = Boolean(userBid);

    const card = document.createElement('div');
    card.dataset.playerId = player.id;
    card.dataset.hasBid = hasBid ? 'true' : 'false';
    card.className = [
        'market-player-card',
        POS_ACCENT_CLASS[player.position] ?? 'card-accent-MC',
        hasBid ? 'market-player-card-active' : '',
    ].join(' ');

    const title = document.createElement('h3');
    title.className = 'market-player-name';
    title.textContent = player.name;

    const logoClip = createClippedClubBadge(player.clubLogoUrl ?? null, 'market-player-logo-clip');

    const body = document.createElement('div');
    body.className = 'market-player-body';

    const portrait = createPlayerPortrait({
        name: player.name,
        faceUrl: player.faceUrl ?? null,
        playerFifaApiId: player.playerFifaApiId ?? null,
        position: player.position,
        className: 'market-player-portrait',
        imageClassName: 'market-player-portrait-media',
    });

    const content = document.createElement('div');
    content.className = 'market-player-content';

    const header = document.createElement('div');
    header.className = 'market-player-header';

    const club = document.createElement('p');
    club.className = 'market-player-club';
    club.textContent = player.realTeam ?? player.real_team ?? 'Sin equipo';

    const posTag = document.createElement('span');
    posTag.className = 'market-player-pos';
    posTag.textContent = POS_LABEL[player.position] ?? player.position ?? 'JUG';

    header.appendChild(club);
    header.appendChild(posTag);

    const footer = document.createElement('div');
    footer.className = 'market-player-footer';

    const priceBlock = document.createElement('div');
    priceBlock.className = 'market-player-price-block';

    const label = document.createElement('span');
    label.className = 'market-player-price-label';
    label.textContent = 'PRECIO';

    const value = document.createElement('span');
    value.className = hasBid ? 'market-player-bid-value' : 'market-player-price-value';
    value.textContent = `${formatCurrency(hasBid ? userBid.amount : player.market_value)} €`;

    priceBlock.appendChild(label);
    priceBlock.appendChild(value);

    if (hasBid) {
        const bidMeta = document.createElement('span');
        bidMeta.className = 'market-player-price-label';
        bidMeta.textContent = 'TU PUJA';
        priceBlock.insertBefore(bidMeta, value);
        label.remove();
    }

    const actions = document.createElement('div');
    actions.className = hasBid ? 'market-player-actions market-player-actions-split' : 'market-player-actions';

    if (hasBid) {
        actions.appendChild(createBtn('market-player-button market-player-button-secondary', 'Modificar', 'open-bid-drawer', player));
        actions.appendChild(createBtn('market-player-button market-player-button-danger', 'Cancelar', 'cancel-bid', player));
    } else {
        actions.appendChild(createBtn('market-player-button market-player-button-primary', 'Fichar', 'open-bid-drawer', player));
    }

    content.appendChild(header);
    content.appendChild(priceBlock);
    footer.appendChild(actions);

    body.appendChild(portrait);
    body.appendChild(content);

    card.appendChild(title);
    card.appendChild(logoClip);
    card.appendChild(body);
    card.appendChild(footer);

    return card;
}
