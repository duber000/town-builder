---
description: Review codebase structure and key files
---

Review the Town Builder codebase structure and understand key components.

## Backend Structure (Python/FastAPI)
Key files to review:
- `app/main.py` - Application entry point, route registration
- `app/config.py` - Configuration management with Pydantic
- `app/routes/` - API endpoint handlers organized by domain
- `app/services/` - Business logic layer
- `app/models/schemas.py` - Request/response data models

## Frontend Structure (JavaScript/Three.js)
Key files to review:
- `static/js/main.js` - Application initialization
- `static/js/scene.js` - Scene orchestration
- `static/js/models/` - Model loading, placement, collision detection
- `static/js/physics/car.js` - Vehicle physics
- `static/js/network.js` - Multiplayer SSE client

## WASM Modules (Go)
- `physics_wasm.go` - High-performance physics calculations
- `calc.go` - Legacy distance calculations

## Documentation
- `README.md` - Main project documentation
- `CONTRIBUTING.md` - Development guide
- `ARCHITECTURE.md` - Codebase structure overview
- `docs/` - Additional documentation

For more details, see ARCHITECTURE.md
