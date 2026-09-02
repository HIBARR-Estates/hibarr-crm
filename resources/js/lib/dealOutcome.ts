import { Deal } from "@/Types/api/deals";

export type DealOutcome = "won" | "lost" | null;

/**
 * outcome_status is the sole authoritative signal — a pipeline stage merely
 * slugged "win"/"lost" does not itself mean the deal is won/lost (that stage
 * slug fallback used to be here, but it can't distinguish "outcome_status
 * was never set" from "outcome_status was deliberately cleared": both are
 * null, and clearing an outcome never moves the deal out of its stage, so
 * the fallback permanently resurrected "won" after every revert).
 */
export function resolveDealOutcome(deal: Deal): DealOutcome {
    const outcome = (deal as Deal & { outcome_status?: string }).outcome_status;
    if (outcome === "won") return "won";
    if (outcome === "lost") return "lost";
    return null;
}

/**
 * Mirrors Deal::isLocked() (app/Models/Deal.php) — only the explicit
 * is_locked flag locks a deal. Winning a deal does not lock it on its own;
 * use the lock_deal automation action (or a manual lock) for that.
 */
export function isDealEffectivelyLocked(deal: Deal): boolean {
    return !!deal.is_locked;
}

/**
 * Mirrors Deal::isCommissionLocked() (app/Models/Deal.php) — set once
 * commission has been distributed for a won deal. Narrower than
 * isDealEffectivelyLocked: it protects only the value (and anything that
 * feeds it — packages, properties, offers), not the whole deal.
 */
export function isDealValueLocked(deal: Deal): boolean {
    return !!deal.commission_locked;
}
