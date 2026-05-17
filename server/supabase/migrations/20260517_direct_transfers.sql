create table if not exists public.league_direct_offers (
    id uuid primary key default gen_random_uuid(),
    league_id integer not null references public.fantasy_leagues(id) on delete cascade,
    buyer_user_id uuid not null references auth.users(id) on delete cascade,
    seller_user_id uuid not null references auth.users(id) on delete cascade,
    player_api_id bigint not null references public."Player"(player_api_id) on delete cascade,
    amount integer not null check (amount > 0),
    status text not null default 'pending'
        check (status in ('pending', 'accepted', 'rejected', 'cancelled', 'expired')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    resolved_at timestamptz null,
    constraint league_direct_offers_no_self check (buyer_user_id <> seller_user_id)
);

create unique index if not exists idx_league_direct_offers_pending_buyer_player
    on public.league_direct_offers (league_id, buyer_user_id, player_api_id)
    where status = 'pending';

create index if not exists idx_league_direct_offers_seller_pending
    on public.league_direct_offers (league_id, seller_user_id, status, created_at desc);

create table if not exists public.league_transfer_history (
    id uuid primary key default gen_random_uuid(),
    league_id integer not null references public.fantasy_leagues(id) on delete cascade,
    player_api_id bigint not null references public."Player"(player_api_id) on delete cascade,
    from_user_id uuid null references auth.users(id) on delete set null,
    to_user_id uuid not null references auth.users(id) on delete cascade,
    amount integer not null check (amount >= 0),
    transfer_type text not null check (transfer_type in ('market', 'direct_offer')),
    offer_id uuid null references public.league_direct_offers(id) on delete set null,
    created_at timestamptz not null default now()
);

create index if not exists idx_league_transfer_history_league_created
    on public.league_transfer_history (league_id, created_at desc);

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
        is_starter
    ) values (
        v_offer.league_id,
        v_offer.buyer_user_id,
        v_offer.player_api_id,
        v_offer.amount,
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

alter table public.league_direct_offers enable row level security;
alter table public.league_transfer_history enable row level security;

drop policy if exists league_direct_offers_select_participant on public.league_direct_offers;
create policy league_direct_offers_select_participant
    on public.league_direct_offers
    for select
    using (
        exists (
            select 1
              from public.league_participants lp
             where lp.league_id = league_direct_offers.league_id
               and lp.user_id = auth.uid()
        )
    );

drop policy if exists league_transfer_history_select_participant on public.league_transfer_history;
create policy league_transfer_history_select_participant
    on public.league_transfer_history
    for select
    using (
        exists (
            select 1
              from public.league_participants lp
             where lp.league_id = league_transfer_history.league_id
               and lp.user_id = auth.uid()
        )
    );
