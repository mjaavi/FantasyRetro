-- =====================================================================
-- SCRIPT DE DIAGNÓSTICO: Buscar datos "sucios" (huérfanos) en Kaggle
-- =====================================================================
-- Ejecuta esto en el SQL Editor de tu panel de Supabase.
-- Si alguna de estas consultas devuelve filas, significa que tienes datos sucios.

-- 1. Buscar Partidos cuyos Equipos (Local o Visitante) NO existen en la tabla Team
SELECT 
    m.id AS match_id, 
    m.home_team_api_id, 
    m.away_team_api_id
FROM "Match" m
LEFT JOIN "Team" th ON m.home_team_api_id = th.team_api_id
LEFT JOIN "Team" ta ON m.away_team_api_id = ta.team_api_id
WHERE th.team_api_id IS NULL OR ta.team_api_id IS NULL;

-- 2. Buscar Atributos de Jugadores asignados a un Jugador que NO existe
SELECT 
    pa.id AS attribute_id, 
    pa.player_api_id
FROM "Player_Attributes" pa
LEFT JOIN "Player" p ON pa.player_api_id = p.player_api_id
WHERE p.player_api_id IS NULL;

-- 3. Buscar Jugadores en las alineaciones (Partidos) que NO existen en la tabla Player
-- (Este chequeo une a todos los jugadores de un partido para buscar al menos un infractor)
SELECT 
    m.id AS match_id,
    missing_player_id
FROM "Match" m,
LATERAL (
    SELECT unnest(ARRAY[
        home_player_1::bigint, home_player_2::bigint, home_player_3::bigint, home_player_4::bigint, home_player_5::bigint, home_player_6::bigint, home_player_7::bigint, home_player_8::bigint, home_player_9::bigint, home_player_10::bigint, home_player_11::bigint,
        away_player_1::bigint, away_player_2::bigint, away_player_3::bigint, away_player_4::bigint, away_player_5::bigint, away_player_6::bigint, away_player_7::bigint, away_player_8::bigint, away_player_9::bigint, away_player_10::bigint, away_player_11::bigint
    ]) AS missing_player_id
) AS players
LEFT JOIN "Player" p ON players.missing_player_id = p.player_api_id
WHERE players.missing_player_id IS NOT NULL 
  AND p.player_api_id IS NULL
GROUP BY m.id, missing_player_id;
