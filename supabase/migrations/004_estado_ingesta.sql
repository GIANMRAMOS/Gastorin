-- 004_estado_ingesta.sql
-- Tabla de estado de la ingesta automática de gastos por correo (HU-5.5):
-- guarda cuándo se ejecutó por última vez la revisión programada, para que
-- la Bandeja pueda mostrar si la ingesta sigue corriendo con normalidad.
-- Diseño: Data. Pendiente de aplicar a producción.

CREATE TABLE estado_ingesta (
  usuario_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ultima_ejecucion_en timestamptz NOT NULL
);

ALTER TABLE estado_ingesta ENABLE ROW LEVEL SECURITY;

CREATE POLICY estado_ingesta_solo_lectura_propia ON estado_ingesta
  FOR SELECT USING (usuario_id = auth.uid());
