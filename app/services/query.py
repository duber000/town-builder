"""Query and spatial search service for town data."""
import logging
import math
from typing import Dict, List, Any, Optional, Callable

from app.services.storage import get_town_data

logger = logging.getLogger(__name__)


class QueryManager:
    """Manages queries and spatial searches on town data."""

    def spatial_query_radius(
        self,
        center: Dict[str, float],
        radius: float,
        category: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find objects within a radius from a center point.

        Args:
            center: Center point with x, y, z coordinates
            radius: Search radius
            category: Optional category filter
            limit: Optional result limit

        Returns:
            List of objects within the radius
        """
        town_data = get_town_data()
        results = []

        # Determine categories to search
        categories = [category] if category else self._get_all_categories(town_data)

        for cat in categories:
            if cat not in town_data:
                continue

            for obj in town_data[cat]:
                if not isinstance(obj, dict):
                    continue

                pos = obj.get("position", {})
                distance = self._calculate_distance(center, pos)

                if distance <= radius:
                    results.append({
                        **obj,
                        "category": cat,
                        "distance": distance
                    })

        # Sort by distance
        results.sort(key=lambda x: x["distance"])

        # Apply limit
        if limit:
            results = results[:limit]

        logger.info(f"Radius query: found {len(results)} objects within {radius} units")
        return results

    def spatial_query_bounds(
        self,
        min_point: Dict[str, float],
        max_point: Dict[str, float],
        category: Optional[str] = None,
        limit: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """Find objects within a bounding box.

        Args:
            min_point: Minimum corner of bounding box
            max_point: Maximum corner of bounding box
            category: Optional category filter
            limit: Optional result limit

        Returns:
            List of objects within the bounds
        """
        town_data = get_town_data()
        results = []

        # Determine categories to search
        categories = [category] if category else self._get_all_categories(town_data)

        for cat in categories:
            if cat not in town_data:
                continue

            for obj in town_data[cat]:
                if not isinstance(obj, dict):
                    continue

                pos = obj.get("position", {})
                if self._is_within_bounds(pos, min_point, max_point):
                    results.append({
                        **obj,
                        "category": cat
                    })

        # Apply limit
        if limit:
            results = results[:limit]

        logger.info(f"Bounds query: found {len(results)} objects")
        return results

    def spatial_query_nearest(
        self,
        point: Dict[str, float],
        category: Optional[str] = None,
        count: int = 1,
        max_distance: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Find nearest objects to a point.

        Args:
            point: Reference point
            category: Optional category filter
            count: Number of nearest objects to return
            max_distance: Optional maximum distance filter

        Returns:
            List of nearest objects
        """
        town_data = get_town_data()
        results = []

        # Determine categories to search
        categories = [category] if category else self._get_all_categories(town_data)

        for cat in categories:
            if cat not in town_data:
                continue

            for obj in town_data[cat]:
                if not isinstance(obj, dict):
                    continue

                pos = obj.get("position", {})
                distance = self._calculate_distance(point, pos)

                if max_distance is None or distance <= max_distance:
                    results.append({
                        **obj,
                        "category": cat,
                        "distance": distance
                    })

        # Sort by distance and take top N
        results.sort(key=lambda x: x["distance"])
        results = results[:count]

        logger.info(f"Nearest query: found {len(results)} objects")
        return results

    def advanced_query(
        self,
        category: Optional[str] = None,
        filters: Optional[List[Dict[str, Any]]] = None,
        sort_by: Optional[str] = None,
        sort_order: str = "asc",
        limit: Optional[int] = None,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """Execute advanced query with filters and sorting.

        Args:
            category: Optional category filter
            filters: List of filter conditions
            sort_by: Field to sort by
            sort_order: Sort order (asc or desc)
            limit: Optional result limit
            offset: Result offset for pagination

        Returns:
            List of matching objects
        """
        town_data = get_town_data()
        results = []

        # Determine categories to search
        categories = [category] if category else self._get_all_categories(town_data)

        for cat in categories:
            if cat not in town_data:
                continue

            for obj in town_data[cat]:
                if not isinstance(obj, dict):
                    continue

                # Add category to object
                obj_with_cat = {**obj, "category": cat}

                # Apply filters
                if filters:
                    if self._matches_filters(obj_with_cat, filters):
                        results.append(obj_with_cat)
                else:
                    results.append(obj_with_cat)

        # Sort results
        if sort_by:
            reverse = (sort_order == "desc")
            results.sort(
                key=lambda x: self._get_nested_value(x, sort_by),
                reverse=reverse
            )

        # Apply pagination
        total = len(results)
        results = results[offset:]
        if limit:
            results = results[:limit]

        logger.info(f"Advanced query: found {total} objects, returning {len(results)}")
        return results

    def _calculate_distance(
        self,
        point1: Dict[str, float],
        point2: Dict[str, float]
    ) -> float:
        """Calculate Euclidean distance between two points.

        Args:
            point1: First point
            point2: Second point

        Returns:
            Distance between points
        """
        x1 = point1.get("x", 0)
        y1 = point1.get("y", 0)
        z1 = point1.get("z", 0)

        x2 = point2.get("x", 0)
        y2 = point2.get("y", 0)
        z2 = point2.get("z", 0)

        dx = x2 - x1
        dy = y2 - y1
        dz = z2 - z1

        return math.sqrt(dx*dx + dy*dy + dz*dz)

    def _is_within_bounds(
        self,
        point: Dict[str, float],
        min_point: Dict[str, float],
        max_point: Dict[str, float]
    ) -> bool:
        """Check if a point is within bounding box.

        Args:
            point: Point to check
            min_point: Minimum corner
            max_point: Maximum corner

        Returns:
            True if within bounds
        """
        x = point.get("x", 0)
        y = point.get("y", 0)
        z = point.get("z", 0)

        return (
            min_point.get("x", float('-inf')) <= x <= max_point.get("x", float('inf')) and
            min_point.get("y", float('-inf')) <= y <= max_point.get("y", float('inf')) and
            min_point.get("z", float('-inf')) <= z <= max_point.get("z", float('inf'))
        )

    def _matches_filters(
        self,
        obj: Dict[str, Any],
        filters: List[Dict[str, Any]]
    ) -> bool:
        """Check if object matches all filters.

        Args:
            obj: Object to check
            filters: List of filter conditions

        Returns:
            True if all filters match
        """
        for filter_cond in filters:
            field = filter_cond.get("field")
            operator = filter_cond.get("operator")
            value = filter_cond.get("value")

            obj_value = self._get_nested_value(obj, field)

            if not self._evaluate_condition(obj_value, operator, value):
                return False

        return True

    def _get_nested_value(self, obj: Dict[str, Any], field: str) -> Any:
        """Get nested value from object using dot notation.

        Args:
            obj: Object to get value from
            field: Field name (supports dot notation like "position.x")

        Returns:
            Field value or None
        """
        parts = field.split(".")
        value = obj

        for part in parts:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None

        return value

    def _evaluate_condition(
        self,
        obj_value: Any,
        operator: str,
        filter_value: Any
    ) -> bool:
        """Evaluate a filter condition.

        Args:
            obj_value: Value from object
            operator: Comparison operator
            filter_value: Value to compare against

        Returns:
            True if condition is met
        """
        if obj_value is None:
            return False

        try:
            if operator == "eq":
                return obj_value == filter_value
            elif operator == "ne":
                return obj_value != filter_value
            elif operator == "gt":
                return obj_value > filter_value
            elif operator == "lt":
                return obj_value < filter_value
            elif operator == "gte":
                return obj_value >= filter_value
            elif operator == "lte":
                return obj_value <= filter_value
            elif operator == "contains":
                return filter_value in str(obj_value)
            elif operator == "in":
                return obj_value in filter_value
            else:
                logger.warning(f"Unknown operator: {operator}")
                return False
        except Exception as e:
            logger.warning(f"Filter evaluation error: {e}")
            return False

    def _get_all_categories(self, town_data: Dict[str, Any]) -> List[str]:
        """Get all valid categories from town data.

        Args:
            town_data: Town data

        Returns:
            List of category names
        """
        return [
            key for key, value in town_data.items()
            if isinstance(value, list) and key not in ["snapshots", "history"]
        ]


# Global query manager instance
query_manager = QueryManager()
