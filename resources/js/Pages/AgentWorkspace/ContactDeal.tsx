import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Head, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import { AgentLinkPills, AgentSecondRow, AgentWorkspaceLayout, useMinuteClock } from "@/Components/Redesign/agent";
import CommunicationModal from "@/Email/CommunicationModal";
import { subscribeOpenSourceEmail } from "@/Email/openSourceEmail";
import type { EmailFollowUpKind, EmailQuickAction } from "@/Email/types";
import { DEAL_EXPOSES_FLAG } from "@/Hooks/useDealExposesFlag";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { resolveDealOutcome } from "@/lib/dealOutcome";
import { setDealDateLocale } from "@/Pages/Deals/Redesign/adapters/dateFormat";
import { highlightDealField } from "@/Pages/Deals/Redesign/adapters/highlightDealField";
import AnalysisStatusBanner from "@/Pages/Deals/Redesign/components/analysis/AnalysisStatusBanner";
import DealAnalysisModal from "@/Pages/Deals/Redesign/components/analysis/DealAnalysisModal";
import DealPipelineStepper from "@/Pages/Deals/Redesign/components/header/DealPipelineStepper";
import DealStickyHeader from "@/Pages/Deals/Redesign/components/header/DealStickyHeader";
import DealAddNoteModal from "@/Pages/Deals/Redesign/components/workspace/DealAddNoteModal";
import DealAddTaskModal from "@/Pages/Deals/Redesign/components/workspace/DealAddTaskModal";
import DealMeetingDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealMeetingDetailModal";
import DealNoteDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealNoteDetailModal";
import DealScheduleMeetingModal from "@/Pages/Deals/Redesign/components/workspace/DealScheduleMeetingModal";
import DealTaskDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealTaskDetailModal";
import DealWorkspaceTabs from "@/Pages/Deals/Redesign/components/workspace/DealWorkspaceTabs";
import WorkspaceContextRail from "@/Pages/Deals/Redesign/components/workspace/rail/WorkspaceContextRail";
import { DealWorkspaceProvider, useDealWorkspace } from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import useDealAnalysis from "@/Pages/Deals/Redesign/hooks/useDealAnalysis";
import useDealViewNavigation from "@/Pages/Deals/Redesign/hooks/useDealViewNavigation";
import useDealWorkspaceModel from "@/Pages/Deals/Redesign/hooks/useDealWorkspaceModel";
import type { DealShowProps } from "@/Pages/Deals/Redesign/types";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import ActivityCards, { type ActivityPermissions, type ActivitySource } from "./contact/ActivityCards";
import ContactHeader from "./contact/ContactHeader";
import KeyFacts from "./contact/KeyFacts";
import { buildKeyFacts } from "./contact/model";
import "@/Components/Redesign/redesign.css";
import "@/Components/CallRecordingPlayer.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "@/Pages/Leads/Redesign/lead-redesign.css";
import "./contact/contact.css";

/** One of the person's deals, for the second row (ContactDeals::forLead). */
export interface ContactDealSummary {
    id: number;
    name: string | null;
    stage: string | null;
    stage_color: string | null;
    pipeline: string | null;
    outcome: "won" | "lost" | null;
}

type ContactDealProps = DealShowProps & {
    contactDeals?: ContactDealSummary[];
    showOnlinePayment?: boolean;
    sallyInsightsEnabled?: boolean;
};

/** add_* scopes that let the viewer create (the deal header's own checks). */
const canAdd = (scope: string | undefined, scopes: string[]) => scope !== undefined && scopes.includes(scope);

/**
 * The agent workspace's page for one person in a deal's state (canvas L7-10
 * and L7-11): the person on top, then the deal (its header, stage path, AI
 * summary), key facts, what's coming up on this deal, the last touches and
 * notes, and the deal's own tabs below. The second row lists the person's
 * deals; each is its own URL.
 *
 * It runs on the deal page's props (DealController::agentShow), context,
 * hooks and tabs, so every edit patches local state and nothing reloads.
 */
export default function ContactDeal(props: ContactDealProps) {
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showOnlinePayment = featureFlags?.["packages.online-payment"] === true;
    const sallyInsightsEnabled = featureFlags?.["crm.sally-insights-tab"] === true;

    return (
        // Keyed by deal: switching deals in the second row starts clean
        // rather than carrying the previous deal's local lists.
        <DealWorkspaceProvider
            key={props.deal.id}
            deal={props.deal}
            paymentEnabled={showOnlinePayment}
            sallyInsightsEnabled={sallyInsightsEnabled}
        >
            <ContactDealInner {...props} showOnlinePayment={showOnlinePayment} sallyInsightsEnabled={sallyInsightsEnabled} />
        </DealWorkspaceProvider>
    );
}

function ContactDealInner(props: ContactDealProps) {
    const { t, locale } = useTranslation();
    const { td } = useTd();
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;
    const showAnalysis = featureFlags?.["crm.deal-analysis"] === true;
    const showExposes = featureFlags?.[DEAL_EXPOSES_FLAG] === true;
    const showCompletionDot = featureFlags?.["crm.deal-info-count-indicator"] === true;
    const { timezone } = useUserDateTime();
    const nowMs = useMinuteClock();
    const companyCurrency = useCompanyCurrency();
    // Adapters are plain functions with no hook access; publish the locale.
    setDealDateLocale(locale);

    const { deal, notes, notesLoading, tasks, tasksLoading, dealFollowUps, dealFollowUpsLoading, files } = useDealWorkspace();
    const model = useDealWorkspaceModel(props);
    const { permissions, dealPermissions, meetingTypes, employees, taskBoardColumns } = model;
    const nav = useDealViewNavigation();
    const analysis = useDealAnalysis();
    const tabsRef = useRef<HTMLDivElement>(null);

    // Email: the same fail-closed gate as the deal page.
    const emailQuickAction: EmailQuickAction | null =
        featureFlags?.["crm.email"] === true && props.emailQuickAction != null ? props.emailQuickAction : null;
    const [communication, setCommunication] = useState<{ open: boolean; messageId: string | null }>({ open: false, messageId: null });
    const openCommunication = (messageId: string | null = null) => setCommunication({ open: true, messageId });
    const closeCommunication = () => setCommunication({ open: false, messageId: null });

    const [createKind, setCreateKind] = useState<LeadCreateKind | null>(null);
    const [sourceEmailMessageId, setSourceEmailMessageId] = useState<string | null>(null);
    const closeCreate = () => {
        setCreateKind(null);
        setSourceEmailMessageId(null);
    };
    const openCreateFromEmail = (kind: EmailFollowUpKind, messageId: string) => {
        closeCommunication();
        setSourceEmailMessageId(messageId);
        setCreateKind(kind);
    };
    useEffect(() => subscribeOpenSourceEmail((messageId) => openCommunication(messageId)), []);

    const [openTaskId, setOpenTaskId] = useState<number | null>(null);
    const [openMeetingId, setOpenMeetingId] = useState<number | null>(null);
    const [openNoteId, setOpenNoteId] = useState<number | null>(null);

    // The deal header's own create checks; watchers never write.
    const writer = !dealPermissions.isWatcherOnly;
    const activityPermissions: ActivityPermissions = {
        viewNotes: permissions.view_deal_note !== "none",
        viewTasks: permissions.view_tasks !== "none",
        viewMeetings: permissions.view_lead_follow_up !== "none",
        create: {
            task: writer && canAdd(permissions.add_tasks, ["all", "added", "both"]),
            meeting: writer && canAdd(permissions.add_lead_follow_up, ["all", "added"]),
            note: writer && canAdd(permissions.add_deal_note, ["all", "added", "both"]),
            // A deal has no "log activity" form; the lead page's is lead-only.
            log: false,
        },
    };
    const activitySource: ActivitySource = {
        tasks,
        tasksLoading,
        meetings: dealFollowUps,
        meetingsLoading: dealFollowUpsLoading,
        notes,
        notesLoading,
        timelineId: deal.id,
    };

    const contact = deal.contact;
    const keyFacts = useMemo(
        () =>
            contact
                ? buildKeyFacts(
                      contact,
                      {
                          preferredTime: (time) => t("pages.agent_workspace.contact.best_time", { time }),
                          addedBy: (name) => t("pages.agent_workspace.contact.facts.added_by", { name }),
                          score: (score) => t("pages.agent_workspace.contact.facts.score", { score }),
                          webinarAttended: t("pages.agent_workspace.contact.facts.webinar_attended"),
                          webinarRegistered: t("pages.agent_workspace.contact.facts.webinar_registered"),
                          lastWebinar: (date) => t("pages.agent_workspace.contact.facts.last_webinar", { date }),
                          ebook: t("pages.agent_workspace.contact.facts.ebook"),
                      },
                      companyCurrency,
                  ).filter((group) => group.id !== "value") // the deal header carries the deal's value
                : [],
        [companyCurrency, contact, t],
    );

    // Deal info holds the deal's and the person's fields; Edit details opens it.
    const openDealInfo = () => {
        nav.goToDealInfo("general");
        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    const outcome = resolveDealOutcome(deal);
    const pillLabel = (summary: ContactDealSummary) => {
        const state =
            summary.outcome === "won"
                ? t("pages.deals.header.won")
                : summary.outcome === "lost"
                  ? t("pages.deals.header.lost")
                  : summary.stage
                    ? td(summary.stage, { source: "en" })
                    : summary.name || "";
        return t("pages.agent_workspace.contact.deal_pill", { stage: state });
    };
    const contactDeals = props.contactDeals ?? [];
    const leadId = deal.lead_id ?? contact?.id;
    const pills = contactDeals.map((summary) => ({
        key: String(summary.id),
        label: pillLabel(summary),
        title: summary.name ?? undefined,
        dot: summary.stage_color,
        href: route("agent.people.deal", { lead: leadId, deal: summary.id }),
        current: summary.id === deal.id,
    }));
    // Two deals in the same stage read the same; add their names.
    const labelCounts = new Map<string, number>();
    pills.forEach((pill) => labelCounts.set(pill.label, (labelCounts.get(pill.label) ?? 0) + 1));
    pills.forEach((pill, index) => {
        if ((labelCounts.get(pill.label) ?? 0) > 1 && contactDeals[index].name) {
            pill.label = `${pill.label} · ${contactDeals[index].name}`;
        }
    });

    const name = contact?.client_name || deal.name || td("Deal", { source: "en" });
    const comingUpTitle = t("pages.agent_workspace.contact.coming_up.deal_title");

    return (
        <>
            <Head title={name} />
            <AgentSecondRow>
                <AgentLinkPills pills={pills} ariaLabel={t("pages.agent_workspace.contact.deals_aria")} />
            </AgentSecondRow>

            <div
                className={`lead-redesign deal-redesign dr-mobile-responsive agent-contact agent-contact--deal${
                    showAnalysis ? "" : " agent-contact--no-goal"
                }`}
            >
                <div className="agent-contact__main">
                    {contact ? (
                        <div className="agent-contact__head-card">
                            <ContactHeader
                                lead={contact}
                                canEdit={dealPermissions.canEdit}
                                canDelete={false}
                                canFindDuplicates={false}
                                onCreate={setCreateKind}
                                allowedCreate={activityPermissions.create}
                                onEdit={openDealInfo}
                                callEntity={{ type: "deal", id: deal.id }}
                                staticAvatar
                            />
                        </div>
                    ) : null}

                    <div className="agent-contact__body-card">
                        <div className="agent-contact__section agent-contact__deal">
                            <DealStickyHeader
                                embedded
                                deal={deal}
                                permissions={permissions}
                                employees={employees}
                                isRefreshing={false}
                                onRefresh={() => {}}
                                onAddNote={() => setCreateKind("note")}
                                onAddTask={() => setCreateKind("task")}
                                onScheduleMeeting={() => setCreateKind("meeting")}
                                onOpenAnalysis={showAnalysis ? analysis.open : undefined}
                                isMobileResponsive
                                emailQuickAction={emailQuickAction}
                                onEmail={() => openCommunication(null)}
                            />
                        </div>
                        {showAiSummary ? (
                            <div className="agent-contact__section agent-contact__summary">
                                <EntityAiSummaryCard
                                    entityType="deal"
                                    entityId={deal.id}
                                    initialSummary={props.dealAiSummary}
                                    variant="redesign"
                                    onCreateTask={() => setCreateKind("task")}
                                    onScheduleCall={() => setCreateKind("meeting")}
                                    onRequestDocuments={() => {
                                        nav.setTab("files");
                                        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    onReviewStaleDeal={() => {
                                        nav.setTab("timeline");
                                        tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }}
                                    onAdvanceStage={model.advanceToNextStage}
                                />
                            </div>
                        ) : null}
                        <div className="agent-contact__section agent-contact__stages">
                            <p className="agent-contact__label">
                                {[
                                    t("pages.agent_workspace.contact.deal_stage"),
                                    deal.pipeline?.name ? td(deal.pipeline.name, { source: "en" }) : "",
                                    deal.name ?? "",
                                ]
                                    .filter(Boolean)
                                    .join(" · ")}
                            </p>
                            {outcome ? (
                                <p className="agent-contact__note">
                                    {outcome === "won" ? t("pages.deals.header.won") : t("pages.deals.header.lost")}
                                </p>
                            ) : null}
                            <DealPipelineStepper
                                deal={deal}
                                permissions={permissions}
                                onGoToField={({ section, fieldKey }) => {
                                    nav.goToDealInfo(section);
                                    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                                    highlightDealField(fieldKey);
                                }}
                            />
                        </div>
                        {keyFacts.length > 0 ? <KeyFacts groups={keyFacts} /> : null}
                    </div>

                    <div className="agent-contact__activity">
                        <ActivityCards
                            source={activitySource}
                            comingUpTitle={comingUpTitle}
                            nowMs={nowMs}
                            timeZone={timezone}
                            permissions={activityPermissions}
                            onCreate={setCreateKind}
                            onOpenTask={setOpenTaskId}
                            onOpenMeeting={setOpenMeetingId}
                            onOpenNote={setOpenNoteId}
                        />
                    </div>

                    <div ref={tabsRef} className="agent-contact__tabs">
                        <DealWorkspaceTabs
                            props={props}
                            model={model}
                            nav={nav}
                            showExposes={showExposes}
                            showCompletionDot={showCompletionDot}
                            emailEnabled={emailQuickAction != null}
                            onOpenEmailMessage={(messageId: string) => openCommunication(messageId)}
                            onAddTask={() => setCreateKind("task")}
                            onAddMeeting={() => setCreateKind("meeting")}
                            onAddNote={() => setCreateKind("note")}
                            className="agent-card agent-contact__tabs-card"
                        />
                    </div>
                </div>

                <aside className="agent-contact__goal agent-contact__rail">
                    {showAnalysis ? (
                        <AnalysisStatusBanner
                            analysis={analysis}
                            totalFilled={model.analysisProgress.totalFilled}
                            totalFields={model.analysisProgress.totalFields}
                            isMobileResponsive
                        />
                    ) : null}
                    <div className="dr-dossier agent-contact__dossier">
                        <WorkspaceContextRail
                            deal={deal}
                            files={files}
                            fields={model.fields}
                            categoryIds={model.pipelineCategoryIds}
                            visibilityMap={model.dealFileVisibilityMap}
                            restrictPackageOrProperty={props.restrictPackageOrProperty}
                            onNavigateToSubTab={(tab) => {
                                nav.setTab(tab);
                                tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                            onSwitchToDealInfo={openDealInfo}
                            showOnlinePayment={props.showOnlinePayment}
                            canCreatePaymentRequest={model.canCreatePaymentRequest}
                            canConfirmPaymentTransfer={model.canConfirmPaymentTransfer}
                        />
                    </div>
                </aside>
            </div>

            {/* Mounted only while open, as on the deal page: its hooks build
                the whole analysis model. */}
            {showAnalysis && analysis.isOpen ? (
                <DealAnalysisModal
                    analysis={analysis}
                    dealInfoCategories={model.dealInfoCategories}
                    fields={model.fields}
                    visibleLeadFieldKeys={props.visibleLeadFieldKeys}
                    analysisScript={props.analysisScript}
                />
            ) : null}
            <DealAddTaskModal
                open={createKind === "task"}
                onClose={closeCreate}
                dealId={deal.id}
                dealName={deal.name}
                dealAgentUserId={
                    deal.lead_agent?.user?.id ?? deal.lead_agent?.user_id ?? deal.agent?.user?.id ?? deal.agent?.user_id ?? null
                }
                sourceEmailMessageId={sourceEmailMessageId}
            />
            <DealScheduleMeetingModal
                open={createKind === "meeting"}
                onClose={closeCreate}
                deal={deal}
                meetingTypes={meetingTypes}
                sourceEmailMessageId={sourceEmailMessageId}
            />
            <DealAddNoteModal open={createKind === "note"} onClose={closeCreate} dealId={deal.id} sourceEmailMessageId={sourceEmailMessageId} />
            <DealTaskDetailModal
                task={tasks.find((task) => task.id === openTaskId) ?? null}
                taskBoardColumns={taskBoardColumns}
                onClose={() => setOpenTaskId(null)}
            />
            <DealMeetingDetailModal
                meeting={dealFollowUps.find((meeting) => meeting.id === openMeetingId) ?? null}
                deal={deal}
                meetingTypes={meetingTypes}
                canEdit={writer && permissions.edit_lead_follow_up !== "none"}
                canDelete={writer && permissions.delete_lead_follow_up !== "none"}
                onClose={() => setOpenMeetingId(null)}
            />
            <DealNoteDetailModal
                note={notes.find((note) => note.id === openNoteId) ?? null}
                permissions={permissions}
                onClose={() => setOpenNoteId(null)}
            />
            <CommunicationModal
                open={communication.open && emailQuickAction != null}
                onClose={closeCommunication}
                record={{ type: "deal", id: deal.id }}
                recordLabel={deal.name}
                messageId={communication.messageId}
                hasConnection={emailQuickAction?.has_connection === true}
                prefillTo={contact?.client_email ?? null}
                onCreateFollowUp={openCreateFromEmail}
            />
        </>
    );
}

ContactDeal.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
