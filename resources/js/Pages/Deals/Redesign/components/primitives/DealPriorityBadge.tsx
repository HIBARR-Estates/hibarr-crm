import useTranslation from "@/Hooks/useTranslation";
import PriorityBadge from "@/Components/Redesign/primitives/PriorityBadge";

type Priority = "high" | "medium" | "low";

const PRIORITY_LABEL_KEYS: Record<Priority, string> = {
    high: "priority_high",
    medium: "priority_medium",
    low: "priority_low",
};

interface DealPriorityBadgeProps {
    priority: Priority;
}

/** Deal-branded PriorityBadge with deal i18n labels. */
export default function DealPriorityBadge({ priority }: DealPriorityBadgeProps) {
    const { t } = useTranslation();
    return (
        <PriorityBadge
            priority={priority}
            label={t(`pages.deals.common.${PRIORITY_LABEL_KEYS[priority]}`)}
        />
    );
}
