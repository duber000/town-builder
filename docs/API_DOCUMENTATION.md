# Town Builder API Documentation

## New Programmatic Building API Endpoints

### Buildings API (`/api/buildings`)

Programmatically manage buildings and objects in your town.

#### Create a Building

**POST** `/api/buildings`

Create a new building/object in the scene.

**Request Body:**
```json
{
  "model": "house.glb",
  "category": "buildings",
  "position": {
    "x": 5.0,
    "y": 0.0,
    "z": 3.0
  },
  "rotation": {
    "x": 0.0,
    "y": 1.57,
    "z": 0.0
  },
  "scale": {
    "x": 1.0,
    "y": 1.0,
    "z": 1.0
  }
}
```

**Response:**
```json
{
  "id": "obj_a1b2c3d4",
  "model": "house.glb",
  "category": "buildings",
  "position": {"x": 5.0, "y": 0.0, "z": 3.0},
  "rotation": {"x": 0.0, "y": 1.57, "z": 0.0},
  "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
  "driver": null
}
```

#### List All Buildings

**GET** `/api/buildings`

List all buildings/objects in the scene.

**Query Parameters:**
- `category` (optional): Filter by category (buildings, vehicles, trees, props, street, park)

**Response:**
```json
[
  {
    "id": "obj_a1b2c3d4",
    "model": "house.glb",
    "category": "buildings",
    "position": {"x": 5.0, "y": 0.0, "z": 3.0},
    "rotation": {"x": 0.0, "y": 1.57, "z": 0.0},
    "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
    "driver": null
  }
]
```

#### Get a Specific Building

**GET** `/api/buildings/{building_id}`

Get details of a specific building by ID.

**Response:**
```json
{
  "id": "obj_a1b2c3d4",
  "model": "house.glb",
  "category": "buildings",
  "position": {"x": 5.0, "y": 0.0, "z": 3.0},
  "rotation": {"x": 0.0, "y": 1.57, "z": 0.0},
  "scale": {"x": 1.0, "y": 1.0, "z": 1.0},
  "driver": null
}
```

#### Update a Building

**PUT** `/api/buildings/{building_id}`

Update a building's properties.

**Request Body:**
```json
{
  "position": {
    "x": 10.0,
    "y": 0.0,
    "z": 5.0
  },
  "rotation": {
    "x": 0.0,
    "y": 3.14,
    "z": 0.0
  },
  "scale": {
    "x": 1.5,
    "y": 1.5,
    "z": 1.5
  },
  "model": "office.glb",
  "category": "buildings"
}
```

**Response:**
```json
{
  "id": "obj_a1b2c3d4",
  "model": "office.glb",
  "category": "buildings",
  "position": {"x": 10.0, "y": 0.0, "z": 5.0},
  "rotation": {"x": 0.0, "y": 3.14, "z": 0.0},
  "scale": {"x": 1.5, "y": 1.5, "z": 1.5},
  "driver": null
}
```

#### Delete a Building

**DELETE** `/api/buildings/{building_id}`

Delete a building from the scene.

**Response:**
```json
{
  "status": "success",
  "message": "Building obj_a1b2c3d4 deleted successfully"
}
```

---

## Scene Description API (`/api/scene`)

Get detailed descriptions and statistics about your town scene.

#### Get Scene Description

**GET** `/api/scene/description`

Get a comprehensive natural language description of the scene with detailed analysis.

**Response:**
```json
{
  "status": "success",
  "data": {
    "description": "Scene: Downtown\nTotal objects: 15\nBuildings (5): 3 house, 2 office\nVehicles (4): 2 car, 1 truck, 1 police car, 2 in use\nTrees (4): 3 oak tree, 1 pine tree\nProps: 2 objects\nScene dimensions: 25.5 x 18.3 units",
    "analysis": {
      "town_name": "Downtown",
      "total_objects": 15,
      "categories": {
        "buildings": {
          "count": 5,
          "models": {
            "house.glb": 3,
            "office.glb": 2
          },
          "has_drivers": false,
          "driver_count": 0
        },
        "vehicles": {
          "count": 4,
          "models": {
            "car.glb": 2,
            "truck.glb": 1,
            "police_car.glb": 1
          },
          "has_drivers": true,
          "driver_count": 2
        }
      },
      "bounds": {
        "min": {"x": -10.5, "y": 0.0, "z": -8.2},
        "max": {"x": 15.0, "y": 5.0, "z": 10.1},
        "dimensions": {
          "width": 25.5,
          "height": 5.0,
          "depth": 18.3
        }
      }
    }
  }
}
```

#### Get Scene Statistics

**GET** `/api/scene/stats`

Get quick statistics about object counts in the scene.

**Response:**
```json
{
  "status": "success",
  "data": {
    "town_name": "Downtown",
    "buildings": 5,
    "vehicles": 4,
    "trees": 4,
    "props": 2,
    "street": 0,
    "park": 0,
    "terrain": 0,
    "roads": 0,
    "total": 15
  }
}
```

---

## Available Categories

- `buildings` - Residential and commercial buildings
- `vehicles` - Cars, trucks, and other vehicles
- `trees` - Trees and vegetation
- `props` - Generic decorative objects
- `street` - Street elements and signs
- `park` - Park furniture and objects
- `terrain` - Terrain objects
- `roads` - Road segments

---

## Example Usage

### Python Example

```python
import requests

BASE_URL = "http://localhost:5001/api"

# Create a building
response = requests.post(
    f"{BASE_URL}/buildings",
    json={
        "model": "house.glb",
        "category": "buildings",
        "position": {"x": 5.0, "y": 0.0, "z": 3.0},
        "rotation": {"x": 0.0, "y": 1.57, "z": 0.0},
        "scale": {"x": 1.0, "y": 1.0, "z": 1.0}
    }
)
building = response.json()
print(f"Created building with ID: {building['id']}")

# List all buildings
response = requests.get(f"{BASE_URL}/buildings")
buildings = response.json()
print(f"Total buildings: {len(buildings)}")

# Get scene description
response = requests.get(f"{BASE_URL}/scene/description")
scene = response.json()
print(scene['data']['description'])

# Update a building
response = requests.put(
    f"{BASE_URL}/buildings/{building['id']}",
    json={
        "position": {"x": 10.0, "y": 0.0, "z": 5.0}
    }
)
updated_building = response.json()
print(f"Updated building position: {updated_building['position']}")

# Delete a building
response = requests.delete(f"{BASE_URL}/buildings/{building['id']}")
print(response.json()['message'])
```

### JavaScript/Fetch Example

```javascript
const BASE_URL = 'http://localhost:5001/api';

// Create a building
const createBuilding = async () => {
  const response = await fetch(`${BASE_URL}/buildings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'house.glb',
      category: 'buildings',
      position: { x: 5.0, y: 0.0, z: 3.0 },
      rotation: { x: 0.0, y: 1.57, z: 0.0 },
      scale: { x: 1.0, y: 1.0, z: 1.0 }
    })
  });
  const building = await response.json();
  console.log('Created building:', building.id);
  return building;
};

// List all buildings
const listBuildings = async () => {
  const response = await fetch(`${BASE_URL}/buildings`);
  const buildings = await response.json();
  console.log('Total buildings:', buildings.length);
  return buildings;
};

// Get scene description
const getSceneDescription = async () => {
  const response = await fetch(`${BASE_URL}/scene/description`);
  const scene = await response.json();
  console.log(scene.data.description);
  return scene;
};

// Update a building
const updateBuilding = async (id) => {
  const response = await fetch(`${BASE_URL}/buildings/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      position: { x: 10.0, y: 0.0, z: 5.0 }
    })
  });
  const building = await response.json();
  console.log('Updated building:', building);
  return building;
};

// Delete a building
const deleteBuilding = async (id) => {
  const response = await fetch(`${BASE_URL}/buildings/${id}`, {
    method: 'DELETE'
  });
  const result = await response.json();
  console.log(result.message);
  return result;
};
```

### cURL Example

```bash
# Create a building
curl -X POST http://localhost:5001/api/buildings \
  -H "Content-Type: application/json" \
  -d '{
    "model": "house.glb",
    "category": "buildings",
    "position": {"x": 5.0, "y": 0.0, "z": 3.0},
    "rotation": {"x": 0.0, "y": 1.57, "z": 0.0},
    "scale": {"x": 1.0, "y": 1.0, "z": 1.0}
  }'

# List all buildings
curl http://localhost:5001/api/buildings

# Get scene description
curl http://localhost:5001/api/scene/description

# Update a building
curl -X PUT http://localhost:5001/api/buildings/obj_a1b2c3d4 \
  -H "Content-Type: application/json" \
  -d '{"position": {"x": 10.0, "y": 0.0, "z": 5.0}}'

# Delete a building
curl -X DELETE http://localhost:5001/api/buildings/obj_a1b2c3d4
```

---

## Real-time Updates

All building creation, updates, and deletions are automatically broadcast to all connected clients via Server-Sent Events (SSE). This ensures that changes made through the programmatic API are immediately reflected in all connected browser sessions.

The broadcast events follow these formats:

- **Create/Full Update**: `{"type": "full", "town": {...}}`
- **Edit**: `{"type": "edit", "category": "buildings", "id": "obj_123", "data": {...}}`
- **Delete**: `{"type": "delete", "category": "buildings", "id": "obj_123"}`

---

## Authentication

If JWT authentication is enabled (default), you'll need to include an `Authorization` header with your requests:

```
Authorization: Bearer <your_jwt_token>
```

For development, you can disable JWT authentication by setting `DISABLE_JWT_AUTH=true` in your environment variables.
