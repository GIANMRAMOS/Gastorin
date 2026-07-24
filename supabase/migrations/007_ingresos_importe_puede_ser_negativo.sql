-- 007_ingresos_importe_puede_ser_negativo.sql
-- Amplía la restricción de `ingresos.importe` de "> 0" a "<> 0": permite
-- valores negativos (ej. correcciones/reversos registrados como ingreso),
-- pero sigue bloqueando exactamente 0 (sin sentido de negocio).
--
-- Postgres nombra automáticamente la restricción inline de la migración 005
-- como `ingresos_importe_check` (confirmado contra el esquema real de
-- producción vía pg_constraint/pg_get_constraintdef). Se elimina solo si
-- existe, para que esta migración sea segura de re-ejecutar.
alter table ingresos drop constraint if exists ingresos_importe_check;

alter table ingresos add constraint ingresos_importe_distinto_de_cero check (importe <> 0);
