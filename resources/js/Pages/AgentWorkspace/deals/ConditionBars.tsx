import useTranslation from "@/Hooks/useTranslation";
import type { DealExtras } from "./types";

interface ConditionBarsProps {
    /** Undefined while the deferred conditions are on their way. */
    conditions: DealExtras["conditions"] | undefined;
}

/**
 * Which of the next stage's conditions a deal meets: one bar per condition,
 * green for each one met, then "1/3". A deal whose next stage has none shows
 * a dash.
 */
export default function ConditionBars({ conditions }: ConditionBarsProps) {
    const { t } = useTranslation();

    if (!conditions) return <span className="agent-dp__loading" aria-hidden="true" />;
    if (conditions.total === 0) return <span className="agent-dp__muted">{t("pages.agent_workspace.deals.no_value")}</span>;

    return (
        <span className="agent-dp__conditions" role="img" aria-label={t("pages.agent_workspace.deals.conditions_label", { met: conditions.met, total: conditions.total })}>
            <span className="agent-dp__bars" aria-hidden="true">
                {Array.from({ length: conditions.total }, (_, index) => (
                    <i key={index} className={index < conditions.met ? "agent-dp__bar agent-dp__bar--met" : "agent-dp__bar"} />
                ))}
            </span>
            <span className="agent-dp__count" aria-hidden="true">
                {conditions.met}/{conditions.total}
            </span>
        </span>
    );
}
