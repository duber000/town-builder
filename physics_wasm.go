//go:build js && wasm

package main

import (
	"math"
	"sync"
	"syscall/js"
)

// ============================================================================
// Data Structures
// ============================================================================

// Vec2 represents a 2D vector with float64 precision
type Vec2 struct {
	X, Y float64
}

// BoundingBox represents an axis-aligned bounding box
type BoundingBox struct {
	MinX, MinY, MaxX, MaxY float64
}

// CategoryMask represents object categories as bit flags for fast filtering
type CategoryMask uint32

const (
	CategoryUnknown   CategoryMask = 1 << iota // 0b00001
	CategoryVehicle                             // 0b00010
	CategoryBuilding                            // 0b00100
	CategoryTerrain                             // 0b01000
	CategoryProp                                // 0b10000
	CategoryRoad                                // 0b100000
	CategoryTree                                // 0b1000000
	CategoryPark                                // 0b10000000
)

// categoryFromString converts string category to bitmask
func categoryFromString(category string) CategoryMask {
	switch category {
	case "vehicles":
		return CategoryVehicle
	case "buildings":
		return CategoryBuilding
	case "terrain":
		return CategoryTerrain
	case "props":
		return CategoryProp
	case "roads":
		return CategoryRoad
	case "trees":
		return CategoryTree
	case "park":
		return CategoryPark
	default:
		return CategoryUnknown
	}
}

// GameObject represents a game object with position and bounding box
type GameObject struct {
	ID           int
	X, Y         float64
	BBox         BoundingBox
	Category     string       // Original string category
	CategoryMask CategoryMask // Bitmask for fast filtering
}

// GridKey represents a cell in the spatial grid
type GridKey struct {
	X, Y int
}

// ============================================================================
// Bit Vector for Grid Occupancy
// ============================================================================

// BitVector efficiently tracks grid cell occupancy
// Uses larger bit array to minimize hash collisions
type BitVector struct {
	bits             []uint64
	maxSize          int // Maximum size limit for security
	boundaryHitCount int // Track how many times safety check triggers (indicates hash issues)
	mu               sync.Mutex
}

const (
	bitVectorInitialSize = 8192  // 524288 bits initially (8x larger)
	bitVectorMaxSize     = 65536 // 4MB max (security limit)
)

// NewBitVector creates a new bit vector
func NewBitVector() *BitVector {
	return &BitVector{
		bits:    make([]uint64, bitVectorInitialSize),
		maxSize: bitVectorMaxSize,
	}
}

// gridKeyToIndex converts GridKey to a unique index
// Uses improved spatial hash to minimize collisions
func (bv *BitVector) gridKeyToIndex(key GridKey) uint {
	// Improved spatial hash with better distribution
	// Offset coordinates to handle negatives
	const offset = 16384 // Larger offset for better range
	x := uint(key.X + offset)
	y := uint(key.Y + offset)

	// Use prime numbers and bit rotation for better distribution
	hash := x*73856093 ^ y*19349669 ^ (x<<13 | x>>19) ^ (y<<7 | y>>25)
	return hash
}

// Set marks a grid cell as occupied
func (bv *BitVector) Set(key GridKey) {
	bv.mu.Lock()
	defer bv.mu.Unlock()

	hash := bv.gridKeyToIndex(key)
	// Use current size for modulo to ensure consistent hashing
	idx := hash % uint(len(bv.bits)*64)
	wordIdx := idx / 64
	bitIdx := idx % 64

	// Due to modulo operation above, wordIdx should always be < len(bv.bits)
	// This safety check should never trigger unless there's integer overflow or logic error
	if int(wordIdx) >= len(bv.bits) {
		// Track this anomaly - indicates potential hash distribution issue
		bv.boundaryHitCount++
		// Log first few occurrences for debugging
		if bv.boundaryHitCount <= 10 {
			println("WARNING: BitVector boundary hit detected!")
			println("  wordIdx:", int(wordIdx), "len(bits):", len(bv.bits))
			println("  GridKey:", key.X, key.Y, "hash:", hash, "idx:", idx)
			println("  Total boundary hits:", bv.boundaryHitCount)
		}
		// Wrap to stay safe, but this indicates a problem that should be investigated
		wordIdx = wordIdx % uint(len(bv.bits))
	}

	bv.bits[wordIdx] |= (1 << bitIdx)
}

// IsSet checks if a grid cell is occupied
func (bv *BitVector) IsSet(key GridKey) bool {
	bv.mu.Lock()
	defer bv.mu.Unlock()

	hash := bv.gridKeyToIndex(key)
	// Use current size for modulo to ensure consistent hashing
	idx := hash % uint(len(bv.bits)*64)
	wordIdx := idx / 64
	bitIdx := idx % 64

	// Due to modulo operation above, wordIdx should always be < len(bv.bits)
	// This safety check should never trigger unless there's integer overflow or logic error
	if int(wordIdx) >= len(bv.bits) {
		// Track this anomaly - indicates potential hash distribution issue
		bv.boundaryHitCount++
		// Log first few occurrences for debugging
		if bv.boundaryHitCount <= 10 {
			println("WARNING: BitVector boundary hit detected in IsSet!")
			println("  wordIdx:", int(wordIdx), "len(bits):", len(bv.bits))
			println("  GridKey:", key.X, key.Y, "hash:", hash, "idx:", idx)
			println("  Total boundary hits:", bv.boundaryHitCount)
		}
		// Wrap to stay safe, but this indicates a problem that should be investigated
		wordIdx = wordIdx % uint(len(bv.bits))
	}

	return (bv.bits[wordIdx] & (1 << bitIdx)) != 0
}

// Helper function for min
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// Clear resets all bits
func (bv *BitVector) Clear() {
	bv.mu.Lock()
	defer bv.mu.Unlock()

	for i := range bv.bits {
		bv.bits[i] = 0
	}
	// Reset boundary hit count on clear
	bv.boundaryHitCount = 0
}

// GetBoundaryHitCount returns the number of times boundary checks triggered
// Non-zero values indicate potential hash distribution issues
func (bv *BitVector) GetBoundaryHitCount() int {
	bv.mu.Lock()
	defer bv.mu.Unlock()
	return bv.boundaryHitCount
}

// ============================================================================
// Spatial Grid (Leveraging Go 1.24 Swiss Tables)
// ============================================================================

// SpatialGrid implements spatial partitioning for efficient collision detection
//
// Go 1.24 Performance Optimizations (enabled by default):
// - Swiss Tables: 30% faster map access, 35% faster assignment, 10-60% faster iteration
// - Better stack allocation: Small slices allocated on stack vs heap
// - Improved mutex performance: SpinbitMutex for faster RWMutex operations
// - Enhanced small object allocation
// - Bit vector for O(1) occupancy checks (saves memory and CPU)
type SpatialGrid struct {
	cellSize   float64
	cells      map[GridKey][]int // Swiss Tables for object storage
	occupancy  *BitVector        // Bit vector for fast occupancy checks
	mu         sync.RWMutex      // SpinbitMutex optimization
}

// NewSpatialGrid creates a new spatial grid with the given cell size
func NewSpatialGrid(cellSize float64) *SpatialGrid {
	return &SpatialGrid{
		cellSize:  cellSize,
		cells:     make(map[GridKey][]int, 256), // Swiss Tables optimization
		occupancy: NewBitVector(),               // Bit vector for fast occupancy checks
	}
}

// getCellKey returns the grid cell key for a given position
func (g *SpatialGrid) getCellKey(x, y float64) GridKey {
	return GridKey{
		X: int(math.Floor(x / g.cellSize)),
		Y: int(math.Floor(y / g.cellSize)),
	}
}

// getCellsForBBox returns all grid cells that intersect with a bounding box
func (g *SpatialGrid) getCellsForBBox(bbox BoundingBox) []GridKey {
	minKey := g.getCellKey(bbox.MinX, bbox.MinY)
	maxKey := g.getCellKey(bbox.MaxX, bbox.MaxY)

	// Go 1.25: This slice will likely be stack-allocated due to improved compiler
	cells := make([]GridKey, 0, (maxKey.X-minKey.X+1)*(maxKey.Y-minKey.Y+1))

	for x := minKey.X; x <= maxKey.X; x++ {
		for y := minKey.Y; y <= maxKey.Y; y++ {
			cells = append(cells, GridKey{X: x, Y: y})
		}
	}

	return cells
}

// Insert adds an object to the spatial grid
func (g *SpatialGrid) Insert(id int, bbox BoundingBox) {
	g.mu.Lock()
	defer g.mu.Unlock()

	cells := g.getCellsForBBox(bbox)
	for _, cell := range cells {
		g.cells[cell] = append(g.cells[cell], id)
		g.occupancy.Set(cell) // Mark cell as occupied in bit vector
	}
}

// Remove removes an object from the spatial grid
func (g *SpatialGrid) Remove(id int, bbox BoundingBox) {
	g.mu.Lock()
	defer g.mu.Unlock()

	cells := g.getCellsForBBox(bbox)
	for _, cell := range cells {
		objects := g.cells[cell]
		for i, objID := range objects {
			if objID == id {
				// Remove object from slice
				g.cells[cell] = append(objects[:i], objects[i+1:]...)
				break
			}
		}
	}
}

// Query returns all object IDs in cells that intersect with the given bounding box
// Uses bit vector for O(1) occupancy check before map lookup
func (g *SpatialGrid) Query(bbox BoundingBox) []int {
	g.mu.RLock()
	defer g.mu.RUnlock()

	cells := g.getCellsForBBox(bbox)
	seen := make(map[int]bool, 16) // Track unique objects
	results := make([]int, 0, 16)

	// Go 1.24: Map iteration is 10-60% faster with Swiss Tables
	for _, cell := range cells {
		// Bit vector pre-check: O(1) operation to skip empty cells
		if !g.occupancy.IsSet(cell) {
			continue // Cell definitely empty, skip expensive map lookup
		}

		if objects, exists := g.cells[cell]; exists {
			for _, id := range objects {
				if !seen[id] {
					seen[id] = true
					results = append(results, id)
				}
			}
		}
	}

	return results
}

// Clear removes all objects from the grid
func (g *SpatialGrid) Clear() {
	g.mu.Lock()
	defer g.mu.Unlock()

	// Go 1.24: Pre-sizing map for 35% faster subsequent assignments
	g.cells = make(map[GridKey][]int, 256)
	g.occupancy.Clear() // Clear bit vector
}

// ============================================================================
// Collision Detection
// ============================================================================

// checkAABBCollision checks if two axis-aligned bounding boxes intersect
func checkAABBCollision(a, b BoundingBox) bool {
	return a.MinX <= b.MaxX && a.MaxX >= b.MinX &&
		a.MinY <= b.MaxY && a.MaxY >= b.MinY
}

// Global spatial grid instance
var spatialGrid = NewSpatialGrid(10.0) // 10 unit cells

// Global object cache (Go 1.24: Better small object allocation)
var (
	objectCache   = make(map[int]GameObject, 256)
	objectCacheMu sync.RWMutex
)

// Note: Collision bloom filter removed as spatial grid already provides O(k) optimization
// Adding bloom filter on top would add memory/CPU overhead with minimal benefit

// ============================================================================
// WASM Exported Functions
// ============================================================================

// distance calculates Euclidean distance between two points
func distance(this js.Value, args []js.Value) interface{} {
	x1 := args[0].Float()
	y1 := args[1].Float()
	x2 := args[2].Float()
	y2 := args[3].Float()

	dx := x2 - x1
	dy := y2 - y1

	return js.ValueOf(math.Sqrt(dx*dx + dy*dy))
}

// updateSpatialGrid updates the spatial grid with current objects
// JavaScript signature: updateSpatialGrid(objects: Array<{id, x, y, bbox, category}>)
// Now includes category bitmask optimization and bloom filter population
func updateSpatialGrid(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf(false)
	}

	objectsArray := args[0]
	length := objectsArray.Length()

	// Clear grid and rebuild
	spatialGrid.Clear()

	objectCacheMu.Lock()
	objectCache = make(map[int]GameObject, length)
	objectCacheMu.Unlock()

	// Build object cache with category bitmasks
	for i := 0; i < length; i++ {
		obj := objectsArray.Index(i)

		id := obj.Get("id").Int()
		x := obj.Get("x").Float()
		y := obj.Get("y").Float()
		category := obj.Get("category").String()

		bboxJS := obj.Get("bbox")
		bbox := BoundingBox{
			MinX: bboxJS.Get("minX").Float(),
			MinY: bboxJS.Get("minY").Float(),
			MaxX: bboxJS.Get("maxX").Float(),
			MaxY: bboxJS.Get("maxY").Float(),
		}

		gameObj := GameObject{
			ID:           id,
			X:            x,
			Y:            y,
			BBox:         bbox,
			Category:     category,
			CategoryMask: categoryFromString(category), // Bitmask for fast filtering
		}

		objectCacheMu.Lock()
		objectCache[id] = gameObj
		objectCacheMu.Unlock()

		spatialGrid.Insert(id, bbox)
	}

	return js.ValueOf(true)
}

// checkCollision checks if a single object collides with any objects in the grid
// JavaScript signature: checkCollision(objId: number, bbox: {minX, minY, maxX, maxY}) -> number[]
// Uses spatial grid for O(k) complexity where k = nearby objects
func checkCollision(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return js.ValueOf([]interface{}{})
	}

	objID := args[0].Int()
	bboxJS := args[1]

	bbox := BoundingBox{
		MinX: bboxJS.Get("minX").Float(),
		MinY: bboxJS.Get("minY").Float(),
		MaxX: bboxJS.Get("maxX").Float(),
		MaxY: bboxJS.Get("maxY").Float(),
	}

	// Query spatial grid (O(k) where k = nearby objects)
	candidateIDs := spatialGrid.Query(bbox)

	collisions := make([]interface{}, 0, 8)

	objectCacheMu.RLock()
	defer objectCacheMu.RUnlock()

	// Check each candidate with AABB collision test
	// Spatial grid already reduced candidates from O(n) to O(k)
	for _, candidateID := range candidateIDs {
		if candidateID == objID {
			continue // Skip self
		}

		if candidate, exists := objectCache[candidateID]; exists {
			if checkAABBCollision(bbox, candidate.BBox) {
				collisions = append(collisions, candidateID)
			}
		}
	}

	return js.ValueOf(collisions)
}

// batchCheckCollisions checks multiple objects for collisions in a single call
// JavaScript signature: batchCheckCollisions(checks: Array<{id, bbox}>) -> Array<{id, collisions}>
// Uses spatial grid for efficient O(k) per-object complexity
func batchCheckCollisions(this js.Value, args []js.Value) interface{} {
	if len(args) < 1 {
		return js.ValueOf([]interface{}{})
	}

	checksArray := args[0]
	length := checksArray.Length()

	results := make([]interface{}, length)

	// Process all collision checks
	for i := 0; i < length; i++ {
		check := checksArray.Index(i)
		objID := check.Get("id").Int()
		bboxJS := check.Get("bbox")

		bbox := BoundingBox{
			MinX: bboxJS.Get("minX").Float(),
			MinY: bboxJS.Get("minY").Float(),
			MaxX: bboxJS.Get("maxX").Float(),
			MaxY: bboxJS.Get("maxY").Float(),
		}

		candidateIDs := spatialGrid.Query(bbox)
		collisions := make([]interface{}, 0, 8)

		objectCacheMu.RLock()
		for _, candidateID := range candidateIDs {
			if candidateID == objID {
				continue
			}

			if candidate, exists := objectCache[candidateID]; exists {
				if checkAABBCollision(bbox, candidate.BBox) {
					collisions = append(collisions, candidateID)
				}
			}
		}
		objectCacheMu.RUnlock()

		result := make(map[string]interface{})
		result["id"] = objID
		result["collisions"] = collisions
		results[i] = result
	}

	return js.ValueOf(results)
}

// findNearestObject finds the nearest object of a given category to a position
// JavaScript signature: findNearestObject(x: number, y: number, category: string, maxDistance: number) -> {id, distance} | null
// Now uses category bitmask for faster filtering (bit comparison vs string comparison)
func findNearestObject(this js.Value, args []js.Value) interface{} {
	if len(args) < 4 {
		return js.ValueOf(nil)
	}

	x := args[0].Float()
	y := args[1].Float()
	targetCategory := args[2].String()
	maxDistance := args[3].Float()

	// Convert category string to bitmask once (faster than repeated string comparisons)
	targetMask := categoryFromString(targetCategory)

	var nearestID int
	nearestDist := maxDistance
	found := false

	objectCacheMu.RLock()
	defer objectCacheMu.RUnlock()

	// Go 1.24: 10-60% faster map iteration with Swiss Tables
	for id, obj := range objectCache {
		// Category bitmask comparison (1 CPU cycle vs ~10+ for string comparison)
		if obj.CategoryMask != targetMask {
			continue
		}

		dx := obj.X - x
		dy := obj.Y - y
		dist := math.Sqrt(dx*dx + dy*dy)

		if dist < nearestDist {
			nearestDist = dist
			nearestID = id
			found = true
		}
	}

	if !found {
		return js.ValueOf(nil)
	}

	result := make(map[string]interface{})
	result["id"] = nearestID
	result["distance"] = nearestDist

	return js.ValueOf(result)
}

// findObjectsInRadius finds all objects within a given radius
// JavaScript signature: findObjectsInRadius(x: number, y: number, radius: number, category?: string) -> Array<{id, distance}>
// Now uses category bitmask for faster filtering
func findObjectsInRadius(this js.Value, args []js.Value) interface{} {
	if len(args) < 3 {
		return js.ValueOf([]interface{}{})
	}

	x := args[0].Float()
	y := args[1].Float()
	radius := args[2].Float()

	var filterMask CategoryMask
	useFilter := false
	if len(args) >= 4 && !args[3].IsNull() && !args[3].IsUndefined() {
		filterCategory := args[3].String()
		filterMask = categoryFromString(filterCategory)
		useFilter = true
	}

	// Create bounding box for spatial query
	bbox := BoundingBox{
		MinX: x - radius,
		MinY: y - radius,
		MaxX: x + radius,
		MaxY: y + radius,
	}

	candidateIDs := spatialGrid.Query(bbox)
	results := make([]interface{}, 0, len(candidateIDs))

	objectCacheMu.RLock()
	defer objectCacheMu.RUnlock()

	radiusSq := radius * radius

	for _, id := range candidateIDs {
		obj, exists := objectCache[id]
		if !exists {
			continue
		}

		// Category bitmask filtering (faster than string comparison)
		if useFilter && obj.CategoryMask != filterMask {
			continue
		}

		dx := obj.X - x
		dy := obj.Y - y
		distSq := dx*dx + dy*dy

		if distSq <= radiusSq {
			result := make(map[string]interface{})
			result["id"] = id
			result["distance"] = math.Sqrt(distSq)
			results = append(results, result)
		}
	}

	return js.ValueOf(results)
}

// getGridStats returns statistics about the spatial grid for debugging
// JavaScript signature: getGridStats() -> {cellCount, objectCount, avgObjectsPerCell, boundaryHitCount}
func getGridStats(this js.Value, args []js.Value) interface{} {
	spatialGrid.mu.RLock()
	defer spatialGrid.mu.RUnlock()

	cellCount := len(spatialGrid.cells)
	totalObjects := 0

	for _, objects := range spatialGrid.cells {
		totalObjects += len(objects)
	}

	avgObjectsPerCell := 0.0
	if cellCount > 0 {
		avgObjectsPerCell = float64(totalObjects) / float64(cellCount)
	}

	// Get boundary hit count for hash distribution monitoring
	boundaryHitCount := spatialGrid.occupancy.GetBoundaryHitCount()

	result := make(map[string]interface{})
	result["cellCount"] = cellCount
	result["objectCount"] = totalObjects
	result["avgObjectsPerCell"] = avgObjectsPerCell
	result["boundaryHitCount"] = boundaryHitCount

	return js.ValueOf(result)
}

// ============================================================================
// Car Physics
// ============================================================================

// CarState represents the state of a car for physics simulation
type CarState struct {
	X, Z         float64
	RotationY    float64
	VelocityX    float64
	VelocityZ    float64
}

// InputState represents player input for car control
type InputState struct {
	Forward  bool
	Backward bool
	Left     bool
	Right    bool
}

// updateCarPhysics updates car physics based on input
// JavaScript signature: updateCarPhysics(carState, inputState) -> carState
func updateCarPhysics(this js.Value, args []js.Value) interface{} {
	if len(args) < 2 {
		return js.ValueOf(nil)
	}

	// Physics constants
	const (
		ACCELERATION  = 0.005
		MAX_SPEED     = 0.2
		FRICTION      = 0.98
		BRAKE_POWER   = 0.01
		ROTATE_SPEED  = 0.04
	)

	// Parse car state
	carJS := args[0]
	car := CarState{
		X:         carJS.Get("x").Float(),
		Z:         carJS.Get("z").Float(),
		RotationY: carJS.Get("rotation_y").Float(),
		VelocityX: carJS.Get("velocity_x").Float(),
		VelocityZ: carJS.Get("velocity_z").Float(),
	}

	// Parse input state
	inputJS := args[1]
	input := InputState{
		Forward:  inputJS.Get("forward").Bool(),
		Backward: inputJS.Get("backward").Bool(),
		Left:     inputJS.Get("left").Bool(),
		Right:    inputJS.Get("right").Bool(),
	}

	// Handle steering
	if input.Left {
		car.RotationY += ROTATE_SPEED
	}
	if input.Right {
		car.RotationY -= ROTATE_SPEED
	}

	// Calculate forward vector based on rotation
	forwardX := math.Sin(car.RotationY)
	forwardZ := math.Cos(car.RotationY)

	// Handle acceleration
	if input.Forward {
		car.VelocityX += forwardX * ACCELERATION
		car.VelocityZ += forwardZ * ACCELERATION
	}

	// Handle braking/reverse
	if input.Backward {
		// Calculate current speed and dot product
		speed := math.Sqrt(car.VelocityX*car.VelocityX + car.VelocityZ*car.VelocityZ)
		dot := car.VelocityX*forwardX + car.VelocityZ*forwardZ

		if dot > 0.0 && speed > 0.0 {
			// Brake when moving forward
			car.VelocityX -= (car.VelocityX / speed) * BRAKE_POWER
			car.VelocityZ -= (car.VelocityZ / speed) * BRAKE_POWER
		} else {
			// Accelerate backward
			car.VelocityX -= forwardX * ACCELERATION
			car.VelocityZ -= forwardZ * ACCELERATION
		}
	}

	// Apply friction
	car.VelocityX *= FRICTION
	car.VelocityZ *= FRICTION

	// Clamp speed to max
	speed := math.Sqrt(car.VelocityX*car.VelocityX + car.VelocityZ*car.VelocityZ)
	if speed > MAX_SPEED {
		car.VelocityX = (car.VelocityX / speed) * MAX_SPEED
		car.VelocityZ = (car.VelocityZ / speed) * MAX_SPEED
	}

	// Stop tiny movements
	if speed < 0.001 {
		car.VelocityX = 0.0
		car.VelocityZ = 0.0
	}

	// Update position
	car.X += car.VelocityX
	car.Z += car.VelocityZ

	// Return updated state
	result := make(map[string]interface{})
	result["x"] = car.X
	result["z"] = car.Z
	result["rotation_y"] = car.RotationY
	result["velocity_x"] = car.VelocityX
	result["velocity_z"] = car.VelocityZ

	return js.ValueOf(result)
}

// ============================================================================
// Registration and Main
// ============================================================================

func registerCallbacks() {
	// Original function
	js.Global().Set("calcDistance", js.FuncOf(distance))

	// Spatial grid functions (Go 1.24 optimized)
	js.Global().Set("wasmUpdateSpatialGrid", js.FuncOf(updateSpatialGrid))
	js.Global().Set("wasmCheckCollision", js.FuncOf(checkCollision))
	js.Global().Set("wasmBatchCheckCollisions", js.FuncOf(batchCheckCollisions))

	// Search functions (Go 1.24 fast map iteration)
	js.Global().Set("wasmFindNearestObject", js.FuncOf(findNearestObject))
	js.Global().Set("wasmFindObjectsInRadius", js.FuncOf(findObjectsInRadius))

	// Car physics
	js.Global().Set("wasmUpdateCarPhysics", js.FuncOf(updateCarPhysics))

	// Debugging
	js.Global().Set("wasmGetGridStats", js.FuncOf(getGridStats))
}

func main() {
	c := make(chan struct{}, 0)
	registerCallbacks()
	println("Physics WASM module loaded (Go 1.25+ with GreenTea GC)")
	println("Optimizations: Swiss Tables, SpinbitMutex, GreenTea GC (experimental)")
	println("Performance: 30-60% faster map operations, reduced GC pauses")
	println("Car physics: Acceleration, steering, friction (WASM-powered)")
	<-c // Keep Go running
}
