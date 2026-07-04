-- Migration: Add seller_id to league_market table to support player selling functionality
alter table public.league_market
    add column if not exists seller_id uuid references auth.users(id) on delete set null;

create index if not exists idx_league_market_seller_id
    on public.league_market (seller_id);
