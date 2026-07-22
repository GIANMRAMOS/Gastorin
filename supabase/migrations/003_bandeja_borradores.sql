-- 003_bandeja_borradores.sql
-- Habilita la bandeja de borradores: monto/moneda nullable (con check condicionado a
-- estado='revision_manual') y siembra las categorías predefinidas (incluida "Otros")
-- para cada usuario existente.
-- Diseño: Data. Ya aplicada en el proyecto Supabase productivo; este archivo solo versiona el SQL.

ALTER TABLE gastos ALTER COLUMN monto DROP NOT NULL;
ALTER TABLE gastos ALTER COLUMN moneda DROP NOT NULL;

ALTER TABLE gastos ADD CONSTRAINT gastos_datos_completos_si_no_revision
  CHECK (estado = 'revision_manual' OR (monto IS NOT NULL AND moneda IS NOT NULL));

INSERT INTO categorias (usuario_id, nombre, predefinida, activa)
SELECT u.id, c.nombre, true, true
FROM auth.users u
CROSS JOIN (VALUES
  ('Alimentación'), ('Transporte'), ('Hogar'), ('Ocio'), ('Salud'), ('Otros')
) AS c(nombre)
WHERE NOT EXISTS (
  SELECT 1 FROM categorias existente
  WHERE existente.usuario_id = u.id AND existente.nombre = c.nombre
);
