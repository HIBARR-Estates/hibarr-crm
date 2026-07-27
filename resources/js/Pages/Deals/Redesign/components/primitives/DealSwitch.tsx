import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

interface DealSwitchProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    /** Mid-toggle: dims the track and swaps the label for a spinner. */
    loading?: boolean;
    label?: string;
    "aria-label"?: string;
}

/**
 * 1:1 port of v2.2's checkbox switch (deal-v2-2.jsx:783-808) — a pill
 * track + thumb toggled directly on click, no separate edit mode. `loading`
 * is CRM-specific (v2.2's mock save is instant) so the in-flight PATCH has
 * a visible cue instead of the control just going inert.
 */
export default function DealSwitch({
    checked,
    onChange,
    disabled,
    loading,
    label,
    "aria-label": ariaLabel,
}: DealSwitchProps) {
    const isDisabled = disabled || loading;
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-busy={loading}
            aria-label={ariaLabel}
            disabled={isDisabled}
            onClick={onChange}
            className="inline-flex shrink-0 items-center gap-2 border-0 bg-transparent p-0"
            style={{ cursor: isDisabled ? "default" : "pointer" }}
        >
            <span
                className="relative inline-block h-5 w-[34px] rounded-full"
                style={{
                    background: checked ? T.GREEN : T.BORDER,
                    opacity: loading ? 0.6 : 1,
                    transition: "background 0.15s, opacity 0.15s",
                }}
            >
                <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all"
                    style={{ left: checked ? 16 : 2 }}
                />
            </span>
            {loading ? (
                <span
                    className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-solid border-current border-t-transparent"
                    style={{ color: T.TEXT_MUTED }}
                    aria-hidden="true"
                />
            ) : (
                label != null && (
                    <span
                        className="font-medium"
                        style={{ fontSize: 13, color: T.TEXT }}
                    >
                        {label}
                    </span>
                )
            )}
        </button>
    );
}
