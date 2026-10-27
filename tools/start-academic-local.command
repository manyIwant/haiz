#!/bin/zsh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG="$HOME/.config/haiz-academic"
FILE="$CONFIG/local.env"
umask 077
mkdir -p "$CONFIG"
chmod 700 "$CONFIG"
if [[ ! -f "$FILE" ]]; then
  PASSWORD="$(openssl rand -hex 20)"
  printf 'export HAIZ_ADMIN_LOGIN="haizadmin"\nexport HAIZ_ADMIN_PASSWORD="%s"\nexport HAIZ_PORT="8780"\n' "$PASSWORD" > "$FILE"
  chmod 600 "$FILE"
  echo "本地管理员凭据已生成：$FILE（仅本人可读，不要上传）"
fi
source "$FILE"
echo "HAIZ Academic: http://127.0.0.1:8780/"
echo "按 Ctrl+C 结束。本服务仅供本机虚构数据演示，不是学校正式服务。"
exec node "$ROOT/services/academic/server.mjs"
