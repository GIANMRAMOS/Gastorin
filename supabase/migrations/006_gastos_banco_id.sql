-- 006_gastos_banco_id.sql
-- Paso 1: sembrar banco por defecto para cada usuario existente.
insert into bancos (usuario_id, nombre)
select id, 'No especificado' from auth.users
on conflict do nothing;

-- Paso 2: agregar la columna nullable primero (no se puede NOT NULL sin default en tabla con filas).
alter table gastos add column banco_id uuid references bancos(id) on delete restrict;

-- Paso 3: backfill de gastos existentes con el banco "No especificado" del mismo usuario.
update gastos g
set banco_id = b.id
from bancos b
where b.usuario_id = g.usuario_id
  and lower(b.nombre) = 'no especificado'
  and g.banco_id is null;

-- Paso 4: ahora que no quedan nulos, se aplica la restricción.
alter table gastos alter column banco_id set not null;

create index idx_gastos_banco_id on gastos(banco_id);
