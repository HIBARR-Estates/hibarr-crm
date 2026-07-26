import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { Deal } from "@/Types/api/deals";
import { AppPermission, PermissionScope } from "@/Types/permission";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";

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
    /**
     * The user's `edit_deals` scope is "all", i.e. they can act on any deal.
     * This is NOT the admin role - a manager can hold this without being an
     * admin. For real role checks use `useIsAdminRole()`, which is what the
     * backend's `hasRole('admin')` gates correspond to.
     */
    hasFullDealAccess: boolean;
    /** Whether the deal is locked (no modifications allowed) */
    isLocked: boolean;
    /** Whether the user can edit the deal (creator, agent, participant, or admin — and not locked) */
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
 * - Deal Participant: Same as agent (edit, view — not delete)
 * - Deal Watcher: View only
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
            hasFullDealAccess: false,
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
        const isLocked = isDealEffectivelyLocked(deal);

        // Full-access scope, not the admin role (see hasFullDealAccess docs).
        const hasFullDealAccess =
            permissions?.edit_deals === "all" || permissions?.edit_deals === 4;
        if (hasFullDealAccess) roles.push("admin");

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

        // Admins, creators, agents, and participants can edit — participants act with the
        // same rights as the agent. Watchers stay view-only.
        const canEdit =
            !isLocked && (hasFullDealAccess || isCreator || isAgent || isParticipant);

        // Mirrors PermissionService::checkAccess's 'delete_deals' scope handling in
        // DealController::destroy (added -> creator, owned -> agent/watcher, both -> either)
        // so the delete button isn't shown to users who'll just get a 403.
        const deleteScope = permissions?.delete_deals;
        const canDelete =
            !isLocked &&
            (deleteScope === "all" ||
                (deleteScope === "added" && isCreator) ||
                (deleteScope === "owned" && (isAgent || isWatcher)) ||
                (deleteScope === "both" && (isCreator || isAgent || isWatcher)));

        // Anyone with a role can view (including admins)
        const canView = hasAnyRole || hasFullDealAccess;

        return {
            roles,
            isCreator,
            isAgent,
            isWatcher,
            isParticipant,
            hasFullDealAccess,
            isLocked,
            canEdit,
            canDelete,
            canView,
            hasAnyRole,
        };
    }, [deal, currentUser?.id, permissions?.edit_deals, permissions?.delete_deals]);
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
    deleteDealsPermission?: PermissionScope,
): DealPermissions {
    const defaultPermissions: DealPermissions = {
        roles: ["none"],
        isCreator: false,
        isAgent: false,
        isWatcher: false,
        isParticipant: false,
        hasFullDealAccess: false,
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
    const isLocked = isDealEffectivelyLocked(deal);

    // Full-access scope, not the admin role (see hasFullDealAccess docs).
    const hasFullDealAccess =
        editDealsPermission === "all" || editDealsPermission === 4;
    if (hasFullDealAccess) roles.push("admin");

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

    // Admins, creators, agents, and participants can edit — participants act with the
    // same rights as the agent. Watchers stay view-only.
    const canEdit = !isLocked && (hasFullDealAccess || isCreator || isAgent || isParticipant);

    // Mirrors PermissionService::checkAccess's 'delete_deals' scope handling in
    // DealController::destroy (added -> creator, owned -> agent/watcher, both -> either).
    const canDelete =
        !isLocked &&
        (deleteDealsPermission === "all" ||
            (deleteDealsPermission === "added" && isCreator) ||
            (deleteDealsPermission === "owned" && (isAgent || isWatcher)) ||
            (deleteDealsPermission === "both" && (isCreator || isAgent || isWatcher)));

    // Anyone with a role can view (including admins)
    const canView = hasAnyRole || hasFullDealAccess;

    return {
        roles,
        isCreator,
        isAgent,
        isWatcher,
        isParticipant,
        hasFullDealAccess,
        isLocked,
        canEdit,
        canDelete,
        canView,
        hasAnyRole,
    };
}

export default useDealPermissions;
