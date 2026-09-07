#!/usr/bin/env bash
set -Eeuo pipefail

script_dir=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
export PATH="/opt/node-v22.23.1/bin:$PATH"

exec bash "$script_dir/install-and-start.sh" --skip-nginx "$@"
