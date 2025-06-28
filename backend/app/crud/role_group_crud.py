from typing import Any, Dict, List, Set
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.orm import selectinload
from sqlmodel.ext.asyncio.session import AsyncSession

from app.crud.base_crud import CRUDBase
from app.models.role_group_map_model import RoleGroupMap
from app.models.role_group_model import RoleGroup
from app.models.role_model import Role
from app.models.user_model import User
from app.schemas.role_group_schema import IRoleGroupCreate, IRoleGroupUpdate
from app.utils.exceptions.common_exception import NameExistException, ResourceNotFoundException
from app.utils.security_audit import create_audit_log


class CRUDRoleGroup(CRUDBase[RoleGroup, IRoleGroupCreate, IRoleGroupUpdate]):
    """CRUD operations for RoleGroup model"""

    async def get_all(self, *, db_session: AsyncSession) -> List[RoleGroup]:
        """Get all role groups without pagination"""
        result = await db_session.exec(select(RoleGroup))
        return result.scalars().all()

    async def get_group_by_name(self, *, name: str, db_session: AsyncSession) -> RoleGroup | None:
        result = await db_session.exec(select(RoleGroup).where(RoleGroup.name == name))
        return result.scalars().first()

    async def get_by_name(self, *, name: str, db_session: AsyncSession) -> RoleGroup | None:
        """Alias for get_group_by_name."""
        return await self.get_group_by_name(name=name, db_session=db_session)

    async def check_role_exists_in_group(self, *, group_id: UUID, db_session: AsyncSession) -> bool:
        result = await db_session.exec(select(RoleGroupMap).where(RoleGroupMap.role_group_id == group_id))
        return result.one_or_none() is not None

    async def add_roles_to_group(
        self, *, group_id: UUID, role_ids: list[UUID], db_session: AsyncSession
    ) -> list[RoleGroupMap]:
        """Add multiple roles to a group in a batch operation"""
        # Create all role_group_map objects
        role_group_maps = []
        for role_id in role_ids:
            map_obj = RoleGroupMap(role_id=role_id, role_group_id=group_id)
            db_session.add(map_obj)
            role_group_maps.append(map_obj)

        await db_session.commit()

        # Refresh all objects
        for map_obj in role_group_maps:
            await db_session.refresh(map_obj)

        return role_group_maps

    async def remove_roles_from_group(
        self, *, group_id: UUID, role_ids: list[UUID], db_session: AsyncSession
    ) -> None:
        """Remove multiple roles from a group in a batch operation"""
        for role_id in role_ids:
            # Delete the mapping between role and group
            await db_session.exec(
                delete(RoleGroupMap).where(
                    RoleGroupMap.role_group_id == group_id,
                    RoleGroupMap.role_id == role_id,
                )
            )

        await db_session.commit()

    async def validate_circular_dependency(
        self, *, group_id: UUID, role_ids: List[UUID], db_session: AsyncSession
    ) -> bool:
        """Check for circular dependencies when adding roles to a group"""
        checked_roles: Set[UUID] = set()

        async def check_role_chain(role_id: UUID) -> bool:
            if role_id in checked_roles:
                return True  # Circular dependency found

            checked_roles.add(role_id)

            # Get all groups that this role belongs to
            result = await db_session.exec(select(RoleGroupMap).where(RoleGroupMap.role_id == role_id))
            role_groups = result.scalars().all()

            for role_group_map in role_groups:
                if role_group_map.role_group_id == group_id:
                    return True  # Circular dependency found

                # Get roles in this group and check them
                sub_result = await db_session.exec(
                    select(RoleGroupMap).where(RoleGroupMap.role_group_id == role_group_map.role_group_id)
                )
                sub_roles = sub_result.scalars().all()

                for sub_role in sub_roles:
                    if await check_role_chain(sub_role.role_id):
                        return True

            checked_roles.remove(role_id)
            return False

        # Check each role for circular dependencies
        for role_id in role_ids:
            if await check_role_chain(role_id):
                return True

        return False

    async def bulk_create(
        self,
        *,
        groups: List[IRoleGroupCreate],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> List[RoleGroup]:
        """Create multiple role groups in a single transaction"""
        new_groups = []

        for group in groups:
            # Check if group name already exists
            existing = await self.get_group_by_name(name=group.name, db_session=db_session)
            if existing:
                raise NameExistException(RoleGroup, name=group.name)

            new_group = RoleGroup(**group.model_dump())
            new_group.created_by_id = current_user.id
            db_session.add(new_group)
            new_groups.append(new_group)

            # Create audit log
            await create_audit_log(
                db_session=db_session,
                actor_id=current_user.id,
                action="create_role_group",
                resource_type="role_group",
                resource_id=str(new_group.id),
                details={"name": group.name},
            )

        await db_session.commit()

        # Refresh all new groups
        for group in new_groups:
            await db_session.refresh(group)

        return new_groups

    async def bulk_delete(
        self,
        *,
        group_ids: List[UUID],
        current_user: User,
        db_session: AsyncSession | None = None,
    ) -> None:
        """Delete multiple role groups in a single transaction"""
        db_session = db_session or super().get_db().session

        for group_id in group_ids:
            group = await self.get(id=group_id, db_session=db_session)
            if not group:
                raise ResourceNotFoundException(RoleGroup, id=group_id)

            # Check if group has any roles before deletion
            has_roles = await self.check_role_exists_in_group(group_id=group_id, db_session=db_session)
            if has_roles:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"Group {group.name} has assigned roles and cannot be deleted",
                )

            await db_session.delete(group)

            # Create audit log
            await create_audit_log(
                db_session=db_session,
                actor_id=current_user.id,
                action="delete_role_group",
                resource_type="role_group",
                resource_id=str(group_id),
                details={"name": group.name},
            )

        await db_session.commit()

    async def sync_roles_with_role_groups(
        self,
        *,
        db_session: AsyncSession | None = None,
        current_user: User | None = None,
    ) -> Dict[str, int]:
        """
        Synchronize roles with their role groups based on the role_group_id field.
        This helps populate the RoleGroupMap table for existing relationships.

        Returns:
            Dict containing counts of created mappings and skipped (already existing) mappings
        """
        db_session = db_session or super().get_db().session

        # Get all roles that have a role_group_id assigned
        result = await db_session.exec(select(Role).where(Role.role_group_id.is_not(None)))
        roles = result.scalars().all()

        # Track statistics
        stats = {
            "created": 0,
            "skipped": 0,
        }

        for role in roles:
            if not role.role_group_id:
                continue

            # Check if mapping already exists using direct query on role_id and role_group_id
            query = (
                select(1)
                .select_from(RoleGroupMap)
                .where(
                    RoleGroupMap.role_id == role.id,
                    RoleGroupMap.role_group_id == role.role_group_id,
                )
            )
            existing_mapping = await db_session.exec(query)

            if existing_mapping.scalar_one_or_none():
                stats["skipped"] += 1
                continue

            # Create new mapping
            new_mapping = RoleGroupMap(role_id=role.id, role_group_id=role.role_group_id)
            db_session.add(new_mapping)
            stats["created"] += 1

            # Create audit log if user is provided
            if current_user:
                # Get the role name safely
                role_name = role.name if hasattr(role, "name") and role.name else "Unknown"

                try:
                    await create_audit_log(
                        db_session=db_session,
                        actor_id=current_user.id,
                        action="sync_role_to_group",
                        resource_type="role_group_map",
                        resource_id=str(role.role_group_id),
                        details={"role_id": str(role.id), "role_name": role_name},
                    )
                except Exception as audit_error:
                    # Log the error but continue with the sync process
                    import logging

                    logging.error(f"Error creating audit log: {str(audit_error)}")
                    # Check if the error is about the missing table
                    if "no such table: audit_logs" in str(audit_error):
                        logging.warning("audit_logs table does not exist. Skipping audit logging.")
                        # Stop trying to create audit logs for other roles to avoid repeated errors
                        current_user = None

        await db_session.commit()
        return stats

    async def get_multi_paginated_hierarchical(
        self,
        *,
        params: Any = None,
        db_session: AsyncSession | None = None,
    ) -> Any:
        """
        Get paginated role groups with hierarchical structure.
        Only returns root-level groups with their children populated.
        """

        try:
            # Use the provided session or get a new one from the base class
            db_session = db_session or super().get_db().session

            # Instead of using base get_multi_paginated, create a custom query that joins with User table
            # to load creator data in a single query
            from fastapi_pagination.ext.sqlalchemy import paginate
            from sqlalchemy.orm import selectinload
            from sqlmodel import select

            # Create a query that joins with User (creator) and eagerly loads relationships
            query = (
                select(RoleGroup)
                .options(selectinload(RoleGroup.creator))
                .options(selectinload(RoleGroup.children).selectinload(RoleGroup.creator))
                .order_by(RoleGroup.name)
            )

            # Apply pagination using the paginate function from fastapi_pagination
            paginated_result = await paginate(db_session, query, params)

            if not paginated_result.items:
                return paginated_result

            # Build the hierarchy structure
            all_groups = {group.id: group for group in paginated_result.items}

            # Initialize children lists for all groups
            for group in paginated_result.items:
                if not hasattr(group, "children") or group.children is None:
                    group.children = []
                else:
                    # Clear any existing children to prevent duplication
                    group.children = []

            # Track which children have already been assigned to parents
            # to prevent adding the same child multiple times
            assigned_children = set()

            # Create the proper hierarchy - associate children with their parents
            for group in list(all_groups.values()):
                if group.parent_id and group.parent_id in all_groups:
                    parent = all_groups[group.parent_id]
                    if not hasattr(parent, "children") or parent.children is None:
                        parent.children = []

                    # Only add this child to the parent if it hasn't been added already
                    if group.id not in assigned_children:
                        # Add the child to the parent's children list
                        parent.children.append(group)
                        # Mark this child as assigned
                        assigned_children.add(group.id)

                    # We don't need to set parent=None here since we're using the simplified schema
                    # that doesn't have circular references

            # Filter items to only include root-level groups (those without parents)
            root_groups = [group for group in paginated_result.items if group.parent_id is None]

            # Update the paginated result to include only root groups
            paginated_result.items = root_groups

            return paginated_result

        except Exception as e:
            # Log the error for debugging
            import logging

            logging.error(f"Error in get_multi_paginated_hierarchical: {str(e)}")

            # Re-raise with more specific information about the context
            raise Exception(f"Error in role_group hierarchical query: {str(e)}") from e

    async def get_with_hierarchy(
        self,
        *,
        id: UUID,
        db_session: AsyncSession | None = None,
        include_roles_recursive: bool = True,  # Keep parameter for potential future use
    ) -> RoleGroup | None:
        """
        Get a role group by ID and ensure all hierarchical relationships
        (children, parent, roles, creator) are eagerly loaded.

        Args:
            id: The UUID of the role group
            db_session: Optional database session
            include_roles_recursive: (Currently unused but kept for signature consistency)

        Returns:
            The role group with relationships loaded via selectinload, or None if not found
        """
        try:
            db_session = db_session or super().get_db().session

            # Define eager loading options
            options = [
                selectinload(RoleGroup.roles),
                selectinload(RoleGroup.creator),
                # Load children and their essential data (roles, creator)
                selectinload(RoleGroup.children).selectinload(RoleGroup.roles),
                selectinload(RoleGroup.children).selectinload(RoleGroup.creator),
                # Load parent and its essential data (roles, creator)
                selectinload(RoleGroup.parent).selectinload(RoleGroup.roles),
                selectinload(RoleGroup.parent).selectinload(RoleGroup.creator),
                # Explicitly load grandchildren to prevent lazy load later if needed by consuming code
                # Note: This might load more data than strictly necessary for all use cases
                # but helps prevent the MissingGreenlet error during relationship traversal.
                selectinload(RoleGroup.children).selectinload(RoleGroup.children),
            ]

            # Create a query that eagerly loads all needed relationships
            query = select(RoleGroup).options(*options).where(RoleGroup.id == id)

            result = await db_session.exec(query)
            # Use unique() to handle potential duplicates from eager loading multiple paths
            role_group = result.unique().scalar_one_or_none()

            # Removed the post-processing loop that used hasattr checks.
            # Relying solely on selectinload to populate the attributes.
            # If relationships are accessed later (e.g., in the endpoint),
            # they should be available without triggering lazy loads.

            return role_group

        except Exception as e:
            import logging

            # Log the specific error and context
            logging.error(f"Error in get_with_hierarchy for id {id}: {str(e)}", exc_info=True)
            # Re-raise the exception to be handled by the caller or FastAPI's exception handlers
            raise

    async def _load_roles_recursive(
        self, groups: List[RoleGroup], db_session: AsyncSession | None = None
    ) -> None:
        """
        Helper method to recursively load roles for a list of role groups

        Args:
            groups: List of role groups to load roles for
            db_session: Database session
        """
        for group in groups:
            # Load roles for this group
            if hasattr(group, "roles"):
                await db_session.refresh(group, ["roles"])
            else:
                group.roles = []  # Recursively load roles for children
            if hasattr(group, "children") and group.children:
                await self._load_roles_recursive(group.children, db_session)

    async def create(
        self,
        *,
        obj_in: IRoleGroupCreate | RoleGroup,
        created_by_id: UUID | str | None = None,
        db_session: AsyncSession | None = None,
    ) -> RoleGroup:
        """
        Create a role group and ensure all relationships are properly loaded
        to avoid lazy loading issues during response serialization.
        Enforces unique group name at the CRUD layer.
        """
        db_session = db_session or super().get_db().session

        # Enforce unique name
        name = obj_in.name if hasattr(obj_in, "name") else None
        if name:
            existing = await self.get_group_by_name(name=name, db_session=db_session)
            if existing:
                from app.models.role_group_model import RoleGroup
                from app.utils.exceptions.common_exception import NameExistException

                raise NameExistException(RoleGroup, name=name)

        # Call the base create method
        created_group = await super().create(
            obj_in=obj_in, created_by_id=created_by_id, db_session=db_session
        )

        # Reload the group with all relationships to avoid lazy loading issues
        # This ensures the parent, children, creator, and roles relationships are loaded
        reloaded_group = await self.get_with_hierarchy(
            id=created_group.id, db_session=db_session, include_roles_recursive=True
        )

        if not reloaded_group:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Role group with id {created_group.id} not found after creation",
            )

        return reloaded_group

    async def update(
        self,
        *,
        obj_current: RoleGroup,
        obj_new: IRoleGroupUpdate | dict[str, Any] | RoleGroup,
        db_session: AsyncSession | None = None,
    ) -> RoleGroup:
        """
        Update a role group and ensure all relationships are properly loaded
        to avoid lazy loading issues during response serialization.
        """
        db_session = db_session or super().get_db().session

        # Call the base update method
        updated_group = await super().update(
            obj_current=obj_current, obj_new=obj_new, db_session=db_session
        )  # Reload the group with all relationships to avoid lazy loading issues
        # This ensures the parent, children, creator, and roles relationships are loaded
        reloaded_group = await self.get_with_hierarchy(
            id=updated_group.id, db_session=db_session, include_roles_recursive=True
        )
        if not reloaded_group:
            # This should not happen since we just updated the group
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Role group with id {updated_group.id} not found after update",
            )

        return reloaded_group


role_group = CRUDRoleGroup(RoleGroup)
