import { REDESIGN_TOKENS as T } from "../tokens";

interface SwitchProps {
    checked: boolean;
    onChange: () => void;
    disabled?: boolean;
    /** Mid-toggle: dims the track and swaps the label for a spinner. */
    loading?: boolean;
    label?: string;
    "aria-label"?: string;
}

/** Pill track + thumb toggle. */
export default function Switch({
    checked,
    onChange,
    disabled,
    loading,
    label,
    "aria-label": ariaLabel,
}: SwitchProps) {
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
