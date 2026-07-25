-- 008_categorias_tipo_e_ingresos_categoria.sql
-- Épica 12 (HU-12.1): categorías propias para Ingresos, separadas de las de
-- Gasto (Salario/Servicios/Rendimientos/Otros ingresos no deben aparecer al
-- crear un gasto, y viceversa). Diseño: Data.

-- Paso 1: columna `tipo`, todo lo existente hoy es de gasto.
alter table categorias add column tipo text not null default 'gasto'
  check (tipo in ('gasto', 'ingreso'));

-- Paso 2: la unicidad por (usuario_id, nombre) impediría que un usuario tenga
-- una categoría de gasto y una de ingreso con el mismo nombre (ej. "Otros").
-- Se reemplaza por (usuario_id, nombre, tipo).
alter table categorias drop constraint categorias_usuario_id_nombre_key;
alter table categorias add constraint categorias_usuario_nombre_tipo_unico unique (usuario_id, nombre, tipo);

-- Paso 3: sembrar una categoría de ingreso por defecto para cada usuario
-- existente (mismo patrón que "No especificado" en bancos/006).
insert into categorias (usuario_id, nombre, tipo, predefinida)
select id, 'Otros ingresos', 'ingreso', true from auth.users
on conflict do nothing;

-- Paso 4: columna nullable primero (no se puede NOT NULL sin backfill).
alter table ingresos add column categoria_id uuid references categorias(id) on delete restrict;

-- Paso 5: backfill de ingresos existentes con "Otros ingresos" del mismo usuario.
update ingresos i
set categoria_id = c.id
from categorias c
where c.usuario_id = i.usuario_id
  and c.tipo = 'ingreso'
  and lower(c.nombre) = 'otros ingresos'
  and i.categoria_id is null;

-- Paso 6: ya sin nulos, se aplica la restricción.
alter table ingresos alter column categoria_id set not null;

create index idx_ingresos_categoria_id on ingresos(categoria_id);
