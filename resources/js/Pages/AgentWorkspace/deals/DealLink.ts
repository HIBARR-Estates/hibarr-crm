import type { DealItem } from "./types";

/** A deal opens on its person's page in the deal state; one without a person opens by id. */
export function dealHref(deal: DealItem): string {
    return deal.lead_id ? route("agent.people.deal", { lead: deal.lead_id, deal: deal.id }) : route("agent.deals.show", deal.id);
}
