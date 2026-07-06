import { DEAL_REDESIGN_TOKENS as T } from "../../../tokens";

const PRIORITY_STYLES = {
    high: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: "High" },
    medium: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Medium" },
    low: { bg: T.GRAY, color: T.GRAY_DARKER, border: T.GRAY_MID, label: "Low" },
} as const;

interface OverviewPriorityBadgeProps {
    priority: "low" | "medium" | "high";
    vertical?: boolean;
}

export default function OverviewPriorityBadge({
    priority,
    vertical = false,
}: OverviewPriorityBadgeProps) {
    const style = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.medium;

    if (vertical) {
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

    return (
        <span
            className="rounded-[10px] px-[7px] py-0.5 text-[10px] font-medium"
            style={{
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
            }}
        >
            {style.label}
        </span>
    );
}
