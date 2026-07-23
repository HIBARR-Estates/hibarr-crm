import useTranslation from "@/Hooks/useTranslation";
import DealBadge from "./DealBadge";

type Priority = "high" | "medium" | "low";

const PRIORITY_VARIANT: Record<Priority, "red" | "amber" | "gray"> = {
    high: "red",
    medium: "amber",
    low: "gray",
};

const PRIORITY_LABEL_KEYS: Record<Priority, string> = {
    high: "priority_high",
    medium: "priority_medium",
    low: "priority_low",
};

interface DealPriorityBadgeProps {
    priority: Priority;
}

/** v2.2 PriorityBadge (deal-v2-2.jsx:1777-1780) — lowercase label, pill tones. */
export default function DealPriorityBadge({ priority }: DealPriorityBadgeProps) {
    const { t } = useTranslation();
    return (
        <DealBadge variant={PRIORITY_VARIANT[priority] ?? "amber"}>
            {t(`pages.deals.common.${PRIORITY_LABEL_KEYS[priority]}`)}
        </DealBadge>
    );
}
