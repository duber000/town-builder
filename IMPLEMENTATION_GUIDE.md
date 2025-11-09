# Implementation Guide: Go 1.24/1.25 WASM Physics Optimization

## Quick Start

### 1. Build the WASM Module

```bash
# Standard build (Go 1.24 with Swiss Tables)
./build_wasm.sh

# Experimental build (Go 1.25 with Green Tea GC)
./build_wasm.sh --experimental
```

### 2. Load WASM in HTML

Update your HTML to load the physics WASM module:

```html
<!-- Load WASM execution runtime -->
<script src="/static/js/wasm_exec.js"></script>

<!-- Load physics WASM module -->
<script>
  const go = new Go();
  WebAssembly.instantiateStreaming(
    fetch("/static/wasm/physics.wasm"),
    go.importObject
  ).then((result) => {
    go.run(result.instance);
  });
</script>
```

### 3. Import and Initialize in JavaScript

```javascript
import {
  initPhysicsWasm,
  updateSpatialGrid,
  checkCollision,
  findNearestObject,
  perfMonitor
} from './utils/physics_wasm.js';

// Wait for WASM to load
await initPhysicsWasm();

// Update spatial grid with scene objects
updateSpatialGrid(placedObjects);

// Check collisions
const collisions = checkCollision(carObject);

// Find nearest target
const nearest = findNearestObject(x, z, 'vehicles', 100);
```

---

## Integration with Existing Code

### Option A: Drop-in Replacement (Recommended)

Replace existing collision detection with WASM-accelerated version:

**Before (collision.js):**
```javascript
export function checkCollisions(car, placedObjects) {
    for (const obj of placedObjects) {
        if (car === obj) continue;
        if (checkAABBCollision(car, obj)) {
            return true;
        }
    }
    return false;
}
```

**After (collision.js with WASM):**
```javascript
import { checkCollision, updateSpatialGrid } from './utils/physics_wasm.js';

// Call once when objects change (add/remove/move significantly)
export function updateCollisionGrid(placedObjects) {
    updateSpatialGrid(placedObjects);
}

// Fast collision check using spatial grid
export function checkCollisions(car, placedObjects) {
    const wasmCollisions = checkCollision(car);

    // Fall back to JavaScript if WASM not available
    if (wasmCollisions === null) {
        return checkCollisionsJavaScript(car, placedObjects);
    }

    return wasmCollisions.length > 0;
}

// Keep original function as fallback
function checkCollisionsJavaScript(car, placedObjects) {
    for (const obj of placedObjects) {
        if (car === obj) continue;
        if (checkAABBCollision(car, obj)) {
            return true;
        }
    }
    return false;
}
```

### Option B: Hybrid Approach

Use WASM for heavy operations, JavaScript for simple cases:

```javascript
import { batchCheckCollisions, updateSpatialGrid } from './utils/physics_wasm.js';

export function updateMovingCars(movingCars, placedObjects) {
    // Update grid once per frame
    updateSpatialGrid(placedObjects);

    // Batch check all cars at once (more efficient)
    const results = batchCheckCollisions(movingCars);

    if (results) {
        // Process WASM results
        for (const { id, collisions } of results) {
            const car = movingCars.find(c => c.id === id);
            if (collisions.length > 0) {
                handleCarCollision(car);
            }
        }
    } else {
        // Fallback to JavaScript
        updateMovingCarsJavaScript(movingCars, placedObjects);
    }
}
```

---

## Integrating with Chase AI

Update chase AI to use fast nearest-object search:

**Before (car.js):**
```javascript
function findNearestTarget(car, placedObjects, targetType) {
    let nearestDist = Infinity;
    let nearestObj = null;

    for (const obj of placedObjects) {
        if (obj.userData.modelName !== targetType) continue;

        const dx = obj.position.x - car.position.x;
        const dz = obj.position.z - car.position.z;
        const dist = Math.sqrt(dx*dx + dz*dz);

        if (dist < nearestDist) {
            nearestDist = dist;
            nearestObj = obj;
        }
    }

    return nearestObj;
}
```

**After (car.js with WASM):**
```javascript
import { findNearestObject } from './utils/physics_wasm.js';

function findNearestTarget(car, placedObjects, targetType) {
    const result = findNearestObject(
        car.position.x,
        car.position.z,
        'vehicles', // Category
        100 // Max search distance
    );

    if (result) {
        // Find the actual object
        return placedObjects.find(obj => obj.id === result.id);
    }

    // Fallback to JavaScript
    return findNearestTargetJavaScript(car, placedObjects, targetType);
}
```

---

## Performance Monitoring

### Enable Performance Tracking

```javascript
import {
  updateSpatialGridTimed,
  checkCollisionTimed,
  perfMonitor
} from './utils/physics_wasm.js';

// Use timed versions for monitoring
updateSpatialGridTimed(placedObjects);
const collisions = checkCollisionTimed(car);

// Log performance stats
perfMonitor.logStats();
```

### Output Example

```
Physics WASM Performance Stats (ms):
┌─────────────────┬───────┬───────┬────────┬──────┬──────┬──────┬──────┐
│                 │ count │  avg  │ median │  p95 │  p99 │  min │  max │
├─────────────────┼───────┼───────┼────────┼──────┼──────┼──────┼──────┤
│ updateGrid      │   100 │ 0.234 │  0.210 │ 0.45 │ 0.67 │ 0.12 │ 0.89 │
│ checkCollision  │  1000 │ 0.045 │  0.042 │ 0.08 │ 0.12 │ 0.02 │ 0.15 │
│ batchCollision  │   100 │ 0.312 │  0.298 │ 0.52 │ 0.71 │ 0.18 │ 0.92 │
│ findNearest     │   500 │ 0.089 │  0.081 │ 0.15 │ 0.23 │ 0.04 │ 0.31 │
└─────────────────┴───────┴───────┴────────┴──────┴──────┴──────┴──────┘

Spatial Grid Stats:
{
  cellCount: 42,
  objectCount: 120,
  avgObjectsPerCell: 2.86
}
```

---

## Migration Checklist

### Phase 1: Add WASM Module (No Breaking Changes)

- [x] Build physics WASM module
- [ ] Add WASM loading to HTML
- [ ] Import physics_wasm.js utility
- [ ] Test that WASM loads successfully
- [ ] Verify console shows "Physics WASM module ready"

### Phase 2: Enable Spatial Grid (Gradual Migration)

- [ ] Call `updateSpatialGrid()` when placing objects
- [ ] Call `updateSpatialGrid()` when deleting objects
- [ ] Test grid updates with `getGridStats()`
- [ ] Verify grid cells contain correct objects

### Phase 3: Replace Collision Detection

- [ ] Update collision.js to use `checkCollision()`
- [ ] Keep JavaScript fallback for compatibility
- [ ] Test collision detection accuracy
- [ ] Compare performance before/after
- [ ] Measure frame time improvement

### Phase 4: Optimize Chase AI

- [ ] Update car.js to use `findNearestObject()`
- [ ] Test chase behavior unchanged
- [ ] Measure AI update time improvement
- [ ] Monitor grid stats for efficiency

### Phase 5: Enable Batch Operations

- [ ] Replace per-car collision checks with `batchCheckCollisions()`
- [ ] Test with 10+ moving cars
- [ ] Measure batch performance gain
- [ ] Optimize grid update frequency

### Phase 6: Performance Testing

- [ ] Test with 50+ objects
- [ ] Test with 100+ objects
- [ ] Test with 20+ moving cars
- [ ] Measure frame time at different scales
- [ ] Document performance improvements

---

## Troubleshooting

### WASM Module Not Loading

**Symptom:** Console shows "Physics WASM not loaded, using JavaScript fallback"

**Solutions:**
1. Check browser console for errors
2. Verify `/static/wasm/physics.wasm` is accessible
3. Ensure `wasm_exec.js` is loaded before WASM
4. Check MIME type: server must serve `.wasm` as `application/wasm`

### Collision Detection Inaccurate

**Symptom:** Objects pass through each other or collide incorrectly

**Solutions:**
1. Ensure bounding boxes are correct: `object.userData.boundingBox`
2. Call `updateSpatialGrid()` after moving objects significantly
3. Check grid cell size (10 units default, adjust in physics_wasm.go)
4. Verify object positions are serialized correctly

### Performance Not Improving

**Symptom:** WASM is slower than JavaScript

**Possible Causes:**
1. **Too few objects:** Overhead dominates (WASM wins at 20+ objects)
2. **Grid update too frequent:** Only update when objects move >1 cell
3. **JavaScript fallback active:** Check `isPhysicsWasmReady()`
4. **Wrong grid cell size:** Too small = too many cells, too large = too many objects per cell

**Optimal Settings:**
- Grid cell size: 10-20 units (depending on object size)
- Update frequency: Once per 5-10 frames, or when objects move >5 units
- Batch size: 5+ objects for batch operations

### Memory Issues

**Symptom:** Increasing memory usage over time

**Solutions:**
1. Clear spatial grid when resetting scene: `updateSpatialGrid([])`
2. Ensure objects are removed from grid when deleted
3. Monitor with: `perfMonitor.logStats()`
4. Check for object leaks in JavaScript (not WASM issue)

---

## Advanced: Testing Green Tea GC

Go 1.25 includes an experimental garbage collector optimized for programs with many small objects.

### Build with Green Tea GC

```bash
./build_wasm.sh --experimental
```

This creates `static/wasm/physics_greentea.wasm`.

### Load Experimental Build

Update HTML to load experimental build:

```html
<script>
  const go = new Go();
  WebAssembly.instantiateStreaming(
    // Change to experimental build
    fetch("/static/wasm/physics_greentea.wasm"),
    go.importObject
  ).then((result) => {
    go.run(result.instance);
  });
</script>
```

### Expected Improvements

With Green Tea GC:
- 20-40% reduction in GC pause time
- More consistent frame times
- Better worst-case latency

### Testing Methodology

1. **Baseline Test (Standard Build):**
   - Load scene with 100 objects, 20 cars
   - Run for 1000 frames
   - Record frame times with `performance.now()`
   - Calculate avg, p95, p99

2. **Green Tea Test (Experimental Build):**
   - Same scene configuration
   - Same 1000 frame test
   - Compare frame times

3. **Stress Test:**
   - Load scene with 200 objects, 50 cars
   - Monitor for GC pauses (will show as frame spikes)
   - Green Tea should have fewer/shorter spikes

### A/B Test Script

```javascript
const frameTimes = [];
let frameCount = 0;

function measureFrame() {
    const start = performance.now();

    // Your game loop here
    updateMovingCars();
    renderer.render(scene, camera);

    const duration = performance.now() - start;
    frameTimes.push(duration);

    frameCount++;
    if (frameCount >= 1000) {
        // Calculate statistics
        const sorted = [...frameTimes].sort((a, b) => a - b);
        const avg = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
        const p95 = sorted[Math.floor(sorted.length * 0.95)];
        const p99 = sorted[Math.floor(sorted.length * 0.99)];

        console.log('Frame Time Stats (ms):', {
            avg: avg.toFixed(2),
            p95: p95.toFixed(2),
            p99: p99.toFixed(2),
            max: Math.max(...frameTimes).toFixed(2)
        });

        return;
    }

    requestAnimationFrame(measureFrame);
}

measureFrame();
```

---

## Expected Performance Gains

Based on Go 1.24/1.25 features and algorithmic improvements:

| Operation | Before (JS) | After (WASM) | Improvement |
|-----------|------------|--------------|-------------|
| Collision Check (10 cars, 50 objects) | 1.5ms | 0.2ms | **87%** |
| Collision Check (20 cars, 100 objects) | 6.0ms | 0.4ms | **93%** |
| Chase AI Search (1 car, 100 targets) | 0.3ms | 0.03ms | **90%** |
| Chase AI Search (10 cars, 100 targets) | 3.0ms | 0.15ms | **95%** |
| Total CPU (20 cars, 100 objects) | 8-10ms | 2-3ms | **70%** |

**Note:** Actual gains depend on scene complexity and object count. WASM overhead makes it slower for <10 objects.

---

## Debugging Tools

### Enable WASM Debugging

Add to console:

```javascript
// Check if WASM is active
import { isPhysicsWasmReady, getGridStats } from './utils/physics_wasm.js';

console.log('WASM Ready:', isPhysicsWasmReady());
console.log('Grid Stats:', getGridStats());

// Monitor performance
import { perfMonitor } from './utils/physics_wasm.js';
setInterval(() => perfMonitor.logStats(), 5000); // Log every 5 seconds
```

### Visualize Spatial Grid

Add debug rendering to see grid cells:

```javascript
function debugRenderGrid() {
    const stats = getGridStats();
    if (!stats) return;

    const cellSize = 10; // Must match physics_wasm.go
    const material = new THREE.LineBasicMaterial({ color: 0x00ff00 });

    // Draw grid cells (simplified)
    for (let x = -50; x <= 50; x += cellSize) {
        for (let z = -50; z <= 50; z += cellSize) {
            const geometry = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(x, 0, z),
                new THREE.Vector3(x + cellSize, 0, z),
                new THREE.Vector3(x + cellSize, 0, z + cellSize),
                new THREE.Vector3(x, 0, z + cellSize),
                new THREE.Vector3(x, 0, z),
            ]);
            const line = new THREE.Line(geometry, material);
            scene.add(line);
        }
    }
}
```

---

## Next Steps

1. **Implement Phase 1-2** to get WASM module loaded
2. **Test with small scenes** (10-20 objects)
3. **Migrate collision detection** gradually
4. **Measure performance gains** with monitoring tools
5. **Optimize grid parameters** based on your object sizes
6. **Test Green Tea GC** once standard build is stable

For questions or issues, check:
- `GO_OPTIMIZATION_ANALYSIS.md` for detailed explanation
- Console logs for WASM loading status
- `perfMonitor.logStats()` for performance metrics

---

**Generated:** 2025-11-08
**Go Version:** 1.24.7
**Target:** WASM (js/wasm)
