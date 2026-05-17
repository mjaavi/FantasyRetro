alter table public.user_roster
    add column if not exists release_clause integer;

update public.user_roster
   set release_clause = greatest(
       coalesce(release_clause, 0),
       ceiling(coalesce(purchase_price, 0) * 1.25)::integer
   )
 where release_clause is null
    or release_clause < ceiling(coalesce(purchase_price, 0) * 1.25)::integer;

alter table public.user_roster
    alter column release_clause set not null;

alter table public.user_roster
    add constraint user_roster_release_clause_non_negative
    check (release_clause >= 0) not valid;

alter table public.user_roster
    validate constraint user_roster_release_clause_non_negative;

alter table public.league_transfer_history
    drop constraint if exists league_transfer_history_transfer_type_check;

alter table public.league_transfer_history
    add constraint league_transfer_history_transfer_type_check
    check (transfer_type in ('market', 'direct_offer', 'release_clause'));

create or replace function assign_initial_roster(
    p_league_id integer,
    p_user_id uuid,
    p_player_ids integer[],
    p_prices bigint[],
    p_release_clauses bigint[] default null
)
returns void
language plpgsql
security definer
as $$
declare
    i integer;
    v_release_clause bigint;
begin
    if array_length(p_player_ids, 1) is distinct from 11 then
        raise exception 'assign_initial_roster: Se requieren exactamente 11 jugadores, se recibieron %',
            coalesce(array_length(p_player_ids, 1), 0);
    end if;

    if array_length(p_player_ids, 1) != array_length(p_prices, 1) then
        raise exception 'assign_initial_roster: Los arrays p_player_ids y p_prices deben tener el mismo tamaño';
    end if;

    if p_release_clauses is not null
       and array_length(p_player_ids, 1) != array_length(p_release_clauses, 1) then
        raise exception 'assign_initial_roster: Los arrays p_player_ids y p_release_clauses deben tener el mismo tamaño';
    end if;

    for i in 1..array_length(p_player_ids, 1) loop
        v_release_clause := coalesce(p_release_clauses[i], ceiling(p_prices[i] * 1.25)::bigint);

        insert into user_roster (
            league_id,
            user_id,
            player_api_id,
            purchase_price,
            release_clause,
            is_starter
        ) values (
            p_league_id,
            p_user_id,
            p_player_ids[i],
            p_prices[i],
            v_release_clause,
            true
        );
    end loop;
end;
$$;

grant execute on function assign_initial_roster(integer, uuid, integer[], bigint[], bigint[]) to service_role;

create or replace function public.accept_league_direct_offer(
    p_offer_id uuid,
    p_seller_user_id uuid
)
returns void
language plpgsql
security definer
as $$
declare
    v_offer public.league_direct_offers%rowtype;
    v_player_is_starter boolean;
    v_expired_offer public.league_direct_offers%rowtype;
begin
    select *
      into v_offer
      from public.league_direct_offers
     where id = p_offer_id
       and status = 'pending'
     for update;

    if not found then
        raise exception 'Oferta no encontrada o ya resuelta';
    end if;

    if v_offer.seller_user_id <> p_seller_user_id then
        raise exception 'Solo el vendedor puede aceptar esta oferta';
    end if;

    select is_starter
      into v_player_is_starter
      from public.user_roster
     where league_id = v_offer.league_id
       and user_id = v_offer.seller_user_id
       and player_api_id = v_offer.player_api_id
     for update;

    if not found then
        raise exception 'El jugador ya no pertenece al vendedor';
    end if;

    delete from public.user_roster
     where league_id = v_offer.league_id
       and user_id = v_offer.seller_user_id
       and player_api_id = v_offer.player_api_id;

    insert into public.user_roster (
        league_id,
        user_id,
        player_api_id,
        purchase_price,
        release_clause,
        is_starter
    ) values (
        v_offer.league_id,
        v_offer.buyer_user_id,
        v_offer.player_api_id,
        v_offer.amount,
        ceiling(v_offer.amount * 1.25)::integer,
        false
    );

    update public.league_participants
       set budget = budget + v_offer.amount
     where league_id = v_offer.league_id
       and user_id = v_offer.seller_user_id;

    update public.league_direct_offers
       set status = 'accepted',
           resolved_at = now(),
           updated_at = now()
     where id = v_offer.id;

    for v_expired_offer in
        select *
          from public.league_direct_offers
         where league_id = v_offer.league_id
           and player_api_id = v_offer.player_api_id
           and status = 'pending'
           and id <> v_offer.id
         for update
    loop
        update public.league_participants
           set budget = budget + v_expired_offer.amount
         where league_id = v_expired_offer.league_id
           and user_id = v_expired_offer.buyer_user_id;

        update public.league_direct_offers
           set status = 'expired',
               resolved_at = now(),
               updated_at = now()
         where id = v_expired_offer.id;
    end loop;

    insert into public.league_transfer_history (
        league_id,
        player_api_id,
        from_user_id,
        to_user_id,
        amount,
        transfer_type,
        offer_id
    ) values (
        v_offer.league_id,
        v_offer.player_api_id,
        v_offer.seller_user_id,
        v_offer.buyer_user_id,
        v_offer.amount,
        'direct_offer',
        v_offer.id
    );
end;
$$;

grant execute on function public.accept_league_direct_offer(uuid, uuid) to service_role;

create or replace function public.pay_league_release_clause(
    p_league_id integer,
    p_buyer_user_id uuid,
    p_seller_user_id uuid,
    p_player_api_id bigint,
    p_clause_amount integer,
    p_next_release_clause integer
)
returns void
language plpgsql
security definer
as $$
declare
    v_current_clause integer;
    v_buyer_budget integer;
    v_expired_offer public.league_direct_offers%rowtype;
begin
    if p_buyer_user_id = p_seller_user_id then
        raise exception 'No puedes pagar tu propia clausula';
    end if;

    select budget
      into v_buyer_budget
      from public.league_participants
     where league_id = p_league_id
       and user_id = p_buyer_user_id
     for update;

    if not found then
        raise exception 'El comprador no participa en la liga';
    end if;

    select release_clause
      into v_current_clause
      from public.user_roster
     where league_id = p_league_id
       and user_id = p_seller_user_id
       and player_api_id = p_player_api_id
     for update;

    if not found then
        raise exception 'El jugador ya no pertenece al vendedor';
    end if;

    if p_clause_amount < v_current_clause then
        raise exception 'La clausula enviada es inferior a la clausula vigente';
    end if;

    for v_expired_offer in
        select *
          from public.league_direct_offers
         where league_id = p_league_id
           and player_api_id = p_player_api_id
           and status = 'pending'
         for update
    loop
        update public.league_participants
           set budget = budget + v_expired_offer.amount
         where league_id = v_expired_offer.league_id
           and user_id = v_expired_offer.buyer_user_id;

        update public.league_direct_offers
           set status = 'expired',
               resolved_at = now(),
               updated_at = now()
         where id = v_expired_offer.id;
    end loop;

    select budget
      into v_buyer_budget
      from public.league_participants
     where league_id = p_league_id
       and user_id = p_buyer_user_id
     for update;

    if v_buyer_budget < p_clause_amount then
        raise exception 'Presupuesto insuficiente';
    end if;

    update public.league_participants
       set budget = budget - p_clause_amount
     where league_id = p_league_id
       and user_id = p_buyer_user_id;

    update public.league_participants
       set budget = budget + p_clause_amount
     where league_id = p_league_id
       and user_id = p_seller_user_id;

    delete from public.user_roster
     where league_id = p_league_id
       and user_id = p_seller_user_id
       and player_api_id = p_player_api_id;

    insert into public.user_roster (
        league_id,
        user_id,
        player_api_id,
        purchase_price,
        release_clause,
        is_starter
    ) values (
        p_league_id,
        p_buyer_user_id,
        p_player_api_id,
        p_clause_amount,
        greatest(p_next_release_clause, p_clause_amount),
        false
    );

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
        p_seller_user_id,
        p_buyer_user_id,
        p_clause_amount,
        'release_clause'
    );
end;
$$;

grant execute on function public.pay_league_release_clause(integer, uuid, uuid, bigint, integer, integer) to service_role;

create or replace function public.raise_player_release_clause(
    p_league_id integer,
    p_user_id uuid,
    p_player_api_id bigint,
    p_contribution integer,
    p_next_release_clause integer
)
returns void
language plpgsql
security definer
as $$
declare
    v_budget integer;
    v_current_clause integer;
begin
    select budget
      into v_budget
      from public.league_participants
     where league_id = p_league_id
       and user_id = p_user_id
     for update;

    if not found then
        raise exception 'El usuario no participa en la liga';
    end if;

    if v_budget < p_contribution then
        raise exception 'Presupuesto insuficiente';
    end if;

    select release_clause
      into v_current_clause
      from public.user_roster
     where league_id = p_league_id
       and user_id = p_user_id
       and player_api_id = p_player_api_id
     for update;

    if not found then
        raise exception 'El jugador no pertenece al usuario';
    end if;

    if p_next_release_clause < v_current_clause then
        raise exception 'La clausula no puede bajar';
    end if;

    update public.league_participants
       set budget = budget - p_contribution
     where league_id = p_league_id
       and user_id = p_user_id;

    update public.user_roster
       set release_clause = p_next_release_clause
     where league_id = p_league_id
       and user_id = p_user_id
       and player_api_id = p_player_api_id;
end;
$$;

grant execute on function public.raise_player_release_clause(integer, uuid, bigint, integer, integer) to service_role;
