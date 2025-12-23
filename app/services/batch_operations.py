"""Batch operations service for executing multiple operations atomically."""
import logging
import uuid
from typing import Dict, List, Any, Optional, Tuple

from app.services.storage import get_town_data, set_town_data
from app.services.events import broadcast_sse
from app.services.history import history_manager

logger = logging.getLogger(__name__)


class BatchOperationsManager:
    """Manages batch operations on town data."""

    def execute_operations(
        self,
        operations: List[Dict[str, Any]],
        validate: bool = True
    ) -> Tuple[List[Dict[str, Any]], int, int]:
        """Execute a batch of operations.

        Args:
            operations: List of operations to execute
            validate: Whether to validate operations before executing

        Returns:
            Tuple of (results, successful_count, failed_count)
        """
        results = []
        successful = 0
        failed = 0

        # Get current town data
        town_data = get_town_data()
        original_town_data = town_data.copy()

        # Track changes for history
        changes = []

        try:
            for op_data in operations:
                op_type = op_data.get("op")
                result = self._execute_single_operation(town_data, op_data, validate)

                if result["success"]:
                    successful += 1
                    changes.append(op_data)
                else:
                    failed += 1

                results.append(result)

            # If all operations succeeded, save the changes
            if failed == 0:
                set_town_data(town_data)

                # Add to history
                history_manager.add_entry(
                    operation="batch",
                    before_state=original_town_data,
                    after_state=town_data
                )

                # Broadcast full update
                broadcast_sse({'type': 'full', 'town': town_data})
                logger.info(f"Batch operations completed: {successful} successful, {failed} failed")
            else:
                # Rollback on any failure
                logger.warning(f"Batch operations had failures, rolling back. {successful} successful, {failed} failed")
                # Don't save changes if any operation failed

        except Exception as e:
            logger.error(f"Batch operations error: {e}", exc_info=True)
            # Return error for all remaining operations
            failed = len(operations)
            successful = 0
            results = [
                {
                    "success": False,
                    "op": op.get("op", "unknown"),
                    "message": f"Batch execution failed: {str(e)}"
                }
                for op in operations
            ]

        return results, successful, failed

    def _execute_single_operation(
        self,
        town_data: Dict[str, Any],
        op_data: Dict[str, Any],
        validate: bool
    ) -> Dict[str, Any]:
        """Execute a single operation.

        Args:
            town_data: Current town data (modified in place)
            op_data: Operation data
            validate: Whether to validate the operation

        Returns:
            Operation result
        """
        op_type = op_data.get("op")

        try:
            if op_type == "create":
                return self._create_object(town_data, op_data, validate)
            elif op_type == "update":
                return self._update_object(town_data, op_data, validate)
            elif op_type == "delete":
                return self._delete_object(town_data, op_data, validate)
            elif op_type == "edit":
                # Convert edit operations to update operations for consistency
                return self._edit_object(town_data, op_data, validate)
            else:
                return {
                    "success": False,
                    "op": op_type,
                    "message": f"Unknown operation type: {op_type}"
                }

        except Exception as e:
            logger.error(f"Operation {op_type} failed: {e}")
            return {
                "success": False,
                "op": op_type,
                "message": str(e)
            }

    def _create_object(
        self,
        town_data: Dict[str, Any],
        op_data: Dict[str, Any],
        validate: bool
    ) -> Dict[str, Any]:
        """Create a new object."""
        category = op_data.get("category")
        data = op_data.get("data", {})

        if not category:
            return {"success": False, "op": "create", "message": "Missing category"}

        # Ensure category exists
        if category not in town_data:
            town_data[category] = []

        # Generate ID if not provided
        if "id" not in data:
            data["id"] = str(uuid.uuid4())

        # Validate if required
        if validate and not self._validate_object(data):
            return {"success": False, "op": "create", "message": "Object validation failed"}

        # Add object
        town_data[category].append(data)

        return {
            "success": True,
            "op": "create",
            "message": f"Created object in {category}",
            "data": {"id": data["id"], "category": category}
        }

    def _update_object(
        self,
        town_data: Dict[str, Any],
        op_data: Dict[str, Any],
        validate: bool
    ) -> Dict[str, Any]:
        """Update an existing object."""
        category = op_data.get("category")
        object_id = op_data.get("id")
        data = op_data.get("data", {})

        if not category or not object_id:
            return {"success": False, "op": "update", "message": "Missing category or id"}

        if category not in town_data:
            return {"success": False, "op": "update", "message": f"Category {category} not found"}

        # Find and update object
        for i, obj in enumerate(town_data[category]):
            if obj.get("id") == object_id:
                # Merge data
                town_data[category][i] = {**obj, **data}

                return {
                    "success": True,
                    "op": "update",
                    "message": f"Updated object {object_id} in {category}",
                    "data": {"id": object_id, "category": category}
                }

        return {"success": False, "op": "update", "message": f"Object {object_id} not found"}

    def _delete_object(
        self,
        town_data: Dict[str, Any],
        op_data: Dict[str, Any],
        validate: bool
    ) -> Dict[str, Any]:
        """Delete an object by ID or by position."""
        category = op_data.get("category")
        object_id = op_data.get("id")
        position = op_data.get("position")

        if not category:
            return {"success": False, "op": "delete", "message": "Missing category"}

        if not object_id and not position:
            return {"success": False, "op": "delete", "message": "Missing both id and position"}

        if category not in town_data:
            return {"success": False, "op": "delete", "message": f"Category {category} not found"}

        # Delete by ID
        if object_id:
            for i, obj in enumerate(town_data[category]):
                if obj.get("id") == object_id:
                    deleted = town_data[category].pop(i)
                    return {
                        "success": True,
                        "op": "delete",
                        "message": f"Deleted object {object_id} from {category}",
                        "data": {"id": object_id, "category": category}
                    }
            return {"success": False, "op": "delete", "message": f"Object {object_id} not found"}

        # Delete by position (find closest model)
        elif position:
            closest_model_index = -1
            closest_distance = float('inf')
            closest_id = None

            for i, obj in enumerate(town_data[category]):
                if not isinstance(obj, dict):
                    continue
                model_pos = obj.get("position", {})
                dx = model_pos.get("x", 0) - position.get("x", 0)
                dy = model_pos.get("y", 0) - position.get("y", 0)
                dz = model_pos.get("z", 0) - position.get("z", 0)

                distance = (dx*dx + dy*dy + dz*dz) ** 0.5

                if distance < closest_distance:
                    closest_distance = distance
                    closest_model_index = i
                    closest_id = obj.get("id")

            if closest_model_index >= 0 and closest_distance < 2.0:  # Threshold for deletion
                deleted_model = town_data[category].pop(closest_model_index)
                return {
                    "success": True,
                    "op": "delete",
                    "message": f"Deleted model at position ({position.get('x')}, {position.get('y')}, {position.get('z')})",
                    "data": {"id": closest_id, "category": category, "distance": closest_distance}
                }
            else:
                return {"success": False, "op": "delete", "message": f"No model found within range at position ({position.get('x')}, {position.get('y')}, {position.get('z')})"}

    def _edit_object(
        self,
        town_data: Dict[str, Any],
        op_data: Dict[str, Any],
        validate: bool
    ) -> Dict[str, Any]:
        """Edit object properties (position, rotation, scale)."""
        category = op_data.get("category")
        object_id = op_data.get("id")
        position = op_data.get("position")
        rotation = op_data.get("rotation")
        scale = op_data.get("scale")

        if not category or not object_id:
            return {"success": False, "op": "edit", "message": "Missing category or id"}

        if category not in town_data:
            return {"success": False, "op": "edit", "message": f"Category {category} not found"}

        # Find and edit object
        for i, obj in enumerate(town_data[category]):
            if obj.get("id") == object_id:
                # Track what was actually changed
                changes_made = []
                
                if position is not None:
                    town_data[category][i]["position"] = position
                    changes_made.append("position")
                if rotation is not None:
                    town_data[category][i]["rotation"] = rotation
                    changes_made.append("rotation")
                if scale is not None:
                    town_data[category][i]["scale"] = scale
                    changes_made.append("scale")

                return {
                    "success": True,
                    "op": "edit",
                    "message": f"Edited object {object_id} in {category} ({', '.join(changes_made)} changed)",
                    "data": {"id": object_id, "category": category, "changes": changes_made}
                }

        return {"success": False, "op": "edit", "message": f"Object {object_id} not found"}

    def _validate_object(self, obj: Dict[str, Any]) -> bool:
        """Validate an object.

        Args:
            obj: Object to validate

        Returns:
            True if valid
        """
        # Basic validation - check for required fields
        if "position" in obj:
            pos = obj["position"]
            if not isinstance(pos, dict) or "x" not in pos or "y" not in pos:
                return False

        return True


# Global batch operations manager instance
batch_operations_manager = BatchOperationsManager()
