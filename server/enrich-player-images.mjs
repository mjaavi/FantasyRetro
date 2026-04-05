#!/usr/bin/env node
// ─────────────────────────────────────────────────────────────────────────────
// scripts/enrich-player-images.mjs
//
// Vincula el CSV de SoFIFA con la tabla "Player" de Kaggle usando nombre
// normalizado y, cuando está disponible, la fecha de nacimiento. Actualiza
// player_face_url y club_logo_url en Supabase.
//
// Uso:
//   node scripts/enrich-player-images.mjs
//
// Variables de entorno necesarias (en server/.env):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   SUPABASE_STORAGE_URL   — base URL pública del Storage (ver abajo)
//   CSV_PATH               — ruta al fifa_players.csv (default: ./fifa_players.csv)
//
// SUPABASE_STORAGE_URL es la URL base de tus buckets públicos, con esta forma:
//   https://<proyecto>.supabase.co/storage/v1/object/public
// ─────────────────────────────────────────────────────────────────────────────

import fs            from 'node:fs';
import path          from 'node:path';
import { createReadStream } from 'node:fs';
import { createClient }     from '@supabase/supabase-js';
import csvParser            from 'csv-parser';
import dotenv               from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

// ── Config ────────────────────────────────────────────────────────────────────

const SUPABASE_URL         = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CSV_PATH             = process.env.CSV_PATH
    ?? path.resolve(process.cwd(), 'data', 'players_15.csv');

const BATCH_SIZE               = 100;   // filas por UPDATE en Supabase
const FUZZY_RATIO              = 0.80;  // similitud mínima sin fecha de nacimiento
const FUZZY_RATIO_WITH_BIRTH   = 0.72;  // más permisivo si coincide la fecha
const FUZZY_MARGIN             = 0.08;  // diferencia mínima frente al 2º mejor sin fecha
const FUZZY_MARGIN_WITH_BIRTH  = 0.03;  // diferencia mínima frente al 2º mejor con fecha

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌  Falta SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en .env');
    process.exit(1);
}

function resolveStorageBaseUrl() {
    const configured = process.env.SUPABASE_STORAGE_URL?.trim();
    const publicBase = `${SUPABASE_URL}/storage/v1/object/public`;

    if (!configured) return publicBase;

    const cleaned = configured.replace(/\/+$/, '');

    if (cleaned.includes('/storage/v1/object/public')) {
        return cleaned;
    }

    if (cleaned.includes('.storage.supabase.co/storage/v1/s3')) {
        console.warn('⚠️  SUPABASE_STORAGE_URL apunta al endpoint S3. Se usará la URL pública de objetos.');
        console.warn(`   → ${publicBase}`);
        return publicBase;
    }

    return cleaned;
}

const STORAGE_BASE_URL = resolveStorageBaseUrl();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

// ── Normalización de nombres ───────────────────────────────────────────────────
// El nombre es la única clave de join entre los dos datasets.
// Normalizamos para absorber variaciones de acentos, puntuación y case.

function normalizeName(raw) {
    return (raw ?? '')
        .normalize('NFD')                     // descomponer acentos
        .replace(/[\u0300-\u036f]/g, '')      // eliminar diacríticos
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, '')           // solo alfanumérico y espacio
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

// Similitud de Dice entre dos strings (rápida, sin dependencias)
function diceSimilarity(a, b) {
    if (a === b) return 1;
    if (a.length < 2 || b.length < 2) return 0;
    const aBigrams = new Map();
    for (let i = 0; i < a.length - 1; i++) {
        const bg = a.slice(i, i + 2);
        aBigrams.set(bg, (aBigrams.get(bg) ?? 0) + 1);
    }
    let intersection = 0;
    for (let i = 0; i < b.length - 1; i++) {
        const bg = b.slice(i, i + 2);
        if ((aBigrams.get(bg) ?? 0) > 0) {
            intersection++;
            aBigrams.set(bg, aBigrams.get(bg) - 1);
        }
    }
    return (2 * intersection) / (a.length + b.length - 2);
}

// ── Paso 1: leer el CSV ───────────────────────────────────────────────────────

async function readCsv(filePath) {
    console.log(`📂  Leyendo CSV: ${filePath}`);
    return new Promise((resolve, reject) => {
        const rows = [];

        createReadStream(filePath)
            .pipe(csvParser())
            .on('data', row => rows.push(row))
            .on('end', () => {
                console.log(`   → ${rows.length} filas leídas`);
                resolve(rows);
            })
            .on('error', reject);
    });
}

// ── Paso 2: cargar jugadores de Supabase ──────────────────────────────────────

async function loadSupabasePlayers() {
    console.log('🌐  Descargando jugadores de Supabase...');
    const all  = [];
    const SIZE = 1000;
    let   from = 0;
    let   selectFields = 'player_api_id, player_name, birthday';

    const probe = await supabase
        .from('Player')
        .select(selectFields)
        .range(0, 0);

    if (probe.error) {
        console.warn(`⚠️  No se pudo leer birthday de Player (${probe.error.message}). Se seguirá solo con nombre.`);
        selectFields = 'player_api_id, player_name';
    }

    while (true) {
        const { data, error } = await supabase
            .from('Player')
            .select(selectFields)
            .range(from, from + SIZE - 1);

        if (error) { console.error('Error:', error.message); break; }
        if (!data?.length) break;

        all.push(...data);
        if (data.length < SIZE) break;
        from += SIZE;
    }

    console.log(`   → ${all.length} jugadores en Supabase`);
    return all;
}

// ── Paso 3: construir URL pública de Storage ──────────────────────────────────
// Los archivos se subieron como {sofifa_id}.webp en los buckets "players" y "clubs".
// La URL pública de Supabase Storage tiene la forma:
//   {STORAGE_BASE_URL}/{bucket}/{filename}

function buildPlayerUrl(sofifaId) {
    return sofifaId ? `${STORAGE_BASE_URL}/players/${sofifaId}.webp` : null;
}

function buildClubUrl(clubTeamId) {
    return clubTeamId ? `${STORAGE_BASE_URL}/clubs/${clubTeamId}.webp` : null;
}

function firstNonEmpty(...values) {
    for (const value of values) {
        if (value === null || value === undefined) continue;
        const text = String(value).trim();
        if (text) return text;
    }
    return '';
}

function getCandidateNorms(row) {
    const norms = new Set();
    const rawNames = [
        firstNonEmpty(row['long_name'], row['player_name']),
        firstNonEmpty(row['short_name']),
    ].filter(Boolean);

    for (const rawName of rawNames) {
        const norm = normalizeName(rawName);
        if (!norm) continue;

        norms.add(norm);

        const tokens = norm.split(' ').filter(Boolean);
        if (tokens.length >= 3) {
            // Alias habitual: nombre + primer apellido (ej: "daniel alves").
            norms.add(`${tokens[0]} ${tokens[1]}`);
            // Variante alternativa: nombre + último apellido.
            norms.add(`${tokens[0]} ${tokens[tokens.length - 1]}`);
        }
    }

    return Array.from(norms);
}

function pushMapArray(map, key, value) {
    if (!key) return;
    const arr = map.get(key);
    if (arr) arr.push(value);
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

function buildPlayerMatchIndexes(supabasePlayers) {
    const byName       = new Map();
    const byNameAndDob = new Map();
    const byDob        = new Map();
    const all          = [];

    for (const player of supabasePlayers) {
        const normName = normalizeName(player.player_name);
        if (!normName) continue;

        const birthday = normalizeDate(player.birthday);
        const record = {
            player_api_id: player.player_api_id,
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

    return { byName, byNameAndDob, byDob, all };
}

function findExactMatch(candidateNorms, birthday, indexes) {
    if (birthday) {
        for (const norm of candidateNorms) {
            const exact = getUniqueCandidate(indexes.byNameAndDob.get(`${norm}|${birthday}`));
            if (exact) return { player_api_id: exact.player_api_id, strategy: 'exact_name_dob' };
        }
    }

    for (const norm of candidateNorms) {
        const exact = getUniqueCandidate(indexes.byName.get(norm));
        if (exact) return { player_api_id: exact.player_api_id, strategy: 'exact_name' };
    }

    return null;
}

function findFuzzyMatch(candidateNorms, birthday, indexes) {
    const birthdayPool = birthday ? uniqueCandidates(indexes.byDob.get(birthday)) : [];
    const pool         = birthdayPool.length ? birthdayPool : indexes.all;

    if (!pool.length) return null;

    let bestCandidate = null;
    let bestScore     = 0;
    let secondScore   = 0;
    let tieOnBest     = false;

    for (const norm of candidateNorms) {
        for (const candidate of pool) {
            const score = diceSimilarity(norm, candidate.normName);

            if (score > bestScore) {
                secondScore   = bestScore;
                bestScore     = score;
                bestCandidate = candidate;
                tieOnBest     = false;
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

    const requiredScore  = birthdayPool.length ? FUZZY_RATIO_WITH_BIRTH : FUZZY_RATIO;
    const requiredMargin = birthdayPool.length ? FUZZY_MARGIN_WITH_BIRTH : FUZZY_MARGIN;

    if (!bestCandidate || bestScore < requiredScore || tieOnBest) {
        return null;
    }

    if (pool.length > 1 && (bestScore - secondScore) < requiredMargin) {
        return null;
    }

    return {
        player_api_id: bestCandidate.player_api_id,
        strategy: birthdayPool.length ? 'fuzzy_name_dob' : 'fuzzy_name',
    };
}

// ── Paso 4: hacer el match por nombre ────────────────────────────────────────

function matchPlayers(csvRows, supabasePlayers) {
    console.log('🔗  Cruzando datasets por nombre normalizado y fecha de nacimiento...');

    const indexes       = buildPlayerMatchIndexes(supabasePlayers);
    const updatesByPlayerId = new Map();
    const claimedPlayerIds  = new Set();

    const stats = {
        exact_name_dob: 0,
        exact_name: 0,
        fuzzy_name_dob: 0,
        fuzzy_name: 0,
        duplicated_target: 0,
        no_match: 0,
    };

    for (const row of csvRows) {
        const candidateNorms = getCandidateNorms(row);
        const birthday       = normalizeDate(firstNonEmpty(row['dob'], row['birthday'], row['date_of_birth']));
        const sofifaId       = firstNonEmpty(row['sofifa_id'], row['player_id']);
        const clubId         = firstNonEmpty(row['club_team_id'], row['team_id']);

        if (!candidateNorms.length || !sofifaId) continue;

        const faceUrl = buildPlayerUrl(sofifaId);
        const clubUrl = buildClubUrl(clubId);

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
            club_logo_url: clubUrl,
        });
        stats[match.strategy]++;
    }

    console.log(
        `   → Exact nombre+fecha: ${stats.exact_name_dob} | Exact nombre: ${stats.exact_name} | ` +
        `Fuzzy nombre+fecha (≥${FUZZY_RATIO_WITH_BIRTH}): ${stats.fuzzy_name_dob} | ` +
        `Fuzzy nombre (≥${FUZZY_RATIO}): ${stats.fuzzy_name} | ` +
        `Colisiones: ${stats.duplicated_target} | Sin match: ${stats.no_match}`
    );
    console.log(`   → Total a actualizar: ${updatesByPlayerId.size}`);
    return Array.from(updatesByPlayerId.values());
}

// ── Paso 5: actualizar Supabase en batches ────────────────────────────────────

async function bulkUpdate(updates) {
    console.log(`\n💾  Actualizando Supabase (batches de ${BATCH_SIZE})...`);

    let done    = 0;
    let errors  = 0;
    const total = updates.length;

    for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = updates.slice(i, i + BATCH_SIZE);

        // upsert sobre player_api_id — no inserta filas nuevas (ignoreSecurity=false)
        // usamos update individual por limitación de upsert con columnas parciales
        await Promise.all(batch.map(async row => {
            const { error } = await supabase
                .from('Player')
                .update({
                    player_face_url: row.player_face_url,
                    club_logo_url:   row.club_logo_url,
                })
                .eq('player_api_id', row.player_api_id);

            if (error) { errors++; }
            else        { done++;  }
        }));

        const pct = Math.round(((i + batch.length) / total) * 100);
        process.stdout.write(`\r   ${pct}% (${i + batch.length}/${total})  `);
    }

    console.log(`\n\n✅  Completado: ${done} actualizados, ${errors} errores`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    console.log('🚀  Iniciando enriquecimiento de imágenes de jugadores\n');

    if (!fs.existsSync(CSV_PATH)) {
        console.error(`❌  CSV no encontrado: ${CSV_PATH}`);
        console.error('    Ajusta la variable CSV_PATH en .env o pasa la ruta como argumento.');
        process.exit(1);
    }

    const csvRows         = await readCsv(CSV_PATH);
    const supabasePlayers = await loadSupabasePlayers();
    const updates         = matchPlayers(csvRows, supabasePlayers);

    if (!updates.length) {
        console.log('⚠️   No hay actualizaciones que hacer. Revisa el CSV y los nombres.');
        process.exit(0);
    }

    await bulkUpdate(updates);

    console.log('\n📋  Próximo paso:');
    console.log('    Los repositorios del servidor ya están actualizados para leer');
    console.log('    player_face_url y club_logo_url en los SELECT de Player.');
}

main().catch(err => { console.error(err); process.exit(1); });
