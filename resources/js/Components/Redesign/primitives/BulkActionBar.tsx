import { CSSProperties, ReactNode } from "react";
import { REDESIGN_TOKENS as T } from "../tokens";

interface BulkActionBarProps {
    count: number;
    onClear: () => void;
    clearLabel: string;
    children: ReactNode;
    /** Defaults to "{count} selected". */
    selectedLabel?: string;
    /**
     * Overrides the bar's own padding/gap — e.g. roomier spacing for a page
     * whose bulk actions need more breathing room than the compact default
     * (dense workspace tabs) suits. Inline so it reliably beats the base
     * Tailwind utility classes regardless of stylesheet ordering.
     */
    style?: CSSProperties;
    /** Gap between action buttons; defaults to the compact 6px. */
    actionsGap?: number;
}

/** Sticky bar shown while a list is in bulk-select mode. */
export default function BulkActionBar({
    count,
    onClear,
    clearLabel,
    children,
    selectedLabel,
    style,
    actionsGap,
}: BulkActionBarProps) {
    return (
        <div
            className="mb-2.5 flex flex-wrap items-center gap-2.5 rounded-[10px] px-3 py-2"
            style={{ background: T.NAVY, color: T.WHITE, ...style }}
        >
            <span className="text-sm font-semibold">
                {selectedLabel ?? `${count} selected`}
            </span>
            <span
                className="flex flex-wrap items-center gap-1.5"
                style={actionsGap ? { gap: actionsGap } : undefined}
            >
                {children}
            </span>
            <button
                type="button"
                onClick={onClear}
                disabled={!count}
                className="ml-auto border-0 bg-transparent px-1 py-1.5 font-inherit text-sm text-white"
                style={{
                    opacity: count ? 0.9 : 0.4,
                    cursor: count ? "pointer" : "default",
                }}
            >
                {clearLabel}
            </button>
        </div>
    );
}
