# Town Builder Architecture

This document provides a comprehensive overview of the Town Builder codebase structure, designed to help developers (including AI assistants) quickly understand and navigate the project.

## Table of Contents

- [Overview](#overview)
- [Technology Stack](#technology-stack)
- [Backend Architecture](#backend-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Data Flow](#data-flow)
- [Key Concepts](#key-concepts)
- [File Organization](#file-organization)
- [API Endpoints](#api-endpoints)
- [Configuration](#configuration)

## Overview

Town Builder is a real-time multiplayer 3D town building application with:
- **Backend**: FastAPI (Python 3.14) with Redis for state management
- **Frontend**: Three.js for 3D rendering, vanilla JavaScript
- **WASM**: Go 1.24 for high-performance physics calculations
- **Multiplayer**: Server-Sent Events (SSE) with Redis Pub/Sub

## Technology Stack

### Backend
- **FastAPI 0.119.1+** - Modern async web framework
- **Pydantic 2.12.0+** - Data validation and settings management
- **Redis 5.2.0+** - In-memory data store for state sharing
- **Authlib 1.3.0+** - JWT authentication
- **Uvicorn** - ASGI server (development)
- **Gunicorn + Gevent** - Production server with async support

### Frontend
- **Three.js r181** - 3D rendering engine
- **Vanilla JavaScript** - No framework dependencies
- **WebAssembly** - Go-compiled WASM for physics
- **Server-Sent Events** - Real-time updates

### Deployment
- **Docker** - Containerization
- **Kubernetes** - Orchestration
- **Valkey/Redis** - State storage

## Backend Architecture

### Application Structure

```
app/
├── main.py              # FastAPI app initialization & route registration
├── config.py            # Environment configuration (Pydantic Settings)
├── models/
│   └── schemas.py       # Pydantic request/response models
├── routes/              # API endpoint handlers (routers)
│   ├── ui.py           # HTML template rendering
│   ├── auth.py         # JWT authentication endpoints
│   ├── models.py       # 3D model listing
│   ├── town.py         # Town CRUD operations
│   ├── proxy.py        # Django API proxy
│   ├── events.py       # Server-Sent Events (SSE)
│   ├── cursor.py       # Multiplayer cursor positions
│   ├── batch.py        # Batch operations (programmatic API)
│   ├── query.py        # Spatial queries & filtering (programmatic API)
│   ├── history.py      # Undo/redo operations (programmatic API)
│   └── snapshots.py    # Town snapshots (programmatic API)
├── services/            # Business logic layer
│   ├── auth.py         # JWT token generation/validation
│   ├── storage.py      # Redis + in-memory storage abstraction
│   ├── events.py       # Event publishing/subscription
│   ├── django_client.py # External Django API client
│   ├── model_loader.py  # 3D model file discovery
│   ├── batch_operations.py # Batch operations manager
│   ├── query.py        # Spatial queries & filtering
│   ├── history.py      # Operation history management
│   └── snapshots.py    # Snapshot versioning
└── utils/
    ├── static_files.py  # Static file serving with MIME types
    └── security.py      # Path traversal & SSRF prevention
```

### Layered Architecture

```
┌─────────────────────────────────────────┐
│          Routes (API Handlers)          │  - HTTP request handling
│        app/routes/*.py                   │  - Input validation
└─────────────────────────────────────────┘  - Response formatting
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Services (Business Logic)          │  - Core functionality
│        app/services/*.py                 │  - Data transformation
└─────────────────────────────────────────┘  - External integrations
                  │
                  ▼
┌─────────────────────────────────────────┐
│      Storage & External Systems         │  - Redis operations
│   Redis, Django API, File System        │  - File I/O
└─────────────────────────────────────────┘  - External API calls
```

### Key Backend Modules

#### `app/main.py`
- FastAPI application initialization
- CORS middleware configuration
- Route registration
- Startup/shutdown event handlers
- Static file serving

#### `app/config.py`
- Environment variable loading (.env)
- Configuration validation with Pydantic
- Singleton settings instance
- Security configurations (JWT, CORS, SSRF protection)

#### `app/services/storage.py`
- Abstract storage interface
- Redis implementation for multiplayer state
- In-memory fallback when Redis unavailable
- Town data persistence (Redis + JSON files)

#### `app/services/events.py`
- Event publishing to Redis Pub/Sub
- SSE connection management
- User presence tracking
- Broadcast system for multiplayer updates

#### `app/services/auth.py`
- JWT token generation
- Token validation and decoding
- Optional authentication bypass (development)

## Frontend Architecture

### Module Structure

```
static/js/
├── main.js              # Application entry point & initialization
├── scene.js             # Main scene orchestrator
├── scene/
│   └── scene.js        # Three.js scene setup & management
├── models/
│   ├── loader.js       # GLTF model loading with caching
│   ├── placement.js    # Placement indicator & grid snapping
│   └── collision.js    # Bounding box collision detection
├── physics/
│   └── car.js          # Vehicle movement & physics
├── utils/
│   ├── wasm.js         # WebAssembly initialization
│   ├── physics_wasm.js # Physics WASM wrapper
│   ├── raycaster.js    # Mouse picking & raycasting
│   └── disposal.js     # Three.js memory cleanup
├── controls.js          # Camera & keyboard controls
├── ui.js               # UI state management & event handlers
├── network.js          # SSE client & multiplayer sync
└── collaborative-cursors.js # Show other users' cursors
```

### Frontend Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│   UI Layer      │  ui.js - Handle button clicks, mode changes
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Scene Layer    │  scene.js - Orchestrate operations
└─────────────────┘
    │
    ├──▶ Model Placement (placement.js)
    ├──▶ Collision Detection (collision.js)
    ├──▶ Physics Calculation (car.js, WASM)
    └──▶ Network Sync (network.js)
    │
    ▼
┌─────────────────┐
│  Three.js       │  Render 3D scene
└─────────────────┘
```

### Key Frontend Modules

#### `main.js`
- Application initialization
- WASM module loading
- Scene creation
- Error handling setup

#### `scene.js`
- Central coordinator for all scene operations
- Mode management (place/edit/delete/drive)
- Object placement and manipulation
- Save/load functionality

#### `models/loader.js`
- GLTF model loading with THREE.GLTFLoader
- Model caching to avoid duplicate loads
- Error handling for missing models
- Progress callbacks

#### `models/collision.js`
- Bounding box calculations
- Collision detection between objects
- Ground plane detection
- WASM integration for performance

#### `network.js`
- SSE connection management
- Reconnection with exponential backoff
- Event broadcasting to other clients
- JWT token handling

#### `utils/wasm.js`
- Go WASM runtime initialization
- Physics module loading
- Fallback to JavaScript if WASM fails

## Data Flow

### User Placement Flow

```
1. User clicks "Place" mode
   └─▶ ui.js updates mode state

2. User selects model from sidebar
   └─▶ scene.js loads model via loader.js
   └─▶ Creates placement indicator

3. User moves mouse
   └─▶ raycaster.js detects ground position
   └─▶ placement.js updates indicator position
   └─▶ collision.js checks for overlaps (via WASM)

4. User clicks to place
   └─▶ scene.js adds object to scene
   └─▶ network.js broadcasts to other clients via SSE
   └─▶ storage.js saves to Redis

5. Other clients receive update
   └─▶ network.js receives SSE event
   └─▶ scene.js places object in their scene
```

### Multiplayer State Sync

```
Client A                    Backend                    Client B
   │                           │                          │
   │──[Place Object]──────▶    │                          │
   │                           │                          │
   │                    [Save to Redis]                   │
   │                           │                          │
   │                    [Publish to Pub/Sub]              │
   │                           │                          │
   │                           │────[SSE Event]──────▶    │
   │                           │                          │
   │                           │                    [Update Scene]
```

## Key Concepts

### Modes

The application has several operational modes:

- **Place Mode**: Select and place objects on the ground
- **Edit Mode**: Click objects to adjust position/rotation
- **Delete Mode**: Click objects to remove them
- **Drive Mode**: Control vehicles with WASD/arrows

### Object Structure

Each placed object has:
```javascript
{
    id: "unique-id",
    type: "model-name",
    position: { x, y, z },
    rotation: { x, y, z },
    scale: { x, y, z },
    category: "buildings|vehicles|roads|etc"
}
```

### Storage Strategy

- **Redis**: Primary storage for multiplayer state (if available)
- **Local Files**: Backup storage in `data/` directory
- **Memory**: In-memory cache for fast access

### WASM Physics Module

Go WASM module provides:
- Spatial grid for O(k) collision detection
- Batch collision checking
- Nearest neighbor queries
- Radius-based object searches

API functions:
- `wasmUpdateSpatialGrid(objects)`
- `wasmCheckCollision(id, bbox)`
- `wasmBatchCheckCollisions(checks)`
- `wasmFindNearestObject(x, y, category, maxDist)`

## File Organization

### Configuration Files

- `.env` - Environment variables (gitignored)
- `.env.example` - Environment variable template
- `pyproject.toml` - Python dependencies and project metadata
- `go.mod` - Go module dependencies
- `Dockerfile` - Container build instructions
- `.gitignore` - Git ignore patterns

### Static Assets

```
static/
├── js/              # JavaScript modules
├── models/          # 3D GLTF models
│   ├── buildings/
│   ├── vehicles/
│   ├── roads/
│   └── nature/
├── wasm/            # WebAssembly modules
│   ├── physics.wasm
│   └── calc.wasm
└── css/             # Stylesheets
```

### Templates

```
templates/
└── index.html       # Main application HTML (Jinja2 template)
```

### Data Storage

```
data/
└── towns/           # JSON files for town saves (gitignored)
    └── <town_id>.json
```

## API Endpoints

### Authentication
- `POST /api/auth/dev-token` - Generate development JWT token

### Models
- `GET /api/models` - List available 3D models by category

### Town Management
- `GET /api/town/{town_id}` - Get town data
- `POST /api/town/{town_id}` - Save town data
- `DELETE /api/town/{town_id}` - Delete town
- `GET /api/towns` - List all towns

### Multiplayer
- `GET /api/events` - SSE endpoint for real-time updates
- `POST /api/cursor/update` - Update user cursor position

### Proxy (Django Integration)
- `GET /api/proxy/towns` - Proxy to external Django API

### UI
- `GET /` - Main application page
- `GET /readyz` - Health check endpoint

### Documentation
- `GET /docs` - Swagger UI
- `GET /redoc` - ReDoc documentation
- `GET /openapi.json` - OpenAPI schema

### Programmatic APIs (Claude Integration)

New medium-level APIs for programmatic interaction and AI-driven automation:

**Batch Operations:**
- `POST /api/batch/operations` - Execute multiple create/update/delete/edit operations atomically

**Spatial Queries:**
- `POST /api/query/spatial/radius` - Find objects within radius from center point
- `POST /api/query/spatial/bounds` - Find objects within bounding box
- `POST /api/query/spatial/nearest` - Find N nearest objects to a point

**Advanced Filtering:**
- `POST /api/query/advanced` - Execute complex queries with filters, sorting, and pagination

**History & Undo/Redo:**
- `GET /api/history` - Get operation history
- `POST /api/history/undo` - Undo last operation
- `POST /api/history/redo` - Redo last undone operation
- `DELETE /api/history` - Clear history

**Snapshots:**
- `POST /api/snapshots` - Create snapshot of current town state
- `GET /api/snapshots` - List all snapshots
- `GET /api/snapshots/{id}` - Get snapshot data
- `POST /api/snapshots/{id}/restore` - Restore town to snapshot state
- `DELETE /api/snapshots/{id}` - Delete snapshot

See `PROGRAMMATIC_API.md` for detailed documentation and examples.

## Configuration

### Environment Variables

See `.env.example` for complete list. Key variables:

**Required in Production:**
- `JWT_SECRET_KEY` - Secret for JWT token signing
- `ALLOWED_ORIGINS` - CORS allowed origins (comma-separated)

**Optional:**
- `DISABLE_JWT_AUTH` - Bypass JWT auth (development only)
- `REDIS_URL` - Redis connection string
- `TOWN_API_URL` - External Django API URL
- `ENVIRONMENT` - `development` or `production`

### Port Configuration

- **Development**: Port 5001 (uvicorn with --reload)
- **Production**: Port 5000 (gunicorn with gevent)

### Security

- **CORS**: Configured via `ALLOWED_ORIGINS`
- **JWT**: Optional authentication for API endpoints
- **Path Traversal**: Prevented via `app/utils/security.py`
- **SSRF**: URL validation for external API calls

## Development Workflow

### Adding a New Feature

1. **Backend**:
   - Define request/response models in `app/models/schemas.py`
   - Implement business logic in `app/services/`
   - Create route handler in `app/routes/`
   - Register route in `app/main.py`

2. **Frontend**:
   - Add UI controls in `static/js/ui.js`
   - Implement logic in appropriate module
   - Update scene orchestration in `static/js/scene.js`
   - Add network sync if needed in `static/js/network.js`

3. **Testing**:
   - Manual testing in browser
   - Check browser console for errors
   - Test multiplayer with multiple windows

### Debugging Tips

- **Backend Logs**: Watch uvicorn output for errors
- **Frontend Logs**: Check browser Developer Console
- **Network**: Use browser Network tab for API calls
- **Redis**: Use `redis-cli monitor` to watch events
- **WASM**: Check console for WASM loading errors (non-critical)

## Performance Considerations

### Backend
- Redis connection pooling
- Async/await for I/O operations
- Gevent for SSE handling (non-blocking)

### Frontend
- Model caching (avoid re-loading same models)
- WASM for collision detection (faster than JS)
- Three.js object pooling for reused geometries
- Raycasting optimization (limit objects checked)

### Network
- SSE for server-push (more efficient than polling)
- Redis Pub/Sub for inter-process communication
- Batch collision checks to reduce WASM overhead

## Security

See `docs/SECURITY_FIXES.md` for detailed security information.

Key protections:
- Path traversal prevention for file operations
- SSRF prevention for external API calls
- CORS restrictions
- Optional JWT authentication
- Input validation with Pydantic

## Deployment

### Local Development
```bash
uv run uvicorn app.main:app --reload --port 5001
```

### Production (Docker)
```bash
docker build -t town-builder .
docker run -p 5000:5000 town-builder
```

### Kubernetes
```bash
kubectl apply -f k8s/
```

See `k8s/` directory for deployment manifests.

## Common Patterns

### Adding a New API Endpoint

```python
# 1. Define model in app/models/schemas.py
class MyRequest(BaseModel):
    data: str

class MyResponse(BaseModel):
    result: str

# 2. Create service in app/services/my_service.py
async def process_data(data: str) -> str:
    # Business logic here
    return result

# 3. Create route in app/routes/my_route.py
from fastapi import APIRouter
router = APIRouter(prefix="/api/my", tags=["my-feature"])

@router.post("/action", response_model=MyResponse)
async def my_action(request: MyRequest):
    result = await process_data(request.data)
    return MyResponse(result=result)

# 4. Register in app/main.py
from app.routes import my_route
app.include_router(my_route.router)
```

### Adding a Frontend Feature

```javascript
// 1. Add UI in static/js/ui.js
export function initMyFeature() {
    const button = document.getElementById('my-button');
    button.addEventListener('click', handleMyFeature);
}

// 2. Implement in new module static/js/my_feature.js
export async function handleMyFeature() {
    // Feature logic
    const result = await callAPI();
    updateScene(result);
}

// 3. Wire up in static/js/main.js
import { initMyFeature } from './my_feature.js';
initMyFeature();
```

## Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Three.js Documentation](https://threejs.org/docs/)
- [Go WebAssembly Wiki](https://github.com/golang/go/wiki/WebAssembly)
- [Redis Documentation](https://redis.io/documentation)

---

For questions or clarifications, see CONTRIBUTING.md or open an issue.
