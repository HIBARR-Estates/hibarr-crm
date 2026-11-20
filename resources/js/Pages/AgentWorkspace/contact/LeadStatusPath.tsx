import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { buildLeadPath, type LeadStatusOption } from "./model";

interface LeadPathStepsProps {
    statuses: LeadStatusOption[];
    currentKey: string;
}

/**
 * The lead's lifecycle as a path: New → Contacted → Qualifying → Qualified
 * (the goal). It sits in the status bar (canvas L8-01), whose Status menu
 * changes it; an off-path status leaves every step ahead.
 */
export function LeadPathSteps({ statuses, currentKey }: LeadPathStepsProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const path = buildLeadPath(statuses, currentKey);
    const last = path.steps.length - 1;
    const offCurrent = path.offPath.find((status) => status.current);

    return (
        <>
            <ol className="agent-path__steps" aria-label={t("pages.agent_workspace.contact.status.path_aria")}>
                {path.steps.map((step, index) => (
                    <li
                        key={step.key}
                        className={`agent-path__step agent-path__step--${step.state}`}
                        aria-current={step.state === "current" ? "step" : undefined}
                    >
                        <span className="agent-path__bar" aria-hidden="true" />
                        <span className="agent-path__name">
                            {td(step.label, { source: "en" })}
                            {step.state === "current" ? (
                                <span className="agent-path__tag"> · {t("pages.agent_workspace.contact.status.now")}</span>
                            ) : index === last ? (
                                <span className="agent-path__tag"> · {t("pages.agent_workspace.contact.status.goal")}</span>
                            ) : null}
                        </span>
                    </li>
                ))}
            </ol>
            {offCurrent ? (
                <span className="agent-path__chip agent-path__chip--current">
                    <span className={`agent-path__dot${offCurrent.key === "lost" ? " agent-path__dot--lost" : ""}`} aria-hidden="true" />
                    {t("pages.agent_workspace.contact.status.off_now", { status: td(offCurrent.label, { source: "en" }) })}
                </span>
            ) : null}
        </>
    );
}
