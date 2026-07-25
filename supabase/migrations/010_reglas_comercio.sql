-- 010_reglas_comercio.sql
-- Épica 14 (HU-14.1): al confirmar un borrador con una categoría, se recuerda
-- para el mismo comercio y se sugiere la próxima vez ("Categoría sugerida por
-- N cargos anteriores de X"). Diseño: Data.
-- HU-14.2 (detección de "posible duplicado") NO necesita tabla nueva: se
-- resuelve comparando borradores pendientes entre sí (mismo monto + banco +
-- fecha dentro de una ventana), lógica de aplicación pura en el composable.

create table reglas_comercio (
  usuario_id uuid not null references auth.users(id) on delete cascade,
  -- Nombre del comercio normalizado (lower + trim) para que "Primax Surco" y
  -- "PRIMAX SURCO " cuenten como la misma regla.
  comercio text not null,
  categoria_id uuid not null references categorias(id) on delete cascade,
  actualizado_en timestamptz not null default now(),
  primary key (usuario_id, comercio)
);

alter table reglas_comercio enable row level security;

create policy reglas_comercio_crud_propio on reglas_comercio
  for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
