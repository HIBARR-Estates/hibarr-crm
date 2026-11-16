import { useMemo } from "react";
import dayjs from "dayjs";
import { Play } from "lucide-react";
import relativeTime from "dayjs/plugin/relativeTime";
import { usePage } from "@inertiajs/react";
import EntityAiSummaryFacts from "@/Components/EntitySummary/EntityAiSummaryFacts";
import EntityAiSummaryProse from "@/Components/EntitySummary/EntityAiSummaryProse";
import { SummaryPersonalizationProvider } from "@/Components/EntitySummary/SummaryPersonalization";
import { executeSummaryAction, isExecutableAction, nextStepButtonLabel } from "@/Components/EntitySummary/summaryActions";
import { buildLeadTokenValues, personalizeSummaryText } from "@/Components/EntitySummary/summaryTokens";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import useClickToCall from "@/Hooks/useClickToCall";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useEntityAiSummary from "@/Hooks/useEntityAiSummary";
import useSoftphone, { canPlaceCrmCall } from "@/Hooks/useSoftphone";
import useTranslation from "@/Hooks/useTranslation";
import type { EntityAiSummaryCardProps, EntitySummaryChipTone, EntitySummaryPayload } from "@/Types/entity-summary";
import { isLeadSummaryPayload } from "@/Types/entity-summary";
import "@/Components/EntitySummary/entity-summary.css";

dayjs.extend(relativeTime);

type SummaryActions = Pick<
    EntityAiSummaryCardProps,
    "onCreateTask" | "onScheduleCall" | "onRequestDocuments" | "onAdvanceStage" | "onReviewStaleDeal" | "onQualifyLead"
>;

interface AiSummaryPanelProps extends SummaryActions {
    entityType: "lead" | "deal";
    entityId: number;
    initialSummary: EntitySummaryPayload | null | undefined;
    /** The person's name; the summary names them by token. */
    leadName: string | null | undefined;
    leadPhone?: string | null;
}

const RISK_TONE: Record<string, string> = { low: "green", medium: "amber", high: "red" };
const CHIP_TONE: Record<EntitySummaryChipTone, string> = { green: "green", amber: "amber", red: "red", neutral: "gray" };
const URGENCY_TONE: Record<string, string> = { immediate: "amber", this_week: "blue" };

/**
 * The AI summary, readable at a glance and in place (canvas L8-01, L8-03):
 * the takeaway in bold with risk and age, then the lead's written brief and
 * facts, or the deal's toned chips and bullets, then the next step with the
 * button that does it. No dialog to open. A summary is never written by
 * opening the page; Generate or the refresh button asks for one.
 */
export default function AiSummaryPanel({ entityType, entityId, initialSummary, leadName, leadPhone, ...actions }: AiSummaryPanelProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { props } = usePage();
    const { isEnabled: clickToCallEnabled } = useClickToCall();
    const { isEnabled: softphoneEnabled, devices } = useSoftphone();
    const canDial = canPlaceCrmCall({
        softphoneEnabled: softphoneEnabled && props.featureFlags?.["crm.softphone"] === true,
        user: props.auth?.user,
        permissions: props.auth?.permissions,
        deviceCount: devices.length,
        clickToCallEnabled,
    });
    const tokens = useMemo(() => buildLeadTokenValues(leadName), [leadName]);
    const { summary, loading, error, isStale, generate, regenerate } = useEntityAiSummary({
        entityType,
        entityId,
        initialSummary,
        autoGenerate: false,
    });

    const age = summary?.meta?.generated_at ? dayjs(summary.meta.generated_at).fromNow(true) : null;
    const risk = summary?.risk_level && summary.risk_level !== "none" ? summary.risk_level : null;
    const lead = summary && isLeadSummaryPayload(summary) && summary.summary ? summary : null;
    const step = summary?.next_step ?? null;
    const actionable = step ? isExecutableAction(step.action_type, { canAdvanceStage: Boolean(actions.onAdvanceStage) }) : false;
    const urgency = step?.urgency && URGENCY_TONE[step.urgency] ? step.urgency : null;
    const say = (text: string) => personalizeSummaryText(td(text, { source: "en" }), tokens);

    const act = () => {
        if (!step) return;
        executeSummaryAction({ nextStep: step, entityType, entityId, leadPhone: canDial ? leadPhone : null, ...actions });
    };

    return (
        <SummaryPersonalizationProvider values={tokens}>
            <section className="agent-ai" aria-busy={loading || undefined} aria-label={t("pages.agent_workspace.contact.ai.label")}>
                <div className="agent-ai__head">
                    <span className="agent-ai__badge">AI</span>
                    <b className="agent-ai__line">
                        {loading && !summary
                            ? t("pages.agent_workspace.contact.ai.writing")
                            : summary
                              ? say(summary.status_line)
                              : error || t("pages.agent_workspace.contact.ai.none")}
                    </b>
                    {risk ? <span className={`dr-pill dr-pill-${RISK_TONE[risk]}`}>{t(`pages.agent_workspace.contact.ai.risk_${risk}`)}</span> : null}
                    {isStale ? <span className="dr-pill dr-pill-gray">{t("pages.entity_summary.out_of_date")}</span> : null}
                    {age ? <span className="agent-ai__age">{t("pages.agent_workspace.contact.ai.age", { age })}</span> : null}
                    {summary ? (
                        <Button
                            size="sm"
                            className="agent-ai__refresh"
                            onClick={() => void regenerate()}
                            disabled={loading}
                            aria-label={t("pages.agent_workspace.contact.ai.refresh")}
                            title={t("pages.agent_workspace.contact.ai.refresh")}
                        >
                            <Icon name="refresh" size={13} />
                        </Button>
                    ) : (
                        <Button size="sm" onClick={() => void generate()} loading={loading}>
                            <Icon name="refresh" size={13} />
                            {t("pages.agent_workspace.contact.ai.generate")}
                        </Button>
                    )}
                </div>

                {loading && summary ? <p className="agent-ai__writing">{t("pages.agent_workspace.contact.ai.writing")}</p> : null}

                {lead ? (
                    <>
                        <EntityAiSummaryProse text={lead.summary ?? ""} />
                        <EntityAiSummaryFacts facts={lead.facts ?? []} />
                    </>
                ) : summary ? (
                    <>
                        {summary.chips.length > 0 ? (
                            <div className="agent-ai__chips">
                                {summary.chips.slice(0, 4).map((chip) => (
                                    <span key={chip.id} className={`agent-ai__chip agent-ai__chip--${CHIP_TONE[chip.tone] ?? "gray"}`}>
                                        <span className="agent-ai__chip-label">{say(chip.label)}</span>
                                        <b className="agent-ai__chip-value">{say(chip.value)}</b>
                                    </span>
                                ))}
                            </div>
                        ) : null}
                        {summary.bullets.length > 0 ? (
                            <ul className="agent-ai__bullets">
                                {summary.bullets.map((bullet) => (
                                    <li key={bullet}>
                                        <EntityAiSummaryProse text={bullet} />
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </>
                ) : null}

                {step && step.action_type !== "NO_ACTION_NEEDED" ? (
                    <div className="agent-ai__next">
                        <span className="agent-ai__next-cap">{t("pages.agent_workspace.contact.ai.next_step")}</span>
                        <span className="agent-ai__next-text">
                            <b>{say(step.label)}</b>
                            {step.rationale ? <span className="agent-ai__next-why"> · {say(step.rationale)}</span> : null}
                        </span>
                        {urgency ? (
                            <span className={`dr-pill dr-pill-${URGENCY_TONE[urgency]}`}>{t(`pages.agent_workspace.contact.ai.urgency_${urgency}`)}</span>
                        ) : null}
                        {actionable ? (
                            <Button size="sm" variant="navy" onClick={act}>
                                <Play size={12} aria-hidden="true" />
                                {nextStepButtonLabel(step, t)}
                            </Button>
                        ) : null}
                    </div>
                ) : null}
            </section>
        </SummaryPersonalizationProvider>
    );
}
