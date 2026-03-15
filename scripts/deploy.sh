#!/bin/sh

set -eu

APP_DIR="${APP_DIR:-$(pwd)}"

cd "$APP_DIR"

if [ ! -f .env ]; then
  echo ".env file is missing in $APP_DIR"
  exit 1
fi

docker compose --profile prod build mcp-server mcp-server-migrate
docker compose --profile prod run --rm mcp-server-migrate
docker compose --profile prod up -d mcp-server