import type { Lead } from "@/Types/api/leads";

function relationUserId(
    value: { id?: number } | number | null | undefined,
): number | null {
    if (value == null) return null;
    if (typeof value === "number") return value;
    if (typeof value.id === "number") return value.id;
    return null;
}

/**
 * Mirrors PermissionService::checkAccess for `edit_lead` with
 * added → added_by, owned → lead_owner (same as uploadImage / patch).
 */
export function canEditLead(
    permission: string | null | undefined,
    lead: Pick<Lead, "added_by" | "lead_owner">,
    userId: number | null | undefined,
): boolean {
    const scope = permission ?? "none";
    if (scope === "all") return true;
    if (scope === "none" || userId == null) return false;

    const isAdded = relationUserId(lead.added_by) === userId;
    const isOwned = relationUserId(lead.lead_owner) === userId;

    if (scope === "added") return isAdded;
    if (scope === "owned") return isOwned;
    if (scope === "both") return isAdded || isOwned;

    return false;
}
