-- migration para anadir is_starter a fantasy_scores
ALTER TABLE public.fantasy_scores
ADD COLUMN IF NOT EXISTS is_starter boolean NOT NULL DEFAULT false;

-- Indice opcional si hacemos filtrados por titulares
CREATE INDEX IF NOT EXISTS idx_fantasy_scores_is_starter ON public.fantasy_scores(is_starter);
