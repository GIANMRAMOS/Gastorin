-- 002_estado_gasto_descartado.sql
-- Añade el valor 'descartado' al enum estado_gasto para soportar soft-delete de borradores.
-- Diseño: Data. Ya aplicada en el proyecto Supabase productivo; este archivo solo versiona el SQL.

ALTER TYPE estado_gasto ADD VALUE IF NOT EXISTS 'descartado';
