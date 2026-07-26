-- 011_ajustes_saldo_cuenta.sql
-- "Setear saldo de cuenta" (Dashboard, tarjeta "Saldo por cuenta"): el
-- usuario puede fijar el saldo real de una cuenta (banco+moneda) a partir de
-- una fecha; desde ese momento, el saldo mostrado = ese monto + (ingresos −
-- gastos) de esa cuenta con fecha POSTERIOR al ajuste, no desde el inicio de
-- los tiempos. Se guarda como historial (no upsert de una sola fila): si el
-- usuario vuelve a setear el saldo más adelante, ese nuevo ajuste es "el
-- último" y gobierna desde su propia fecha en adelante; los ajustes previos
-- quedan como registro, no se borran. Diseño: Data.

create table ajustes_saldo_cuenta (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  banco_id uuid not null references bancos(id) on delete cascade,
  moneda moneda_tipo not null,
  saldo numeric(12, 2) not null,
  fecha date not null,
  creado_en timestamptz not null default now()
);

alter table ajustes_saldo_cuenta enable row level security;

create policy ajustes_saldo_cuenta_crud_propio on ajustes_saldo_cuenta
  for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());

-- Resolver "el último ajuste" de una cuenta es siempre por (banco_id, moneda)
-- ordenado por fecha desc, creado_en desc como desempate.
create index idx_ajustes_saldo_cuenta_banco_moneda on ajustes_saldo_cuenta(banco_id, moneda, fecha desc, creado_en desc);
