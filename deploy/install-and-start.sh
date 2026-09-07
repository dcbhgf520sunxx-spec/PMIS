#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
repo_dir=$(cd "$script_dir/.." && pwd)

app_root=${SIDM_APP_ROOT:-/opt/pmis}
run_user=${SIDM_RUN_USER:-pmis}
service_name=${SIDM_SERVICE_NAME:-pmis-backend}
shared_env="$app_root/shared/backend.env"
provided_env=
server_name=${SIDM_SERVER_NAME:-_}
nginx_conf=${SIDM_NGINX_CONF:-/etc/nginx/conf.d/sidm.conf}
configure_nginx=1

usage() {
  cat <<'EOF'
SIDM Linux 一键构建与启动

用法：
  sudo bash deploy/install-and-start.sh [选项]

选项：
  --env-file <文件>       首次部署使用的后端环境文件；默认读取 backend/.env
  --server-name <域名>    Nginx server_name；默认使用 _ 接受当前服务器地址
  --skip-nginx            保留服务器现有 Nginx 配置，不安装仓库模板
  --print-nginx-config <安装根目录> <域名>  只预览将生成的 Nginx 配置
  --help                  显示帮助

可选环境变量：SIDM_APP_ROOT、SIDM_RUN_USER、SIDM_SERVICE_NAME、
SIDM_SERVER_NAME、SIDM_NGINX_CONF、SIDM_POSTGRES_SERVICE、
SIDM_PSQL_BIN、SIDM_PG_DUMP_BIN。

前提：Linux 已安装 Node.js >= 22.18、PostgreSQL 16、Nginx 和 systemd，
并已创建 backend/.env（或通过 --env-file 指定）。数据库本身及访问账号需已创建。
EOF
}

version_ge() {
  local actual=${1#v} required=${2#v}
  local a_major=0 a_minor=0 a_patch=0 r_major=0 r_minor=0 r_patch=0
  IFS=. read -r a_major a_minor a_patch <<< "${actual%%-*}"
  IFS=. read -r r_major r_minor r_patch <<< "${required%%-*}"
  a_major=${a_major:-0}; a_minor=${a_minor:-0}; a_patch=${a_patch:-0}
  r_major=${r_major:-0}; r_minor=${r_minor:-0}; r_patch=${r_patch:-0}
  (( a_major > r_major )) ||
    (( a_major == r_major && a_minor > r_minor )) ||
    (( a_major == r_major && a_minor == r_minor && a_patch >= r_patch ))
}

die() {
  echo "错误：$*" >&2
  exit 1
}

find_binary() {
  local override=$1 name=$2 common_path=$3
  if [[ -n "$override" && -x "$override" ]]; then
    printf '%s\n' "$override"
  elif command -v "$name" >/dev/null 2>&1; then
    command -v "$name"
  elif [[ -x "$common_path" ]]; then
    printf '%s\n' "$common_path"
  else
    return 1
  fi
}

render_nginx_config() {
  local target_root=$1 target_server_name=$2
  sed \
    -e "s#/path/to/PMIS/frontend/dist#$target_root/current/frontend/dist#" \
    -e "s/server_name your-domain.com;/server_name $target_server_name;/" \
    -e 's/PMIS/SIDM/g' \
    "$script_dir/nginx.conf"
}

if [[ ${1:-} == --check-node-version ]]; then
  version_ge "${2:-0}" 22.18.0
  exit $?
fi

if [[ ${1:-} == --print-nginx-config ]]; then
  [[ $# -eq 3 ]] || die '--print-nginx-config 需要安装根目录和域名'
  [[ $2 == /* ]] || die '安装根目录必须是绝对路径'
  [[ $3 =~ ^[A-Za-z0-9._*-]+$ ]] || die '域名格式不正确'
  render_nginx_config "$2" "$3"
  exit 0
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || die '--env-file 缺少文件路径'
      provided_env=$2
      shift 2
      ;;
    --server-name)
      [[ $# -ge 2 ]] || die '--server-name 缺少域名或 IP'
      server_name=$2
      shift 2
      ;;
    --skip-nginx)
      configure_nginx=0
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      die "未知选项：$1"
      ;;
  esac
done

[[ $(uname -s) == Linux ]] || die '该脚本只支持 Linux'
[[ ${EUID:-$(id -u)} -eq 0 ]] || die '请使用 sudo 或 root 执行'
[[ "$server_name" =~ ^[A-Za-z0-9._*-]+$ ]] || die 'server_name 只能包含域名、IP、下划线、星号和连字符'

for command_name in node npm tar curl systemctl runuser install; do
  command -v "$command_name" >/dev/null 2>&1 || die "缺少命令：$command_name"
done

node_version=$(node --version)
version_ge "$node_version" 22.18.0 || die "Node.js 版本过低：$node_version，需要 >= 22.18"
node_bin=$(command -v node)
psql_bin=$(find_binary "${SIDM_PSQL_BIN:-}" psql /opt/postgresql-16/bin/psql) || die '找不到 PostgreSQL psql'
pg_dump_bin=$(find_binary "${SIDM_PG_DUMP_BIN:-}" pg_dump /opt/postgresql-16/bin/pg_dump) || die '找不到 PostgreSQL pg_dump'
postgres_version=$($psql_bin --version)
[[ "$postgres_version" =~ ([0-9]+)\.([0-9]+) ]] || die "无法识别 PostgreSQL 版本：$postgres_version"
postgres_major=${BASH_REMATCH[1]}
(( postgres_major >= 16 )) || die "PostgreSQL 版本过低：$postgres_version，需要 >= 16"

if ! id "$run_user" >/dev/null 2>&1; then
  command -v useradd >/dev/null 2>&1 || die "系统不存在用户 $run_user，且缺少 useradd"
  nologin_shell=$(command -v nologin || printf '/bin/false')
  useradd --system --home-dir "$app_root/shared" --shell "$nologin_shell" "$run_user"
fi
run_group=$(id -gn "$run_user")

install -d -m 755 "$app_root" "$app_root/releases" "$app_root/shared"
install -d -o "$run_user" -g "$run_group" -m 755 \
  "$app_root/shared/uploads" \
  "$app_root/shared/private-uploads" \
  "$app_root/shared/private-uploads/project-contracts" \
  "$app_root/shared/private-uploads/project-plan-deliveries"

if [[ ! -f "$shared_env" ]]; then
  env_source=${provided_env:-$repo_dir/backend/.env}
  [[ -f "$env_source" ]] || die "未找到环境文件：$env_source；请先配置 backend/.env 或使用 --env-file"
  install -m 600 -o root -g root "$env_source" "$shared_env"
fi
chmod 600 "$shared_env"

set -a
# shellcheck disable=SC1090
. "$shared_env"
set +a
for variable_name in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME JWT_SECRET; do
  [[ -n ${!variable_name:-} ]] || die "环境文件缺少 $variable_name"
done

postgres_service=${SIDM_POSTGRES_SERVICE:-}
if [[ "$DB_HOST" == localhost || "$DB_HOST" == 127.0.0.1 || "$DB_HOST" == ::1 ]]; then
  if [[ -z "$postgres_service" ]]; then
    for candidate in postgresql-16 postgresql; do
      if systemctl cat "$candidate.service" >/dev/null 2>&1; then
        postgres_service=$candidate
        break
      fi
    done
  fi
  if [[ -n "$postgres_service" ]]; then
    systemctl enable --now "$postgres_service"
  fi
fi

commit_id=$(git -C "$repo_dir" rev-parse --short=8 HEAD 2>/dev/null || printf 'source')
release_name="${commit_id}-$(date +%Y%m%d_%H%M%S)"
release_dir="$app_root/releases/$release_name"
install -d -o "$run_user" -g "$run_group" -m 755 "$release_dir"

tar \
  --exclude='./.git' \
  --exclude='./artifacts' \
  --exclude='./tmp' \
  --exclude='./backend/.env' \
  --exclude='node_modules' \
  --exclude='dist' \
  -C "$repo_dir" -cf - . | tar -C "$release_dir" -xf -
chown -R "$run_user:$run_group" "$release_dir"

runuser -u "$run_user" -- env PATH="$(dirname "$node_bin"):$PATH" \
  npm --prefix "$release_dir/backend" ci --omit=dev --no-audit --no-fund
runuser -u "$run_user" -- env PATH="$(dirname "$node_bin"):$PATH" \
  npm --prefix "$release_dir/frontend" ci --no-audit --no-fund
runuser -u "$run_user" -- env PATH="$(dirname "$node_bin"):$PATH" \
  npm --prefix "$release_dir/frontend" run build
[[ -f "$release_dir/frontend/dist/index.html" ]] || die '前端构建产物不存在'

export PGPASSWORD=$DB_PASSWORD
psql_args=(--host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" --no-password)
schema_exists=$($psql_bin "${psql_args[@]}" --tuples-only --no-align \
  --command="SELECT to_regclass('public.pms_user') IS NOT NULL")

if [[ "$schema_exists" == t ]]; then
  backup_dir=${SIDM_BACKUP_DIR:-/opt/backups/pmis-postgresql}
  install -d -m 700 "$backup_dir"
  backup_file="$backup_dir/sidm_$(date +%Y%m%d_%H%M%S).dump"
  "$pg_dump_bin" "${psql_args[@]}" --format=custom --file="$backup_file"
  echo "数据库备份完成：$backup_file"
  npm --prefix "$release_dir/backend" run db:migrate -- --check
  npm --prefix "$release_dir/backend" run db:migrate -- --apply --user-approved
else
  "$psql_bin" "${psql_args[@]}" --set=ON_ERROR_STOP=1 --file="$release_dir/backend/db/init/001_schema.sql"
  npm --prefix "$release_dir/backend" run db:migrate -- --baseline
  echo '数据库初始化及迁移基线完成'
fi
unset PGPASSWORD

old_release=
if [[ -L "$app_root/current" ]]; then
  old_release=$(readlink -f "$app_root/current")
  "$release_dir/deploy/retain-previous-frontend-assets.sh" \
    "$old_release/frontend/dist" "$release_dir/frontend/dist"
fi
chmod 755 "$release_dir"

service_file="/etc/systemd/system/$service_name.service"
cat > "$service_file" <<EOF
[Unit]
Description=SIDM backend
After=network.target

[Service]
Type=simple
User=$run_user
Group=$run_group
WorkingDirectory=$app_root/current/backend
Environment=NODE_ENV=production
Environment=PMIS_PRIVATE_UPLOAD_ROOT=$app_root/shared/private-uploads
EnvironmentFile=$shared_env
ExecStart=$node_bin $app_root/current/backend/src/server.js
Restart=always
RestartSec=3
TimeoutStopSec=15
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
EOF
chmod 644 "$service_file"

rollback_release() {
  if [[ -n "$old_release" ]]; then
    ln -sfn "$old_release" "$app_root/current"
    systemctl restart "$service_name" || true
  else
    systemctl stop "$service_name" || true
    [[ ! -L "$app_root/current" ]] || unlink "$app_root/current"
  fi
}

ln -sfn "$release_dir" "$app_root/current"
systemctl daemon-reload
systemctl enable "$service_name" >/dev/null
if ! systemctl restart "$service_name"; then
  rollback_release
  die '后端启动失败，已恢复上一版本'
fi

health_url="http://127.0.0.1:${PORT:-3103}/api/health"
health_ok=0
for _ in {1..30}; do
  if curl --fail --silent "$health_url" >/dev/null; then
    health_ok=1
    break
  fi
  sleep 1
done
if [[ $health_ok -ne 1 ]]; then
  journalctl -u "$service_name" -n 50 --no-pager >&2 || true
  rollback_release
  die '后端健康检查失败，已恢复上一版本'
fi

if [[ $configure_nginx -eq 1 ]]; then
  command -v nginx >/dev/null 2>&1 || die '缺少命令：nginx'
  install -d -m 755 "$(dirname "$nginx_conf")"
  nginx_backup=
  if [[ -f "$nginx_conf" ]]; then
    nginx_backup="$nginx_conf.bak.$(date +%Y%m%d_%H%M%S)"
    cp -p "$nginx_conf" "$nginx_backup"
  fi
  render_nginx_config "$app_root" "$server_name" > "$nginx_conf"
  if ! nginx -t; then
    if [[ -n "$nginx_backup" ]]; then cp -p "$nginx_backup" "$nginx_conf"; else unlink "$nginx_conf"; fi
    rollback_release
    die 'Nginx 配置检查失败，已恢复原配置和上一版本'
  fi
  if systemctl is-active nginx >/dev/null 2>&1; then
    nginx_action=(reload nginx)
  else
    nginx_action=(enable --now nginx)
  fi
  if ! systemctl "${nginx_action[@]}"; then
    if [[ -n "$nginx_backup" ]]; then cp -p "$nginx_backup" "$nginx_conf"; else unlink "$nginx_conf"; fi
    rollback_release
    die 'Nginx 启动或重载失败，已恢复原配置和上一版本'
  fi
fi

echo
echo "SIDM 已启动"
echo "发布目录：$release_dir"
echo "后端健康检查：$health_url"
if [[ $configure_nginx -eq 1 ]]; then
  echo "访问地址：http://$server_name/"
else
  echo 'Nginx 保持原配置，请使用现有域名访问。'
fi
