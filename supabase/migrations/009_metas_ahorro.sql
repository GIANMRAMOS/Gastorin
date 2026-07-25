-- 009_metas_ahorro.sql
-- Épica 13 (HU-13.1): "Ahorro comprometido" — una sola meta de ahorro activa
-- por usuario (monto + descripción, ej. "meta viaje 2027"). Diseño: Data.
-- A diferencia de estado_ingesta, esta tabla la escribe el propio usuario
-- desde la app (no una Edge Function con service role), por eso la política
-- es de CRUD completo, no solo lectura.

create table metas_ahorro (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  descripcion text not null,
  monto numeric(12, 2) not null check (monto > 0),
  actualizado_en timestamptz not null default now()
);

alter table metas_ahorro enable row level security;

create policy metas_ahorro_crud_propio on metas_ahorro
  for all
  using (usuario_id = auth.uid())
  with check (usuario_id = auth.uid());
