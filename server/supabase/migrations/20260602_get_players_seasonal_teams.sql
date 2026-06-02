-- ─────────────────────────────────────────────────────────────────────────────
-- get_players_seasonal_teams
--
-- Obtiene el club de temporada (nombre, logo y ID) para un lote de jugadores.
-- Evita tener que cargar y procesar todos los partidos de la temporada en el servidor.
--
-- Parámetros:
--   p_league_id  : ID de la liga de Kaggle
--   p_season     : temporada (ej. '2015/2016')
--   p_player_ids : array de IDs de jugadores
--
-- Retorna: Tabla con player_id, team_api_id, team_long_name, team_fifa_api_id
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_players_seasonal_teams(
    p_league_id INTEGER,
    p_season TEXT,
    p_player_ids INTEGER[]
)
RETURNS TABLE(
    player_id INTEGER,
    team_api_id INTEGER,
    team_long_name TEXT,
    team_fifa_api_id INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH player_matches AS (
    SELECT m.date, m.home_team_api_id AS team_id, home_player_1 AS p_id FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_1 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_2 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_2 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_3 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_3 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_4 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_4 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_5 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_5 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_6 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_6 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_7 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_7 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_8 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_8 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_9 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_9 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_10 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_10 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.home_team_api_id, home_player_11 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND home_player_11 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_1 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_1 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_2 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_2 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_3 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_3 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_4 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_4 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_5 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_5 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_6 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_6 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_7 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_7 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_8 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_8 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_9 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_9 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_10 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_10 = ANY(p_player_ids)
    UNION ALL SELECT m.date, m.away_team_api_id, away_player_11 FROM "Match" m WHERE m.league_id = p_league_id AND m.season = p_season AND away_player_11 = ANY(p_player_ids)
  ),
  latest_player_match AS (
    SELECT pm.p_id, pm.team_id,
           ROW_NUMBER() OVER(PARTITION BY pm.p_id ORDER BY pm.date DESC) as rn
    FROM player_matches pm
    WHERE pm.p_id IS NOT NULL AND pm.team_id IS NOT NULL
  )
  SELECT
    lpm.p_id::integer AS player_id,
    lpm.team_id::integer AS team_api_id,
    t.team_long_name::text AS team_long_name,
    t.team_fifa_api_id::integer AS team_fifa_api_id
  FROM latest_player_match lpm
  JOIN "Team" t ON lpm.team_id = t.team_api_id
  WHERE lpm.rn = 1;
END;
$$;

-- Permite que la service-role (backend) ejecute esta función
GRANT EXECUTE ON FUNCTION public.get_players_seasonal_teams(INTEGER, TEXT, INTEGER[]) TO service_role;
