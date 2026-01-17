import { usePage } from "@inertiajs/react";
import { useMemo } from "react";
import { Deal } from "@/Types/api/deals";

export type DealRole = "creator" | "agent" | "watcher" | "participant" | "none";

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
    /** Whether the user can edit the deal (creator or agent only) */
    canEdit: boolean;
    /** Whether the user can delete the deal (creator or agent only) */
    canDelete: boolean;
    /** Whether the user can view the deal (any role) */
    canView: boolean;
    /** Whether the user has any role on the deal */
    hasAnyRole: boolean;
}

/**
 * Hook to determine the current user's permissions on a deal.
 *
 * Rules:
 * - Deal Creator: Full access (edit, delete, view)
 * - Deal Agent: Full access (edit, delete, view)
 * - Deal Watcher: View only
 * - Deal Participant: View only
 *
 * @param deal - The deal to check permissions for
 * @returns DealPermissions object with role information and permission flags
 */
export function useDealPermissions(
    deal: Deal | null | undefined
): DealPermissions {
    const { props } = usePage<any>();
    const currentUser = props.auth?.user;

    return useMemo(() => {
        // Default permissions (no access)
        const defaultPermissions: DealPermissions = {
            roles: ["none"],
            isCreator: false,
            isAgent: false,
            isWatcher: false,
            isParticipant: false,
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
                (participant) => participant.id === userId
            ) ?? false;
        if (isParticipant) roles.push("participant");

        // If no roles found, mark as none
        if (roles.length === 0) {
            roles.push("none");
        }

        const hasAnyRole = roles.length > 0 && !roles.includes("none");

        // Only creators and agents can edit/delete
        const canEdit = isCreator || isAgent;
        const canDelete = isCreator || isAgent;

        // Anyone with a role can view
        const canView = hasAnyRole;

        return {
            roles,
            isCreator,
            isAgent,
            isWatcher,
            isParticipant,
            canEdit,
            canDelete,
            canView,
            hasAnyRole,
        };
    }, [deal, currentUser?.id]);
}

/**
 * Utility function to check deal permissions without hooks (for non-component contexts)
 *
 * @param deal - The deal to check permissions for
 * @param userId - The user ID to check permissions for
 * @returns DealPermissions object with role information and permission flags
 */
export function getDealPermissions(
    deal: Deal | null | undefined,
    userId: number | null | undefined
): DealPermissions {
    const defaultPermissions: DealPermissions = {
        roles: ["none"],
        isCreator: false,
        isAgent: false,
        isWatcher: false,
        isParticipant: false,
        canEdit: false,
        canDelete: false,
        canView: false,
        hasAnyRole: false,
    };

    if (!deal || !userId) {
        return defaultPermissions;
    }

    const roles: DealRole[] = [];

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
            (participant) => participant.id === userId
        ) ?? false;
    if (isParticipant) roles.push("participant");

    // If no roles found, mark as none
    if (roles.length === 0) {
        roles.push("none");
    }

    const hasAnyRole = roles.length > 0 && !roles.includes("none");

    // Only creators and agents can edit/delete
    const canEdit = isCreator || isAgent;
    const canDelete = isCreator || isAgent;

    // Anyone with a role can view
    const canView = hasAnyRole;

    return {
        roles,
        isCreator,
        isAgent,
        isWatcher,
        isParticipant,
        canEdit,
        canDelete,
        canView,
        hasAnyRole,
    };
}

export default useDealPermissions;
