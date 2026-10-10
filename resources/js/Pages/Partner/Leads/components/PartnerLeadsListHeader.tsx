import { useTd } from "@/Hooks/useDynamicTranslation";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { PARTNER_LEAD_COLUMNS as C } from "./PartnerLeadRow";

const LABEL_STYLE = {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: "0.06em",
    color: T.TEXT,
};

/**
 * Column headings for the list. The widths and responsive classes come from
 * `PartnerLeadRow`'s own column table, so a column that disappears at a
 * breakpoint disappears from both halves at once.
 */
export default function PartnerLeadsListHeader() {
    const { td } = useTd();

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
