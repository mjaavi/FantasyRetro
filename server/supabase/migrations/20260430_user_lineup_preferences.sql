-- Persistencia de formacion por usuario/liga/jornada.
-- El once titular sigue viviendo en user_roster; esta tabla guarda la intencion
-- de layout para que la UI no tenga que inferirla y pisar la seleccion.

create table if not exists public.user_lineup_preferences (
    league_id integer not null
        references public.fantasy_leagues (id)
        on delete cascade,
    user_id uuid not null,
    jornada integer not null,
    formation_key text not null,
    updated_at timestamptz not null default timezone('utc', now()),
    constraint user_lineup_preferences_pkey
        primary key (league_id, user_id, jornada),
    constraint user_lineup_preferences_jornada_check
        check (jornada between 1 and 38),
    constraint user_lineup_preferences_formation_key_check
        check (formation_key in ('3-5-2', '3-4-3', '4-5-1', '4-4-2', '4-3-3', '5-3-2', '5-2-3'))
);

create index if not exists idx_user_lineup_preferences_user_league
    on public.user_lineup_preferences (user_id, league_id);

alter table public.user_lineup_preferences enable row level security;

drop policy if exists user_lineup_preferences_select_own_league
    on public.user_lineup_preferences;

create policy user_lineup_preferences_select_own_league
    on public.user_lineup_preferences
    for select
    to authenticated
    using (
        user_id = auth.uid()
        and exists (
            select 1
            from public.league_participants lp
            where lp.league_id = user_lineup_preferences.league_id
              and lp.user_id = auth.uid()
        )
    );

drop policy if exists user_lineup_preferences_write_open_round
    on public.user_lineup_preferences;

drop policy if exists user_lineup_preferences_insert_open_round
    on public.user_lineup_preferences;

create policy user_lineup_preferences_insert_open_round
    on public.user_lineup_preferences
    for insert
    to authenticated
    with check (
        user_id = auth.uid()
        and exists (
            select 1
            from public.league_participants lp
            where lp.league_id = user_lineup_preferences.league_id
              and lp.user_id = auth.uid()
        )
        and jornada = (
            select coalesce(fl.jornada_actual, 0) + 1
            from public.fantasy_leagues fl
            where fl.id = user_lineup_preferences.league_id
        )
    );

drop policy if exists user_lineup_preferences_update_open_round
    on public.user_lineup_preferences;

create policy user_lineup_preferences_update_open_round
    on public.user_lineup_preferences
    for update
    to authenticated
    using (
        user_id = auth.uid()
        and exists (
            select 1
            from public.league_participants lp
            where lp.league_id = user_lineup_preferences.league_id
              and lp.user_id = auth.uid()
        )
        and jornada = (
            select coalesce(fl.jornada_actual, 0) + 1
            from public.fantasy_leagues fl
            where fl.id = user_lineup_preferences.league_id
        )
    )
    with check (
        user_id = auth.uid()
        and exists (
            select 1
            from public.league_participants lp
            where lp.league_id = user_lineup_preferences.league_id
              and lp.user_id = auth.uid()
        )
        and jornada = (
            select coalesce(fl.jornada_actual, 0) + 1
            from public.fantasy_leagues fl
            where fl.id = user_lineup_preferences.league_id
        )
    );
