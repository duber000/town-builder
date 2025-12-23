"""Pydantic models for request/response validation."""
from typing import Dict, List, Optional, Any
from pydantic import BaseModel


class Position(BaseModel):
    """3D position coordinates."""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class Rotation(BaseModel):
    """3D rotation coordinates."""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0


class Scale(BaseModel):
    """3D scale coordinates."""
    x: float = 1.0
    y: float = 1.0
    z: float = 1.0


class ModelData(BaseModel):
    """Model data for a placed object."""
    id: Optional[str] = None
    position: Optional[Position] = None
    rotation: Optional[Rotation] = None
    scale: Optional[Scale] = None
    driver: Optional[str] = None


class TownUpdateRequest(BaseModel):
    """Request to update town data."""
    townName: Optional[str] = None
    buildings: Optional[List[Dict[str, Any]]] = None
    terrain: Optional[List[Dict[str, Any]]] = None
    roads: Optional[List[Dict[str, Any]]] = None
    props: Optional[List[Dict[str, Any]]] = None
    driver: Optional[str] = None
    id: Optional[str] = None
    category: Optional[str] = None


class SaveTownRequest(BaseModel):
    """Request to save town data."""
    filename: Optional[str] = "town_data.json"
    data: Optional[Any] = None  # Can be array or dict depending on use case
    town_id: Optional[int] = None  # Changed to int to match Django's integer primary key
    townName: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    description: Optional[str] = None
    population: Optional[int] = None
    area: Optional[float] = None
    established_date: Optional[str] = None
    place_type: Optional[str] = None
    full_address: Optional[str] = None
    town_image: Optional[str] = None


class LoadTownRequest(BaseModel):
    """Request to load town data from file."""
    filename: str = "town_data.json"


class DeleteModelRequest(BaseModel):
    """Request to delete a model from the town."""
    id: Optional[str] = None
    category: str
    position: Optional[Position] = None


class EditModelRequest(BaseModel):
    """Request to edit a model in the town."""
    id: str
    category: str
    position: Optional[Position] = None
    rotation: Optional[Rotation] = None
    scale: Optional[Scale] = None


class CursorUpdate(BaseModel):
    """Cursor position update for collaborative cursors."""
    username: str
    position: Position  # 3D world position where cursor is pointing
    camera_position: Position  # Camera position for better context


class ApiResponse(BaseModel):
    """Standard API response."""
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    town_id: Optional[str] = None


# ===== Batch Operations =====

class BatchOperation(BaseModel):
    """Single operation in a batch request."""
    op: str  # create, update, delete, edit
    category: Optional[str] = None
    id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    position: Optional[Position] = None
class BuildingCreateRequest(BaseModel):
    """Request to create a new building programmatically."""
    model: str  # Model filename (e.g., "house.glb")
    category: str = "buildings"  # Category: buildings, vehicles, trees, props, street, park
    position: Position
    rotation: Optional[Rotation] = None
    scale: Optional[Scale] = None


class BatchOperationRequest(BaseModel):
    """Request to execute multiple operations in a single transaction."""
    operations: List[BatchOperation]
    validate: bool = True


class BatchOperationResult(BaseModel):
    """Result of a single batch operation."""
    success: bool
    op: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class BatchOperationResponse(BaseModel):
    """Response from batch operations."""
    status: str
    results: List[BatchOperationResult]
    successful: int
    failed: int


# ===== Spatial Queries =====

class SpatialQueryRadius(BaseModel):
    """Query objects within a radius."""
    type: str = "radius"
    center: Position
    radius: float
    category: Optional[str] = None
    limit: Optional[int] = None


class SpatialQueryBounds(BaseModel):
    """Query objects within a bounding box."""
    type: str = "bounds"
    min: Position
    max: Position
    category: Optional[str] = None
    limit: Optional[int] = None


class SpatialQueryNearest(BaseModel):
    """Find nearest objects to a point."""
    type: str = "nearest"
    point: Position
    category: Optional[str] = None
    count: int = 1
    max_distance: Optional[float] = None


# ===== Advanced Filtering =====

class FilterCondition(BaseModel):
    """Single filter condition."""
    field: str
    operator: str  # eq, ne, gt, lt, gte, lte, contains, in
    value: Any


class QueryRequest(BaseModel):
    """Advanced query/filter request."""
    category: Optional[str] = None
    filters: Optional[List[FilterCondition]] = None
    sort_by: Optional[str] = None
    sort_order: str = "asc"  # asc or desc
    limit: Optional[int] = None
    offset: int = 0


# ===== Snapshots =====

class SnapshotCreate(BaseModel):
    """Create a new snapshot."""
    name: Optional[str] = None
    description: Optional[str] = None


class SnapshotInfo(BaseModel):
    """Snapshot information."""
    id: str
    name: Optional[str] = None
    description: Optional[str] = None
    timestamp: float
    size: int  # Number of objects


class SnapshotListResponse(BaseModel):
    """List of snapshots."""
    status: str
    snapshots: List[SnapshotInfo]


# ===== History/Undo =====

class HistoryEntry(BaseModel):
    """Single history entry."""
    id: str
    timestamp: float
    operation: str
    category: Optional[str] = None
    object_id: Optional[str] = None
    data: Optional[Dict[str, Any]] = None


class HistoryResponse(BaseModel):
    """Operation history response."""
    status: str
    history: List[HistoryEntry]
    can_undo: bool
    can_redo: bool
class BuildingUpdateRequest(BaseModel):
    """Request to update a building programmatically."""
    position: Optional[Position] = None
    rotation: Optional[Rotation] = None
    scale: Optional[Scale] = None
    model: Optional[str] = None
    category: Optional[str] = None


class BuildingResponse(BaseModel):
    """Response with building data."""
    id: str
    model: str
    category: str
    position: Position
    rotation: Rotation
    scale: Scale
    driver: Optional[str] = None
