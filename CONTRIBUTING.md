# Contributing to Town Builder

Thank you for your interest in contributing to Town Builder! This guide will help you get started with development.

## Table of Contents

- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Code Style](#code-style)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Common Tasks](#common-tasks)

## Development Setup

### Prerequisites

- **Python 3.14+** (check with `python --version`)
- **Go 1.24+** (for WASM modules, check with `go version`)
- **Redis** (for multiplayer features)
- **[uv](https://github.com/astral-sh/uv)** (recommended Python package manager)

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd town-builder
   ```

2. **Install Python dependencies**
   ```bash
   # Using uv (recommended)
   uv sync

   # Or using pip
   pip install -e .
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start Redis** (required for multiplayer)
   ```bash
   redis-server
   ```

5. **Run the application**
   ```bash
   # Development mode (port 5001, auto-reload)
   uv run uvicorn app.main:app --reload --port 5001

   # Production mode (port 5000)
   gunicorn -w 4 -k gevent -b 0.0.0.0:5000 app.main:app
   ```

6. **Open your browser**
   - Development: http://127.0.0.1:5001/
   - Production: http://127.0.0.1:5000/

## Project Structure

```
town-builder/
├── app/                    # Backend Python application
│   ├── main.py            # FastAPI application entry point
│   ├── config.py          # Configuration management
│   ├── models/            # Pydantic data models
│   ├── routes/            # API endpoint handlers
│   ├── services/          # Business logic layer
│   └── utils/             # Utility functions
├── static/                 # Frontend assets
│   ├── js/                # JavaScript modules
│   │   ├── models/        # 3D model handling
│   │   ├── physics/       # Physics calculations
│   │   ├── scene/         # Three.js scene management
│   │   └── utils/         # Utility functions
│   ├── models/            # 3D GLTF model files
│   └── wasm/              # WebAssembly modules
├── templates/              # Jinja2 HTML templates
├── docs/                   # Documentation
├── k8s/                    # Kubernetes deployment files
├── data/                   # Town save files (gitignored)
└── tests/                  # Test files (to be added)
```

### Key Files

- **app/main.py** - Application entry point, route registration
- **app/config.py** - Environment configuration with Pydantic
- **static/js/main.js** - Frontend initialization
- **static/js/scene.js** - Three.js scene orchestration
- **physics_wasm.go** - Go WASM physics module
- **build_wasm.sh** - Script to rebuild WASM modules

## Development Workflow

### Making Changes

1. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**
   - Follow the code style guidelines below
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**
   ```bash
   # Run the application
   uv run uvicorn app.main:app --reload --port 5001

   # Test in browser
   # Visit http://127.0.0.1:5001/
   ```

4. **Commit your changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

### Commit Message Format

Follow conventional commits format:

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

Examples:
```
feat: add undo/redo functionality for object placement
fix: resolve collision detection issue with large models
docs: update WASM build instructions
refactor: extract model loading logic into separate module
```

## Code Style

### Python

- Follow [PEP 8](https://pep8.org/) style guide
- Use type hints for function parameters and return values
- Add docstrings to all public functions and classes
- Maximum line length: 100 characters

```python
def calculate_distance(x1: float, y1: float, x2: float, y2: float) -> float:
    """Calculate Euclidean distance between two points.

    Args:
        x1: X coordinate of first point
        y1: Y coordinate of first point
        x2: X coordinate of second point
        y2: Y coordinate of second point

    Returns:
        Distance between the two points
    """
    return math.sqrt((x2 - x1)**2 + (y2 - y1)**2)
```

### JavaScript

- Use modern ES6+ syntax
- Use descriptive variable names
- Add JSDoc comments for complex functions
- Use consistent indentation (2 or 4 spaces)

```javascript
/**
 * Load a 3D model from the specified path
 * @param {string} modelPath - Path to the GLTF model file
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object3D>} Loaded Three.js object
 */
async function loadModel(modelPath, onProgress) {
    // Implementation
}
```

### Go (for WASM)

- Follow standard Go conventions
- Use `gofmt` for formatting
- Add comments for exported functions

## Testing

### Manual Testing

1. Start the application in development mode
2. Test the following scenarios:
   - Place different types of objects
   - Edit object positions and rotations
   - Delete objects
   - Save and load town layouts
   - Test multiplayer functionality (open multiple browser windows)
   - Test vehicle driving mode

### Automated Testing

```bash
# Python tests (to be implemented)
pytest

# JavaScript tests (to be implemented)
npm test
```

## Submitting Changes

### Pull Request Process

1. **Update documentation**
   - Update README.md if needed
   - Add docstrings to new functions
   - Update ARCHITECTURE.md for structural changes

2. **Create pull request**
   - Push your branch to GitHub
   - Create a pull request with a clear description
   - Link any related issues

3. **Pull request checklist**
   - [ ] Code follows style guidelines
   - [ ] Documentation is updated
   - [ ] Tests pass (when available)
   - [ ] Commit messages are clear
   - [ ] No merge conflicts

### Review Process

- Maintainers will review your pull request
- Address any feedback or requested changes
- Once approved, your changes will be merged

## Common Tasks

### Rebuilding WASM Modules

If you modify the Go source code:

```bash
# Build all WASM modules
./build_wasm.sh

# Manual build
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/physics.wasm physics_wasm.go
```

### Adding New 3D Models

1. Place GLTF model files in `static/models/<category>/`
2. The model loader will automatically discover them
3. Ensure models follow the naming convention
4. Test loading and placement in the UI

### Adding New API Endpoints

1. Create route handler in `app/routes/`
2. Add business logic to `app/services/`
3. Define request/response models in `app/models/schemas.py`
4. Register route in `app/main.py`
5. Update API documentation

Example:
```python
# app/routes/my_feature.py
from fastapi import APIRouter, Depends
from app.models.schemas import MyRequest, MyResponse
from app.services.my_service import my_service_function

router = APIRouter(prefix="/api/my-feature", tags=["my-feature"])

@router.post("/action", response_model=MyResponse)
async def my_action(request: MyRequest):
    """Perform some action."""
    result = await my_service_function(request)
    return MyResponse(**result)
```

### Working with Redis

```python
# Access Redis in services
from app.services.storage import storage

# Get data
data = await storage.get_town_data("town_id")

# Set data
await storage.save_town_data("town_id", town_data)

# Publish event
from app.services.events import EventService
event_service = EventService()
await event_service.publish_event("event_type", {"data": "value"})
```

## Getting Help

- Check existing [issues](../../issues) for similar problems
- Read the [documentation](docs/)
- Ask questions in discussions
- Review the [README.md](README.md)

## Areas for Contribution

We welcome contributions in these areas:

- 🎨 **3D Models & Assets** - Add new buildings, vehicles, decorations
- 🎮 **Game Features** - Undo/redo, minimap, templates, etc.
- ⚡ **Performance** - Optimize rendering, physics, networking
- 📱 **Mobile Support** - Touch controls, responsive UI
- 🧪 **Testing** - Add unit tests, integration tests
- 📚 **Documentation** - Improve guides, add examples
- 🌐 **Internationalization** - Add translations
- ♿ **Accessibility** - Keyboard navigation, screen reader support

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on the code, not the person
- Help others learn and grow

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

Thank you for contributing to Town Builder! 🏗️
