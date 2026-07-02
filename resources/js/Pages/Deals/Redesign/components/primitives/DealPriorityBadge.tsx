import { DEAL_REDESIGN_TOKENS as T } from "../../tokens";

type Priority = "high" | "medium" | "low";

const PRIORITY_STYLES: Record<Priority, { bg: string; color: string; border: string; label: string }> = {
    high: { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: "High" },
    medium: { bg: "#fffbeb", color: "#b45309", border: "#fde68a", label: "Medium" },
    low: { bg: T.GRAY, color: T.GRAY_DARK, border: T.GRAY_MID, label: "Low" },
};

interface DealPriorityBadgeProps {
    priority: Priority;
}

export default function DealPriorityBadge({ priority }: DealPriorityBadgeProps) {
    const style = PRIORITY_STYLES[priority];

    return (
        <span
            style={{
                fontSize: 11,
                padding: "3px 8px",
                borderRadius: 10,
                background: style.bg,
                color: style.color,
                border: `1px solid ${style.border}`,
                fontWeight: 500,
            }}
        >
            {style.label}
        </span>
    );
}
