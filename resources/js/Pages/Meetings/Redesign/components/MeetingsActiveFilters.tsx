import { useTd } from "@/Hooks/useDynamicTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface MeetingFilters {
    attendance: string | null;
    date_from: string | null;
    date_to: string | null;
}

interface MeetingsActiveFiltersProps {
    filters: MeetingFilters;
    onClear: () => void;
}

const ATTENDANCE_LABELS: Record<string, string> = {
    attended: "Client attended",
    no_show: "Client did not attend",
};

/**
 * Deep links from the dashboard ("3 missed") narrow this list server-side.
 * Without a line saying so the page just looks short — this names the
 * narrowing and offers one click out of it.
 */
export default function MeetingsActiveFilters({
    filters,
    onClear,
}: MeetingsActiveFiltersProps) {
    const { td } = useTd();
    const { formatDate } = useUserDateTime();

    const clauses: string[] = [];
    if (filters.attendance) {
        clauses.push(
            td(ATTENDANCE_LABELS[filters.attendance] ?? filters.attendance),
        );
    }
    if (filters.date_from && filters.date_to) {
        clauses.push(
            `${formatDate(filters.date_from)} – ${formatDate(filters.date_to)}`,
        );
    } else if (filters.date_from) {
        clauses.push(`${td("From")} ${formatDate(filters.date_from)}`);
    } else if (filters.date_to) {
        clauses.push(`${td("Until")} ${formatDate(filters.date_to)}`);
    }

    if (clauses.length === 0) return null;

    return (
        <div
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-3.5 py-2.5"
            style={{
                background: T.SURFACE_2,
                border: `1px solid ${T.BORDER}`,
                borderRadius: R.MD,
            }}
        >
            <Icon name="filter" size={14} color={T.TEXT_HINT} />
            <span style={{ fontSize: 13, color: T.TEXT_MUTED }}>
                {td("Showing only")}{" "}
                <span className="font-semibold" style={{ color: T.TEXT }}>
                    {clauses.join(" · ")}
                </span>
            </span>
            <Button variant="ghost" size="sm" className="ml-auto" onClick={onClear}>
                {td("Clear")}
            </Button>
        </div>
    );
}
