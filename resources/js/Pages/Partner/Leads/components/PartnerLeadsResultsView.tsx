import { forwardRef } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";
import EmptyState from "@/Components/Redesign/primitives/EmptyState";
import Pagination from "@/Components/Redesign/primitives/Pagination";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import type { PartnerLeadsPage } from "../types";
import PartnerLeadRow from "./PartnerLeadRow";
import PartnerLeadsListHeader from "./PartnerLeadsListHeader";

interface Props {
    leads: PartnerLeadsPage;
    onOpen: (id: number) => void;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
    /** Dimmed while a page or filter round trip is in flight. */
    isPaging: boolean;
    /** True when a search or filter is narrowing the list. */
    filtered: boolean;
    onClearFilters: () => void;
}

/**
 * The paginated leads, as one bordered table with the redesign pager beneath —
 * the same arrangement as the Meetings list.
 */
const PartnerLeadsResultsView = forwardRef<HTMLDivElement, Props>(function PartnerLeadsResultsView(
    { leads, onOpen, onPageChange, onPageSizeChange, isPaging, filtered, onClearFilters },
    ref,
) {
    const { td } = useTd();

    if (leads.data.length === 0) {
        return (
            <div ref={ref}>
                <EmptyState
                    icon="users"
                    title={td(filtered ? "No leads match" : "No referrals yet")}
                    description={td(
                        filtered
                            ? "Try a different search or clear the filters."
                            : "Leads you refer will appear here.",
                    )}
                    action={filtered ? { label: td("Clear filters"), onClick: onClearFilters } : undefined}
                />
            </div>
        );
    }

    return (
        <>
            <div ref={ref} style={{ opacity: isPaging ? 0.55 : 1, transition: "opacity 120ms ease" }}>
                <div
                    style={{
                        background: T.WHITE,
                        border: `1px solid ${T.BORDER}`,
                        // Square at the bottom: the pager sits directly beneath
                        // and the two read as one surface.
                        borderRadius: "10px 10px 0 0",
                        borderBottom: "none",
                        overflow: "hidden",
                    }}
                >
                    <PartnerLeadsListHeader />
                    {leads.data.map((lead) => (
                        <PartnerLeadRow key={lead.id} lead={lead} onOpen={() => onOpen(lead.id)} />
                    ))}
                </div>
            </div>

            <Pagination
                page={leads.current_page}
                pageSize={leads.per_page}
                totalItems={leads.total}
                onPageChange={onPageChange}
                onPageSizeChange={onPageSizeChange}
                itemLabel="lead"
                itemLabelPlural="leads"
            />
        </>
    );
});

export default PartnerLeadsResultsView;
