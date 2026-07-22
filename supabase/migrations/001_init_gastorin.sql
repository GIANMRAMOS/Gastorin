-- 001_init_gastorin.sql
-- Migración inicial de Gastorin: categorias, gastos, presupuestos + RLS.
-- Diseño: Data (Fase 0). No destructiva (creación pura, sin datos previos que perder).

create type moneda_tipo as enum ('PEN', 'USD');
create type origen_gasto as enum ('manual', 'correo');
create type estado_gasto as enum ('confirmado', 'borrador', 'revision_manual');

create table categorias (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  predefinida boolean not null default false,
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  unique (usuario_id, nombre)
);

create table gastos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete restrict,
  monto numeric(12,2) not null check (monto > 0),
  moneda moneda_tipo not null,
  fecha date not null,
  descripcion text,
  origen origen_gasto not null default 'manual',
  estado estado_gasto not null default 'confirmado',
  gmail_message_id text,
  gmail_fragmento text,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  check (origen = 'correo' or gmail_message_id is null),
  check (estado <> 'revision_manual' or origen = 'correo')
);

create unique index gastos_gmail_message_id_unico
  on gastos (usuario_id, gmail_message_id)
  where gmail_message_id is not null;

create index gastos_usuario_fecha on gastos (usuario_id, fecha desc);
create index gastos_usuario_moneda on gastos (usuario_id, moneda);
create index gastos_usuario_categoria on gastos (usuario_id, categoria_id);

create table presupuestos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  categoria_id uuid not null references categorias(id) on delete restrict,
  mes date not null, -- convención: siempre día 1 del mes (ej. 2026-07-01)
  moneda moneda_tipo not null,
  monto_limite numeric(12,2) not null check (monto_limite > 0),
  creado_en timestamptz not null default now(),
  unique (usuario_id, categoria_id, mes, moneda)
);

-- RLS
alter table categorias enable row level security;
alter table gastos enable row level security;
alter table presupuestos enable row level security;

create policy categorias_por_usuario on categorias
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy gastos_por_usuario on gastos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());

create policy presupuestos_por_usuario on presupuestos
  for all using (usuario_id = auth.uid()) with check (usuario_id = auth.uid());
