# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Town Builder is a web-based 3D town building application with real-time multiplayer collaboration. It combines a Python/FastAPI backend with a Three.js frontend and Go WebAssembly for high-performance physics.

## Development Commands

### Setup and Installation
```bash
# Initial setup (checks dependencies, creates .env, installs packages)
./scripts/setup.sh

# Install dependencies manually
uv sync  # Preferred method
# or
pip install -e .

# Make scripts executable if needed
chmod +x scripts/*.sh
```

### Running the Application
```bash
# Development mode (port 5001, auto-reload enabled)
./scripts/dev.sh
# or
uv run uvicorn app.main:app --reload --port 5001

# Production mode (port 5000, Gunicorn with gevent workers)
./scripts/prod.sh
```

### Building WebAssembly Modules
```bash
# Rebuild Go WASM physics module (required after modifying physics_wasm.go)
./build_wasm.sh

# Manual WASM build
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/physics.wasm physics_wasm.go
```

### Health Checks and Maintenance
```bash
# Check system health (server, Redis, data directory, configuration)
./scripts/check-health.sh

# Clean build artifacts and caches
./scripts/clean.sh
```

### Redis Operations
```bash
# Start Redis (required for multiplayer)
redis-server

# Check Redis connection
redis-cli ping
```

## Architecture

### Backend (Python/FastAPI)

**Entry Point**: `app/main.py`
- Registers all route modules
- Configures CORS middleware based on `.env` settings
- Mounts static files with custom MIME type handlers for WASM/JS

**Configuration**: `app/config.py`
- Uses Pydantic Settings for environment variable management
- Validates JWT configuration on startup
- Provides paths to models, static files, templates, and data directories

**Routes** (`app/routes/`):
- `ui.py` - Serves HTML templates
- `auth.py` - JWT authentication (can be disabled via DISABLE_JWT_AUTH)
- `models.py` - 3D model file serving and discovery
- `town.py` - Town CRUD operations (save, load, update)
- `buildings.py` - Building-specific operations
- `scene.py` - Scene management and queries
- `events.py` - Server-Sent Events for multiplayer
- `cursor.py` - Collaborative cursor tracking
- `batch.py` - Batch operations API
- `query.py` - Scene querying API
- `history.py` - Undo/redo operations
- `snapshots.py` - Scene snapshot management
- `proxy.py` - External API proxy

**Services** (`app/services/`):
- `storage.py` - Redis-backed town data storage with in-memory fallback
- `events.py` - SSE (Server-Sent Events) broadcasting via Redis pub/sub
- `auth.py` - JWT token validation
- `django_client.py` - Integration with external Django API (optional)
- `model_loader.py` - GLTF model file discovery
- `batch_operations.py` - Batch scene operations
- `query.py` - Scene querying logic
- `history.py` - Operation history tracking
- `snapshots.py` - Scene snapshot management
- `scene_description.py` - Scene description generation

**Models** (`app/models/`):
- `schemas.py` - Pydantic models for request/response validation

### Frontend (Vanilla JavaScript + Three.js)

**Entry Point**: `static/js/main.js`
- Initializes WASM physics module
- Sets up scene, controls, and UI
- Auto-loads town data if `window.currentTownId` is set
- Establishes SSE connection for multiplayer

**Scene Management**: `static/js/scene.js`
- Main scene orchestrator coordinating all components
- Uses THREE.Timer (r181+) for frame-independent physics
- Manages placement indicator, object selection, and editing
- Implements frustum culling for performance (threshold: 100+ objects)
- Integrates with WASM physics for spatial grid updates

**Modules**:
- `models/loader.js` - GLTF model loading with caching and abort support
- `models/placement.js` - Placement indicator and validation
- `models/collision.js` - Collision detection integration
- `physics/car.js` - Vehicle physics and driving mode
- `controls.js` - Keyboard/mouse camera controls
- `ui.js` - UI state management and mode switching
- `network.js` - SSE connection and Django API integration
- `collaborative-cursors.js` - Multiplayer cursor tracking
- `category_status.js` - Category-based object status visualization
- `joystick.js` - Mobile touch controls for driving mode

**Utilities** (`static/js/utils/`):
- `physics_wasm.js` - Go WASM physics integration (spatial grid, collision detection)
- `data_structures.js` - Efficient data structures (SpatialGrid, QuadTree)
- `raycaster.js` - Mouse picking and 3D coordinate conversion
- `disposal.js` - Three.js memory cleanup
- `wasm.js` - WASM readiness tracking

### Physics (Go WebAssembly)

**File**: `physics_wasm.go`
- Implements spatial grid for efficient collision detection
- Provides car physics calculations
- Uses bit vectors and Swiss tables (Go 1.24+) for performance
- Exposed JavaScript functions:
  - `wasmUpdateSpatialGrid` - Updates spatial grid with scene objects
  - `wasmCheckCollision` - Checks for collisions at given position
  - `wasmSimulateCarPhysics` - Simulates car movement and physics

**Categories**: Uses bitmasks for fast filtering (vehicles, buildings, terrain, props, roads, trees, park)

### Real-time Multiplayer

**Technology**: Server-Sent Events (SSE) + Redis Pub/Sub

**Flow**:
1. Frontend connects to `/api/events/sse` endpoint
2. Backend subscribes to Redis `town_events` channel
3. User actions broadcast events via `events.py:broadcast_sse()`
4. All connected clients receive updates in real-time

**Event Types**:
- `name` - Town name changes
- `add` - Object placement
- `delete` - Object removal
- `edit` - Object position/rotation updates
- `driver` - Vehicle driver assignments
- `cursor` - Collaborative cursor positions

### Data Storage

**Primary**: Redis (`REDIS_URL` in `.env`)
- Town data stored as JSON at key `town_data`
- Pub/sub channel: `town_events`

**Fallback**: In-memory storage (if Redis unavailable)

**File System** (`data/` directory):
- Optional persistent storage for saved towns
- Managed via `town.py` routes

## Important Patterns

### Adding a New API Endpoint

1. Create route handler in `app/routes/<feature>.py`
2. Define request/response schemas in `app/models/schemas.py`
3. Add business logic to `app/services/<feature>.py`
4. Register router in `app/main.py`

Example:
```python
# app/routes/my_feature.py
from fastapi import APIRouter
from app.models.schemas import MyRequest, MyResponse

router = APIRouter(prefix="/api/my-feature", tags=["my-feature"])

@router.post("/action", response_model=MyResponse)
async def my_action(request: MyRequest):
    # Implementation
    pass

# app/main.py
from app.routes import my_feature
app.include_router(my_feature.router)
```

### Adding New 3D Models

1. Place GLTF files in `static/models/<category>/`
2. Model loader automatically discovers them on startup
3. Categories: buildings, vehicles, terrain, props, roads, trees, park
4. Test loading via the UI model selection panel

### Working with WASM Physics

Frontend calls:
```javascript
// Update spatial grid with scene objects
window.wasmUpdateSpatialGrid(objectsArray);

// Check collision at position
const hasCollision = window.wasmCheckCollision(x, y, width, height, ignoreId);

// Simulate car physics
const result = window.wasmSimulateCarPhysics(x, y, rotation, speed, steering, deltaTime);
```

After modifying `physics_wasm.go`, rebuild with `./build_wasm.sh`.

### Broadcasting Real-time Events

```python
from app.services.events import broadcast_sse

# Broadcast to all connected clients
broadcast_sse({
    'type': 'add',
    'category': 'buildings',
    'data': object_data
})
```

### Redis Access in Services

```python
from app.services.storage import get_town_data, set_town_data

# Get current town data
town_data = get_town_data()

# Update town data
set_town_data(updated_data)
```

## Configuration

**Required** (`.env` file):
- `JWT_SECRET_KEY` - Secret for JWT token signing (production)
- `REDIS_URL` - Redis connection string (default: `redis://localhost:6379/0`)

**Optional**:
- `DISABLE_JWT_AUTH` - Set to `true` to disable JWT authentication (development only)
- `ALLOWED_ORIGINS` - Comma-separated CORS origins
- `ENVIRONMENT` - `development` or `production`
- `TOWN_API_URL` - External Django API URL (if integrating with Django)
- `TOWN_API_JWT_TOKEN` - JWT token for Django API authentication

## Code Style

### Python
- Follow PEP 8
- Use type hints for function parameters and return values
- Maximum line length: 100 characters
- Add docstrings to public functions and classes

### JavaScript
- Modern ES6+ syntax
- Use descriptive variable names
- Add JSDoc comments for complex functions
- Consistent indentation (2 or 4 spaces)

### Go (WASM)
- Follow standard Go conventions
- Use `gofmt` for formatting
- Add comments for exported functions

## Testing

Currently manual testing via browser. Future: pytest for Python, Jest for JavaScript.

**Test checklist**:
- Place different object types (buildings, vehicles, terrain, props)
- Edit object positions and rotations
- Delete objects
- Save and load town layouts
- Test multiplayer (open multiple browser windows)
- Test vehicle driving mode (desktop and mobile)
- Verify collision detection with WASM

## Troubleshooting

**Port already in use**:
```bash
lsof -i :5001  # or :5000 for production
kill -9 <PID>
```

**Redis connection failed**:
```bash
redis-server &
redis-cli ping  # Should return PONG
```

**WASM not loading**:
- Check browser console for errors
- Verify MIME types are correct (should be `application/wasm`)
- Rebuild WASM: `./build_wasm.sh`
- Check that `static/wasm/physics.wasm` exists

**JWT authentication errors** (production):
- Verify `JWT_SECRET_KEY` is set in `.env`
- For development, set `DISABLE_JWT_AUTH=true`

## Technology Stack

- **Backend**: Python 3.14+, FastAPI, Uvicorn/Gunicorn
- **Frontend**: Three.js r181+, Vanilla JavaScript (ES6+)
- **Physics**: Go 1.24+ (WASM with Swiss Tables)
- **Real-time**: Server-Sent Events (SSE)
- **Storage**: Redis (Valkey compatible)
- **Package Management**: uv (recommended) or pip
- **Models**: GLTF 2.0 format

## Deployment

- **Docker**: Production-ready Dockerfile included
- **Kubernetes**: Deployment manifests in `k8s/` directory
- **Redis**: Required for multiplayer functionality (can use Valkey as drop-in replacement)

## External Integrations

**Optional Django API Integration**:
- Configure via `TOWN_API_URL` and `TOWN_API_JWT_TOKEN`
- Services: `app/services/django_client.py`
- Used for town search, creation, and updates
- Can be disabled by not setting these environment variables
