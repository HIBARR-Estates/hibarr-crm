import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { Property } from "@/Types";
import { AppPermission, PermissionScope } from "@/Types/permission";

export type PropertyRole =
    | "creator"
    | "responsible_agent"
    | "admin"
    | "viewer"
    | "none";

export interface PropertyPermissions {
    /** The role(s) the current user has on the property */
    roles: PropertyRole[];
    /** Whether the user is the creator of the property */
    isCreator: boolean;
    /** Whether the user is the responsible agent */
    isResponsibleAgent: boolean;
    /** Whether the user is an admin */
    isAdmin: boolean;
    /** Whether the user can edit the property */
    canEdit: boolean;
    /** Whether the user can delete the property */
    canDelete: boolean;
    /** Whether the user can view the property */
    canView: boolean;
    /** Whether the user can publish/unpublish the property */
    canPublish: boolean;
    /** Whether the user can view owner information */
    canViewOwnerInfo: boolean;
    /** Whether the user can request access to the property */
    canRequestAccess: boolean;
    /** Whether the user has any role on the property */
    hasAnyRole: boolean;
}

/**
 * Hook to determine the current user's permissions on a property.
 *
 * Rules:
 * - Admin: Full access (edit, delete, view, publish)
 * - Property Creator: Full access (edit, delete, view, publish)
 * - Responsible Agent: Edit, delete, view (but not publish)
 * - Viewer: View only (published properties)
 *
 * @param property - The property to check permissions for
 * @returns PropertyPermissions object with role information and permission flags
 */
export function usePropertyPermissions(
    property: Property | null | undefined,
): PropertyPermissions {
    const { props } = usePage<any>();
    const currentUser = props.auth?.user;
    const permissions = props.auth?.permissions as AppPermission | undefined;

    return useMemo(() => {
        // Default permissions (no access)
        const defaultPermissions: PropertyPermissions = {
            roles: ["none"],
            isCreator: false,
            isResponsibleAgent: false,
            isAdmin: false,
            canEdit: false,
            canDelete: false,
            canView: false,
            canPublish: false,
            canViewOwnerInfo: false,
            canRequestAccess: false,
            hasAnyRole: false,
        };

        if (!property || !currentUser?.id) {
            return defaultPermissions;
        }

        const userId = currentUser.id;
        const roles: PropertyRole[] = [];

        // Check if user is an admin (has edit_product permission set to 'all')
        // Note: Currently using edit_product/view_product permissions until dedicated property permissions are added
        const isAdmin =
            permissions?.edit_product === "all" ||
            permissions?.edit_product === 4;
        if (isAdmin) roles.push("admin");

        // Check if user is the creator
        const isCreator = (property as any).added_by === userId;
        if (isCreator) roles.push("creator");

        // Check if user is the responsible agent
        const isResponsibleAgent =
            (property as any).responsible_agent_id === userId;
        if (isResponsibleAgent) roles.push("responsible_agent");

        // If user can view but has no other role
        const canViewPublished =
            property.is_published !== false &&
            (permissions?.view_product === "all" ||
                permissions?.view_product === "added" ||
                permissions?.view_product === 4 ||
                permissions?.view_product === 1);

        if (!isAdmin && !isCreator && !isResponsibleAgent && canViewPublished) {
            roles.push("viewer");
        }

        // If no roles found, mark as none
        if (roles.length === 0) {
            roles.push("none");
        }

        const hasAnyRole = roles.length > 0 && !roles.includes("none");

        // Permissions logic
        // Can view if: admin, creator, responsible agent, or published property with view permission
        const canView =
            isAdmin ||
            isCreator ||
            isResponsibleAgent ||
            (property.is_published !== false && canViewPublished);

        // Can edit if: admin, creator, or responsible agent
        const canEdit = isAdmin || isCreator || isResponsibleAgent;

        // Can delete if: admin, creator, or responsible agent
        const canDelete = isAdmin || isCreator || isResponsibleAgent;

        // Can publish if: admin or creator only
        const canPublish = isAdmin || isCreator;

        // Can view owner info if: admin, creator, or responsible agent
        const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;

        // Can request access if: not creator, not responsible agent, and property is published
        const canRequestAccess =
            !isCreator &&
            !isResponsibleAgent &&
            property.is_published !== false;

        return {
            roles,
            isCreator,
            isResponsibleAgent,
            isAdmin,
            canEdit,
            canDelete,
            canView,
            canPublish,
            canViewOwnerInfo,
            canRequestAccess,
            hasAnyRole,
        };
    }, [
        property,
        currentUser?.id,
        permissions?.edit_product,
        permissions?.view_product,
    ]);
}

/**
 * Utility function to check property permissions without hooks (for non-component contexts)
 *
 * @param property - The property to check permissions for
 * @param userId - The user ID to check permissions for
 * @param editProductsPermission - The user's edit_products permission scope (used until dedicated property permissions exist)
 * @param viewProductsPermission - The user's view_products permission scope (used until dedicated property permissions exist)
 * @returns PropertyPermissions object with role information and permission flags
 */
export function getPropertyPermissions(
    property: Property | null | undefined,
    userId: number | null | undefined,
    editProductsPermission?: PermissionScope,
    viewProductsPermission?: PermissionScope,
): PropertyPermissions {
    // Default permissions (no access)
    const defaultPermissions: PropertyPermissions = {
        roles: ["none"],
        isCreator: false,
        isResponsibleAgent: false,
        isAdmin: false,
        canEdit: false,
        canDelete: false,
        canView: false,
        canPublish: false,
        canViewOwnerInfo: false,
        canRequestAccess: false,
        hasAnyRole: false,
    };

    if (!property || !userId) {
        return defaultPermissions;
    }

    const roles: PropertyRole[] = [];

    // Check if user is an admin
    const isAdmin =
        editProductsPermission === "all" || editProductsPermission === 4;
    if (isAdmin) roles.push("admin");

    // Check if user is the creator
    const isCreator = (property as any).added_by === userId;
    if (isCreator) roles.push("creator");

    // Check if user is the responsible agent
    const isResponsibleAgent =
        (property as any).responsible_agent_id === userId;
    if (isResponsibleAgent) roles.push("responsible_agent");

    // Check if user is a viewer
    const canViewPublished =
        property.is_published !== false &&
        (viewProductsPermission === "all" ||
            viewProductsPermission === "added" ||
            viewProductsPermission === 4 ||
            viewProductsPermission === 1);

    if (!isAdmin && !isCreator && !isResponsibleAgent && canViewPublished) {
        roles.push("viewer");
    }

    if (roles.length === 0) {
        roles.push("none");
    }

    const hasAnyRole = roles.length > 0 && !roles.includes("none");

    const canView =
        isAdmin ||
        isCreator ||
        isResponsibleAgent ||
        (property.is_published !== false && canViewPublished);
    const canEdit = isAdmin || isCreator || isResponsibleAgent;
    const canDelete = isAdmin || isCreator || isResponsibleAgent;
    const canPublish = isAdmin || isCreator;
    const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;
    const canRequestAccess =
        !isCreator && !isResponsibleAgent && property.is_published !== false;

    return {
        roles,
        isCreator,
        isResponsibleAgent,
        isAdmin,
        canEdit,
        canDelete,
        canView,
        canPublish,
        canViewOwnerInfo,
        canRequestAccess,
        hasAnyRole,
    };
}

export default usePropertyPermissions;
