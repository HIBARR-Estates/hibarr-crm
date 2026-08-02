import Badge from "./Badge";

type Priority = "high" | "medium" | "low";

const PRIORITY_VARIANT: Record<Priority, "red" | "amber" | "gray"> = {
    high: "red",
    medium: "amber",
    low: "gray",
};

const DEFAULT_LABELS: Record<Priority, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
};

interface PriorityBadgeProps {
    priority: Priority;
    /** Override the displayed label (e.g. translated string). */
    label?: string;
}

/** Lowercase-friendly priority pill. */
export default function PriorityBadge({ priority, label }: PriorityBadgeProps) {
    return (
        <Badge variant={PRIORITY_VARIANT[priority] ?? "amber"}>
            {label ?? DEFAULT_LABELS[priority] ?? priority}
        </Badge>
    );
}
