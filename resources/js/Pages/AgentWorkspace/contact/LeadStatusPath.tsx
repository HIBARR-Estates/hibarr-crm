import Button from "@/Components/Redesign/primitives/Button";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { buildLeadPath, type LeadStatusOption } from "./model";

interface LeadStatusPathProps {
    statuses: LeadStatusOption[];
    currentKey: string;
    /** Shown only when the agent may edit the lead and it isn't lost already. */
    onMarkLost?: () => void;
    saving?: boolean;
}

/**
 * The lead's lifecycle as a path: New → Contacted → Qualifying → Qualified
 * (the goal), with the company's other statuses as chips off the path. It
 * reads the status; it doesn't set it. Status moves with the qualification
 * and the actions that already move it; the one exception is Mark as lost.
 */
export default function LeadStatusPath({ statuses, currentKey, onMarkLost, saving = false }: LeadStatusPathProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const path = buildLeadPath(statuses, currentKey);
    const last = path.steps.length - 1;

    return (
        <section className="agent-contact__section agent-path" aria-labelledby="agent-path-title">
            <h2 id="agent-path-title" className="agent-contact__label">
                {t("pages.agent_workspace.contact.status.title")}
            </h2>
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
            {path.offPath.length > 0 || onMarkLost ? (
                <div className="agent-path__off">
                    {path.offPath.length > 0 ? (
                        <>
                            <span className="agent-path__off-label">{t("pages.agent_workspace.contact.status.off_path")}</span>
                            <ul className="agent-path__chips">
                                {path.offPath.map((status) => (
                                    <li
                                        key={status.key}
                                        className={`agent-path__chip${status.current ? " agent-path__chip--current" : ""}`}
                                        aria-current={status.current ? "true" : undefined}
                                    >
                                        <span
                                            className="agent-path__dot"
                                            style={status.label_color ? { background: status.label_color } : undefined}
                                            aria-hidden="true"
                                        />
                                        {td(status.label, { source: "en" })}
                                    </li>
                                ))}
                            </ul>
                        </>
                    ) : null}
                    {onMarkLost ? (
                        <Button variant="ghost" className="agent-path__lost" onClick={onMarkLost} loading={saving}>
                            {t("pages.agent_workspace.contact.status.mark_lost")}
                        </Button>
                    ) : null}
                </div>
            ) : null}
        </section>
    );
}
