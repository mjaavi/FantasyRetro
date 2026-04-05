#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { createReadStream } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import csvParser from 'csv-parser';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH = process.env.CSV_PATH ?? path.resolve(process.cwd(), 'data', 'players_15.csv');
const BATCH_SIZE = Number(process.env.FACE_URL_BATCH_SIZE ?? 100);
const DRY_RUN = String(process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';
const SOFIFA_FACE_EDITIONS = String(process.env.SOFIFA_FACE_EDITIONS ?? '16,15,14,13,12,11,10,09,08')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
const FIFA_PROBE_CONCURRENCY = Number(process.env.FIFA_FACE_PROBE_CONCURRENCY ?? 12);

const FUZZY_RATIO = 0.8;
const FUZZY_RATIO_WITH_BIRTH = 0.72;
const FUZZY_MARGIN = 0.08;
const FUZZY_MARGIN_WITH_BIRTH = 0.03;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

function normalizeName(raw) {
    return String(raw ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeDate(raw) {
    const text = String(raw ?? '').trim();
    if (!text) return '';

    const isoLike = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoLike) return `${isoLike[1]}-${isoLike[2]}-${isoLike[3]}`;

    const slashLike = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashLike) return `${slashLike[3]}-${slashLike[2]}-${slashLike[1]}`;

    const parsed = new Date(text);
    if (Number.isNaN(parsed.getTime())) return '';

    return [
        parsed.getUTCFullYear(),
        String(parsed.getUTCMonth() + 1).padStart(2, '0'),
        String(parsed.getUTCDate()).padStart(2, '0'),
    ].join('-');
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return '';
}

function diceSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;

    const aBigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bigram = a.slice(i, i + 2);
        aBigrams.set(bigram, (aBigrams.get(bigram) ?? 0) + 1);
    }

    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bigram = b.slice(i, i + 2);
        if ((aBigrams.get(bigram) ?? 0) > 0) {
            intersection++;
            aBigrams.set(bigram, aBigrams.get(bigram) - 1);
        }
    }

    return (2 * intersection) / (a.length + b.length - 2);
}

function pushMapArray(map, key, value) {
    if (!key) return;
    const current = map.get(key);
    if (current) current.push(value);
    else map.set(key, [value]);
}

function uniqueCandidates(candidates = []) {
    const seen = new Set();
    const unique = [];

    for (const candidate of candidates) {
        if (!candidate || seen.has(candidate.player_api_id)) continue;
        seen.add(candidate.player_api_id);
        unique.push(candidate);
    }

    return unique;
}

function getUniqueCandidate(candidates = []) {
    const unique = uniqueCandidates(candidates);
    return unique.length === 1 ? unique[0] : null;
}

function getCandidateNorms(row) {
    const norms = new Set();
    const rawNames = [
        firstNonEmpty(row.long_name, row.player_name),
        firstNonEmpty(row.short_name),
    ].filter(Boolean);

    for (const rawName of rawNames) {
        const normalized = normalizeName(rawName);
        if (!normalized) continue;

        norms.add(normalized);

        const tokens = normalized.split(' ').filter(Boolean);
        if (tokens.length >= 2) {
            for (let index = 1; index < tokens.length; index++) {
                norms.add(`${tokens[0]} ${tokens[index]}`);
            }
        }

        if (tokens.length >= 3) {
            for (let index = 1; index < tokens.length - 1; index++) {
                norms.add(`${tokens[index]} ${tokens[index + 1]}`);
            }
        }
    }

    return Array.from(norms);
}

async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];

        createReadStream(filePath)
            .pipe(csvParser())
            .on('data', row => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

async function loadSupabasePlayersWithoutFace() {
    const all = [];
    const pageSize = 1000;
    let from = 0;
    let selectFields = 'player_api_id, player_name, birthday, player_fifa_api_id, player_face_url';

    const probe = await supabase.from('Player').select(selectFields).range(0, 0);
    if (probe.error) {
        console.warn(`No se pudo leer birthday en Player (${probe.error.message}). Reintentando sin birthday.`);
        selectFields = 'player_api_id, player_name, player_fifa_api_id, player_face_url';
    }

    const fallbackProbe = await supabase.from('Player').select(selectFields).range(0, 0);
    if (fallbackProbe.error) {
        console.warn(`No se pudo leer player_fifa_api_id en Player (${fallbackProbe.error.message}). Se seguira solo con nombre.`);
        selectFields = 'player_api_id, player_name, player_face_url';
    }

    while (true) {
        const { data, error } = await supabase
            .from('Player')
            .select(selectFields)
            .or('player_face_url.is.null,player_face_url.eq.')
            .range(from, from + pageSize - 1);

        if (error) {
            throw error;
        }

        if (!data?.length) {
            break;
        }

        all.push(...data);
        if (data.length < pageSize) {
            break;
        }

        from += pageSize;
    }

    return all;
}

function buildIndexes(players) {
    const byName = new Map();
    const byNameAndDob = new Map();
    const byDob = new Map();
    const all = [];

    for (const player of players) {
        const normName = normalizeName(player.player_name);
        if (!normName) continue;

        const birthday = normalizeDate(player.birthday);
        const record = {
            player_api_id: Number(player.player_api_id),
            normName,
            birthday,
        };

        pushMapArray(byName, normName, record);
        if (birthday) {
            pushMapArray(byNameAndDob, `${normName}|${birthday}`, record);
            pushMapArray(byDob, birthday, record);
        }
        all.push(record);
    }

    return { all, byDob, byName, byNameAndDob };
}

function findExactMatch(candidateNorms, birthday, indexes) {
    if (birthday) {
        for (const norm of candidateNorms) {
            const exact = getUniqueCandidate(indexes.byNameAndDob.get(`${norm}|${birthday}`));
            if (exact) return { ...exact, strategy: 'exact_name_dob' };
        }
    }

    for (const norm of candidateNorms) {
        const exact = getUniqueCandidate(indexes.byName.get(norm));
        if (exact) return { ...exact, strategy: 'exact_name' };
    }

    return null;
}

function findFuzzyMatch(candidateNorms, birthday, indexes) {
    const birthdayPool = birthday ? uniqueCandidates(indexes.byDob.get(birthday)) : [];
    const pool = birthdayPool.length ? birthdayPool : indexes.all;
    if (!pool.length) return null;

    let bestCandidate = null;
    let bestScore = 0;
    let secondScore = 0;
    let tieOnBest = false;

    for (const norm of candidateNorms) {
        for (const candidate of pool) {
            const score = diceSimilarity(norm, candidate.normName);

            if (score > bestScore) {
                secondScore = bestScore;
                bestScore = score;
                bestCandidate = candidate;
                tieOnBest = false;
                continue;
            }

            if (!bestCandidate || candidate.player_api_id === bestCandidate.player_api_id) {
                continue;
            }

            if (score === bestScore) {
                tieOnBest = true;
            } else if (score > secondScore) {
                secondScore = score;
            }
        }
    }

    const requiredScore = birthdayPool.length ? FUZZY_RATIO_WITH_BIRTH : FUZZY_RATIO;
    const requiredMargin = birthdayPool.length ? FUZZY_MARGIN_WITH_BIRTH : FUZZY_MARGIN;

    if (!bestCandidate || bestScore < requiredScore || tieOnBest) {
        return null;
    }

    if (pool.length > 1 && (bestScore - secondScore) < requiredMargin) {
        return null;
    }

    return {
        ...bestCandidate,
        strategy: birthdayPool.length ? 'fuzzy_name_dob' : 'fuzzy_name',
    };
}

function buildUpdates(csvRows, playersWithoutFace) {
    const indexes = buildIndexes(playersWithoutFace);
    const updatesByPlayerId = new Map();
    const claimedPlayerIds = new Set();

    const stats = {
        exact_name: 0,
        exact_name_dob: 0,
        fuzzy_name: 0,
        fuzzy_name_dob: 0,
        duplicated_target: 0,
        no_face_url_in_csv: 0,
        no_match: 0,
    };

    for (const row of csvRows) {
        const candidateNorms = getCandidateNorms(row);
        const birthday = normalizeDate(firstNonEmpty(row.dob, row.birthday, row.date_of_birth));
        const faceUrl = firstNonEmpty(row.player_face_url, row.face_url);

        if (!candidateNorms.length) {
            continue;
        }

        if (!faceUrl) {
            stats.no_face_url_in_csv++;
            continue;
        }

        const match = findExactMatch(candidateNorms, birthday, indexes)
            ?? findFuzzyMatch(candidateNorms, birthday, indexes);

        if (!match) {
            stats.no_match++;
            continue;
        }

        if (claimedPlayerIds.has(match.player_api_id)) {
            stats.duplicated_target++;
            continue;
        }

        claimedPlayerIds.add(match.player_api_id);
        updatesByPlayerId.set(match.player_api_id, {
            player_api_id: match.player_api_id,
            player_face_url: faceUrl,
        });
        stats[match.strategy]++;
    }

    return { stats, updates: Array.from(updatesByPlayerId.values()) };
}

function buildSofifaFaceUrl(playerFifaApiId, edition) {
    const numericId = Number(playerFifaApiId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
        return null;
    }

    const paddedId = String(Math.trunc(numericId)).padStart(6, '0');
    return `https://cdn.sofifa.net/players/${paddedId.slice(0, 3)}/${paddedId.slice(3)}/${edition}_120.png`;
}

async function probeSofifaFaceUrl(playerFifaApiId, cache) {
    const numericId = Number(playerFifaApiId);
    if (!Number.isFinite(numericId) || numericId <= 0) {
        return null;
    }

    const cacheKey = String(Math.trunc(numericId));
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey);
    }

    let resolvedUrl = null;

    for (const edition of SOFIFA_FACE_EDITIONS) {
        const candidateUrl = buildSofifaFaceUrl(numericId, edition);
        if (!candidateUrl) continue;

        try {
            const response = await fetch(candidateUrl, { method: 'HEAD', redirect: 'follow' });
            if (response.ok) {
                resolvedUrl = candidateUrl;
                break;
            }
        } catch {
            // Si la CDN falla en una edición concreta, seguimos probando el resto.
        }
    }

    cache.set(cacheKey, resolvedUrl);
    return resolvedUrl;
}

async function mapWithConcurrency(items, concurrency, mapper) {
    const results = new Array(items.length);
    let currentIndex = 0;

    async function worker() {
        while (true) {
            const itemIndex = currentIndex++;
            if (itemIndex >= items.length) {
                return;
            }

            results[itemIndex] = await mapper(items[itemIndex], itemIndex);
        }
    }

    const workerCount = Math.max(1, Math.min(concurrency, items.length));
    await Promise.all(Array.from({ length: workerCount }, () => worker()));
    return results;
}

async function buildFifaIdFallbackUpdates(playersWithoutFace, alreadyMatchedPlayerIds) {
    const unresolvedPlayers = playersWithoutFace.filter(player => !alreadyMatchedPlayerIds.has(Number(player.player_api_id)));
    const playersWithFifaId = unresolvedPlayers.filter(player => Number(player.player_fifa_api_id) > 0);
    const urlCache = new Map();

    const stats = {
        eligible_with_fifa_id: playersWithFifaId.length,
        no_fifa_id: unresolvedPlayers.length - playersWithFifaId.length,
        found_remote_asset: 0,
        no_remote_asset: 0,
    };

    if (!playersWithFifaId.length) {
        return { stats, updates: [] };
    }

    let processed = 0;
    const updates = await mapWithConcurrency(playersWithFifaId, FIFA_PROBE_CONCURRENCY, async player => {
        try {
            const faceUrl = await probeSofifaFaceUrl(player.player_fifa_api_id, urlCache);
            if (faceUrl) {
                stats.found_remote_asset++;
                return {
                    player_api_id: Number(player.player_api_id),
                    player_face_url: faceUrl,
                };
            }

            stats.no_remote_asset++;
            return null;
        } finally {
            processed++;
            if (processed % 50 === 0 || processed === playersWithFifaId.length) {
                process.stdout.write(`\rProbe FIFA IDs: ${processed}/${playersWithFifaId.length}`);
            }
        }
    });

    process.stdout.write('\n');
    return {
        stats,
        updates: updates.filter(Boolean),
    };
}

async function bulkUpdate(updates) {
    let done = 0;
    let errors = 0;

    for (let index = 0; index < updates.length; index += BATCH_SIZE) {
        const batch = updates.slice(index, index + BATCH_SIZE);

        await Promise.all(batch.map(async row => {
            const { error } = await supabase
                .from('Player')
                .update({ player_face_url: row.player_face_url })
                .eq('player_api_id', row.player_api_id);

            if (error) {
                errors++;
            } else {
                done++;
            }
        }));

        const processed = index + batch.length;
        const pct = Math.round((processed / updates.length) * 100);
        process.stdout.write(`\r${pct}% (${processed}/${updates.length})`);
    }

    process.stdout.write('\n');
    return { done, errors };
}

async function main() {
    if (!fs.existsSync(CSV_PATH)) {
        console.error(`CSV no encontrado: ${CSV_PATH}`);
        process.exit(1);
    }

    console.log('Leyendo CSV de SoFIFA...');
    const csvRows = await readCsv(CSV_PATH);
    console.log(`Filas CSV: ${csvRows.length}`);

    console.log('Buscando jugadores sin cara en Supabase...');
    const playersWithoutFace = await loadSupabasePlayersWithoutFace();
    console.log(`Jugadores sin player_face_url: ${playersWithoutFace.length}`);

    const { updates: csvUpdates, stats } = buildUpdates(csvRows, playersWithoutFace);
    const matchedPlayerIds = new Set(csvUpdates.map(update => update.player_api_id));

    console.log(
        `Match exacto nombre+fecha: ${stats.exact_name_dob} | ` +
        `exacto nombre: ${stats.exact_name} | ` +
        `fuzzy nombre+fecha: ${stats.fuzzy_name_dob} | ` +
        `fuzzy nombre: ${stats.fuzzy_name} | ` +
        `colisiones: ${stats.duplicated_target} | ` +
        `sin face en CSV: ${stats.no_face_url_in_csv} | ` +
        `sin match: ${stats.no_match}`,
    );
    console.log(`Actualizaciones preparadas por CSV: ${csvUpdates.length}`);

    console.log(`Buscando fallback por player_fifa_api_id en ediciones: ${SOFIFA_FACE_EDITIONS.join(', ')}`);
    const { updates: fifaUpdates, stats: fifaStats } = await buildFifaIdFallbackUpdates(playersWithoutFace, matchedPlayerIds);
    console.log(
        `Fallback FIFA ID elegibles: ${fifaStats.eligible_with_fifa_id} | ` +
        `sin fifa id: ${fifaStats.no_fifa_id} | ` +
        `asset encontrado: ${fifaStats.found_remote_asset} | ` +
        `sin asset remoto: ${fifaStats.no_remote_asset}`,
    );

    const updates = [...csvUpdates, ...fifaUpdates];
    console.log(`Actualizaciones preparadas totales: ${updates.length}`);

    if (!updates.length) {
        console.log('No hay actualizaciones que aplicar.');
        return;
    }

    if (DRY_RUN) {
        console.log('DRY_RUN activo. No se ha escrito nada en la BD.');
        return;
    }

    console.log('Actualizando player_face_url en Supabase...');
    const result = await bulkUpdate(updates);
    console.log(`Completado. Actualizados: ${result.done}. Errores: ${result.errors}.`);
}

main().catch(error => {
    console.error(error);
    process.exit(1);
});
