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

            <span className="shrink-0" style={{ width: C.time.width }}>
                {td("Time")}
            </span>

            {/* Matches the row's platform chip, which needs no heading of its
                own — the platform is named in the type column and on hover. */}
            <span className="shrink-0" style={{ width: 28 }} aria-hidden />

            <span className="min-w-0 flex-1">{td("Meeting with")}</span>

            <span
                className={`shrink-0 ${C.type.className}`}
                style={{ width: C.type.width }}
            >
                {td("Type")}
            </span>

            <span
                className={`shrink-0 ${C.status.className}`}
                style={{ width: C.status.width }}
            >
                {td("Status")}
            </span>

            <span
                className={`shrink-0 ${C.people.className}`}
                style={{ width: C.people.width }}
            >
                {td("People")}
            </span>

            <span
                className="shrink-0"
                style={{ width: C.actions.width }}
                aria-hidden
            />
        </div>
    );
}
