#!/bin/bash
# Respaldo de la base de datos de Gastorin (Supabase, plan Free sin backups
# automáticos — ver AUD-OPS-01 del informe de Auditor).
#
# Requiere la variable de entorno SUPABASE_DB_PASSWORD (la contraseña de
# base de datos que definiste al crear el proyecto en Supabase). Nunca la
# pases como argumento en texto plano ni la commitees.
#
# Uso manual:
#   export SUPABASE_DB_PASSWORD="tu-password"
#   ./scripts/backup-db.sh
#
# Uso programado (cron/launchd, sin sesión interactiva): el script busca
# primero un archivo local ~/.gastorin_backup_env (chmod 600, fuera del
# repo, nunca versionado) con la línea:
#   export SUPABASE_DB_PASSWORD='tu-password'
set -euo pipefail

if [ -z "${SUPABASE_DB_PASSWORD:-}" ] && [ -f "$HOME/.gastorin_backup_env" ]; then
  # shellcheck disable=SC1090
  source "$HOME/.gastorin_backup_env"
fi

# Conexión vía connection pooler de Supabase (no requiere Docker, a
# diferencia de `supabase db dump`, que necesita bajar una imagen de
# Postgres para obtener un pg_dump de versión compatible).
PG_DUMP_BIN="/opt/homebrew/opt/postgresql@17/bin/pg_dump"
PGHOST="aws-1-us-east-2.pooler.supabase.com"
PGPORT="5432"
PGUSER="postgres.yinzqgoquzpgmjeqhztb"
PGDATABASE="postgres"

BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/GastorinBackups"
RETENCION_DIAS=30

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "Error: falta la variable de entorno SUPABASE_DB_PASSWORD." >&2
  echo "Expórtala antes de correr este script (no la escribas aquí dentro)." >&2
  exit 1
fi

if [ ! -x "$PG_DUMP_BIN" ]; then
  echo "Error: no se encontró pg_dump en $PG_DUMP_BIN (instala con 'brew install postgresql@17')." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

FECHA="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVO="$BACKUP_DIR/gastorin_backup_${FECHA}.sql"

echo "Iniciando backup de Gastorin -> $ARCHIVO"
PGPASSWORD="$SUPABASE_DB_PASSWORD" "$PG_DUMP_BIN" \
  -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "$PGDATABASE" \
  --no-owner --no-privileges \
  -f "$ARCHIVO"

if [ ! -s "$ARCHIVO" ]; then
  echo "Error: el archivo de backup quedó vacío. Revisa la conexión/contraseña." >&2
  exit 1
fi

echo "Backup completado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Rotación: conserva solo los últimos RETENCION_DIAS días de backups.
find "$BACKUP_DIR" -name "gastorin_backup_*.sql" -mtime +"$RETENCION_DIAS" -delete
echo "Rotación aplicada: se conservan los backups de los últimos ${RETENCION_DIAS} días."
