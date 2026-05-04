-- =====================================================================
-- MIGRACIÓN OPTIMIZADA: Aplicar Foreign Keys a tablas Kaggle
-- =====================================================================

-- PASO 1: Corrección de tipos (Ejecutar TODO este bloque a la vez)
-- Hacerlo todo en un solo ALTER TABLE escanea la tabla 1 sola vez en lugar de 22 veces.
ALTER TABLE "Match"
    ALTER COLUMN home_player_1 TYPE bigint USING NULLIF(TRIM(home_player_1::text), '')::bigint,
    ALTER COLUMN home_player_2 TYPE bigint USING NULLIF(TRIM(home_player_2::text), '')::bigint,
    ALTER COLUMN home_player_3 TYPE bigint USING NULLIF(TRIM(home_player_3::text), '')::bigint,
    ALTER COLUMN home_player_4 TYPE bigint USING NULLIF(TRIM(home_player_4::text), '')::bigint,
    ALTER COLUMN home_player_5 TYPE bigint USING NULLIF(TRIM(home_player_5::text), '')::bigint,
    ALTER COLUMN home_player_6 TYPE bigint USING NULLIF(TRIM(home_player_6::text), '')::bigint,
    ALTER COLUMN home_player_7 TYPE bigint USING NULLIF(TRIM(home_player_7::text), '')::bigint,
    ALTER COLUMN home_player_8 TYPE bigint USING NULLIF(TRIM(home_player_8::text), '')::bigint,
    ALTER COLUMN home_player_9 TYPE bigint USING NULLIF(TRIM(home_player_9::text), '')::bigint,
    ALTER COLUMN home_player_10 TYPE bigint USING NULLIF(TRIM(home_player_10::text), '')::bigint,
    ALTER COLUMN home_player_11 TYPE bigint USING NULLIF(TRIM(home_player_11::text), '')::bigint,
    
    ALTER COLUMN away_player_1 TYPE bigint USING NULLIF(TRIM(away_player_1::text), '')::bigint,
    ALTER COLUMN away_player_2 TYPE bigint USING NULLIF(TRIM(away_player_2::text), '')::bigint,
    ALTER COLUMN away_player_3 TYPE bigint USING NULLIF(TRIM(away_player_3::text), '')::bigint,
    ALTER COLUMN away_player_4 TYPE bigint USING NULLIF(TRIM(away_player_4::text), '')::bigint,
    ALTER COLUMN away_player_5 TYPE bigint USING NULLIF(TRIM(away_player_5::text), '')::bigint,
    ALTER COLUMN away_player_6 TYPE bigint USING NULLIF(TRIM(away_player_6::text), '')::bigint,
    ALTER COLUMN away_player_7 TYPE bigint USING NULLIF(TRIM(away_player_7::text), '')::bigint,
    ALTER COLUMN away_player_8 TYPE bigint USING NULLIF(TRIM(away_player_8::text), '')::bigint,
    ALTER COLUMN away_player_9 TYPE bigint USING NULLIF(TRIM(away_player_9::text), '')::bigint,
    ALTER COLUMN away_player_10 TYPE bigint USING NULLIF(TRIM(away_player_10::text), '')::bigint,
    ALTER COLUMN away_player_11 TYPE bigint USING NULLIF(TRIM(away_player_11::text), '')::bigint;

-- PASO 2: Restricciones principales
ALTER TABLE "Player_Attributes" DROP CONSTRAINT IF EXISTS fk_player_attributes_player;
ALTER TABLE "Player_Attributes" ADD CONSTRAINT fk_player_attributes_player FOREIGN KEY (player_api_id) REFERENCES "Player" (player_api_id) ON DELETE CASCADE;

ALTER TABLE "Match" DROP CONSTRAINT IF EXISTS fk_match_home_team;
ALTER TABLE "Match" ADD CONSTRAINT fk_match_home_team FOREIGN KEY (home_team_api_id) REFERENCES "Team" (team_api_id) ON DELETE CASCADE;

ALTER TABLE "Match" DROP CONSTRAINT IF EXISTS fk_match_away_team;
ALTER TABLE "Match" ADD CONSTRAINT fk_match_away_team FOREIGN KEY (away_team_api_id) REFERENCES "Team" (team_api_id) ON DELETE CASCADE;

-- PASO 3: Restricciones de Alineaciones
-- Como añadir 22 FK de golpe puede dar timeout de nuevo en tablas muy grandes,
-- puedes seleccionar con el ratón solo las líneas de "home", darle a RUN,
-- y luego seleccionar las de "away" y darle a RUN.
ALTER TABLE "Match"
    DROP CONSTRAINT IF EXISTS fk_match_home_player_1, ADD CONSTRAINT fk_match_home_player_1 FOREIGN KEY (home_player_1) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_2, ADD CONSTRAINT fk_match_home_player_2 FOREIGN KEY (home_player_2) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_3, ADD CONSTRAINT fk_match_home_player_3 FOREIGN KEY (home_player_3) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_4, ADD CONSTRAINT fk_match_home_player_4 FOREIGN KEY (home_player_4) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_5, ADD CONSTRAINT fk_match_home_player_5 FOREIGN KEY (home_player_5) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_6, ADD CONSTRAINT fk_match_home_player_6 FOREIGN KEY (home_player_6) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_7, ADD CONSTRAINT fk_match_home_player_7 FOREIGN KEY (home_player_7) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_8, ADD CONSTRAINT fk_match_home_player_8 FOREIGN KEY (home_player_8) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_9, ADD CONSTRAINT fk_match_home_player_9 FOREIGN KEY (home_player_9) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_10, ADD CONSTRAINT fk_match_home_player_10 FOREIGN KEY (home_player_10) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_home_player_11, ADD CONSTRAINT fk_match_home_player_11 FOREIGN KEY (home_player_11) REFERENCES "Player" (player_api_id) ON DELETE SET NULL;

ALTER TABLE "Match"
    DROP CONSTRAINT IF EXISTS fk_match_away_player_1, ADD CONSTRAINT fk_match_away_player_1 FOREIGN KEY (away_player_1) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_2, ADD CONSTRAINT fk_match_away_player_2 FOREIGN KEY (away_player_2) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_3, ADD CONSTRAINT fk_match_away_player_3 FOREIGN KEY (away_player_3) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_4, ADD CONSTRAINT fk_match_away_player_4 FOREIGN KEY (away_player_4) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_5, ADD CONSTRAINT fk_match_away_player_5 FOREIGN KEY (away_player_5) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_6, ADD CONSTRAINT fk_match_away_player_6 FOREIGN KEY (away_player_6) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_7, ADD CONSTRAINT fk_match_away_player_7 FOREIGN KEY (away_player_7) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_8, ADD CONSTRAINT fk_match_away_player_8 FOREIGN KEY (away_player_8) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_9, ADD CONSTRAINT fk_match_away_player_9 FOREIGN KEY (away_player_9) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_10, ADD CONSTRAINT fk_match_away_player_10 FOREIGN KEY (away_player_10) REFERENCES "Player" (player_api_id) ON DELETE SET NULL,
    DROP CONSTRAINT IF EXISTS fk_match_away_player_11, ADD CONSTRAINT fk_match_away_player_11 FOREIGN KEY (away_player_11) REFERENCES "Player" (player_api_id) ON DELETE SET NULL;
