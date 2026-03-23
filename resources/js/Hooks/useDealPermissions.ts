import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { Deal } from "@/Types/api/deals";
import { AppPermission, PermissionScope } from "@/Types/permission";

export type DealRole =
    | "creator"
    | "agent"
    | "watcher"
    | "participant"
    | "admin"
    | "none";

export interface DealPermissions {
    /** The role(s) the current user has on the deal */
    roles: DealRole[];
    /** Whether the user is the creator of the deal */
    isCreator: boolean;
    /** Whether the user is the agent assigned to the deal */
    isAgent: boolean;
    /** Whether the user is a watcher on the deal */
    isWatcher: boolean;
    /** Whether the user is a participant on the deal */
    isParticipant: boolean;
    /** Whether the user is an admin */
    isAdmin: boolean;
    /** Whether the deal is locked (no modifications allowed) */
    isLocked: boolean;
    /** Whether the user can edit the deal (creator, agent, or admin — and not locked) */
    canEdit: boolean;
    /** Whether the user can delete the deal (creator, agent, or admin — and not locked) */
    canDelete: boolean;
    /** Whether the user can view the deal (any role or admin) */
    canView: boolean;
    /** Whether the user has any role on the deal */
    hasAnyRole: boolean;
}

/**
 * Hook to determine the current user's permissions on a deal.
 *
 * Rules:
 * - Admin: Full access (edit, delete, view)
 * - Deal Creator: Full access (edit, delete, view)
 * - Deal Agent: Full access (edit, delete, view)
 * - Deal Watcher: View only
 * - Deal Participant: View only
 *
 * @param deal - The deal to check permissions for
 * @returns DealPermissions object with role information and permission flags
 */
export function useDealPermissions(
    deal: Deal | null | undefined,
): DealPermissions {
    const { props } = usePage<any>();
    const currentUser = props.auth?.user;
    const permissions = props.auth?.permissions as AppPermission | undefined;

    return useMemo(() => {
        // Default permissions (no access)
        const defaultPermissions: DealPermissions = {
            roles: ["none"],
            isCreator: false,
            isAgent: false,
            isWatcher: false,
            isParticipant: false,
            isAdmin: false,
            isLocked: false,
            canEdit: false,
            canDelete: false,
            canView: false,
            hasAnyRole: false,
        };

        if (!deal || !currentUser?.id) {
            return defaultPermissions;
        }

        const userId = currentUser.id;
        const roles: DealRole[] = [];
        const isLocked = !!deal.is_locked;

        // Check if user is an admin (has edit_deals permission set to 'all')
        const isAdmin =
            permissions?.edit_deals === "all" || permissions?.edit_deals === 4;
        if (isAdmin) roles.push("admin");

        // Check if user is the creator
        const isCreator = deal.added_by === userId;
        if (isCreator) roles.push("creator");

        // Check if user is the agent
        // Agent can be identified by agent_id or lead_agent.user_id
        const isAgent =
            deal.agent_id === userId ||
            deal.lead_agent?.user_id === userId ||
            deal.agent?.user_id === userId;
        if (isAgent) roles.push("agent");

        // Check if user is a watcher
        const isWatcher =
            deal.deal_watchers?.some((watcher) => watcher.id === userId) ??
            false;
        if (isWatcher) roles.push("watcher");

        // Check if user is a participant
        const isParticipant =
            deal.deal_participants?.some(
                (participant) => participant.id === userId,
            ) ?? false;
        if (isParticipant) roles.push("participant");

        // If no roles found, mark as none
        if (roles.length === 0) {
            roles.push("none");
        }

        const hasAnyRole = roles.length > 0 && !roles.includes("none");

        // Admins, creators, and agents can edit/delete — unless the deal is locked
        const canEdit = !isLocked && (isAdmin || isCreator || isAgent);
        const canDelete = !isLocked && (isAdmin || isCreator || isAgent);

        // Anyone with a role can view (including admins)
        const canView = hasAnyRole || isAdmin;

        return {
            roles,
            isCreator,
            isAgent,
            isWatcher,
            isParticipant,
            isAdmin,
            isLocked,
            canEdit,
            canDelete,
            canView,
            hasAnyRole,
        };
    }, [deal, currentUser?.id, permissions?.edit_deals]);
}

/**
 * Utility function to check deal permissions without hooks (for non-component contexts)
 *
 * @param deal - The deal to check permissions for
 * @param userId - The user ID to check permissions for
 * @param editDealsPermission - The user's edit_deals permission scope (optional)
 * @returns DealPermissions object with role information and permission flags
 */
export function getDealPermissions(
    deal: Deal | null | undefined,
    userId: number | null | undefined,
    editDealsPermission?: PermissionScope,
): DealPermissions {
    const defaultPermissions: DealPermissions = {
        roles: ["none"],
        isCreator: false,
        isAgent: false,
        isWatcher: false,
        isParticipant: false,
        isAdmin: false,
        isLocked: false,
        canEdit: false,
        canDelete: false,
        canView: false,
        hasAnyRole: false,
    };

    if (!deal || !userId) {
        return defaultPermissions;
    }

    const roles: DealRole[] = [];
    const isLocked = !!deal.is_locked;

    // Check if user is an admin (has edit_deals permission set to 'all')
    const isAdmin = editDealsPermission === "all" || editDealsPermission === 4;
    if (isAdmin) roles.push("admin");

    // Check if user is the creator
    const isCreator = deal.added_by === userId;
    if (isCreator) roles.push("creator");

    // Check if user is the agent
    const isAgent =
        deal.agent_id === userId ||
        deal.lead_agent?.user_id === userId ||
        deal.agent?.user_id === userId;
    if (isAgent) roles.push("agent");

    // Check if user is a watcher
    const isWatcher =
        deal.deal_watchers?.some((watcher) => watcher.id === userId) ?? false;
    if (isWatcher) roles.push("watcher");

    // Check if user is a participant
    const isParticipant =
        deal.deal_participants?.some(
            (participant) => participant.id === userId,
        ) ?? false;
    if (isParticipant) roles.push("participant");

    // If no roles found, mark as none
    if (roles.length === 0) {
        roles.push("none");
    }

    const hasAnyRole = roles.length > 0 && !roles.includes("none");

    // Admins, creators, and agents can edit/delete — unless the deal is locked
    const canEdit = !isLocked && (isAdmin || isCreator || isAgent);
    const canDelete = !isLocked && (isAdmin || isCreator || isAgent);

    // Anyone with a role can view (including admins)
    const canView = hasAnyRole || isAdmin;

    return {
        roles,
        isCreator,
        isAgent,
        isWatcher,
        isParticipant,
        isAdmin,
        isLocked,
        canEdit,
        canDelete,
        canView,
        hasAnyRole,
    };
}

export default useDealPermissions;
