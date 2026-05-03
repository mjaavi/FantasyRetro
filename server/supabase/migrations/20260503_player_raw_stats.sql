-- Migration: 20260503_player_raw_stats
-- Description: Añade la columna raw_stats a las tablas de scores para almacenar el rendimiento base parseado (CQRS Read Model).

ALTER TABLE player_global_scores ADD COLUMN IF NOT EXISTS raw_stats JSONB;
ALTER TABLE fantasy_scores ADD COLUMN IF NOT EXISTS raw_stats JSONB;
