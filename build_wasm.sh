#!/bin/bash

# ============================================================================
# WASM Build Script - Town Builder Physics Module
# Optimized for Go 1.24 (Swiss Tables) and Go 1.25 (Green Tea GC)
# ============================================================================

set -e  # Exit on error

echo "================================================"
echo "Town Builder WASM Build Script"
echo "================================================"
echo ""

# Check Go version
GO_VERSION=$(go version | awk '{print $3}')
echo "Go version: $GO_VERSION"
echo ""

# Create output directory
mkdir -p static/wasm

# ============================================================================
# Build 1: Standard Go 1.24 Build (Recommended for Production)
# ============================================================================

echo "Building standard WASM module (Go 1.24 Swiss Tables)..."
echo "Features:"
echo "  - Swiss Tables map optimization (30-60% faster)"
echo "  - Improved small object allocation"
echo "  - Better mutex performance"
echo ""

GOOS=js GOARCH=wasm go build \
  -ldflags="-s -w" \
  -o static/wasm/physics.wasm \
  physics_wasm.go

STANDARD_SIZE=$(du -h static/wasm/physics.wasm | cut -f1)
echo "✓ Standard build complete: static/wasm/physics.wasm ($STANDARD_SIZE)"
echo ""

# ============================================================================
# Build 2: Experimental Go 1.25 Green Tea GC Build (Optional)
# ============================================================================

if [[ "$1" == "--experimental" ]] || [[ "$1" == "--greentea" ]]; then
    echo "Building experimental WASM module (Go 1.25 Green Tea GC)..."
    echo "Features:"
    echo "  - Green Tea GC (optimized for small objects)"
    echo "  - Improved stack allocation for slices"
    echo "  - Lower GC latency"
    echo ""
    echo "WARNING: This is experimental. Test thoroughly before production use."
    echo ""

    GOEXPERIMENT=greenteagc GOOS=js GOARCH=wasm go build \
      -ldflags="-s -w" \
      -o static/wasm/physics_greentea.wasm \
      physics_wasm.go

    GREENTEA_SIZE=$(du -h static/wasm/physics_greentea.wasm | cut -f1)
    echo "✓ Green Tea GC build complete: static/wasm/physics_greentea.wasm ($GREENTEA_SIZE)"
    echo ""
fi

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
echo "Standard Build (Recommended):"
echo "  File: static/wasm/physics.wasm"
echo "  Size: $STANDARD_SIZE"
echo "  Features: Go 1.24 Swiss Tables, improved allocation"
echo ""

if [[ "$1" == "--experimental" ]] || [[ "$1" == "--greentea" ]]; then
    echo "Experimental Build:"
    echo "  File: static/wasm/physics_greentea.wasm"
    echo "  Size: $GREENTEA_SIZE"
    echo "  Features: Go 1.25 Green Tea GC (experimental)"
    echo ""
    echo "To use experimental build, modify wasm.js to load:"
    echo "  /static/wasm/physics_greentea.wasm"
    echo ""
fi

echo "Usage in JavaScript:"
echo "  await wasmUpdateSpatialGrid(objects)"
echo "  const collisions = wasmCheckCollision(id, bbox)"
echo "  const nearest = wasmFindNearestObject(x, y, category, maxDist)"
echo ""

echo "To enable experimental Green Tea GC build:"
echo "  ./build_wasm.sh --experimental"
echo ""

echo "================================================"
echo "Build complete!"
echo "================================================"
