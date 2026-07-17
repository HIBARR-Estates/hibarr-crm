import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { Property } from "@/Types";
import { AppPermission, PermissionScope } from "@/Types/permission";

export type PropertyRole =
    | "creator"
    | "responsible_agent"
    | "collaborator"
    | "watcher"
    | "admin"
    | "viewer"
    | "none";

export interface PropertyPermissions {
    roles: PropertyRole[];
    isCreator: boolean;
    isResponsibleAgent: boolean;
    isCollaborator: boolean;
    isWatcher: boolean;
    isAdmin: boolean;
    canEdit: boolean;
    canEditPublicFieldsOnly: boolean;
    canDelete: boolean;
    canView: boolean;
    canPublish: boolean;
    canRequestPublish: boolean;
    canViewOwnerInfo: boolean;
    canRequestAccess: boolean;
    canRequestEditAccess: boolean;
    hasAnyRole: boolean;
    isSalesManager: boolean;
    canViewDocuments: boolean;
    canViewInternalInfo: boolean;
    canViewPublishingPermissions: boolean;
    canManageTeam: boolean;
    canAddSelfAsWatcher: boolean;
}

function resolveCollaboratorIds(property: Property | null | undefined): number[] {
    const collaborators = (property as any)?.collaborators;
    if (!Array.isArray(collaborators)) {
        return [];
    }

    return collaborators
        .map((collaborator: { id?: number }) => collaborator?.id)
        .filter((id): id is number => typeof id === "number");
}

function resolveWatcherIds(property: Property | null | undefined): number[] {
    const watchers = (property as any)?.watchers;
    if (!Array.isArray(watchers)) {
        return [];
    }

    return watchers
        .map((watcher: { id?: number }) => watcher?.id)
        .filter((id): id is number => typeof id === "number");
}

export function usePropertyPermissions(
    property: Property | null | undefined,
    options?: { hasPendingEditAccessRequest?: boolean },
): PropertyPermissions {
    const { props } = usePage<any>();
    const currentUser = props.auth?.user;
    const permissions = props.auth?.permissions as AppPermission | undefined;
    const hasPendingEditAccessRequest =
        options?.hasPendingEditAccessRequest ??
        (property as any)?.has_pending_edit_access_request ??
        false;

    return useMemo(() => {
        const defaultPermissions: PropertyPermissions = {
            roles: ["none"],
            isCreator: false,
            isResponsibleAgent: false,
            isCollaborator: false,
            isWatcher: false,
            isAdmin: false,
            canEdit: false,
            canEditPublicFieldsOnly: false,
            canDelete: false,
            canView: false,
            canPublish: false,
            canRequestPublish: false,
            canViewOwnerInfo: false,
            canRequestAccess: false,
            canRequestEditAccess: false,
            hasAnyRole: false,
            isSalesManager: false,
            canViewDocuments: false,
            canViewInternalInfo: false,
            canViewPublishingPermissions: false,
            canManageTeam: false,
            canAddSelfAsWatcher: false,
        };

        if (!property || !currentUser?.id) {
            return defaultPermissions;
        }

        const userId = currentUser.id;
        const roles: PropertyRole[] = [];

        const isAdmin =
            permissions?.edit_product === "all" ||
            permissions?.edit_product === 4;
        if (isAdmin) roles.push("admin");

        const isCreator =
            (property as any).added_by === userId ||
            (property as any).added_by?.id === userId;
        if (isCreator) roles.push("creator");

        const isResponsibleAgent =
            (property as any).responsible_agent_id === userId ||
            (property as any).responsible_agent?.id === userId;
        if (isResponsibleAgent) roles.push("responsible_agent");

        const collaboratorIds = resolveCollaboratorIds(property);
        const isCollaborator = collaboratorIds.includes(userId);
        if (isCollaborator) roles.push("collaborator");

        const watcherIds = resolveWatcherIds(property);
        const isWatcher = watcherIds.includes(userId);
        if (isWatcher) roles.push("watcher");

        const canViewPublished =
            property.is_published !== false &&
            (permissions?.view_product === "all" ||
                permissions?.view_product === "added" ||
                permissions?.view_product === 4 ||
                permissions?.view_product === 1);

        if (
            !isAdmin &&
            !isCreator &&
            !isResponsibleAgent &&
            !isCollaborator &&
            !isWatcher &&
            canViewPublished
        ) {
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
            isCollaborator ||
            isWatcher ||
            (property.is_published !== false && canViewPublished);

        const canEdit =
            isAdmin || isCreator || isResponsibleAgent || isCollaborator;

        const canEditPublicFieldsOnly =
            isCollaborator && !isAdmin && !isCreator && !isResponsibleAgent;

        const canDelete = isAdmin || isCreator || isResponsibleAgent;
        const canPublish = isAdmin;
        const canRequestPublish =
            !isAdmin && (isCreator || isResponsibleAgent);
        const isSalesManager = isAdmin;
        const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;
        const canViewDocuments = isAdmin || isCreator || isResponsibleAgent;
        const canViewInternalInfo = isAdmin || isCreator || isResponsibleAgent;
        const canViewPublishingPermissions = isAdmin || isCreator;
        const canRequestAccess =
            !isCreator &&
            !isResponsibleAgent &&
            !isCollaborator &&
            property.is_published !== false;
        const canRequestEditAccess =
            !isCreator &&
            !isResponsibleAgent &&
            !isAdmin &&
            !isCollaborator &&
            property.is_published !== false &&
            !hasPendingEditAccessRequest;
        const canManageTeam = isAdmin || isCreator || isResponsibleAgent;
        const canAddSelfAsWatcher = isCollaborator && !isWatcher;

        return {
            roles,
            isCreator,
            isResponsibleAgent,
            isCollaborator,
            isWatcher,
            isAdmin,
            canEdit,
            canEditPublicFieldsOnly,
            canDelete,
            canView,
            canPublish,
            canRequestPublish,
            canViewOwnerInfo,
            canRequestAccess,
            canRequestEditAccess,
            hasAnyRole,
            isSalesManager,
            canViewDocuments,
            canViewInternalInfo,
            canViewPublishingPermissions,
            canManageTeam,
            canAddSelfAsWatcher,
        };
    }, [
        property,
        currentUser?.id,
        permissions?.edit_product,
        permissions?.view_product,
        hasPendingEditAccessRequest,
    ]);
}

export function getPropertyPermissions(
    property: Property | null | undefined,
    userId: number | null | undefined,
    editProductsPermission?: PermissionScope,
    viewProductsPermission?: PermissionScope,
    options?: { hasPendingEditAccessRequest?: boolean },
): PropertyPermissions {
    const defaultPermissions: PropertyPermissions = {
        roles: ["none"],
        isCreator: false,
        isResponsibleAgent: false,
        isCollaborator: false,
        isWatcher: false,
        isAdmin: false,
        canEdit: false,
        canEditPublicFieldsOnly: false,
        canDelete: false,
        canView: false,
        canPublish: false,
        canRequestPublish: false,
        canViewOwnerInfo: false,
        canRequestAccess: false,
        canRequestEditAccess: false,
        hasAnyRole: false,
        isSalesManager: false,
        canViewDocuments: false,
        canViewInternalInfo: false,
        canViewPublishingPermissions: false,
        canManageTeam: false,
        canAddSelfAsWatcher: false,
    };

    if (!property || !userId) {
        return defaultPermissions;
    }

    const hasPendingEditAccessRequest =
        options?.hasPendingEditAccessRequest ?? false;
    const roles: PropertyRole[] = [];

    const isAdmin =
        editProductsPermission === "all" || editProductsPermission === 4;
    if (isAdmin) roles.push("admin");

    const isCreator = (property as any).added_by === userId;
    if (isCreator) roles.push("creator");

    const isResponsibleAgent =
        (property as any).responsible_agent_id === userId;
    if (isResponsibleAgent) roles.push("responsible_agent");

    const isCollaborator = resolveCollaboratorIds(property).includes(userId);
    if (isCollaborator) roles.push("collaborator");

    const isWatcher = resolveWatcherIds(property).includes(userId);
    if (isWatcher) roles.push("watcher");

    const canViewPublished =
        property.is_published !== false &&
        (viewProductsPermission === "all" ||
            viewProductsPermission === "added" ||
            viewProductsPermission === 4 ||
            viewProductsPermission === 1);

    if (
        !isAdmin &&
        !isCreator &&
        !isResponsibleAgent &&
        !isCollaborator &&
        !isWatcher &&
        canViewPublished
    ) {
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
        isCollaborator ||
        isWatcher ||
        (property.is_published !== false && canViewPublished);
    const canEdit =
        isAdmin || isCreator || isResponsibleAgent || isCollaborator;
    const canEditPublicFieldsOnly =
        isCollaborator && !isAdmin && !isCreator && !isResponsibleAgent;
    const canDelete = isAdmin || isCreator || isResponsibleAgent;
    const canPublish = isAdmin;
    const canRequestPublish = !isAdmin && (isCreator || isResponsibleAgent);
    const isSalesManager = isAdmin;
    const canViewOwnerInfo = isAdmin || isCreator || isResponsibleAgent;
    const canViewDocuments = isAdmin || isCreator || isResponsibleAgent;
    const canViewInternalInfo = isAdmin || isCreator || isResponsibleAgent;
    const canViewPublishingPermissions = isAdmin || isCreator;
    const canRequestAccess =
        !isCreator &&
        !isResponsibleAgent &&
        !isCollaborator &&
        property.is_published !== false;
    const canRequestEditAccess =
        !isCreator &&
        !isResponsibleAgent &&
        !isAdmin &&
        !isCollaborator &&
        property.is_published !== false &&
        !hasPendingEditAccessRequest;
    const canManageTeam = isAdmin || isCreator || isResponsibleAgent;
    const canAddSelfAsWatcher = isCollaborator && !isWatcher;

    return {
        roles,
        isCreator,
        isResponsibleAgent,
        isCollaborator,
        isWatcher,
        isAdmin,
        canEdit,
        canEditPublicFieldsOnly,
        canDelete,
        canView,
        canPublish,
        canRequestPublish,
        canViewOwnerInfo,
        canRequestAccess,
        canRequestEditAccess,
        hasAnyRole,
        isSalesManager,
        canViewDocuments,
        canViewInternalInfo,
        canViewPublishingPermissions,
        canManageTeam,
        canAddSelfAsWatcher,
    };
}

export default usePropertyPermissions;
