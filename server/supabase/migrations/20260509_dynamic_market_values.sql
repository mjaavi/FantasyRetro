-- Dynamic market values by league and player.
-- Initial prices still come from the existing pricing engine; this table stores
-- the current value once matchdays have been processed.

create table if not exists public.league_player_market_values (
    league_id integer not null
        references public.fantasy_leagues(id)
        on delete cascade,
    player_api_id bigint not null
        references public."Player"(player_api_id)
        on delete cascade,
    current_price integer not null
        check (current_price >= 0),
    previous_price integer not null
        check (previous_price >= 0),
    last_variation numeric(8, 5) not null default 0,
    raw_variation numeric(8, 5) not null default 0,
    moving_average_points numeric(8, 3) not null default 0,
    last_jornada_processed integer not null
        check (last_jornada_processed between 1 and 38),
    updated_at timestamptz not null default now(),
    constraint league_player_market_values_pkey
        primary key (league_id, player_api_id)
);

create index if not exists idx_league_player_market_values_league
    on public.league_player_market_values (league_id);

create index if not exists idx_league_player_market_values_player
    on public.league_player_market_values (player_api_id);

alter table public.league_player_market_values enable row level security;

drop policy if exists league_player_market_values_select_participant
    on public.league_player_market_values;

create policy league_player_market_values_select_participant
    on public.league_player_market_values
    for select
    using (
        exists (
            select 1
            from public.league_participants lp
            where lp.league_id = league_player_market_values.league_id
              and lp.user_id = auth.uid()
        )
    );
