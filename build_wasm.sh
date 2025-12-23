#!/bin/bash

# ============================================================================
# WASM Build Script - Town Builder Physics Module
# Optimized for Go 1.24+ with Swiss Tables (enabled by default)
# ============================================================================

set -e  # Exit on error

echo "================================================"
echo "Town Builder WASM Build Script"
echo "Go 1.24+ Swiss Tables Enabled"
echo "================================================"
echo ""

# Check Go version
GO_VERSION=$(go version | awk '{print $3}')
echo "Go version: $GO_VERSION"
echo ""

# Create output directory
mkdir -p static/wasm
mkdir -p static/js

# ============================================================================
# Build Physics WASM Module (Swiss Tables enabled by default in Go 1.24)
# ============================================================================

echo "Building physics WASM module with Go 1.24+ optimizations..."
echo ""
echo "Enabled Features:"
echo "  ✓ Swiss Tables (default in Go 1.24+)"
echo "    - 30% faster map access"
echo "    - 35% faster map assignment"
echo "    - 10-60% faster map iteration"
echo "  ✓ Improved small object allocation"
echo "  ✓ Better stack allocation for slices"
echo "  ✓ Enhanced mutex performance (SpinbitMutex)"
echo "  ✓ Optimized for WASM runtime"
echo ""

GOOS=js GOARCH=wasm go build \
  -ldflags="-s -w" \
  -o static/wasm/physics.wasm \
  physics_wasm.go

PHYSICS_SIZE=$(du -h static/wasm/physics.wasm | cut -f1)
echo "✓ Physics WASM build complete: static/wasm/physics.wasm ($PHYSICS_SIZE)"
echo ""

# ============================================================================
# Build 3: Legacy Distance Calculator (Backward Compatibility)
# ============================================================================

if [ -f "calc.go" ]; then
    echo "Building legacy distance calculator (backward compatibility)..."

    GOOS=js GOARCH=wasm go build \
      -ldflags="-s -w" \
      -o static/wasm/calc.wasm \
      calc.go

    CALC_SIZE=$(du -h static/wasm/calc.wasm | cut -f1)
    echo "✓ Legacy calc build complete: static/wasm/calc.wasm ($CALC_SIZE)"
    echo ""
fi

# ============================================================================
# Copy WASM Exec Runtime
# ============================================================================

echo "Copying Go WASM runtime..."
# Try multiple possible locations
WASM_EXEC_LOCATIONS=(
    "$(go env GOROOT)/misc/wasm/wasm_exec.js"
    "$(go env GOROOT)/lib/wasm/wasm_exec.js"
    "/usr/local/go1.24.7/lib/wasm/wasm_exec.js"
)

COPIED=false
for WASM_EXEC_SRC in "${WASM_EXEC_LOCATIONS[@]}"; do
    if [ -f "$WASM_EXEC_SRC" ]; then
        cp "$WASM_EXEC_SRC" static/js/wasm_exec.js
        echo "✓ wasm_exec.js copied to static/js/ from $WASM_EXEC_SRC"
        COPIED=true
        break
    fi
done

if [ "$COPIED" = false ]; then
    echo "⚠ Warning: wasm_exec.js not found in any standard location"
fi
echo ""

# ============================================================================
# Build Summary
# ============================================================================

echo "================================================"
echo "Build Summary"
echo "================================================"
echo ""
echo "Physics WASM Module:"
echo "  File: static/wasm/physics.wasm"
echo "  Size: $PHYSICS_SIZE"
echo "  Go Version: $GO_VERSION"
echo ""
echo "Optimizations (enabled by default in Go 1.24+):"
echo "  ✓ Swiss Tables - 30-60% faster map operations"
echo "  ✓ SpinbitMutex - Enhanced lock performance"
echo "  ✓ Improved allocation - Better small object handling"
echo "  ✓ Stack optimization - Reduced heap pressure"
echo ""

if [ -f "static/wasm/calc.wasm" ]; then
    CALC_SIZE=$(du -h static/wasm/calc.wasm | cut -f1)
    echo "Legacy Calculator:"
    echo "  File: static/wasm/calc.wasm"
    echo "  Size: $CALC_SIZE"
    echo ""
fi

echo "JavaScript API Functions:"
echo "  • wasmUpdateSpatialGrid(objects)      - Update spatial grid"
echo "  • wasmCheckCollision(id, bbox)        - Single collision check"
echo "  • wasmBatchCheckCollisions(checks)    - Batch collision check"
echo "  • wasmFindNearestObject(x, y, cat, d) - Find nearest by category"
echo "  • wasmFindObjectsInRadius(x, y, r, c) - Radius-based search"
echo "  • wasmGetGridStats()                  - Debug statistics"
echo ""
echo "Performance Tips:"
echo "  • Pre-size maps to reduce rehashing (already optimized in code)"
echo "  • Use batch operations for multiple collision checks"
echo "  • Spatial grid auto-optimizes for O(k) collision detection"
echo ""
echo "================================================"
echo "Build complete! 🚀"
echo "================================================"
