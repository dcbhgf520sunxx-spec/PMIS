#!/usr/bin/env bash
set -euo pipefail

backup_dir=/opt/backups/pmis-postgresql
timestamp=$(date +%Y%m%d_%H%M%S)
umask 077
mkdir -p "$backup_dir"

/opt/postgresql-16/bin/pg_dump \
  --host=127.0.0.1 \
  --port=5433 \
  --username=pms_backup \
  --format=custom \
  --file="$backup_dir/pmis_${timestamp}.dump" \
  pmis

find "$backup_dir" -type f -name 'pmis_*.dump' -mtime +7 -delete
