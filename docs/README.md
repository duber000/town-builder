# Documentation

This directory contains detailed documentation for the Town Builder project.

## Security

- **[SECURITY_FIXES.md](SECURITY_FIXES.md)** - Security vulnerability documentation and fixes
  - Path traversal prevention
  - CORS protection
  - SSRF prevention
  - Input validation improvements

## Three.js Upgrade & Enhancements

### Main Documentation

- **[THREEJS_UPGRADE_R181.md](THREEJS_UPGRADE_R181.md)** - Complete upgrade guide from r176 to r181
  - Upgrade summary and changelog
  - Breaking changes assessment
  - Feature improvements overview
  - Testing and validation results
  - Rollback instructions

- **[THREEJS_R181_ENHANCEMENTS.md](THREEJS_R181_ENHANCEMENTS.md)** - Initial enhancements implementation
  - Loader abort support (r179)
  - Timer class integration (r179)
  - Environment mapping with reflections
  - Enhanced PBR lighting
  - Code examples and migration guide

- **[THREEJS_ADVANCED_FEATURES.md](THREEJS_ADVANCED_FEATURES.md)** - Advanced rendering features
  - HDR environment mapping with PMREM generator
  - ACESFilmic tone mapping
  - Real-time loading indicators
  - Enhanced lighting and materials
  - Renderer optimizations
  - Performance analysis and troubleshooting

### Upgrade Timeline

1. **Base Upgrade** (THREEJS_UPGRADE_R181.md)
   - Upgraded three.js from r176 → r181
   - Updated core library and loaders
   - Validated backward compatibility

2. **Initial Enhancements** (THREEJS_R181_ENHANCEMENTS.md)
   - Loader abort functionality
   - Timer class for frame-independent physics
   - Basic environment mapping
   - Enhanced materials

3. **Advanced Features** (THREEJS_ADVANCED_FEATURES.md)
   - Film-quality HDR + PMREM rendering
   - Professional tone mapping
   - Loading state indicators
   - Production-grade optimizations

### Key Improvements

**Visual Quality:**
- Film-grade rendering with ACESFilmic tone mapping
- Realistic environment reflections using PMREM generator
- Enhanced PBR materials with proper roughness/metalness
- Improved lighting for better material definition

**User Experience:**
- Real-time loading feedback
- Loader abort for better responsiveness
- Professional, polished interface
- Zero waiting for unwanted model loads

**Performance:**
- Frame-independent physics with Timer class
- Optimized renderer configuration
- Pixel ratio capping for high-DPI displays
- Zero runtime performance impact from advanced features

**Technical:**
- Leverages r181's GGX VNDF importance sampling
- DFG LUT for accurate PBR
- Multi-scattering energy compensation
- Industry-standard rendering techniques

## Project Management

- **[TODO.md](TODO.md)** - Project tasks and future enhancements
  - Feature roadmap
  - Known issues
  - Improvement opportunities

## Quick Reference

| Topic | Document | Purpose |
|-------|----------|---------|
| Security fixes | SECURITY_FIXES.md | Security improvements and best practices |
| Three.js upgrade | THREEJS_UPGRADE_R181.md | Complete upgrade guide and changelog |
| Initial enhancements | THREEJS_R181_ENHANCEMENTS.md | First wave of r181 features |
| Advanced rendering | THREEJS_ADVANCED_FEATURES.md | Film-quality rendering features |
| Project tasks | TODO.md | Development roadmap |

## Contributing

When adding new documentation:

1. Place files in the `docs/` directory
2. Use descriptive filenames (e.g., `FEATURE_DESCRIPTION.md`)
3. Update this README with a link and description
4. Cross-reference related documentation
5. Include code examples where helpful

## External Links

- [Three.js Official Documentation](https://threejs.org/docs/)
- [Three.js GitHub Releases](https://github.com/mrdoob/three.js/releases)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Project Main README](../README.md)
