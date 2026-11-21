import useTranslation from "@/Hooks/useTranslation";
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
    color: T.TEXT,
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
    const { t } = useTranslation();

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
                label={t("pages.meetings.ui.select_all_meetings_on_this_page")}
            />

            <span className="shrink-0" style={{ width: C.time.width }}>
                {t("pages.meetings.ui.time")}
            </span>

            {/* Matches the row's platform chip, which needs no heading of its
                own — the platform is named in the type column and on hover. */}
            <span className="shrink-0" style={{ width: 28 }} aria-hidden />

            <span className="min-w-0 flex-1">{t("pages.meetings.ui.meeting_with")}</span>

            <span
                className={`shrink-0 ${C.type.className}`}
                style={{ width: C.type.width }}
            >
                {t("pages.meetings.ui.type")}
            </span>

            <span
                className={`shrink-0 ${C.status.className}`}
                style={{ width: C.status.width }}
            >
                {t("pages.meetings.ui.status")}
            </span>

            <span
                className={`shrink-0 ${C.people.className}`}
                style={{ width: C.people.width }}
            >
                {t("pages.meetings.ui.people")}
            </span>

            <span
                className="shrink-0"
                style={{ width: C.actions.width }}
                aria-hidden
            />
        </div>
    );
}
