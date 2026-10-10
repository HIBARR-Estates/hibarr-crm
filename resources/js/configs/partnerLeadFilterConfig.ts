import { FilterConfig } from "@/contexts/FilterContext";

interface PartnerLeadFilterConfigProps {
    /** Lifecycle statuses the partner's own leads actually have. */
    statuses?: Array<{ id: number; label: string }>;
}

/**
 * Filter fields for a partner's referred leads.
 *
 * Same shape as the lead/deal/meeting configs, so the shared `EntityFilterModal`
 * and `ActiveFilterSentence` render this page without knowing anything about
 * partners. Keys are the query params `PartnerLeadController@index` reads.
 * Search is not a field here: it lives in the page's top bar, as on Leads, so
 * it is not offered twice. Status options are only what this partner's own
 * leads have.
 */
const createPartnerLeadFilterConfig = ({
    statuses = [],
}: PartnerLeadFilterConfigProps): FilterConfig => ({
    routeName: "partner.leads.index",
    title: "Lead Filters",
    fields: [
        {
            key: "status",
            label: "Status",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "status",
            options: statuses.map((status) => ({
                label: status.label,
                value: status.id,
            })),
            placeholder: "Filter by status",
        },
        {
            key: "deals",
            label: "Deals",
            type: "multiselect",
            control: "pills",
            section: "General",
            sentence: "deals",
            // Outcomes, not pipeline stages: stages differ from one pipeline to
            // the next, these mean the same on every deal.
            options: [
                { label: "Open", value: "open" },
                { label: "Won", value: "won" },
                { label: "Lost", value: "lost" },
                { label: "No deals", value: "none" },
            ],
            placeholder: "Filter by deal outcome",
        },
    ],
    defaultValues: {},
    // Only the list comes back when a filter changes, as on Meetings.
    only: ["leads"],
});

export default createPartnerLeadFilterConfig;
