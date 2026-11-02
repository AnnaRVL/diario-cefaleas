-- Tabla del diario de cefaleas. Se ejecuta una sola vez en Supabase > SQL Editor.
-- No modifica la tabla de Kakebo.
create table if not exists public.diario (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  coleccion text not null check (coleccion in ('crisis', 'ta', 'dias', 'ajustes')),
  doc_id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, coleccion, doc_id)
);

alter table public.diario enable row level security;

drop policy if exists "diario_propio" on public.diario;
create policy "diario_propio" on public.diario
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.diario to authenticated;
