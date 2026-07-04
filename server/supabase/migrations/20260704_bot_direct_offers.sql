-- Migration: Make buyer_user_id nullable in league_direct_offers to support bot offers,
-- and update accept_league_direct_offer RPC to support null buyers (bot).

alter table public.league_direct_offers alter column buyer_user_id drop not null;

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

    if v_offer.buyer_user_id is not null then
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
    end if;

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
        if v_expired_offer.buyer_user_id is not null then
            update public.league_participants
               set budget = budget + v_expired_offer.amount
             where league_id = v_expired_offer.league_id
               and user_id = v_expired_offer.buyer_user_id;
        end if;

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
