#!/bin/bash
# Health check script for Town Builder

set -e

echo "Town Builder - Health Check"
echo "=========================="
echo ""

# Check if server is running
echo "Checking if server is running..."
if curl -s http://127.0.0.1:5001/readyz > /dev/null 2>&1; then
    echo "✓ Server is running at http://127.0.0.1:5001/"

    # Get health status
    HEALTH=$(curl -s http://127.0.0.1:5001/readyz)
    echo "  Health status: $HEALTH"
else
    echo "❌ Server is not running at http://127.0.0.1:5001/"
    echo "   Start the server with: ./scripts/dev.sh"
fi
echo ""

# Check Redis
echo "Checking Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis is running and responsive"

    # Check Redis info
    REDIS_VERSION=$(redis-cli info server | grep "redis_version" | cut -d: -f2 | tr -d '\r')
    REDIS_CLIENTS=$(redis-cli info clients | grep "connected_clients" | cut -d: -f2 | tr -d '\r')
    echo "  Version: $REDIS_VERSION"
    echo "  Connected clients: $REDIS_CLIENTS"
else
    echo "❌ Redis is not running"
    echo "   Start Redis with: redis-server"
fi
echo ""

# Check data directory
echo "Checking data directory..."
if [ -d "data/towns" ]; then
    TOWN_COUNT=$(ls -1 data/towns/*.json 2>/dev/null | wc -l)
    echo "✓ Data directory exists"
    echo "  Saved towns: $TOWN_COUNT"
else
    echo "⚠️  Data directory not found"
    echo "   Creating data/towns directory..."
    mkdir -p data/towns
    echo "✓ Created data directory"
fi
echo ""

# Check environment
echo "Checking environment configuration..."
if [ -f .env ]; then
    echo "✓ .env file exists"

    # Check critical settings
    if grep -q "JWT_SECRET_KEY=your_secure_random_string_here" .env 2>/dev/null; then
        echo "⚠️  WARNING: JWT_SECRET_KEY is still set to default!"
        echo "   Generate a secure key: openssl rand -hex 32"
    fi

    if grep -q "DISABLE_JWT_AUTH=true" .env 2>/dev/null; then
        echo "⚠️  JWT authentication is disabled (development mode)"
    fi
else
    echo "❌ .env file not found"
    echo "   Copy from template: cp .env.example .env"
fi
echo ""

echo "=========================="
echo "Health check complete"
