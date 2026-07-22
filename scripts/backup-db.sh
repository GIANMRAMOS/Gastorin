#!/bin/bash
# Respaldo de la base de datos de Gastorin (Supabase, plan Free sin backups
# automáticos — ver AUD-OPS-01 del informe de Auditor).
#
# Requiere la variable de entorno SUPABASE_DB_PASSWORD (la contraseña de
# base de datos que definiste al crear el proyecto en Supabase). Nunca la
# pases como argumento en texto plano ni la commitees — expórtala en tu
# shell (ej. en ~/.zshrc, o en un archivo local no versionado) antes de
# correr este script, o antes de que el cron/launchd la lea.
#
# Uso manual:
#   export SUPABASE_DB_PASSWORD="tu-password"
#   ./scripts/backup-db.sh
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKUP_DIR="$HOME/Library/Mobile Documents/com~apple~CloudDocs/GastorinBackups"
RETENCION_DIAS=30

if [ -z "${SUPABASE_DB_PASSWORD:-}" ]; then
  echo "Error: falta la variable de entorno SUPABASE_DB_PASSWORD." >&2
  echo "Expórtala antes de correr este script (no la escribas aquí dentro)." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

FECHA="$(date +%Y-%m-%d_%H%M%S)"
ARCHIVO="$BACKUP_DIR/gastorin_backup_${FECHA}.sql"

cd "$PROJECT_DIR"

echo "Iniciando backup de Gastorin -> $ARCHIVO"
npx supabase db dump --linked --password "$SUPABASE_DB_PASSWORD" -f "$ARCHIVO"

if [ ! -s "$ARCHIVO" ]; then
  echo "Error: el archivo de backup quedó vacío. Revisa la conexión/contraseña." >&2
  exit 1
fi

echo "Backup completado: $ARCHIVO ($(du -h "$ARCHIVO" | cut -f1))"

# Rotación: conserva solo los últimos RETENCION_DIAS días de backups.
find "$BACKUP_DIR" -name "gastorin_backup_*.sql" -mtime +"$RETENCION_DIAS" -delete
echo "Rotación aplicada: se conservan los backups de los últimos ${RETENCION_DIAS} días."
