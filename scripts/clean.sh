#!/bin/bash
# Clean script for removing generated files and caches

set -e

echo "Cleaning Town Builder project..."
echo ""

# Python cache files
echo "Removing Python cache files..."
find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
find . -type f -name "*.pyc" -delete 2>/dev/null || true
find . -type f -name "*.pyo" -delete 2>/dev/null || true
find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
echo "✓ Python cache files removed"
echo ""

# Build artifacts
echo "Removing build artifacts..."
rm -rf build/ dist/ 2>/dev/null || true
echo "✓ Build artifacts removed"
echo ""

# Optional: Clean WASM builds (uncomment if needed)
# echo "Removing WASM builds..."
# rm -f static/wasm/*.wasm 2>/dev/null || true
# echo "✓ WASM builds removed"
# echo ""

# Optional: Clean saved towns (BE CAREFUL!)
# echo "⚠️  Do you want to remove saved towns? (y/N)"
# read -r response
# if [[ "$response" =~ ^([yY][eE][sS]|[yY])$ ]]; then
#     rm -f data/towns/*.json 2>/dev/null || true
#     echo "✓ Saved towns removed"
# else
#     echo "Saved towns preserved"
# fi
# echo ""

echo "Cleanup complete!"
