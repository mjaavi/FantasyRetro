#!/usr/bin/env node

import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BATCH_SIZE = Number(process.env.FACE_URL_BATCH_SIZE ?? 100);
const DRY_RUN = String(process.env.DRY_RUN ?? 'false').toLowerCase() === 'true';
const SOFIFA_FACE_EDITIONS = String(process.env.SOFIFA_FACE_EDITIONS ?? '16,15,14,13,12,11,10,09,08')
    .split(',')
    .map(value => value.trim())
    .filter(Boolean);
const FIFA_PROBE_CONCURRENCY = Number(process.env.FIFA_FACE_PROBE_CONCURRENCY ?? 12);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

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
            // Si una edicion falla, seguimos probando el resto.
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

function isStorageFaceUrl(url) {
    return String(url ?? '').includes('/storage/v1/object/public/players/');
}

async function loadPlayersToRepair() {
    const all = [];
    const pageSize = 1000;
    let from = 0;

    while (true) {
        const { data, error } = await supabase
            .from('Player')
            .select('player_api_id, player_name, player_fifa_api_id, player_face_url')
            .not('player_fifa_api_id', 'is', null)
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

    return all.filter(row => isStorageFaceUrl(row.player_face_url));
}

async function buildRepairUpdates(players) {
    const urlCache = new Map();
    const stats = {
        storage_urls_detected: players.length,
        repaired: 0,
        no_remote_asset: 0,
    };

    let processed = 0;
    const updates = await mapWithConcurrency(players, FIFA_PROBE_CONCURRENCY, async player => {
        try {
            const faceUrl = await probeSofifaFaceUrl(player.player_fifa_api_id, urlCache);
            if (!faceUrl) {
                stats.no_remote_asset++;
                return null;
            }

            stats.repaired++;
            return {
                player_api_id: Number(player.player_api_id),
                player_face_url: faceUrl,
            };
        } finally {
            processed++;
            if (processed % 50 === 0 || processed === players.length) {
                process.stdout.write(`\rReparando URLs de bucket: ${processed}/${players.length}`);
            }
        }
    });

    process.stdout.write('\n');
    return { stats, updates: updates.filter(Boolean) };
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
    console.log('Buscando player_face_url que siguen apuntando al bucket players...');
    const players = await loadPlayersToRepair();
    console.log(`URLs de bucket detectadas: ${players.length}`);

    if (!players.length) {
        console.log('No hay URLs de bucket que reparar.');
        return;
    }

    console.log(`Probando URLs reales de SoFIFA con ediciones: ${SOFIFA_FACE_EDITIONS.join(', ')}`);
    const { stats, updates } = await buildRepairUpdates(players);
    console.log(
        `Detectadas: ${stats.storage_urls_detected} | ` +
        `reparables: ${stats.repaired} | ` +
        `sin asset remoto: ${stats.no_remote_asset}`,
    );
    console.log(`Actualizaciones preparadas: ${updates.length}`);

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
