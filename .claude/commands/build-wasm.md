---
description: Rebuild WebAssembly modules from Go source
---

Rebuild the WebAssembly modules (physics.wasm and calc.wasm) from Go source code.

This is only needed if you've modified the Go source files:
- physics_wasm.go
- calc.go

Run: `./build_wasm.sh`

Or manually build specific module:
```bash
GOOS=js GOARCH=wasm go build -ldflags="-s -w" -o static/wasm/physics.wasm physics_wasm.go
```
