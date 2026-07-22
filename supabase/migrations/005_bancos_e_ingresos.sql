-- 005_bancos_e_ingresos.sql
create table bancos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  created_at timestamptz not null default now()
);

-- UNIQUE (...) como restricción de tabla no admite expresiones como
-- lower(nombre); la unicidad case-insensitive por usuario requiere un
-- índice único sobre la expresión, no una restricción inline.
create unique index bancos_usuario_nombre_unico on bancos (usuario_id, lower(nombre));

alter table bancos enable row level security;

create policy bancos_crud_propio on bancos
  for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create table ingresos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  banco_id uuid not null references bancos(id) on delete restrict,
  fecha date not null,
  moneda moneda_tipo not null,
  importe numeric not null check (importe > 0),
  concepto text not null,
  created_at timestamptz not null default now()
);

alter table ingresos enable row level security;

create policy ingresos_crud_propio on ingresos
  for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

create index idx_ingresos_banco_id on ingresos(banco_id);
create index idx_ingresos_usuario_fecha on ingresos(usuario_id, fecha desc);
