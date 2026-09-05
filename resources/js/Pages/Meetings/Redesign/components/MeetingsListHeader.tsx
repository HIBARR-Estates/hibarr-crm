import { useTd } from "@/Hooks/useDynamicTranslation";
import SelectCheckbox from "@/Components/Redesign/primitives/SelectCheckbox";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import { MEETING_COLUMNS as C } from "./MeetingRow";

interface MeetingsListHeaderProps {
    /** True when every row on the page is selected. */
    allSelected: boolean;
    onToggleAll: () => void;
}

const LABEL_STYLE = {
    fontSize: 11,
    fontWeight: 700 as const,
    letterSpacing: "0.06em",
    color: T.TEXT_HINT,
};

/**
 * Column headings for the list layout.
 *
 * The widths and the responsive classes come from `MeetingRow`'s own column
 * table, so a column that disappears at a breakpoint disappears from both
 * halves at once rather than leaving a heading over nothing.
 */
export default function MeetingsListHeader({
    allSelected,
    onToggleAll,
}: MeetingsListHeaderProps) {
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
            <SelectCheckbox
                checked={allSelected}
                onChange={onToggleAll}
                label={td("Select all meetings on this page")}
            />

            <span className="shrink-0" style={{ width: C.when.width }}>
                {td("When")}
            </span>

            {/* Matches the row's platform glyph, which has no heading. */}
            <span className="shrink-0" style={{ width: 15 }} aria-hidden />

            <span className="min-w-0 flex-1">{td("Meeting")}</span>

            <span
                className={`shrink-0 ${C.related.className}`}
                style={{ width: C.related.width }}
            >
                {td("Related to")}
            </span>

            <span
                className={`shrink-0 ${C.platform.className}`}
                style={{ width: C.platform.width }}
            >
                {td("Where")}
            </span>

            <span
                className={`shrink-0 ${C.people.className}`}
                style={{ width: C.people.width }}
            >
                {td("People")}
            </span>

            <span
                className={`shrink-0 ${C.link.className}`}
                style={{ width: C.link.width }}
                aria-hidden
            />

            <span
                className="shrink-0"
                style={{ width: C.actions.width }}
                aria-hidden
            />
        </div>
    );
}
