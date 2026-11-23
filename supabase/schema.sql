-- Run once in the Supabase SQL editor. Authentication is managed by Supabase Auth.
create table if not exists public.timer_operations (
  user_id uuid not null references auth.users(id) on delete cascade,
  id uuid not null,
  operation jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, id),
  constraint valid_operation check (coalesce((
    jsonb_typeof(operation) = 'object'
    and octet_length(operation::text) <= 65536
    and operation->>'id' = id::text
    and operation->>'kind' in ('session', 'solve', 'settings')
    and jsonb_typeof(operation->'stamp') = 'number'
    and jsonb_typeof(operation->'entityId') = 'string'
    and jsonb_typeof(operation->'value') = 'object'
    and (operation->>'kind' = 'settings' or operation->'value'->>'id' = operation->>'entityId')
    and operation ?& array['id', 'kind', 'stamp', 'entityId', 'value']
  ), false))
);
alter table public.timer_operations enable row level security;
revoke all on public.timer_operations from anon, authenticated;
grant select, insert on public.timer_operations to authenticated;
create policy "Read own operations" on public.timer_operations
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Append own operations" on public.timer_operations
  for insert to authenticated with check ((select auth.uid()) = user_id);
-- Records are immutable. Editing/deleting appends a new operation, never overwrites history.
-- Remove an account through Supabase Auth to erase its cloud history (ON DELETE CASCADE).
