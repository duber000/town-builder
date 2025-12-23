# Town Builder Scripts

This directory contains helper scripts for common development and deployment tasks.

## Available Scripts

### `setup.sh`
**Initial project setup**

Sets up the development environment by checking prerequisites, installing dependencies, and creating configuration files.

```bash
./scripts/setup.sh
```

What it does:
- Checks Python and Go versions
- Checks Redis installation
- Installs Python dependencies (using uv or pip)
- Creates .env file from template
- Creates data directory

### `dev.sh`
**Start development server**

Starts the FastAPI development server with auto-reload on port 5001.

```bash
./scripts/dev.sh
```

Features:
- Auto-creates .env if missing
- Checks for Redis connection
- Starts uvicorn with --reload flag
- Accessible at http://127.0.0.1:5001/

### `prod.sh`
**Start production server**

Starts the production server using Gunicorn with gevent workers on port 5000.

```bash
./scripts/prod.sh
```

Safety checks:
- Verifies .env exists
- Checks JWT_SECRET_KEY is not default
- Warns if JWT auth is disabled
- Ensures Redis is running
- Verifies Gunicorn is installed

### `check-health.sh`
**System health check**

Checks the health of all Town Builder components.

```bash
./scripts/check-health.sh
```

Checks:
- Server status and /readyz endpoint
- Redis connection and info
- Data directory and saved towns count
- Environment configuration
- Security warnings for production

### `clean.sh`
**Clean build artifacts**

Removes generated files and caches.

```bash
./scripts/clean.sh
```

Cleans:
- Python cache files (__pycache__, *.pyc)
- Build artifacts (build/, dist/)
- Optional: WASM builds (commented out)
- Optional: Saved towns (commented out, requires confirmation)

## Making Scripts Executable

Before first use, make the scripts executable:

```bash
chmod +x scripts/*.sh
```

## Usage Examples

### First-time setup
```bash
# Make scripts executable
chmod +x scripts/*.sh

# Run setup
./scripts/setup.sh

# Edit configuration
nano .env

# Start Redis
redis-server &

# Start development server
./scripts/dev.sh
```

### Daily development
```bash
# Check health
./scripts/check-health.sh

# Start development server
./scripts/dev.sh

# In another terminal, watch logs
tail -f *.log
```

### Production deployment
```bash
# Verify configuration
cat .env

# Check health
./scripts/check-health.sh

# Start production server
./scripts/prod.sh
```

### Maintenance
```bash
# Clean cache files
./scripts/clean.sh

# Rebuild WASM (if Go code changed)
./build_wasm.sh

# Check system health
./scripts/check-health.sh
```

## Integration with Claude Code

These scripts are also available as slash commands in Claude Code:

- `/dev` - Equivalent to `./scripts/dev.sh`
- `/prod` - Equivalent to `./scripts/prod.sh`
- `/check-deps` - Similar to `./scripts/check-health.sh`

See `.claude/commands/` for more Claude Code slash commands.

## Notes

- All scripts use `set -e` to exit on first error
- Scripts check for common issues before starting
- Production scripts have additional security checks
- Health check script provides detailed diagnostics

## Troubleshooting

**Permission denied error:**
```bash
chmod +x scripts/*.sh
```

**Redis connection failed:**
```bash
redis-server &
```

**Port already in use:**
```bash
# Check what's using the port
lsof -i :5001
# or
lsof -i :5000

# Kill the process
kill -9 <PID>
```

**Missing dependencies:**
```bash
# Re-run setup
./scripts/setup.sh

# Or manually install
uv sync
```
