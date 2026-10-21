#!/usr/bin/env bash
# Actualiza el código, vuelve a compilar y reinicia el servicio.
#   sudo bash deploy/update.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta el script con sudo: sudo bash deploy/update.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ ! -f /etc/systemd/system/kanban.service ]]; then
  echo "El servicio todavía no está instalado. Ejecuta primero: sudo bash deploy/install.sh" >&2
  exit 1
fi

NODE_BIN="$(awk -F= '/^ExecStart=/{print $2}' /etc/systemd/system/kanban.service | awk '{print $1}')"
NPM_BIN="$(dirname "$NODE_BIN")/npm"
if [[ ! -x "$NODE_BIN" || ! -x "$NPM_BIN" ]]; then
  echo "No se encontró el Node usado por el servicio (${NODE_BIN})." >&2
  exit 1
fi

git pull
chown -R kanban:kanban "$ROOT"
chmod 600 "$ROOT/.env"
sudo -u kanban env PATH="$(dirname "$NODE_BIN"):/usr/bin:/bin" "$NPM_BIN" ci
sudo -u kanban env PATH="$(dirname "$NODE_BIN"):/usr/bin:/bin" "$NPM_BIN" run build
systemctl restart kanban
systemctl --no-pager --full status kanban
