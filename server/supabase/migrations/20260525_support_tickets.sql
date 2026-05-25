create table if not exists public.support_tickets (
    id uuid primary key default gen_random_uuid(),
    user_id uuid null references auth.users(id) on delete set null,
    email text not null,
    subject text not null check (char_length(subject) between 1 and 120),
    message text not null check (char_length(message) between 1 and 5000),
    status text not null default 'open' check (status in ('open', 'in_progress', 'resolved', 'closed')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_support_tickets_created
    on public.support_tickets (created_at desc);

create index if not exists idx_support_tickets_user
    on public.support_tickets (user_id, created_at desc);

alter table public.support_tickets enable row level security;

drop policy if exists support_tickets_select_own on public.support_tickets;
create policy support_tickets_select_own
    on public.support_tickets
    for select
    using (user_id = auth.uid());

drop policy if exists support_tickets_insert_own on public.support_tickets;
create policy support_tickets_insert_own
    on public.support_tickets
    for insert
    with check (user_id = auth.uid());
