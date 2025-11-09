# TODO - Town Builder Next Steps

This document outlines recommended improvements and next steps for the town-builder project following the code organization refactoring.


## 📝 Documentation

- [ ] Generate API documentation from FastAPI (OpenAPI/Swagger available at `/docs`)
- [ ] Add docstrings to remaining Python functions
- [ ] Create architecture diagram showing module relationships
- [ ] Document environment variables in `.env.example`
- [ ] Add JSDoc comments to remaining JavaScript functions
- [ ] Create developer setup guide (CONTRIBUTING.md)
- [ ] Document WASM build process and usage

## 🏗️ Architecture Improvements

### Backend

- [ ] Add error recovery for SSE disconnections with state reconciliation
- [ ] Implement repository pattern for data access
  ```python
  # app/repositories/town_repository.py
  class TownRepository(ABC):
      def get(self, town_id: str) -> Dict
      def save(self, town_data: Dict) -> str
      def delete(self, town_id: str) -> bool
  ```
- [ ] Add API versioning (`/api/v1/...`)
- [ ] Standardize error response format across all endpoints
- [ ] Add request/response logging middleware
- [ ] Implement rate limiting for API endpoints
- [ ] Add database migrations system (Alembic if using SQLAlchemy)
- [ ] Separate dev vs production configuration
- [ ] Add health check for Redis connection in `/readyz`

### Frontend

- [ ] Add TypeScript for type safety
- [ ] Implement frontend build pipeline (Vite or Webpack)
  - [ ] Bundle JavaScript modules
  - [ ] Minify assets for production
  - [ ] Source maps for debugging
- [ ] Add hot module reloading for development
- [ ] Create state management system (consider lightweight solution)
- [ ] Implement error boundaries for graceful failure handling
- [ ] Add loading states for async operations
- [ ] Optimize model loading (lazy loading, caching)

## 🚀 Features

- [ ] Add user authentication UI (login/register)
- [ ] Implement persistent town saves (database integration)
- [ ] Add undo/redo functionality for model placement
- [ ] Implement model rotation/scaling UI controls
- [ ] Add minimap for navigation
- [ ] Implement model search/filter in UI
- [ ] Add screenshot/export functionality
- [ ] Implement collaborative cursors (show other users' positions)
- [ ] Add chat functionality for multiplayer
- [ ] Implement town templates/presets

## 🔒 Security

- [ ] Review and remove dev token generation endpoint in production
- [ ] Add CORS configuration per environment
- [ ] Implement proper secret management (not in code)
- [ ] Add input validation for all user inputs
- [ ] Implement CSRF protection
- [ ] Add Content Security Policy headers
- [ ] Review file upload security (if applicable)
- [ ] Add rate limiting to prevent abuse

## ⚡ Performance

- [ ] Add caching layer for model metadata
- [ ] Implement Redis connection pooling
- [ ] Optimize SSE broadcasting (consider batching updates)
- [ ] Add database indexes for common queries
- [ ] Implement lazy loading for 3D models
- [ ] Add compression for API responses
- [ ] Optimize WASM loading and initialization
- [ ] Profile and optimize car physics calculations
- [ ] Consider using Web Workers for heavy computations

## 📊 Monitoring & Observability

- [ ] Add structured logging (JSON format)
- [ ] Implement application metrics (Prometheus)
- [ ] Add error tracking (Sentry or similar)
- [ ] Create dashboard for monitoring (Grafana)
- [ ] Add performance monitoring for frontend
- [ ] Implement distributed tracing for debugging
- [ ] Add uptime monitoring
- [ ] Create alerts for critical errors

## 🐳 DevOps

- [ ] Optimize Dockerfile:
  - [ ] Multi-stage builds
  - [ ] Build caching
  - [ ] Smaller base image
- [ ] Add docker-compose for local development
- [ ] Create separate production Dockerfile
- [ ] Add health check to Docker container
- [ ] Implement blue-green deployment strategy
- [ ] Add database backup automation
- [ ] Create rollback procedures

## 📦 Dependencies

- [ ] Audit dependencies for security vulnerabilities
- [ ] Remove unused dependencies
- [ ] Pin all dependency versions
- [ ] Setup Dependabot for automated updates
- [ ] Document why each dependency is needed

## 🎨 Code Quality

- [ ] Setup pre-commit hooks (black, ruff, eslint)
- [ ] Add code coverage reporting (aim for >80%)
- [ ] Implement code review checklist
- [ ] Add linting rules for consistency
- [ ] Setup SonarQube or similar for code quality metrics
- [ ] Refactor remaining large functions (>50 lines)
- [ ] Remove magic numbers, use named constants

## 🌐 Internationalization (i18n)

- [ ] Add i18n support for UI text
- [ ] Extract hardcoded strings to translation files
- [ ] Add language selector UI

## ♿ Accessibility

- [ ] Add keyboard navigation support
- [ ] Implement ARIA labels for screen readers
- [ ] Ensure color contrast meets WCAG standards
- [ ] Add focus indicators for interactive elements
- [ ] Test with screen readers

## 🎓 Future Considerations

- [ ] Evaluate WebGL2 features for better graphics
- [ ] Explore WebGPU for future-proof rendering
- [ ] Implement offline mode with service workers
- [ ] Add mobile/touch support

---

**Priority Legend:**
- 🔴 High Priority (Security, Critical Bugs)
- 🟡 Medium Priority (Features, Performance)
- 🟢 Low Priority (Nice to Have)

Start with testing infrastructure and cleanup, then move to features and performance optimizations.
