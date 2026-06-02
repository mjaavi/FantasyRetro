-- ─────────────────────────────────────────────────────────────────────────────
-- get_players_avg_y
--
-- Obtiene la coordenada Y media para un lote de IDs de jugadores en una sola consulta.
-- Esto optimiza la carga del mercado y la plantilla al evitar peticiones N+1.
--
-- Parámetros:
--   p_player_ids : array de player_api_id de los jugadores a consultar
--
-- Retorna: Tabla con player_api_id y avg_y (coordenada Y media)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_players_avg_y(p_player_ids INTEGER[])
RETURNS TABLE(player_api_id INTEGER, avg_y NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT temp.player_id, AVG(temp.y)::numeric
  FROM (
    SELECT home_player_1 AS player_id, "home_player_Y1" AS y FROM "Match" WHERE home_player_1 = ANY(p_player_ids)
    UNION ALL SELECT home_player_2, "home_player_Y2" FROM "Match" WHERE home_player_2 = ANY(p_player_ids)
    UNION ALL SELECT home_player_3, "home_player_Y3" FROM "Match" WHERE home_player_3 = ANY(p_player_ids)
    UNION ALL SELECT home_player_4, "home_player_Y4" FROM "Match" WHERE home_player_4 = ANY(p_player_ids)
    UNION ALL SELECT home_player_5, "home_player_Y5" FROM "Match" WHERE home_player_5 = ANY(p_player_ids)
    UNION ALL SELECT home_player_6, "home_player_Y6" FROM "Match" WHERE home_player_6 = ANY(p_player_ids)
    UNION ALL SELECT home_player_7, "home_player_Y7" FROM "Match" WHERE home_player_7 = ANY(p_player_ids)
    UNION ALL SELECT home_player_8, "home_player_Y8" FROM "Match" WHERE home_player_8 = ANY(p_player_ids)
    UNION ALL SELECT home_player_9, "home_player_Y9" FROM "Match" WHERE home_player_9 = ANY(p_player_ids)
    UNION ALL SELECT home_player_10, "home_player_Y10" FROM "Match" WHERE home_player_10 = ANY(p_player_ids)
    UNION ALL SELECT home_player_11, "home_player_Y11" FROM "Match" WHERE home_player_11 = ANY(p_player_ids)
    UNION ALL SELECT away_player_1, "away_player_Y1" FROM "Match" WHERE away_player_1 = ANY(p_player_ids)
    UNION ALL SELECT away_player_2, "away_player_Y2" FROM "Match" WHERE away_player_2 = ANY(p_player_ids)
    UNION ALL SELECT away_player_3, "away_player_Y3" FROM "Match" WHERE away_player_3 = ANY(p_player_ids)
    UNION ALL SELECT away_player_4, "away_player_Y4" FROM "Match" WHERE away_player_4 = ANY(p_player_ids)
    UNION ALL SELECT away_player_5, "away_player_Y5" FROM "Match" WHERE away_player_5 = ANY(p_player_ids)
    UNION ALL SELECT away_player_6, "away_player_Y6" FROM "Match" WHERE away_player_6 = ANY(p_player_ids)
    UNION ALL SELECT away_player_7, "away_player_Y7" FROM "Match" WHERE away_player_7 = ANY(p_player_ids)
    UNION ALL SELECT away_player_8, "away_player_Y8" FROM "Match" WHERE away_player_8 = ANY(p_player_ids)
    UNION ALL SELECT away_player_9, "away_player_Y9" FROM "Match" WHERE away_player_9 = ANY(p_player_ids)
    UNION ALL SELECT away_player_10, "away_player_Y10" FROM "Match" WHERE away_player_10 = ANY(p_player_ids)
    UNION ALL SELECT away_player_11, "away_player_Y11" FROM "Match" WHERE away_player_11 = ANY(p_player_ids)
  ) AS temp
  WHERE temp.player_id IS NOT NULL AND temp.y IS NOT NULL
  GROUP BY temp.player_id;
END;
$$;

-- Permite que la service-role (backend) ejecute esta función
GRANT EXECUTE ON FUNCTION public.get_players_avg_y(INTEGER[]) TO service_role;
