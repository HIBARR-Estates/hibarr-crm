import type { ReactNode } from "react";
import { REDESIGN_RADIUS as R, REDESIGN_TOKENS as T } from "../tokens";

export interface SegmentedOption<V extends string | number> {
    value: V;
    label: ReactNode;
    /** Optional trailing count, e.g. the quick-filter tallies. */
    count?: ReactNode;
    title?: string;
    /** Optional leading glyph, e.g. the Cards/Calendar view switcher. */
    icon?: ReactNode;
}

interface SegmentedProps<V extends string | number> {
    value: V;
    options: Array<SegmentedOption<V>>;
    onChange: (value: V) => void;
    ariaLabel?: string;
    /** "solid" fills the active segment (quick filters, group by, page size);
     *  "raised" lifts it on white, as the list/board toggle does. */
    variant?: "solid" | "raised";
}

/**
 * The one segmented switcher across the redesign — Tasks' list/board,
 * group-by, quick filters and rows-per-page and the Meetings tabs/view
 * toggle all render through this so they stay identical rather than
 * drifting apart per-component.
 */
export default function Segmented<V extends string | number>({
    value,
    options,
    onChange,
    ariaLabel,
    variant = "solid",
}: SegmentedProps<V>) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="flex gap-0.5 p-0.5"
            style={{
                background: T.BG,
                border: `1px solid ${T.BORDER}`,
                borderRadius: R.MD,
            }}
        >
            {options.map((option) => {
                const active = option.value === value;
                const activeBg = variant === "raised" ? T.WHITE : T.BLUE;
                const activeFg = variant === "raised" ? T.NAVY : T.WHITE;
                return (
                    <button
                        key={String(option.value)}
                        type="button"
                        title={option.title}
                        aria-pressed={active}
                        onClick={() => onChange(option.value)}
                        className="dr-press inline-flex items-center gap-1.5 whitespace-nowrap"
                        style={{
                            padding: "6px 12px",
                            borderRadius: R.SM,
                            border: "none",
                            fontSize: 14,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            cursor: "pointer",
                            background: active ? activeBg : "transparent",
                            color: active ? activeFg : T.TEXT_MUTED,
                        }}
                    >
                        {option.icon}
                        {option.label}
                        {option.count != null && (
                            <span
                                style={{
                                    fontSize: 14,
                                    fontWeight: 600,
                                    fontVariantNumeric: "tabular-nums",
                                    color: active
                                        ? "rgba(255,255,255,0.75)"
                                        : T.TEXT_HINT,
                                }}
                            >
                                {option.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
