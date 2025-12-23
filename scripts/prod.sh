#!/bin/bash
# Start the production server with Gunicorn

set -e

echo "Starting Town Builder production server..."
echo "Server will be available at http://127.0.0.1:5000/"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found!"
    echo "Copy .env.example to .env and configure it for production."
    exit 1
fi

# Check for production security settings
if grep -q "DISABLE_JWT_AUTH=true" .env 2>/dev/null; then
    echo "⚠️  WARNING: JWT authentication is disabled!"
    echo "This is only safe when using an authentication proxy."
    echo ""
fi

if grep -q "JWT_SECRET_KEY=your_secure_random_string_here" .env 2>/dev/null; then
    echo "❌ ERROR: JWT_SECRET_KEY is still set to default!"
    echo "Generate a secure key with: openssl rand -hex 32"
    exit 1
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Error: Redis is not running!"
    echo "Start Redis with: redis-server"
    exit 1
fi

# Check if gunicorn is installed
if ! command -v gunicorn &> /dev/null; then
    echo "❌ Error: Gunicorn not found!"
    echo "Install with: pip install gunicorn gevent"
    exit 1
fi

echo "✓ Prerequisites checked"
echo ""

# Start the production server
echo "Starting Gunicorn with gevent workers..."
exec gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app.main:app
