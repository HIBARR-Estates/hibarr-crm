import DealPriorityBadge from "../../primitives/DealPriorityBadge";
import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

const VERTICAL_STYLES = {
    high: { bg: T.RED_SOFT, color: T.RED, border: T.RED_MID, label: "High" },
    medium: { bg: T.AMBER_SOFT, color: T.AMBER, border: T.AMBER_MID, label: "Medium" },
    low: { bg: T.GRAY, color: T.GRAY_DARK, border: T.BORDER, label: "Low" },
} as const;

interface OverviewPriorityBadgeProps {
    priority: "low" | "medium" | "high";
    vertical?: boolean;
}

/**
 * Horizontal = the shared v2.2 priority pill. The `vertical` variant is a
 * Leads-drawer-only affordance (narrow task rows) with no v2.2 equivalent.
 */
export default function OverviewPriorityBadge({
    priority,
    vertical = false,
}: OverviewPriorityBadgeProps) {
    if (!vertical) {
        return <DealPriorityBadge priority={priority ?? "medium"} />;
    }

    const style = VERTICAL_STYLES[priority] ?? VERTICAL_STYLES.medium;

    return (
        <span
            className="rounded text-[9px] font-semibold leading-none"
            style={{
                padding: "4px 2px",
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
                writingMode: "vertical-rl",
                textOrientation: "mixed",
                letterSpacing: "0.02em",
            }}
        >
            {style.label}
        </span>
    );
}
