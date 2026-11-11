import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { PARTNER_LEAD_COLUMNS as C } from "./PartnerLeadRow";

const LABEL_STYLE = {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: "0.06em",
    color: T.TEXT,
};

interface Props {
    /** "added_desc" is newest first. */
    sort: "added_asc" | "added_desc";
    onToggleAddedSort: () => void;
}

/**
 * Column headings for the list. The widths and responsive classes come from
 * `PartnerLeadRow`'s own column table, so a column that disappears at a
 * breakpoint disappears from both halves at once. Added is the one sortable
 * column: the header toggles oldest and newest.
 */
export default function PartnerLeadsListHeader({ sort, onToggleAddedSort }: Props) {
    const { td } = useTd();
    const newestFirst = sort !== "added_asc";

    return (
        <div
            className="flex items-center gap-4 px-4 py-2.5 uppercase"
            style={{
                background: T.SURFACE_2,
                borderBottom: `1px solid ${T.BORDER}`,
                ...LABEL_STYLE,
            }}
        >
            <span className="min-w-0 flex-1">{td("Lead")}</span>
            <span className={`shrink-0 ${C.added.className}`} style={{ width: C.added.width }}>
                <button
                    type="button"
                    onClick={onToggleAddedSort}
                    aria-sort={newestFirst ? "descending" : "ascending"}
                    style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                        padding: 0,
                        border: "none",
                        background: "none",
                        color: "inherit",
                        font: "inherit",
                        letterSpacing: "inherit",
                        textTransform: "inherit",
                        cursor: "pointer",
                    }}
                >
                    {td("Added")}
                    <span aria-hidden>{newestFirst ? "↓" : "↑"}</span>
                </button>
            </span>
            <span className={`shrink-0 ${C.source.className}`} style={{ width: C.source.width }}>
                {td("Source")}
            </span>
            <span className={`shrink-0 ${C.status.className}`} style={{ width: C.status.width }}>
                {td("Status")}
            </span>
            <span className={`shrink-0 ${C.deals.className}`} style={{ width: C.deals.width }}>
                {td("Deals")}
            </span>
            <span className="shrink-0" style={{ width: C.open.width }} aria-hidden />
        </div>
    );
}
