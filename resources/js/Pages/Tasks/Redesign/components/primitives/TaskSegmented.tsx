import type { ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";

export interface SegmentedOption<V extends string | number> {
    value: V;
    label: ReactNode;
    /** Optional trailing count, e.g. the quick-filter tallies. */
    count?: ReactNode;
    title?: string;
}

interface TaskSegmentedProps<V extends string | number> {
    value: V;
    options: Array<SegmentedOption<V>>;
    onChange: (value: V) => void;
    ariaLabel?: string;
    /** "solid" fills the active segment (quick filters, group by, page size);
     *  "raised" lifts it on white, as the list/board toggle does. */
    variant?: "solid" | "raised";
}

/**
 * The one segmented switcher used across the Tasks workspace — list/board,
 * group-by, quick filters and rows-per-page all render through this so they
 * stay identical rather than drifting apart per-component.
 */
export default function TaskSegmented<V extends string | number>({
    value,
    options,
    onChange,
    ariaLabel,
    variant = "solid",
}: TaskSegmentedProps<V>) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            className="flex gap-0.5 p-0.5"
            style={{
                background: T.BG,
                border: `1px solid ${T.BORDER}`,
                borderRadius: 8,
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
                        className="tasks-press inline-flex items-center gap-1.5 whitespace-nowrap"
                        style={{
                            padding: "6px 12px",
                            borderRadius: 6,
                            border: "none",
                            fontSize: 14,
                            fontWeight: 600,
                            lineHeight: 1.5,
                            cursor: "pointer",
                            background: active ? activeBg : "transparent",
                            color: active ? activeFg : T.TEXT_MUTED,
                        }}
                    >
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
