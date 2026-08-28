import { Deal } from "@/Types/api/deals";

export type DealOutcome = "won" | "lost" | null;

/**
 * outcome_status is set by automation and is authoritative; the pipeline
 * stage slug can lag behind it (e.g. a deal marked won before its stage
 * catches up), so it's only a fallback when outcome_status hasn't been set.
 */
export function resolveDealOutcome(deal: Deal): DealOutcome {
    const outcome = (deal as Deal & { outcome_status?: string }).outcome_status;
    if (outcome === "won") return "won";
    if (outcome === "lost") return "lost";
    const slug = deal.lead_stage?.slug;
    if (slug === "win") return "won";
    if (slug === "lost") return "lost";
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
