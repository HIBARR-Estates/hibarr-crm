<?php

namespace App\Policies;

use App\Models\Property;
use App\Models\User;
use Illuminate\Auth\Access\HandlesAuthorization;

/**
 * PropertyPolicy
 * 
 * Handles authorization for property-related actions.
 * 
 * Rules:
 * - View: Anyone can view published properties. Drafts are visible to creator/responsible agent/admin.
 * - Create: Anyone with 'add_properties' permission can create.
 * - Update: Only creator, responsible agent, or admin can edit.
 * - Delete: Only creator, responsible agent, or admin can delete.
 * - Publish: Only creator or admin can publish/unpublish.
 * - ViewOwnerInfo: Restricted to creator, responsible agent, or users with special permission.
 */
class PropertyPolicy
{
    use HandlesAuthorization;

    /**
     * Perform pre-authorization checks.
     * Admins bypass all checks.
     */
    public function before(User $user, string $ability): ?bool
    {
        // Check if user has admin-level permissions for properties
        if ($this->isPropertyAdmin($user)) {
            return true;
        }

        return null;
    }

    /**
     * Determine whether the user can view any properties.
     */
    public function viewAny(User $user): bool
    {
        return $this->hasPermission($user, 'view_properties');
    }

    /**
     * Determine whether the user can view the property.
     * 
     * Published properties are visible to all.
     * Drafts are only visible to creator, responsible agent, or admin.
     */
    public function view(User $user, Property $property): bool
    {
        // Published properties are visible to all
        if ($property->is_published) {
            return $this->hasPermission($user, 'view_properties');
        }

        // Drafts: only creator, responsible agent
        return $property->isCreator($user->id) 
            || $property->isResponsibleAgent($user->id);
    }

    /**
     * Determine whether the user can create properties.
     */
    public function create(User $user): bool
    {
        return $this->hasPermission($user, 'add_properties');
    }

    /**
     * Determine whether the user can update the property.
     * 
     * Only creator, responsible agent, or admin.
     */
    public function update(User $user, Property $property): bool
    {
        return $property->canBeEditedBy($user->id);
    }

    /**
     * Determine whether the user can delete the property.
     * 
     * Only creator, responsible agent, or admin.
     */
    public function delete(User $user, Property $property): bool
    {
        return $property->canBeEditedBy($user->id);
    }

    /**
     * Determine whether the user can publish/unpublish the property.
     * 
     * Only creator or admin.
     */
    public function publish(User $user, Property $property): bool
    {
        return $property->isCreator($user->id);
    }

    /**
     * Determine whether the user can view owner information.
     * 
     * Restricted to creator, responsible agent, or users with special permission.
     */
    public function viewOwnerInfo(User $user, Property $property): bool
    {
        // Creator and responsible agent can always see owner info
        if ($property->isCreator($user->id) || $property->isResponsibleAgent($user->id)) {
            return true;
        }

        // Check for special permission (to be implemented based on business rules)
        return $this->hasPermission($user, 'view_property_owner_info');
    }

    /**
     * Determine whether the user can request access to a property.
     * 
     * Any authenticated user can request access to published properties they don't own.
     */
    public function requestAccess(User $user, Property $property): bool
    {
        // Can't request access to your own property
        if ($property->isCreator($user->id) || $property->isResponsibleAgent($user->id)) {
            return false;
        }

        // Can only request access to published properties
        return $property->is_published;
    }

    // ================================================================
    // Helper Methods
    // ================================================================

    /**
     * Check if user has admin-level property permissions.
     */
    protected function isPropertyAdmin(User $user): bool
    {
        // Check if user has 'all' scope for edit_properties permission
        $permission = $this->getPermissionScope($user, 'edit_properties');
        return $permission === 'all';
    }

    /**
     * Check if user has a specific permission.
     */
    protected function hasPermission(User $user, string $permissionName): bool
    {
        $permission = $this->getPermissionScope($user, $permissionName);
        // User has permission if scope is not 'none' and not null (i.e., has some level of access)
        return $permission !== 'none' && $permission !== null;
    }

    /**
     * Get the scope of a specific permission for a user.
     */
    protected function getPermissionScope(User $user, string $permissionName): mixed
    {
        // Use the User model's permission() method which returns the permission scope
        // Returns: 'all', 'none', 'added', 'owned', 'both', or false if not found
        $permissionScope = $user->permission($permissionName);
        
        // Convert false to null for consistency
        return $permissionScope === false ? null : $permissionScope;
    }
}
