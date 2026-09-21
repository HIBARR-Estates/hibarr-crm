import { useTd } from "@/Hooks/useDynamicTranslation";

export interface Segment<T extends string> {
    value: T;
    /** Label text — translated by the caller when localize is false. */
    label: string;
    /** Shown but not selectable — greyed out, no click. */
    disabled?: boolean;
    /**
     * Hover text. Mostly for disabled segments: a greyed tab with no reason
     * given reads as broken rather than as not-yet-built.
     */
    title?: string;
}

interface SegmentedControlProps<T extends string> {
    segments: Segment<T>[];
    active: T;
    onSelect: (value: T) => void;
    /** Names the group for screen readers, e.g. "Period" or "Dashboard". */
    label: string;
    /**
     * When false, segment labels and the nav aria-label are shown as-is
     * (already from t()). Default true keeps td() for English source strings.
     */
    localize?: boolean;
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
    localize = true,
}: SegmentedControlProps<T>) {
    const { td } = useTd();

    const ariaLabel = localize ? td(label, { source: "en" }) : label;

    return (
        <nav className="dv2-tabs" aria-label={ariaLabel}>
            {segments.map((segment) => (
                <button
                    key={segment.value}
                    type="button"
                    className="dv2-tab"
                    disabled={segment.disabled}
                    title={
                        segment.title
                            ? localize
                                ? td(segment.title, { source: "en" })
                                : segment.title
                            : undefined
                    }
                    aria-current={segment.value === active ? "page" : undefined}
                    onClick={() =>
                        !segment.disabled && onSelect(segment.value)
                    }
                >
                    {localize
                        ? td(segment.label, { source: "en" })
                        : segment.label}
                </button>
            ))}
        </nav>
    );
}
