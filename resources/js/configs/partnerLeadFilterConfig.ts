import { FilterConfig } from "@/contexts/FilterContext";

interface PartnerLeadFilterConfigProps {
    /** Lifecycle statuses the partner's own leads actually have. */
    statuses?: Array<{ id: number; label: string }>;
    /** Stage names of the partner's own active deals. */
    stages?: string[];
}

/**
 * Filter fields for a partner's referred leads.
 *
 * Same shape as the lead/deal/meeting configs, so the shared `EntityFilterModal`
 * and `ActiveFilterSentence` render this page without knowing anything about
 * partners. Keys are the query params `PartnerLeadController@index` reads. The
 * options are only what this partner's own leads have — there is nothing to
 * pick that would match nothing.
 */
const createPartnerLeadFilterConfig = ({
    statuses = [],
    stages = [],
}: PartnerLeadFilterConfigProps): FilterConfig => ({
    routeName: "partner.leads.index",
    title: "Lead Filters",
    fields: [
        {
            key: "search",
            label: "Search",
            type: "text",
            placeholder: "Search by name...",
            span: 24,
            section: "General",
            sentence: "search",
        },
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
            label: "Active deals",
            type: "select",
            control: "select",
            section: "Deals",
            sentence: "deals",
            options: [
                { label: "With active deals", value: "with" },
                { label: "Without active deals", value: "without" },
            ],
            placeholder: "Any",
        },
        {
            key: "stage",
            label: "Deal status",
            type: "multiselect",
            control: "pills",
            section: "Deals",
            sentence: "deal status",
            options: stages.map((stage) => ({ label: stage, value: stage })),
            placeholder: "Filter by deal status",
        },
    ],
    defaultValues: {},
    // Only the list comes back when a filter changes, as on Meetings.
    only: ["leads"],
});

export default createPartnerLeadFilterConfig;
