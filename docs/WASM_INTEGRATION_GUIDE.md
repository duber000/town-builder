# TinyGo WebAssembly Integration Guide

This guide explains how to integrate your TinyGo-compiled WebAssembly module (`calc.wasm`) into the existing JavaScript codebase to offload collision detection and AI calculations.

## Prerequisites
- Include `wasm_exec.js` in your HTML.
- Build your Wasm binary with TinyGo (or Go 1.20+):
```bash
# Using TinyGo:
tinygo build -o calc.wasm -target wasm calc.go
# Or with Go (requires Go 1.20+):
GOOS=js GOARCH=wasm go build -o calc.wasm calc.go
```

## Loading the Wasm Module
In your `templates/index.html`, before your main scripts:
```html
<script src="/static/js/wasm_exec.js"></script>
<script>
  const go = new Go();
  WebAssembly.instantiateStreaming(fetch("/static/wasm/calc.wasm"), go.importObject)
    .then(result => go.run(result.instance));
</script>
```

## Expose Helper Function
TinyGo’s `main()` registers a global `calcDistance(x1, y1, x2, y2)` function. Ensure your scene code waits until `window.calcDistance` is defined.

## Updating `static/js/scene.js`
1. Wrap your initialization logic to defer until Wasm is ready:
   ```js
   async function initWasm() {
     while (typeof calcDistance !== "function") {
       await new Promise(r => setTimeout(r, 50));
     }
     startScene();
   }
   initWasm();
   ```
2. Replace Three.js vector distance calls:
   ```js
   // Before:
   // const distance = car.position.distanceTo(target.position);
   // After:
   const { x: x1, y: y1 } = car.position;
   const { x: x2, y: y2 } = target.position;
   const distance = calcDistance(x1, y1, x2, y2);
   ```

## Updating `static/js/controls.js`
- Use `calcDistance` instead of manual JS computations for any proximity or hit-test logic.

## Build & Deployment
- Copy `calc.wasm` to `static/wasm/` and `wasm_exec.js` to `static/js/`.
- Update your `Dockerfile` to include the `static/wasm/` directory and the JS helper under `static/js/` in the container.

## Testing & Validation
- In the browser console, verify:
  ```js
  typeof calcDistance; // "function"
  calcDistance(0,0,3,4); // 5
  ```
- Profile FPS and CPU usage to compare JS vs Wasm performance.