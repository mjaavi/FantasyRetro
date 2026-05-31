alter table public.league_transfer_history
    drop constraint if exists league_transfer_history_transfer_type_check;

alter table public.league_transfer_history
    add constraint league_transfer_history_transfer_type_check
    check (transfer_type in ('market', 'direct_offer', 'release_clause', 'dismissal'));

create or replace function public.dismiss_league_player(
    p_league_id integer,
    p_user_id uuid,
    p_player_api_id bigint,
    p_recovered_amount integer
)
returns void
language plpgsql
security definer
as $$
declare
    v_found boolean;
begin
    -- 1. Verificar pertenencia
    select exists (
        select 1 
          from public.user_roster 
         where league_id = p_league_id 
           and user_id = p_user_id 
           and player_api_id = p_player_api_id
    ) into v_found;

    if not v_found then
        raise exception 'El jugador no pertenece a tu equipo en esta liga';
    end if;

    -- 2. Eliminar de user_roster
    delete from public.user_roster
     where league_id = p_league_id
       and user_id = p_user_id
       and player_api_id = p_player_api_id;

    -- 3. Sumar presupuesto
    update public.league_participants
       set budget = budget + p_recovered_amount
     where league_id = p_league_id
       and user_id = p_user_id;

    -- 4. Registrar en el historial de traspasos
    insert into public.league_transfer_history (
        league_id,
        player_api_id,
        from_user_id,
        to_user_id,
        amount,
        transfer_type
    ) values (
        p_league_id,
        p_player_api_id,
        p_user_id,
        null,
        p_recovered_amount,
        'dismissal'
    );
end;
$$;

grant execute on function public.dismiss_league_player(integer, uuid, bigint, integer) to service_role;
