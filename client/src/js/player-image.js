import { getApiBaseUrlSync } from './env.js';

const POS_COLOR = { PT: '#f59e0b', DF: '#22c55e', MC: '#a855f7', DL: '#ef4444' };
const DEFAULT_COLOR = '#3b82f6';
const FACE_CACHE_BUST_VERSION = '2026-04-04-facefix-2';

function getInitials(name) {
    return (name ?? '?')
        .split(' ')
        .map(word => word[0] ?? '')
        .join('')
        .substring(0, 2)
        .toUpperCase();
}

function getAlternateClubLogoUrl(url) {
    if (!url) return null;

    if (url.endsWith('.0.webp')) {
        return url.replace(/\.0\.webp$/, '.webp');
    }

    if (url.endsWith('.webp')) {
        return url.replace(/\.webp$/, '.0.webp');
    }

    return null;
}

function extractPlayerFifaId(url) {
    if (!url) return null;

    const storageMatch = url.match(/\/players\/(\d+)\.webp(?:$|\?)/i);
    if (storageMatch) {
        return storageMatch[1];
    }

    const sofifaMatch = url.match(/\/players\/(\d{3})\/(\d{3})\/\d{2}_120\.png(?:$|\?)/i);
    if (sofifaMatch) {
        return `${sofifaMatch[1]}${sofifaMatch[2]}`;
    }

    return null;
}

function resolvePlayerFifaId(faceUrl, playerFifaApiId) {
    const numericId = Number(playerFifaApiId);
    if (Number.isFinite(numericId) && numericId > 0) {
        return String(Math.trunc(numericId));
    }

    return extractPlayerFifaId(faceUrl);
}

function isSofifaPlayerFaceUrl(url) {
    return /https?:\/\/cdn\.sofifa\.net\/players\//i.test(String(url ?? ''));
}

function extractSofifaFaceEdition(url) {
    const match = String(url ?? '').match(/\/(\d{2})_120\.png(?:$|\?)/i);
    return match?.[1] ?? null;
}

function buildPlayerFaceProxyUrl(fifaId, preferredEdition = null) {
    if (!fifaId) return null;

    const url = new URL(
        `${getApiBaseUrlSync()}/assets/player-face/${encodeURIComponent(String(fifaId))}`,
        window.location.href
    );
    if (preferredEdition) {
        url.searchParams.set('edition', preferredEdition);
    }

    return url.toString();
}

function buildStorageFaceUrl(fifaId) {
    if (!fifaId) return null;
    return `https://umnpkstcvgqnsipllmxd.supabase.co/storage/v1/object/public/players/${String(fifaId)}.webp`;
}

function withCacheBust(url, version = FACE_CACHE_BUST_VERSION) {
    if (!url) return url;

    try {
        const parsed = new URL(url, window.location.href);
        parsed.searchParams.set('v', version);
        return parsed.toString();
    } catch {
        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}v=${encodeURIComponent(version)}`;
    }
}

function getPlayerFaceFallbacks(url, playerFifaApiId) {
    const fifaId = resolvePlayerFifaId(url, playerFifaApiId);
    const fallbacks = [];
    const seen = new Set();
    const preferredSofifaEdition = extractSofifaFaceEdition(url);

    function addCandidate(candidateUrl) {
        if (!candidateUrl || seen.has(candidateUrl)) {
            return;
        }

        seen.add(candidateUrl);
        fallbacks.push(candidateUrl);
    }

    if (!isSofifaPlayerFaceUrl(url)) {
        addCandidate(url);
    }

    if (fifaId) {
        addCandidate(buildStorageFaceUrl(fifaId));
        addCandidate(buildPlayerFaceProxyUrl(fifaId, preferredSofifaEdition));
    }

    return fallbacks;
}

function extractTeamFifaId(url) {
    if (!url) return null;

    const storageMatch = url.match(/\/(\d+)(?:\.0)?\.webp(?:$|\?)/i);
    if (storageMatch) {
        return storageMatch[1];
    }

    const sofifaMatch = url.match(/\/teams\/(\d+)\/60\.png(?:$|\?)/i);
    return sofifaMatch?.[1] ?? null;
}

function buildClubLogoProxyUrl(teamFifaId) {
    if (!teamFifaId) return null;
    return new URL(
        `${getApiBaseUrlSync()}/assets/club-logo/${encodeURIComponent(String(teamFifaId))}`,
        window.location.href
    ).toString();
}

function getClubLogoFallbacks(url) {
    const fallbacks = [];
    const alternateUrl = getAlternateClubLogoUrl(url);
    const proxyUrl = buildClubLogoProxyUrl(extractTeamFifaId(url));

    if (alternateUrl && alternateUrl !== url) {
        fallbacks.push(alternateUrl);
    }

    if (proxyUrl && proxyUrl !== url && proxyUrl !== alternateUrl) {
        fallbacks.push(proxyUrl);
    }

    return fallbacks;
}

function createClubLogoPlaceholder(size, styleText = '') {
    const placeholder = document.createElement('div');
    placeholder.style.cssText = styleText || `
        width:${size}px; height:${size}px; border-radius:4px;
        background:#1e293b; border:1px solid #334155; flex-shrink:0;
    `;
    return placeholder;
}

export function createPlayerAvatar({ name, faceUrl, playerFifaApiId = null, position, size = 56, className = '' }) {
    const color = POS_COLOR[position] ?? DEFAULT_COLOR;
    const initials = getInitials(name);

    const wrapper = document.createElement('div');
    wrapper.style.cssText = `
        width:${size}px; height:${size}px;
        border-radius:50%; overflow:hidden; flex-shrink:0;
        background:${color}22; border:2px solid ${color}55;
        display:flex; align-items:center; justify-content:center;
        font-weight:900; font-size:${Math.round(size * 0.3)}px;
        color:${color}; position:relative;
    `;

    if (className) {
        wrapper.className = className;
    }

    const faceCandidateUrls = getPlayerFaceFallbacks(faceUrl, playerFifaApiId);

    if (faceCandidateUrls.length) {
        const img = document.createElement('img');
        img.src = withCacheBust(faceCandidateUrls[0]);
        img.alt = name ?? '';
        img.loading = 'lazy';
        img.draggable = false;
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;';

        img.onerror = () => {
            const nextIndex = Number(img.dataset.playerFaceFallbackIndex ?? '1');
            const nextFallbackUrl = faceCandidateUrls[nextIndex];

            if (nextFallbackUrl) {
                img.dataset.playerFaceFallbackIndex = String(nextIndex + 1);
                img.src = withCacheBust(nextFallbackUrl, `${FACE_CACHE_BUST_VERSION}-${nextIndex}`);
                return;
            }

            img.remove();
            wrapper.textContent = initials;
        };

        wrapper.appendChild(img);
    } else {
        wrapper.textContent = initials;
    }

    return wrapper;
}

export function createPlayerPortrait({
    name,
    faceUrl,
    playerFifaApiId = null,
    position,
    className = '',
    imageClassName = '',
}) {
    const color = POS_COLOR[position] ?? DEFAULT_COLOR;
    const initials = getInitials(name);

    const wrapper = document.createElement('div');
    wrapper.className = className;
    wrapper.style.cssText = `
        position:relative; overflow:hidden;
        display:flex; align-items:flex-end; justify-content:center;
        background:linear-gradient(180deg, ${color}22 0%, rgba(2,6,23,0) 68%);
        color:${color};
    `;

    const faceCandidateUrls = getPlayerFaceFallbacks(faceUrl, playerFifaApiId);

    if (faceCandidateUrls.length) {
        const img = document.createElement('img');
        img.src = withCacheBust(faceCandidateUrls[0]);
        img.alt = name ?? '';
        img.loading = 'lazy';
        img.draggable = false;
        img.className = imageClassName;
        img.style.cssText = `
            width:100%; height:100%;
            object-fit:contain; object-position:center bottom;
            position:absolute; inset:0;
        `;

        img.onerror = () => {
            const nextIndex = Number(img.dataset.playerFaceFallbackIndex ?? '1');
            const nextFallbackUrl = faceCandidateUrls[nextIndex];

            if (nextFallbackUrl) {
                img.dataset.playerFaceFallbackIndex = String(nextIndex + 1);
                img.src = withCacheBust(nextFallbackUrl, `${FACE_CACHE_BUST_VERSION}-${nextIndex}`);
                return;
            }

            img.remove();
            wrapper.textContent = initials;
            wrapper.style.cssText += `
                font-weight:900; font-size:1.8rem;
                letter-spacing:-0.04em;
            `;
        };

        wrapper.appendChild(img);
    } else {
        wrapper.textContent = initials;
        wrapper.style.cssText += `
            font-weight:900; font-size:1.8rem;
            letter-spacing:-0.04em;
        `;
    }

    return wrapper;
}

export function createClubLogo({ clubLogoUrl, size = 24, alt = '' }) {
    if (!clubLogoUrl) {
        return createClubLogoPlaceholder(size);
    }

    const img = document.createElement('img');
    img.src = clubLogoUrl;
    img.alt = alt;
    img.loading = 'lazy';
    img.draggable = false;
    img.style.cssText = `width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0;`;

    img.onerror = () => {
        const fallbackIndex = Number(img.dataset.clubLogoFallbackIndex ?? '0');
        const fallbackUrls = getClubLogoFallbacks(clubLogoUrl);
        const nextFallbackUrl = fallbackUrls[fallbackIndex];

        if (nextFallbackUrl && nextFallbackUrl !== img.src) {
            img.dataset.clubLogoFallbackIndex = String(fallbackIndex + 1);
            img.src = nextFallbackUrl;
            return;
        }

        img.replaceWith(
            createClubLogoPlaceholder(
                size,
                img.style.cssText.replace('object-fit:contain;', '')
                + 'background:#1e293b;border:1px solid #334155;border-radius:4px;',
            ),
        );
    };

    return img;
}
