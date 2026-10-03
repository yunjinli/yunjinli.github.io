#!/usr/bin/env bash
set -euo pipefail

LYCHEE_INSTALL_DIR="${RUNNER_TEMP:?RUNNER_TEMP must be set}/portfolio-lychee"
LYCHEE_ARCHIVE="$LYCHEE_INSTALL_DIR/lychee.tar.gz"
LYCHEE_URL="https://github.com/lycheeverse/lychee/releases/download/lychee-v0.24.2/lychee-x86_64-unknown-linux-gnu.tar.gz"
LYCHEE_SHA256="1f4e0ef7f6554a6ed33dd7ac144fb2e1bbed98598e7af973042fc5cd43951c9a"

mkdir -p "$LYCHEE_INSTALL_DIR"
# Retry transient release-download failures rather than failing a valid build.
curl --fail --silent --show-error --location \
  --retry 5 --retry-all-errors --retry-delay 2 --retry-max-time 120 \
  --connect-timeout 10 --max-time 60 \
  "$LYCHEE_URL" --output "$LYCHEE_ARCHIVE"
printf '%s  %s\n' "$LYCHEE_SHA256" "$LYCHEE_ARCHIVE" | sha256sum --check -
tar -xzf "$LYCHEE_ARCHIVE" -C "$LYCHEE_INSTALL_DIR"
install -m 755 "$LYCHEE_INSTALL_DIR/lychee-x86_64-unknown-linux-gnu/lychee" "$LYCHEE_INSTALL_DIR/lychee"
printf '%s\n' "$LYCHEE_INSTALL_DIR" >> "${GITHUB_PATH:?GITHUB_PATH must be set}"
"$LYCHEE_INSTALL_DIR/lychee" --version
