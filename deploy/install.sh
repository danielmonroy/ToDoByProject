#!/usr/bin/env bash
# Instala la app como un servicio de systemd. No usa Docker.
# Ejecutar en el servidor, desde cualquier carpeta:
#   sudo bash deploy/install.sh

set -euo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Ejecuta el script con sudo: sudo bash deploy/install.sh" >&2
  exit 1
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
APP_USER="daniel"
NODE_PREFIX="/opt/nodejs"

node_is_new_enough() {
  command -v node >/dev/null 2>&1 || return 1
  node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 18)) process.exit(1)'
}

install_node() {
  if node_is_new_enough; then
    command -v node
    return
  fi

  local arch archive
  case "$(uname -m)" in
    x86_64) arch="linux-x64" ;;
    aarch64) arch="linux-arm64" ;;
    *)
      echo "Arquitectura no soportada: $(uname -m). Hace falta Node.js 22.18 o posterior en el PATH." >&2
      exit 1
      ;;
  esac

  apt-get update >&2
  apt-get install -y ca-certificates curl xz-utils >&2
  archive="$(curl -fsSL "https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt" | awk -v arch="$arch" '$2 ~ "^node-v22[.].*-" arch "[.]tar[.]xz$" { print $2; exit }')"
  if [[ -z "$archive" ]]; then
    echo "No se encontró el paquete de Node.js 22 para ${arch}." >&2
    exit 1
  fi

  curl -fsSL "https://nodejs.org/dist/latest-v22.x/${archive}" -o "/tmp/${archive}"
  rm -rf "$NODE_PREFIX"
  mkdir -p "$NODE_PREFIX"
  tar -xJf "/tmp/${archive}" -C "$NODE_PREFIX" --strip-components=1
  rm -f "/tmp/${archive}"
  echo "${NODE_PREFIX}/bin/node"
}

if ! id "$APP_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --home-dir "$ROOT" --shell /usr/sbin/nologin "$APP_USER"
fi

if [[ ! -f "$ROOT/.env" ]]; then
  cp "$ROOT/.env.example" "$ROOT/.env"
  chown "$APP_USER:$APP_USER" "$ROOT/.env"
  chmod 600 "$ROOT/.env"
  echo "Se creó $ROOT/.env con valores de ejemplo."
  echo "Cambia APP_PASSWORD y SESSION_SECRET, y vuelve a ejecutar: sudo bash deploy/install.sh"
  exit 1
fi

if grep -Eq '^APP_PASSWORD=cambia-esta-clave[[:space:]]*$' "$ROOT/.env" \
  || grep -Eq '^SESSION_SECRET=cambia-este-secreto-largo[[:space:]]*$' "$ROOT/.env"; then
  echo "Cambia APP_PASSWORD y SESSION_SECRET en $ROOT/.env antes de arrancar." >&2
  echo "Puedes generar el secreto con: openssl rand -base64 32" >&2
  exit 1
fi

NODE_BIN="$(install_node)"
NPM_BIN="$(dirname "$NODE_BIN")/npm"
if [[ ! -x "$NODE_BIN" || ! -x "$NPM_BIN" ]]; then
  echo "No se encontró node y npm junto a $NODE_BIN." >&2
  exit 1
fi

mkdir -p "$ROOT/data"
chown -R "$APP_USER:$APP_USER" "$ROOT"
chmod 600 "$ROOT/.env"

sudo -u "$APP_USER" env PATH="$(dirname "$NODE_BIN"):/usr/bin:/bin" "$NPM_BIN" ci
sudo -u "$APP_USER" env PATH="$(dirname "$NODE_BIN"):/usr/bin:/bin" "$NPM_BIN" run build

sed "s|^ExecStart=.*|ExecStart=${NODE_BIN} server/index.ts|" "$ROOT/deploy/kanban.service" > /etc/systemd/system/kanban.service
sed -i "s|^WorkingDirectory=.*|WorkingDirectory=${ROOT}|" /etc/systemd/system/kanban.service
sed -i "s|^EnvironmentFile=.*|EnvironmentFile=${ROOT}/.env|" /etc/systemd/system/kanban.service

systemctl daemon-reload
systemctl enable --now kanban
systemctl --no-pager --full status kanban
echo "La app está en marcha. Revisa los logs con: journalctl -u kanban -f"
