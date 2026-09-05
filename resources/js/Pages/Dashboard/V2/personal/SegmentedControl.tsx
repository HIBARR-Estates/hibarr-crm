import { useTd } from "@/Hooks/useDynamicTranslation";

export interface Segment<T extends string> {
    value: T;
    /** English source string — translated at render. */
    label: string;
    /** Shown but not selectable — greyed out, no click. */
    disabled?: boolean;
}

interface SegmentedControlProps<T extends string> {
    segments: Segment<T>[];
    active: T;
    onSelect: (value: T) => void;
    /** Names the group for screen readers, e.g. "Period" or "Dashboard". */
    label: string;
}

/**
 * The pill-track switcher used for the scope toggle and the view switcher.
 *
 * Wraps `.dv2-tabs` / `.dv2-tab`, which DashboardV2 already ships — the two
 * switchers on this page were otherwise the same twelve lines of markup twice.
 */
export default function SegmentedControl<T extends string>({
    segments,
    active,
    onSelect,
    label,
}: SegmentedControlProps<T>) {
    const { td } = useTd();

    return (
        <nav className="dv2-tabs" aria-label={td(label)}>
            {segments.map((segment) => (
                <button
                    key={segment.value}
                    type="button"
                    className="dv2-tab"
                    disabled={segment.disabled}
                    aria-current={segment.value === active ? "page" : undefined}
                    onClick={() =>
                        !segment.disabled && onSelect(segment.value)
                    }
                >
                    {td(segment.label)}
                </button>
            ))}
        </nav>
    );
}
