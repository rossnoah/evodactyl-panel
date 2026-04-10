#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "╔══════════════════════════════════════════════════╗"
echo "║     Pterodactyl Mirror Test Harness              ║"
echo "╚══════════════════════════════════════════════════╝"

# Clean up from any previous run
echo ""
echo "==> Cleaning up previous containers..."
podman compose -f docker-compose.mirror.yml down -v 2>/dev/null || true

# Start all services
echo ""
echo "==> Starting services..."
podman compose -f docker-compose.mirror.yml up -d

# Wait for MySQL instances to be healthy
echo ""
echo "==> Waiting for databases..."

# Get the mapped ports
PHP_DB_PORT=$(podman compose -f docker-compose.mirror.yml port mysql-php 3306 2>/dev/null | cut -d: -f2)
TS_DB_PORT=$(podman compose -f docker-compose.mirror.yml port mysql-ts 3306 2>/dev/null | cut -d: -f2)

# If port mapping didn't work, use defaults
PHP_DB_PORT=${PHP_DB_PORT:-13306}
TS_DB_PORT=${TS_DB_PORT:-13307}

echo "  PHP MySQL port: $PHP_DB_PORT"
echo "  TS MySQL port: $TS_DB_PORT"

# Wait for both MySQL instances
for label in "PHP:$PHP_DB_PORT" "TS:$TS_DB_PORT"; do
  name="${label%%:*}"
  port="${label##*:}"
  for i in $(seq 1 60); do
    if mysql -h 127.0.0.1 -P "$port" -u root -psecret --skip-ssl -e "SELECT 1" 2>/dev/null | grep -q 1; then
      echo "  $name MySQL ready"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "  ✗ $name MySQL failed to start"
      podman compose -f docker-compose.mirror.yml logs "mysql-$(echo $name | tr '[:upper:]' '[:lower:]')" 2>&1 | tail -5
      exit 1
    fi
    sleep 2
  done
done

# Seed both databases
echo ""
echo "==> Seeding databases..."
cd "$SCRIPT_DIR/../.."
bun run tests/mirror/seed.ts --php-db-port="$PHP_DB_PORT" --ts-db-port="$TS_DB_PORT"
cd "$SCRIPT_DIR"

# Wait for panel services
echo ""
echo "==> Waiting for panel services..."

PHP_URL="http://localhost:8080"
TS_URL="http://localhost:3000"

for label in "PHP:$PHP_URL" "TS:$TS_URL"; do
  name="${label%%:*}"
  url="${label##*:}"
  for i in $(seq 1 60); do
    httpcode=$(curl -s -o /dev/null -w "%{http_code}" "$url/" 2>/dev/null)
    if [ "$httpcode" = "200" ] || [ "$httpcode" = "302" ] || [ "$httpcode" = "401" ]; then
      echo "  $name panel ready (HTTP $httpcode)"
      break
    fi
    if [ "$i" -eq 60 ]; then
      echo "  ✗ $name panel failed to start (last HTTP: $httpcode)"
      exit 1
    fi
    sleep 3
  done
done

# Run the mirror tests
echo ""
echo "==> Running mirror tests..."
cd "$SCRIPT_DIR/../.."
bun run tests/mirror/runner.ts \
  --php-url="$PHP_URL" \
  --ts-url="$TS_URL" \
  --php-db-port="$PHP_DB_PORT" \
  --ts-db-port="$TS_DB_PORT"
EXIT_CODE=$?
cd "$SCRIPT_DIR"

# Tear down
echo ""
echo "==> Tearing down..."
podman compose -f docker-compose.mirror.yml down -v 2>/dev/null || true

exit $EXIT_CODE
