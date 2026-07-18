import DealBadge from "./DealBadge";

type Priority = "high" | "medium" | "low";

const PRIORITY_VARIANT: Record<Priority, "red" | "amber" | "gray"> = {
    high: "red",
    medium: "amber",
    low: "gray",
};

interface DealPriorityBadgeProps {
    priority: Priority;
}

/** v2.2 PriorityBadge (deal-v2-2.jsx:1777-1780) — lowercase label, pill tones. */
export default function DealPriorityBadge({ priority }: DealPriorityBadgeProps) {
    return (
        <DealBadge variant={PRIORITY_VARIANT[priority] ?? "amber"}>
            {priority}
        </DealBadge>
    );
}
