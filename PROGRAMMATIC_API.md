# Programmatic API for Claude Integration

This document describes the medium-level programmatic APIs added to Town Builder to enable better AI-driven interaction and automation.

## Overview

These APIs are designed to enable programmatic control of the Town Builder application, making it easy for AI assistants like Claude to:

- Execute multiple operations atomically
- Query and search town data spatially
- Filter and search with advanced criteria
- Manage operation history with undo/redo
- Create and restore snapshots for versioning

## Authentication

All endpoints require authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## API Endpoints

### 1. Batch Operations

Execute multiple create, update, delete, or edit operations in a single atomic transaction.

#### Execute Batch Operations

**Endpoint:** `POST /api/batch/operations`

**Request Body:**
```json
{
  "operations": [
    {
      "op": "create",
      "category": "buildings",
      "data": {
        "position": {"x": 10, "y": 0, "z": 5},
        "rotation": {"x": 0, "y": 0, "z": 0},
        "scale": {"x": 1, "y": 1, "z": 1}
      }
    },
    {
      "op": "update",
      "category": "vehicles",
      "id": "vehicle-123",
      "data": {
        "driver": "police"
      }
    },
    {
      "op": "delete",
      "category": "props",
      "id": "prop-456"
    },
    {
      "op": "delete",
      "category": "trees",
      "position": {"x": 15, "y": 0, "z": 8}
    },
    {
      "op": "edit",
      "category": "buildings",
      "id": "building-789",
      "position": {"x": 20, "y": 0, "z": 10},
      "rotation": {"x": 0, "y": 1.57, "z": 0}
    }
  ],
  "validate": true
}
```

**Response:**
```json
{
  "status": "success",
  "results": [
    {
      "success": true,
      "op": "create",
      "message": "Created object in buildings",
      "data": {"id": "abc-123", "category": "buildings"}
    },
    {
      "success": true,
      "op": "update",
      "message": "Updated object vehicle-123 in vehicles"
    }
  ],
  "successful": 4,
  "failed": 0
}
```

**Operation Types:**

- `create`: Create a new object in a category
  - Required: `category`, `data`
  - Optional: `data.id` (auto-generated if not provided)

- `update`: Update an existing object
  - Required: `category`, `id`, `data`
  - Merges `data` with existing object

- `delete`: Delete an object by ID or position
  - Option 1: Delete by ID
    - Required: `category`, `id`
  - Option 2: Delete by position (finds closest model within 2.0 unit radius)
    - Required: `category`, `position`
  - Returns distance to deleted object when using position

- `edit`: Edit object properties (position, rotation, scale)
  - Required: `category`, `id`
  - Optional: `position`, `rotation`, `scale`
  - Returns list of fields that were actually changed

**Features:**

- **Atomic execution**: All operations succeed or all fail
- **Automatic rollback**: If any operation fails, changes are not saved
- **History tracking**: Batch operations are recorded in history
- **Real-time sync**: Changes are broadcast to all connected clients

---

### 2. Spatial Queries

Query objects based on spatial relationships and proximity.

#### Query by Radius

Find all objects within a specified radius from a center point.

**Endpoint:** `POST /api/query/spatial/radius`

**Request Body:**
```json
{
  "type": "radius",
  "center": {"x": 0, "y": 0, "z": 0},
  "radius": 50,
  "category": "buildings",
  "limit": 10
}
```

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "results": [
    {
      "id": "building-1",
      "position": {"x": 10, "y": 0, "z": 5},
      "rotation": {"x": 0, "y": 0, "z": 0},
      "scale": {"x": 1, "y": 1, "z": 1},
      "category": "buildings",
      "distance": 11.18
    }
  ]
}
```

**Parameters:**

- `center`: Center point (required)
- `radius`: Search radius in world units (required)
- `category`: Filter by category (optional, searches all if not specified)
- `limit`: Maximum results to return (optional)

**Features:**

- Results sorted by distance (nearest first)
- Includes distance in results
- 3D Euclidean distance calculation

#### Query by Bounding Box

Find all objects within a 3D bounding box.

**Endpoint:** `POST /api/query/spatial/bounds`

**Request Body:**
```json
{
  "type": "bounds",
  "min": {"x": -10, "y": 0, "z": -10},
  "max": {"x": 10, "y": 10, "z": 10},
  "category": "vehicles",
  "limit": 20
}
```

**Response:**
```json
{
  "status": "success",
  "count": 3,
  "results": [
    {
      "id": "vehicle-1",
      "position": {"x": 5, "y": 0, "z": 0},
      "category": "vehicles"
    }
  ]
}
```

**Parameters:**

- `min`: Minimum corner of bounding box (required)
- `max`: Maximum corner of bounding box (required)
- `category`: Filter by category (optional)
- `limit`: Maximum results to return (optional)

#### Find Nearest Objects

Find the N nearest objects to a point.

**Endpoint:** `POST /api/query/spatial/nearest`

**Request Body:**
```json
{
  "type": "nearest",
  "point": {"x": 5, "y": 0, "z": 10},
  "category": "buildings",
  "count": 3,
  "max_distance": 100
}
```

**Response:**
```json
{
  "status": "success",
  "count": 3,
  "results": [
    {
      "id": "building-1",
      "position": {"x": 6, "y": 0, "z": 11},
      "category": "buildings",
      "distance": 1.41
    }
  ]
}
```

**Parameters:**

- `point`: Reference point (required)
- `category`: Filter by category (optional)
- `count`: Number of nearest objects to return (default: 1)
- `max_distance`: Maximum distance to search (optional)

---

### 3. Advanced Filtering

Execute complex queries with multiple filter conditions and sorting.

#### Advanced Query

**Endpoint:** `POST /api/query/advanced`

**Request Body:**
```json
{
  "category": "vehicles",
  "filters": [
    {
      "field": "driver",
      "operator": "eq",
      "value": "police"
    },
    {
      "field": "position.x",
      "operator": "gt",
      "value": 0
    }
  ],
  "sort_by": "position.x",
  "sort_order": "asc",
  "limit": 10,
  "offset": 0
}
```

**Response:**
```json
{
  "status": "success",
  "count": 5,
  "results": [
    {
      "id": "vehicle-1",
      "driver": "police",
      "position": {"x": 10, "y": 0, "z": 5},
      "category": "vehicles"
    }
  ]
}
```

**Filter Operators:**

- `eq`: Equal to
- `ne`: Not equal to
- `gt`: Greater than
- `lt`: Less than
- `gte`: Greater than or equal to
- `lte`: Less than or equal to
- `contains`: String contains (case-sensitive)
- `in`: Value in array

**Features:**

- Nested field access using dot notation (e.g., `position.x`)
- Multiple filter conditions (AND logic)
- Sorting by any field
- Pagination with limit and offset
- Category filtering (optional)

**Example Queries:**

1. Find all buildings with scale > 1:
```json
{
  "category": "buildings",
  "filters": [
    {"field": "scale.x", "operator": "gt", "value": 1}
  ]
}
```

2. Find all objects with a driver:
```json
{
  "filters": [
    {"field": "driver", "operator": "ne", "value": null}
  ]
}
```

3. Find objects in a specific area:
```json
{
  "filters": [
    {"field": "position.x", "operator": "gte", "value": 0},
    {"field": "position.x", "operator": "lte", "value": 100},
    {"field": "position.z", "operator": "gte", "value": 0},
    {"field": "position.z", "operator": "lte", "value": 100}
  ],
  "sort_by": "position.x"
}
```

---

### 4. History & Undo/Redo

Manage operation history and perform undo/redo operations.

#### Get History

**Endpoint:** `GET /api/history?limit=50`

**Response:**
```json
{
  "status": "success",
  "history": [
    {
      "id": "history-1",
      "timestamp": 1703001234.5,
      "operation": "batch",
      "category": null,
      "object_id": null,
      "data": null
    }
  ],
  "can_undo": true,
  "can_redo": false
}
```

**Parameters:**

- `limit`: Maximum number of history entries (default: 50, max: 100)

#### Undo Last Operation

**Endpoint:** `POST /api/history/undo`

**Response:**
```json
{
  "status": "success",
  "message": "Undid batch operation",
  "can_undo": true,
  "can_redo": true
}
```

**Features:**

- Restores town to previous state
- Moves operation to redo stack
- Broadcasts changes to all clients
- Returns whether more undo/redo operations are available

#### Redo Last Operation

**Endpoint:** `POST /api/history/redo`

**Response:**
```json
{
  "status": "success",
  "message": "Redid batch operation",
  "can_undo": true,
  "can_redo": false
}
```

#### Clear History

**Endpoint:** `DELETE /api/history`

**Response:**
```json
{
  "status": "success",
  "message": "History cleared"
}
```

**Note:** Clears both undo and redo stacks.

---

### 5. Snapshots

Create save points and restore town to previous states.

#### Create Snapshot

**Endpoint:** `POST /api/snapshots`

**Request Body:**
```json
{
  "name": "Before major redesign",
  "description": "Backup before redesigning downtown area"
}
```

**Response:**
```json
{
  "status": "success",
  "message": "Snapshot created",
  "snapshot": {
    "id": "snapshot-abc-123",
    "name": "Before major redesign",
    "description": "Backup before redesigning downtown area",
    "timestamp": 1703001234.5,
    "size": 42
  }
}
```

#### List Snapshots

**Endpoint:** `GET /api/snapshots`

**Response:**
```json
{
  "status": "success",
  "snapshots": [
    {
      "id": "snapshot-1",
      "name": "Before major redesign",
      "description": "Backup before redesigning downtown area",
      "timestamp": 1703001234.5,
      "size": 42
    }
  ]
}
```

**Features:**

- Snapshots sorted by timestamp (newest first)
- Automatic cleanup (keeps last 50 snapshots)

#### Get Snapshot

**Endpoint:** `GET /api/snapshots/{snapshot_id}`

**Response:**
```json
{
  "status": "success",
  "snapshot": {
    "id": "snapshot-1",
    "name": "Before major redesign",
    "timestamp": 1703001234.5,
    "size": 42
  },
  "data": {
    "buildings": [...],
    "vehicles": [...],
    "roads": [...],
    "props": [...]
  }
}
```

#### Restore Snapshot

**Endpoint:** `POST /api/snapshots/{snapshot_id}/restore`

**Response:**
```json
{
  "status": "success",
  "message": "Restored to snapshot: Before major redesign",
  "snapshot": {
    "id": "snapshot-1",
    "name": "Before major redesign",
    "timestamp": 1703001234.5,
    "size": 42
  }
}
```

**Features:**

- Restores entire town state
- Broadcasts changes to all clients
- Does not affect history (can be undone)

#### Delete Snapshot

**Endpoint:** `DELETE /api/snapshots/{snapshot_id}`

**Response:**
```json
{
  "status": "success",
  "message": "Snapshot deleted"
}
```

---

## Use Cases for Claude

### 1. Bulk Object Creation

Create multiple related objects in one operation:

```python
# Create a small neighborhood
POST /api/batch/operations
{
  "operations": [
    {"op": "create", "category": "buildings", "data": {"position": {"x": 0, "y": 0, "z": 0}}},
    {"op": "create", "category": "buildings", "data": {"position": {"x": 10, "y": 0, "z": 0}}},
    {"op": "create", "category": "buildings", "data": {"position": {"x": 20, "y": 0, "z": 0}}},
    {"op": "create", "category": "roads", "data": {"position": {"x": 5, "y": 0, "z": -5}}},
    {"op": "create", "category": "roads", "data": {"position": {"x": 15, "y": 0, "z": -5}}}
  ]
}
```

### 2. Query and Modify

Find objects and update them:

```python
# Step 1: Find all vehicles near spawn point
POST /api/query/spatial/radius
{
  "center": {"x": 0, "y": 0, "z": 0},
  "radius": 20,
  "category": "vehicles"
}

# Step 2: Update all found vehicles
POST /api/batch/operations
{
  "operations": [
    {"op": "update", "category": "vehicles", "id": "vehicle-1", "data": {"driver": "civilian"}},
    {"op": "update", "category": "vehicles", "id": "vehicle-2", "data": {"driver": "civilian"}}
  ]
}
```

### 3. Safe Experimentation

Create snapshot before making changes:

```python
# Step 1: Create backup
POST /api/snapshots
{"name": "Before AI modifications", "description": "Backup before Claude makes changes"}

# Step 2: Make changes
POST /api/batch/operations
{...}

# Step 3: If user doesn't like changes, restore
POST /api/snapshots/{snapshot_id}/restore
```

### 4. Complex Queries

Find specific objects with multiple criteria:

```python
# Find all large buildings in the northwest quadrant
POST /api/query/advanced
{
  "category": "buildings",
  "filters": [
    {"field": "position.x", "operator": "lt", "value": 0},
    {"field": "position.z", "operator": "lt", "value": 0},
    {"field": "scale.x", "operator": "gt", "value": 1.5}
  ],
  "sort_by": "scale.x",
  "sort_order": "desc"
}
```

### 5. Undo/Redo Workflow

Experiment and rollback if needed:

```python
# Make changes
POST /api/batch/operations
{...}

# User doesn't like it - undo
POST /api/history/undo

# Make different changes
POST /api/batch/operations
{...}

# User wants original back - undo again
POST /api/history/undo

# Actually, the second version was better - redo
POST /api/history/redo
```

---

## Error Handling

All endpoints return standard error responses:

```json
{
  "detail": "Error message here"
}
```

HTTP status codes:

- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (missing or invalid token)
- `404`: Not found (object/snapshot doesn't exist)
- `500`: Server error

---

## Best Practices

1. **Use batch operations** instead of individual API calls for better performance
2. **Create snapshots** before making significant changes
3. **Use spatial queries** when you need to find objects by location
4. **Use advanced queries** when you need complex filtering
5. **Check can_undo/can_redo** before offering undo/redo to users
6. **Validate operations** in batch requests to catch errors early
7. **Use pagination** (limit/offset) for large result sets

---

## Performance Notes

- **Batch operations**: Execute atomically and are more efficient than individual calls
- **Spatial queries**: Optimized for 3D distance calculations
- **Advanced queries**: Use efficient filtering and sorting
- **History**: Limited to 100 entries to prevent memory issues
- **Snapshots**: Limited to 50 per town, automatically cleaned up
- **Real-time sync**: All modifications broadcast via SSE to connected clients

---

## Integration with Existing APIs

These new APIs complement the existing Town Builder APIs:

- **Existing**: Individual CRUD operations (`/api/town`, `/api/town/model`)
- **New**: Batch operations, spatial queries, history, snapshots
- **Multiplayer**: All changes broadcast via existing SSE system (`/events`)
- **Authentication**: Uses existing JWT authentication
- **Storage**: Uses existing Redis/in-memory storage layer

All new APIs are fully compatible with the existing system and don't break any existing functionality.
