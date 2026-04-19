-- Indices para reducir latencia en mercado, plantilla y puntuaciones.
-- Son seguros de reaplicar gracias a IF NOT EXISTS.

create index if not exists idx_fantasy_leagues_admin_id
    on public.fantasy_leagues (admin_id);

create index if not exists idx_league_participants_user_league
    on public.league_participants (user_id, league_id);

create index if not exists idx_league_participants_league_user
    on public.league_participants (league_id, user_id);

create index if not exists idx_user_roster_league_user
    on public.user_roster (league_id, user_id);

create index if not exists idx_user_roster_league_player
    on public.user_roster (league_id, player_api_id);

create index if not exists idx_league_market_active
    on public.league_market (league_id, is_active, expires_at);

create index if not exists idx_league_bids_league_user
    on public.league_bids (league_id, user_id);

create index if not exists idx_league_bids_league_player
    on public.league_bids (league_id, player_api_id);

create index if not exists idx_fantasy_scores_league_user_jornada
    on public.fantasy_scores (league_id, user_id, jornada);

create index if not exists idx_fantasy_scores_league_player_jornada
    on public.fantasy_scores (league_id, player_api_id, jornada);

create index if not exists idx_player_global_scores_league_player_jornada
    on public.player_global_scores (league_id, player_api_id, jornada);

create index if not exists idx_match_league_season
    on public."Match" (league_id, season);

create index if not exists idx_match_league_season_stage
    on public."Match" (league_id, season, stage);

create index if not exists idx_player_attributes_player_date
    on public."Player_Attributes" (player_api_id, date desc);
