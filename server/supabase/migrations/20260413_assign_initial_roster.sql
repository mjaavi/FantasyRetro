-- ─────────────────────────────────────────────────────────────────────────────
-- assign_initial_roster
--
-- Asigna en UNA SOLA TRANSACCIÓN atómica los 11 jugadores iniciales de un
-- usuario en una liga. Si cualquier inserción falla (ej. jugador ya fichado,
-- constraint unique violada, etc.) TODO el bloque hace ROLLBACK y el usuario
-- no queda con un equipo incompleto.
--
-- Parámetros:
--   p_league_id   : ID de la liga
--   p_user_id     : UUID del usuario
--   p_player_ids  : array de player_api_id (exactamente 11)
--   p_prices      : array de precios de compra (en el mismo orden que p_player_ids)
--
-- Retorna: void (lanza excepción si falla)
--
-- IMPORTANTE: Ejecutar como SECURITY DEFINER para que la función tenga
-- permisos de escritura en user_roster via la service-role key de Supabase.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION assign_initial_roster(
    p_league_id  INTEGER,
    p_user_id    UUID,
    p_player_ids INTEGER[],
    p_prices     BIGINT[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    i INTEGER;
BEGIN
    -- Validación básica: deben ser exactamente 11 jugadores
    IF array_length(p_player_ids, 1) IS DISTINCT FROM 11 THEN
        RAISE EXCEPTION 'assign_initial_roster: Se requieren exactamente 11 jugadores, se recibieron %',
            COALESCE(array_length(p_player_ids, 1), 0);
    END IF;

    IF array_length(p_player_ids, 1) != array_length(p_prices, 1) THEN
        RAISE EXCEPTION 'assign_initial_roster: Los arrays p_player_ids y p_prices deben tener el mismo tamaño';
    END IF;

    -- Insertar los 11 jugadores en una transacción atómica.
    -- Si alguno falla (ej. UNIQUE violation) PostgreSQL lanza una excepción
    -- que el cliente (PostgREST/Supabase) propagará y NINGÚN jugador quedará insertado.
    FOR i IN 1..array_length(p_player_ids, 1) LOOP
        INSERT INTO user_roster (
            league_id,
            user_id,
            player_api_id,
            purchase_price,
            is_starter
        ) VALUES (
            p_league_id,
            p_user_id,
            p_player_ids[i],
            p_prices[i],
            TRUE  -- todos titulares desde el inicio
        );
    END LOOP;
END;
$$;

-- Permite que la service-role (backend) ejecute esta función
GRANT EXECUTE ON FUNCTION assign_initial_roster(INTEGER, UUID, INTEGER[], BIGINT[]) TO service_role;
