-- 012_reglas_comercio_banco.sql
-- Épica 5 (Bandeja), extensión: además de sugerir Categoría por comercio, ahora
-- también se sugiere y aprende el Banco. El campo Banco del panel de revisión
-- pasa de ser texto de solo lectura (lo que resolvió la Edge Function
-- importar-borrador al momento de la ingesta) a ser editable, con una
-- sugerencia que pesa MÁS que la resolución de la Edge Function cuando ya
-- existe una regla previa para ese comercio con banco guardado.
--
-- Se extiende la misma tabla `reglas_comercio` (no una tabla nueva): una sola
-- regla por comercio recuerda tanto la categoría como el banco elegidos la
-- última vez, igual que ya pasa hoy solo con categoría. Nullable porque las
-- reglas existentes no tienen banco guardado, y es válido crear una regla
-- nueva solo con categoría si el usuario nunca tocó el banco sugerido.
--
-- on delete set null (no cascade ni restrict): si se borra un banco del
-- catálogo del usuario (pasó varias veces esta sesión al consolidar BCP/IBK),
-- la regla de comercio no debe romperse ni bloquear el borrado del banco —
-- simplemente deja de tener una sugerencia de banco y cae de nuevo a lo que
-- resuelva la Edge Function, la categoría sugerida sigue intacta.

alter table reglas_comercio
  add column banco_id uuid references bancos(id) on delete set null;
