#!/usr/bin/env bash

set -euo pipefail

if [ "$#" -ne 2 ]; then
  echo "用法: $0 <上一版本dist目录> <新版本dist目录>" >&2
  exit 2
fi

previous_dist=$1
next_dist=$2
previous_assets="$previous_dist/assets"
next_assets="$next_dist/assets"
previous_marker="$previous_dist/.pmis-retained-assets"
next_marker="$next_dist/.pmis-retained-assets"

if [ ! -d "$next_assets" ]; then
  echo "新版本静态资源目录不存在: $next_assets" >&2
  exit 1
fi

if [ ! -d "$previous_assets" ]; then
  exit 0
fi

touch "$next_marker"

while IFS= read -r -d '' source_file; do
  relative_path=${source_file#"$previous_assets/"}
  file_name=${relative_path##*/}
  if [[ "$file_name" == ._* ]]; then
    continue
  fi
  if [ -f "$previous_marker" ] && grep -Fqx -- "$relative_path" "$previous_marker"; then
    continue
  fi

  target_file="$next_assets/$relative_path"
  if [ -e "$target_file" ]; then
    continue
  fi

  mkdir -p "${target_file%/*}"
  cp -p "$source_file" "$target_file"
  printf '%s\n' "$relative_path" >> "$next_marker"
done < <(find "$previous_assets" -type f -print0)
