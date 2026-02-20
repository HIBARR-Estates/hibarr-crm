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
    /** Whether the user can directly publish/unpublish the property (SM/admin only) */
    canPublish: boolean;
    /** Whether the user can request publishing (non-SM creator/responsible agent) */
    canRequestPublish: boolean;
    /** Whether the user can view owner information */
    canViewOwnerInfo: boolean;
    /** Whether the user can request access to the property */
    canRequestAccess: boolean;
    /** Whether the user has any role on the property */
    hasAnyRole: boolean;
    /** Whether the user is a sales manager (edit_product === 'all') */
    isSalesManager: boolean;
    /** Whether the user can view the documents section */
    canViewDocuments: boolean;
    /** Whether the user can view internal info section */
    canViewInternalInfo: boolean;
    /** Whether the user can view publishing permissions (101evler / hangiev) */
    canViewPublishingPermissions: boolean;
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
            canRequestPublish: false,
            canViewOwnerInfo: false,
            canRequestAccess: false,
            hasAnyRole: false,
            isSalesManager: false,
            canViewDocuments: false,
            canViewInternalInfo: false,
            canViewPublishingPermissions: false,
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

        // Can edit if: creator or responsible agent only
        const canEdit = isCreator || isResponsibleAgent;

        // Can delete if: creator or responsible agent only
        const canDelete = isCreator || isResponsibleAgent;

        // Can publish directly if: admin/sales-manager only
        const canPublish = isAdmin;

        // Can request publish if: creator or responsible agent (but NOT admin/SM)
        const canRequestPublish = !isAdmin && (isCreator || isResponsibleAgent);

        // Sales manager is effectively the same as admin (edit_product === 'all')
        const isSalesManager = isAdmin;

        // Can view owner info if: admin, creator, or responsible agent
        // const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;
        const canViewOwnerInfo = isAdmin;

        // Can view documents section if: admin, creator, or responsible agent
        const canViewDocuments = isAdmin || isCreator || isResponsibleAgent;

        // Can view internal info if: admin, creator, or responsible agent
        const canViewInternalInfo = isAdmin || isCreator || isResponsibleAgent;

        // Can view publishing permissions (101evler / hangiev) if: admin or creator
        const canViewPublishingPermissions = isAdmin || isCreator;

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
            canRequestPublish,
            canViewOwnerInfo,
            canRequestAccess,
            hasAnyRole,
            isSalesManager,
            canViewDocuments,
            canViewInternalInfo,
            canViewPublishingPermissions,
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
        canRequestPublish: false,
        canViewOwnerInfo: false,
        canRequestAccess: false,
        hasAnyRole: false,
        isSalesManager: false,
        canViewDocuments: false,
        canViewInternalInfo: false,
        canViewPublishingPermissions: false,
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
    const canEdit = isCreator || isResponsibleAgent;
    const canDelete = isCreator || isResponsibleAgent;
    const canPublish = isAdmin;
    const canRequestPublish = !isAdmin && (isCreator || isResponsibleAgent);
    const isSalesManager = isAdmin;
    const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;
    const canViewDocuments = isAdmin || isCreator || isResponsibleAgent;
    const canViewInternalInfo = isAdmin || isCreator || isResponsibleAgent;
    const canViewPublishingPermissions = isAdmin || isCreator;
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
        canRequestPublish,
        canViewOwnerInfo,
        canRequestAccess,
        hasAnyRole,
        isSalesManager,
        canViewDocuments,
        canViewInternalInfo,
        canViewPublishingPermissions,
    };
}

export default usePropertyPermissions;
