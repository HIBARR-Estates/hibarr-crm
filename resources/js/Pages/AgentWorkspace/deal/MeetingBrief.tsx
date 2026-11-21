import { useMemo } from "react";
import { Play } from "lucide-react";
import { AgentDialog, AgentDialogSection } from "@/Components/Redesign/agent";
import { paymentUiStateLabel } from "@/Components/Redesign/adapters/dealPaymentUiState";
import Button from "@/Components/Redesign/primitives/Button";
import Icon from "@/Components/Redesign/primitives/Icon";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { downloadDealExpose, exposeStatusMeta, formatExposeDate } from "@/Pages/Deals/Redesign/adapters/dealExposeAdapter";
import { formatDate } from "@/Pages/Deals/Redesign/adapters/dateFormat";
import { isTerminalPaymentState } from "@/Pages/Deals/Redesign/adapters/mapDealPaymentUiState";
import { toWorkspaceMeetingPreview } from "@/Pages/Deals/Redesign/adapters/meetingAdapter";
import type { TimelineEventViewModel } from "@/Pages/Deals/Redesign/adapters/timelineAdapter";
import type { AnalysisProgress } from "@/Pages/Deals/Redesign/components/analysis/analysisProgress";
import useDealExposes from "@/Pages/Deals/Redesign/hooks/useDealExposes";
import useDealPayment from "@/Pages/Deals/Redesign/hooks/useDealPayment";
import type { DealDocumentItem } from "@/Pages/Deals/Redesign/hooks/useDealDocuments";
import { formatMoneyAmount } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Note } from "@/Types/api/note";
import { humanize } from "./StageConditionsPanel";
import type { NextStageConditions } from "./stageConditions";
import useMeetingTalkingPoints, { type MeetingBriefContext } from "./useMeetingTalkingPoints";

interface MeetingBriefProps {
    meeting: DealFollowup | null;
    deal: Deal;
    stage: NextStageConditions;
    /** Left out when the analysis is off for this company. */
    analysis?: { progress: AnalysisProgress; onOpen: () => void };
    events: TimelineEventViewModel[];
    notes: Note[];
    documents: DealDocumentItem[];
    /** The exposés list is behind its flag and view_lead_proposals. */
    showExposes: boolean;
    showPayments: boolean;
    /** AI talking points ride on the AI summary flag (sales.ai-entity-summary). */
    showTalkingPoints: boolean;
    onOpenFiles: () => void;
    onClose: () => void;
}

const plain = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/\s+/g, " ")
        .trim();

/**
 * A brief for one meeting on the deal (canvas L8-08), built from what the deal
 * holds, not a copy of its summary: what the meeting must achieve (the next
 * stage's open conditions), what to ask (open analysis questions), what changed
 * since the last meeting, what the notes warn about, and what to have ready.
 * The talking points are the one written part: AI lines built from the deal,
 * the lead and this meeting, stored per meeting and rewritten when either changes.
 */
export default function MeetingBrief(props: MeetingBriefProps) {
    return props.meeting ? <Brief {...props} meeting={props.meeting} /> : null;
}

function Brief({ meeting, deal, stage, analysis, events, notes, documents, showExposes, showPayments, showTalkingPoints, onOpenFiles, onClose }: MeetingBriefProps & { meeting: DealFollowup }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const preview = toWorkspaceMeetingPreview(meeting);
    const { paymentRequests } = useDealPayment(deal.id);

    const name = deal.contact?.client_name || deal.name;
    const typeName = td(preview.title, { source: "en" });
    const duration = meeting.duration ? t("pages.agent_workspace.deal.brief.minutes", { count: meeting.duration }) : "";
    const left = stage.conditions.filter((entry) => !entry.met);

    const openQuestions = useMemo(() => {
        if (!analysis) return [];
        return analysis.progress.steps
            .filter((step) => step.kind !== "instruction" && !analysis.progress.filledSteps.has(step.key))
            .map((step) => {
                const section = analysis.progress.sections.find((item) => item.id === step.sectionId);
                const label = step.item?.scriptItem.label_override?.trim() || step.field?.label || humanize(step.item?.scriptItem.item_key ?? step.key);
                return { key: step.key, label: plain(String(label)), section: section?.title ?? "" };
            })
            .slice(0, 5);
    }, [analysis]);

    // Everything since the last meeting that already happened, or the latest few.
    const since = useMemo(() => {
        const start = preview.startsAt?.getTime() ?? Date.now();
        return events.filter((event) => Date.parse(event.occurredAt) < start).slice(0, 4);
    }, [events, preview.startsAt]);

    const watch = notes.slice(0, 2);
    const awaiting = showPayments ? paymentRequests.filter((request) => !isTerminalPaymentState(request.ui_state)) : [];
    const files = documents.filter((doc) => doc.uploaded).slice(0, 2);

    const when = [formatDate(preview.startsAt), preview.timeLabel].filter(Boolean).join(" · ");
    const pill = preview.isLive
        ? { tone: "green", text: t("pages.agent_workspace.deal.brief.now") }
        : preview.isUpcoming
          ? { tone: "amber", text: when }
          : { tone: "gray", text: when };

    return (
        <AgentDialog
            open
            onClose={onClose}
            width={1000}
            closeLabel={t("pages.agent_workspace.deal.itinerary.close")}
            icon={<Icon name="briefcase" size={18} />}
            eyebrow={t("pages.agent_workspace.deal.brief.title")}
            title={`${typeName} · ${name}`}
            headerAside={<span className={`dr-pill dr-pill-${pill.tone}`}>{pill.text}</span>}
            strip={[
                { label: t("pages.agent_workspace.deal.brief.type"), value: [typeName, duration].filter(Boolean).join(" · ") },
                { label: t("pages.agent_workspace.deal.brief.where"), value: preview.location || "—" },
                { label: t("pages.agent_workspace.deal.brief.with"), value: preview.attendeesLabel || name },
                { label: t("pages.agent_workspace.deal.brief.deal"), value: deal.lead_stage?.name ? td(deal.lead_stage.name, { source: "en" }) : "—" },
            ]}
            footer={
                <>
                    <span className="agent-dlg__note">{t("pages.agent_workspace.deal.brief.built_from")}</span>
                    <span className="agent-dlg__spacer" />
                    {analysis ? (
                        <Button
                            size="sm"
                            onClick={() => {
                                onClose();
                                analysis.onOpen();
                            }}
                        >
                            <Play size={12} aria-hidden="true" />
                            {t("pages.agent_workspace.deal.brief.open_analysis")}
                        </Button>
                    ) : null}
                    {meeting.meeting_link ? (
                        <Button size="sm" variant="call" onClick={() => window.open(meeting.meeting_link, "_blank", "noopener,noreferrer")}>
                            {t("pages.agent_workspace.deal.brief.join")}
                        </Button>
                    ) : null}
                </>
            }
        >
            <div className="agent-brief2">
                <div className="agent-brief2__col">
                    <AgentDialogSection title={t("pages.agent_workspace.deal.brief.goal")}>
                        <div className="agent-brief2__goal">
                            {stage.next ? (
                                <>
                                    <b>{t("pages.agent_workspace.deal.brief.goal_move", { stage: td(stage.next.name, { source: "en" }) })}</b>{" "}
                                    {stage.conditions.length > 0
                                        ? t(left.length === 1 ? "pages.agent_workspace.deal.brief.goal_left_one" : "pages.agent_workspace.deal.brief.goal_left_other", {
                                              count: left.length,
                                              total: stage.conditions.length,
                                          })
                                        : t("pages.agent_workspace.deal.brief.goal_none")}
                                    {left.length > 0 ? (
                                        <ul className="agent-brief2__conds">
                                            {left.map(({ condition }, index) => (
                                                <li key={`${condition.field}-${index}`}>{td(condition.label?.trim() || humanize(condition.field), { source: "en" })}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </>
                            ) : (
                                <b>{t("pages.agent_workspace.deal.brief.goal_last")}</b>
                            )}
                        </div>
                    </AgentDialogSection>

                    {analysis ? (
                        <AgentDialogSection
                            title={t("pages.agent_workspace.deal.brief.ask")}
                            tag={
                                openQuestions.length > 0 ? (
                                    <span className="dr-pill dr-pill-amber">
                                        {t("pages.agent_workspace.deal.brief.open_questions", {
                                            count: analysis.progress.totalFields - analysis.progress.totalFilled,
                                        })}
                                    </span>
                                ) : null
                            }
                        >
                            {openQuestions.length === 0 ? (
                                <p className="agent-trip__empty">{t("pages.agent_workspace.deal.brief.ask_none")}</p>
                            ) : (
                                <ul className="agent-brief2__list">
                                    {openQuestions.map((question) => (
                                        <li key={question.key} className="agent-brief2__ask">
                                            <span className="agent-brief2__box" aria-hidden="true" />
                                            <span className="agent-brief2__ask-text">{td(question.label, { source: "en" })}</span>
                                            {question.section ? <span className="agent-brief2__sub">{td(question.section, { source: "en" })}</span> : null}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </AgentDialogSection>
                    ) : null}

                    <AgentDialogSection title={t("pages.agent_workspace.deal.brief.since")}>
                        {since.length === 0 ? (
                            <p className="agent-trip__empty">{t("pages.agent_workspace.deal.brief.since_none")}</p>
                        ) : (
                            <ul className="agent-brief2__list">
                                {since.map((event) => (
                                    <li key={event.id} className="agent-brief2__since">
                                        <span className="agent-trip__day">{formatDate(event.occurredAt)}</span>
                                        <span>
                                            {event.titleLocalized ? event.title : td(event.title, { source: "en" })}
                                            {event.preview || event.grouped ? <span className="agent-brief2__sub"> · {event.preview || event.grouped}</span> : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </AgentDialogSection>
                </div>

                <div className="agent-brief2__col">
                    <AgentDialogSection title={t("pages.agent_workspace.deal.brief.watch")} tag={<span className="agent-brief2__sub">{t("pages.agent_workspace.deal.brief.from_notes")}</span>}>
                        {watch.length === 0 ? (
                            <p className="agent-trip__empty">{t("pages.agent_workspace.deal.brief.watch_none")}</p>
                        ) : (
                            watch.map((note) => (
                                <div key={note.id} className="agent-brief2__watch">
                                    <Icon name="target" size={14} />
                                    <span>
                                        {note.title ? <b>{note.title}. </b> : null}
                                        {plain(note.details).slice(0, 180)}
                                    </span>
                                </div>
                            ))
                        )}
                    </AgentDialogSection>

                    <AgentDialogSection title={t("pages.agent_workspace.deal.brief.ready")}>
                        {!showExposes && awaiting.length + files.length === 0 ? (
                            <p className="agent-trip__empty">{t("pages.agent_workspace.deal.brief.ready_none")}</p>
                        ) : (
                            <ul className="agent-brief2__list">
                                {showExposes ? (
                                    <ExposesReady
                                        dealId={deal.id}
                                        emptyText={awaiting.length + files.length === 0 ? t("pages.agent_workspace.deal.brief.ready_none") : null}
                                    />
                                ) : null}
                                {awaiting.map((request) => (
                                    <li key={`payment-${request.id}`} className="agent-brief2__ready">
                                        <Icon name="wallet" size={15} />
                                        <span className="agent-brief2__ready-text">
                                            <span className="agent-brief2__ready-title">
                                                {formatMoneyAmount(request.amount, { code: request.currency ?? "", symbol: request.currency_symbol || request.currency || "" })}
                                            </span>
                                            <span className="agent-brief2__sub">{td(paymentUiStateLabel(request.ui_state), { source: "en" })}</span>
                                        </span>
                                    </li>
                                ))}
                                {files.map((doc) => (
                                    <li key={`file-${doc.id}`} className="agent-brief2__ready">
                                        <Icon name="file-text" size={15} />
                                        <span className="agent-brief2__ready-text">
                                            <span className="agent-brief2__ready-title">{doc.source === "attachment" ? doc.label : td(doc.label, { source: "en" })}</span>
                                        </span>
                                        <Button
                                            size="sm"
                                            onClick={() => {
                                                onClose();
                                                onOpenFiles();
                                            }}
                                        >
                                            {t("pages.agent_workspace.deal.brief.open")}
                                        </Button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </AgentDialogSection>

                    {showTalkingPoints ? (
                        <TalkingPoints
                            dealId={deal.id}
                            meetingId={meeting.id}
                            context={{
                                next_stage: stage.next?.name ?? null,
                                open_conditions: left.map(({ condition }) => condition.label?.trim() || humanize(condition.field)),
                                open_questions: openQuestions.map((question) => question.label),
                            }}
                        />
                    ) : null}
                </div>
            </div>
        </AgentDialog>
    );
}

/** The deal's exposés as rows of Have ready; only mounted when the viewer may see them. */
function ExposesReady({ dealId, emptyText }: { dealId: number; emptyText: string | null }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { exposes, loading } = useDealExposes({ type: "deal", dealId });
    if (exposes.length === 0 && emptyText && !loading) {
        return (
            <li>
                <p className="agent-trip__empty">{emptyText}</p>
            </li>
        );
    }
    return (
        <>
            {exposes.slice(0, 3).map((expose) => (
                <li key={`expose-${expose.id}`} className="agent-brief2__ready">
                    <Icon name="building" size={15} />
                    <span className="agent-brief2__ready-text">
                        <span className="agent-brief2__ready-title">{expose.title}</span>
                        <span className="agent-brief2__sub">
                            {[td(exposeStatusMeta(expose.status).label, { source: "en" }), formatExposeDate(expose)].filter(Boolean).join(" · ")}
                        </span>
                    </span>
                    <Button size="sm" onClick={() => downloadDealExpose(expose)} disabled={!expose.download_url}>
                        {t("pages.agent_workspace.deal.brief.open")}
                    </Button>
                </li>
            ))}
        </>
    );
}

/** The brief's AI talking points (canvas L8-08): a short list, written in the background. */
function TalkingPoints({ dealId, meetingId, context }: { dealId: number; meetingId: number; context: MeetingBriefContext }) {
    const { t } = useTranslation();
    const { td } = useTd();
    const { talkingPoints, loading, error, regenerate } = useMeetingTalkingPoints(dealId, meetingId, context, true);
    const points = talkingPoints?.points ?? [];

    return (
        <AgentDialogSection
            title={t("pages.agent_workspace.deal.brief.talking")}
            tag={
                <>
                    <span className="agent-brief2__ai">{td("AI", { source: "en" })}</span>
                    {points.length > 0 || error ? (
                        <Button
                            size="sm"
                            variant="ghost"
                            className="agent-brief2__refresh"
                            onClick={regenerate}
                            disabled={loading}
                            aria-label={t("pages.agent_workspace.deal.brief.talking_refresh")}
                            title={t("pages.agent_workspace.deal.brief.talking_refresh")}
                        >
                            <Icon name="refresh" size={13} />
                        </Button>
                    ) : null}
                </>
            }
        >
            <div aria-live="polite" aria-busy={loading || undefined}>
                {points.length > 0 ? (
                    <ul className={`agent-brief2__points${loading ? " is-updating" : ""}`}>
                        {points.map((point, index) => (
                            <li key={`${index}-${point}`}>{td(point, { source: "en" })}</li>
                        ))}
                    </ul>
                ) : loading ? (
                    <div className="agent-brief2__writing">
                        <span className="agent-brief2__skel" />
                        <span className="agent-brief2__skel agent-brief2__skel--short" />
                        <span className="agent-brief2__sub">{t("pages.agent_workspace.deal.brief.talking_writing")}</span>
                    </div>
                ) : error ? (
                    <p className="agent-trip__empty">{t("pages.agent_workspace.deal.brief.talking_error")}</p>
                ) : null}
                {points.length > 0 && error && !loading ? <p className="agent-brief2__sub">{t("pages.agent_workspace.deal.brief.talking_kept")}</p> : null}
            </div>
        </AgentDialogSection>
    );
}
