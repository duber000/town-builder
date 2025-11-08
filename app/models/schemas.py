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
    data: Optional[Dict[str, Any]] = None
    town_id: Optional[str] = None
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


class ApiResponse(BaseModel):
    """Standard API response."""
    status: str
    message: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    town_id: Optional[str] = None
