#!/bin/ash
set -e
cd /app

# Set up .env symlink
if [ ! -f /app/var/.env ]; then
  mkdir -p /app/var
  echo "APP_KEY=${APP_KEY}" > /app/var/.env
  echo "HASHIDS_SALT=${HASHIDS_SALT}" >> /app/var/.env
fi

if [ ! -L /app/.env ]; then
  rm -rf /app/.env
  ln -s /app/var/.env /app/
fi

# Set up nginx config
if [ ! -f /etc/nginx/http.d/panel.conf ]; then
  cp .github/docker/default.conf /etc/nginx/http.d/panel.conf
  rm -rf /etc/nginx/http.d/default.conf
fi

# Create required directories
mkdir -p /var/log/panel/logs/ /var/log/supervisord/ /var/log/nginx/ /var/run/php /var/run/nginx
chmod 777 /var/log/panel/logs/
ln -sf /app/storage/logs/ /var/log/panel/ 2>/dev/null || true

# Fix permissions
chown -R nginx:nginx /app/storage/logs/ 2>/dev/null || true

# Wait for DB using PHP PDO (avoids mysql CLI SSL issues)
echo "Waiting for database..."
php -r "
\$host = getenv('DB_HOST') ?: 'mysql-php';
\$port = getenv('DB_PORT') ?: '3306';
\$pass = getenv('DB_PASSWORD') ?: 'secret';
\$retries = 60;
while (\$retries--) {
  try {
    new PDO(\"mysql:host=\$host;port=\$port\", 'root', \$pass);
    echo \"Database connected!\\n\";
    exit(0);
  } catch (Exception \$e) {
    echo \"Waiting for DB... (\$retries remaining)\\n\";
    sleep(2);
  }
}
echo \"Failed to connect to database\\n\";
exit(1);
"

# Run migrations and seed
echo "Running migrations..."
php artisan migrate --seed --force 2>&1 || {
  echo "Migration with seed failed, trying without seed..."
  # If the schema dump load fails (SSL), the seed script will handle it
  echo "Skipping artisan migrate — seed script will handle schema loading"
}

# Start cron
echo "Starting cron..."
crond -L /var/log/crond -l 5 2>/dev/null || true

echo "Starting supervisord..."
exec "$@"
