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
    /**
     * Stretches the track and its segments across the full width of the
     * parent — for a switcher that reads as a tab strip (the schedule
     * dialog's Deal/Lead tabs). Left off, the track hugs its buttons.
     */
    fullWidth?: boolean;
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
    fullWidth = false,
}: SegmentedProps<V>) {
    return (
        <div
            role="group"
            aria-label={ariaLabel}
            // inline-flex so the track never runs wider than its segments in a
            // block context (a modal field), which left a full-width grey bar
            // behind a huddle of buttons. `fullWidth` opts back into
            // stretching, and then the segments stretch with it.
            className={`${fullWidth ? "flex w-full" : "inline-flex"} gap-0.5 p-0.5`}
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
                        className={`dr-press inline-flex items-center gap-1.5${
                            fullWidth
                                ? " min-w-0 flex-1 justify-center text-center"
                                : " whitespace-nowrap"
                        }`}
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
                            // fullWidth tracks can hold 3+ segments in a
                            // narrower space than any one label needs on its
                            // own — wrapping beats letting the modal's own
                            // `overflow-x: hidden` silently clip the text.
                            whiteSpace: fullWidth ? "normal" : "nowrap",
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
                                    // "raised" fills the active segment with
                                    // white, not the solid variant's blue —
                                    // the translucent-white count text below
                                    // was built for that blue fill and reads
                                    // as barely-visible white-on-white here.
                                    color: !active
                                        ? T.TEXT_HINT
                                        : variant === "raised"
                                          ? T.TEXT_MUTED
                                          : "rgba(255,255,255,0.75)",
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
