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
 * Mirrors Deal::isLocked() (app/Models/Deal.php) — a won deal is locked for
 * further editing even if the manual is_locked flag was never set, so the
 * frontend gates match what the backend will actually accept.
 */
export function isDealEffectivelyLocked(deal: Deal): boolean {
    return !!deal.is_locked || resolveDealOutcome(deal) === "won";
}
