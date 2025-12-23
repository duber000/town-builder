#!/bin/bash
# Start the development server with auto-reload

set -e

echo "Starting Town Builder development server..."
echo "Server will be available at http://127.0.0.1:5001/"
echo ""

# Check if .env exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found!"
    echo "Creating .env from .env.example..."
    cp .env.example .env
    echo "✓ Created .env file. Please review and update it with your configuration."
    echo ""
fi

# Check if Redis is running
if ! redis-cli ping > /dev/null 2>&1; then
    echo "⚠️  Warning: Redis is not running!"
    echo "Multiplayer features will not work without Redis."
    echo "Start Redis with: redis-server"
    echo ""
fi

# Start the development server
exec uv run uvicorn app.main:app --reload --port 5001
