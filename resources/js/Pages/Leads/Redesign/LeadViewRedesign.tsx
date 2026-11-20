import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import PageLayout from "@/Components/PageLayout";
import ProductTour, { ProductTourHandle } from "@/Components/ProductTour/ProductTour";
import { ConfirmDialog } from "@/Components/Redesign";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { DEAL_EXPOSES_FLAG } from "@/Hooks/useDealExposesFlag";
import useMobileResponsiveLayoutFlag from "@/Hooks/useMobileResponsiveLayoutFlag";
import { useIsDesktopViewport } from "@/Hooks/useMediaQuery";
import {
    OverviewDeferredSkeleton,
    TabDeferredSkeleton,
} from "@/Pages/Deals/Redesign/components/workspace/overview/overviewShared";
import type { LeadRedesignProps } from "./types";
import type { WorkspaceTabId } from "./types";
import type { MoreMenuActionId } from "./config/moreMenuItems";
import {
    buildLeadTourSteps,
    LEAD_TOUR_ID,
    LEAD_TOUR_LABELS,
} from "./config/leadTourSteps";
import { resolveLifecycle } from "./adapters/lifecycleAdapter";
import { canEditLead } from "./adapters/leadEditAccess";
import { getDossierFieldValue } from "./adapters/dossierAdapter";
import {
    formatMoneyAmount,
    resolveCurrencyDisplay,
    useCompanyCurrency,
} from "./adapters/currencyAdapter";
import { toLeadTaskPreview } from "./adapters/taskAdapter";
import { toLeadMeetingPreview } from "./adapters/meetingAdapter";
import useMeetingClockTick from "@/Pages/Deals/Redesign/hooks/useMeetingClockTick";
import { itineraryCount } from "./adapters/itineraryAdapter";
import type { SallyMeetingInsight } from "@/Types/api/sally-meeting-insight";
import {
    LeadWorkspaceProvider,
    useLeadWorkspace,
} from "./context/LeadWorkspaceContext";
import useLeadViewNavigation from "./hooks/useLeadViewNavigation";
import useLeadQualificationWorkspace from "./hooks/useLeadQualificationWorkspace";
import useLeadMissionFlow from "./hooks/useLeadMissionFlow";
import useLeadLifecycleChange from "./hooks/useLeadLifecycleChange";
import useLeadDelete from "./hooks/useLeadDelete";
import useLeadDealCreate from "./hooks/useLeadDealCreate";
import useLeadNoteCreate from "./hooks/useLeadNoteCreate";
import useLeadDocuments from "./hooks/useLeadDocuments";
import useLeadDuplicates from "./hooks/useLeadDuplicates";
import LeadHeaderRoot from "./components/header/LeadHeaderRoot";
import AiSummaryCard from "./components/workspace/AiSummaryCard";
import DuplicateLeadsCard from "./components/workspace/DuplicateLeadsCard";
import QuickStats from "./components/workspace/QuickStats";
import WorkspaceCard from "./components/workspace/WorkspaceCard";
import LeadDossier from "./components/dossier/LeadDossier";
import DossierQuickActions from "./components/dossier/DossierQuickActions";
import { leadCallPhones } from "@/lib/leadCallPhones";
import CommunicationModal from "@/Email/CommunicationModal";
import { subscribeOpenSourceEmail } from "@/Email/openSourceEmail";
import type { EmailFollowUpKind, EmailQuickAction } from "@/Email/types";
import { replaceUrlKeepingHistoryState } from "@/lib/inertiaHistory";
import LeadMeetingDetailModal from "./components/workspace/LeadMeetingDetailModal";
import LeadTaskDetailModal from "./components/workspace/LeadTaskDetailModal";
import LeadCreateModals, { type LeadCreateKind } from "./components/workspace/LeadCreateModals";
import OverviewTab from "./components/workspace/tabs/OverviewTab";
import NotesTab from "./components/workspace/tabs/NotesTab";
import TasksTab from "./components/workspace/tabs/TasksTab";
import MeetingsTab from "./components/workspace/tabs/MeetingsTab";
import DealsTab from "./components/workspace/tabs/DealsTab";
import SallyInsightsPanel from "@/Components/Redesign/sally/SallyInsightsPanel";
import LeadInfoTab from "./components/workspace/tabs/LeadInfoTab";
import ItineraryTab from "./components/workspace/tabs/ItineraryTab";
import CallsTab from "./components/workspace/tabs/CallsTab";
import TimelineTab from "./components/workspace/tabs/TimelineTab";
import FilesTab from "./components/workspace/tabs/FilesTab";
import MarketingTab from "./components/workspace/tabs/MarketingTab";
import ExposesTab from "./components/workspace/tabs/ExposesTab";
import QualificationTab from "./components/workspace/tabs/QualificationTab";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import LeadMissionModals from "./components/qualification/LeadMissionModals";
import {
    answersFromQualification,
    computeWalkSegments,
    hasAnswerContent,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import { REDESIGN_TOKENS as T } from "@/Components/Redesign/tokens";
import "@/Components/Redesign/redesign.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "./lead-redesign.css";

export default function LeadViewRedesign(props: LeadRedesignProps) {
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;

    return (
        <LeadWorkspaceProvider
            lead={props.lead}
            notes={props.notes}
            tasks={props.tasks}
            leadFollowUps={props.leadFollowUps}
            deals={props.deals}
            sallyInsightsEnabled={
                featureFlags?.["crm.sally-insights-tab"] === true
            }
        >
            <LeadViewRedesignInner {...props} />
        </LeadWorkspaceProvider>
    );
}

function LeadViewRedesignInner(props: LeadRedesignProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const isMobileResponsive = useMobileResponsiveLayoutFlag();
    const isDesktopViewport = useIsDesktopViewport();
    /** Pin quick actions above the workspace when the dossier rail stacks (HIB-1404). */
    const quickActionsInMainColumn = isMobileResponsive && !isDesktopViewport;
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;
    // Fail closed: the strip repeats the tabs and dossier, so it stays hidden unless the flag is on.
    const showQuickStats = featureFlags?.["crm.lead-quick-stats"] === true;
    const showQualification =
        featureFlags?.["crm.lead-qualification-tab"] === true;
    const showProductTour = featureFlags?.["crm.leads-product-tour"] === true;
    const sallyInsightsEnabled =
        featureFlags?.["crm.sally-insights-tab"] === true;
    // Fail closed: flag off or missing server gate → no Email Quick action.
    const emailQuickAction: EmailQuickAction | null =
        featureFlags?.["crm.email"] === true && props.emailQuickAction != null
            ? props.emailQuickAction
            : null;
    // An expose is always created on a deal, so the deal view keeps its tab
    // unconditionally. The lead tab is only a rollup of what those deals hold:
    // with nothing attached anywhere it would open on a permanently empty
    // list, so it stays hidden until the lead actually has one
    // (`hasLeadExposes`, resolved in LeadContactController@show).
    // Calls tab: every call on the lead and its deals (softphone feature).
    const showCalls = featureFlags?.["crm.softphone"] === true;
    const callSummary = props.callSummary;

    const showExposes =
        featureFlags?.[DEAL_EXPOSES_FLAG] === true &&
        (page.props.auth?.permissions?.view_lead_proposals ?? "none") !==
            "none" &&
        (props.hasLeadExposes ?? page.props.hasLeadExposes) === true;

    const {
        lead,
        setLead,
        deals,
        notesLoading,
        tasksLoading,
        leadFollowUpsLoading,
        leadFollowUps,
        tasks,
        notes,
        files,
        filesLoading,
        sallyInsights,
        setSallyInsights,
        sallyInsightsLoading,
        sallyInsightsSettled,
        sallyInsightsError,
        refetchSallyInsights,
    } = useLeadWorkspace();
    const callPhones = leadCallPhones(lead);
    // Unlike the other gated tabs, Sally visibility depends on an async client
    // fetch, so it must stay in play until the query settles — otherwise a
    // ?tab=sally deep link is reset to overview before the data arrives.
    const showSally =
        sallyInsightsEnabled &&
        (sallyInsights.length > 0 ||
            !sallyInsightsSettled ||
            sallyInsightsError);

    // Sally edits patch the local list in place — no Inertia reload. Each
    // card owns its own mutations (the routes are keyed by insight id).
    const patchSallyInsight = useCallback(
        (insightId: number, data: Partial<SallyMeetingInsight>) => {
            setSallyInsights((prev) =>
                prev.map((insight) =>
                    insight.id === insightId ? { ...insight, ...data } : insight,
                ),
            );
        },
        [setSallyInsights],
    );

    const overviewPending =
        (notesLoading && notes.length === 0) ||
        (tasksLoading && tasks.length === 0) ||
        (leadFollowUpsLoading && leadFollowUps.length === 0);

    const nav = useLeadViewNavigation(props.customFieldCategories);
    const tourRef = useRef<ProductTourHandle>(null);

    useEffect(() => {
        if (!showQualification && nav.tab === "qualification") {
            nav.setTab("overview");
        }
        if (!showExposes && nav.tab === "exposes") {
            nav.setTab("overview");
        }
        if (!showSally && nav.tab === "sally") {
            nav.setTab("overview");
        }
        if (!showCalls && nav.tab === "calls") {
            nav.setTab("overview");
        }
    }, [nav.setTab, nav.tab, showQualification, showExposes, showSally, showCalls]);

    const leadTourSteps = useMemo(
        () => buildLeadTourSteps(nav.setTab),
        [nav.setTab],
    );

    const lifecycle = useMemo(
        () => resolveLifecycle(lead, props.leadLifecycleStatuses),
        [lead, props.leadLifecycleStatuses],
    );

    const lifecycleStatuses = useMemo(
        () =>
            (props.leadLifecycleStatuses ?? []).map((status) => ({
                id: status.id,
                key: status.key,
                label: status.label,
                label_color: status.label_color ?? null,
            })),
        [props.leadLifecycleStatuses],
    );

    const { changeStatus, saving: statusSaving } =
        useLeadLifecycleChange(lifecycleStatuses);
    const deleteLead = useLeadDelete(lead);
    const dealCreate = useLeadDealCreate(lead);
    const { createNote } = useLeadNoteCreate(lead.id);
    /** Turn a Sally insight's summary + bullet points into a CRM note on the lead. */
    const addInsightToNote = useCallback(
        (content: string) => {
            createNote({
                text: content,
                title: td("Sally insight", { source: "en" }),
            });
        },
        [createNote, td],
    );
    const duplicates = useLeadDuplicates(lead.id);

    const qualification = useLeadQualificationWorkspace(lead, {
        enabled: showQualification,
        seed: props.leadQualification ?? null,
    });

    // undefined until the tab is opened, so the pill stays hidden rather than
    // reading 0 for a lead whose exposes have never been loaded.
    const [exposesCount, setExposesCount] = useState<number | undefined>(
        undefined,
    );
    const [createKind, setCreateKind] = useState<LeadCreateKind | null>(null);
    const [sourceEmailMessageId, setSourceEmailMessageId] = useState<
        string | null
    >(null);
    const closeCreate = useCallback(() => {
        setCreateKind(null);
        setSourceEmailMessageId(null);
    }, []);
    const hasMailboxConnection = emailQuickAction?.has_connection === true;
    const emailQuickActionForUi: EmailQuickAction | null =
        emailQuickAction == null
            ? null
            : { ...emailQuickAction, has_connection: hasMailboxConnection };
    const [communicationOpen, setCommunicationOpen] = useState(() => {
        if (typeof window === "undefined") return false;
        return Boolean(
            new URLSearchParams(window.location.search).get("email_message"),
        );
    });
    const [emailFocusMessageId, setEmailFocusMessageId] = useState<
        string | null
    >(() => {
        if (typeof window === "undefined") return null;
        return new URLSearchParams(window.location.search).get(
            "email_message",
        );
    });
    const openCommunication = (messageId: string | null = null) => {
        setEmailFocusMessageId(messageId);
        setCommunicationOpen(true);
    };
    const closeCommunication = () => {
        setCommunicationOpen(false);
        setEmailFocusMessageId(null);
    };

    useEffect(() => {
        if (typeof window === "undefined") return;
        const url = new URL(window.location.href);
        if (communicationOpen && emailFocusMessageId) {
            url.searchParams.set("email_message", emailFocusMessageId);
        } else {
            url.searchParams.delete("email_message");
        }
        replaceUrlKeepingHistoryState(url);
    }, [communicationOpen, emailFocusMessageId]);
    useEffect(
        () =>
            subscribeOpenSourceEmail((messageId) => {
                openCommunication(messageId);
            }),
        [],
    );
    const openCreateFromEmail = (kind: EmailFollowUpKind, messageId: string) => {
        closeCommunication();
        setSourceEmailMessageId(messageId);
        setCreateKind(kind === "task" || kind === "note" ? kind : "meeting");
    };
    const [detailMeeting, setDetailMeeting] = useState<DealFollowup | null>(
        null,
    );
    const [detailTask, setDetailTask] = useState<Task | null>(null);

    const companyCurrency = useCompanyCurrency();

    const firstName = useMemo(() => {
        const parts = (lead.client_name ?? "").trim().split(/\s+/);
        return parts[0] || lead.client_name || "Lead";
    }, [lead.client_name]);

    const valueLabel = useMemo(() => {
        const value = getDossierFieldValue(lead, "leadValue");
        if (!value.trim()) return null;
        const amount = Number(value.replace(/,/g, ""));
        const currencyCode = getDossierFieldValue(lead, "currency", {
            companyCurrency,
        });
        const currency = resolveCurrencyDisplay(
            currencyCode || null,
            companyCurrency,
        );
        if (Number.isFinite(amount)) {
            return formatMoneyAmount(amount, currency, "code");
        }
        return currency.code ? `${currency.code} ${value}` : value;
    }, [companyCurrency, lead]);

    const qualificationProgress = useMemo(() => {
        const tree = qualification.templateTree;
        const current = qualification.current;
        if (!tree || !current) {
            return { answered: 0, total: 0 };
        }
        // Match QualifyModal: only currently walkable questions (soft-hidden
        // branches / outcomes are excluded), counted via hasAnswerContent.
        const answers = answersFromQualification(current.answers ?? [], tree);
        const questions = computeWalkSegments(tree, answers).filter(
            (segment) => segment.type === "question",
        );
        const answered = questions.filter((segment) =>
            hasAnswerContent(answers[segment.key]),
        ).length;
        return { answered, total: questions.length };
    }, [qualification.current, qualification.templateTree]);

    const { uploadedCount: documentsUploaded } = useLeadDocuments(
        lead,
        props.fields ?? [],
    );

    const tabCounts = useMemo((): Partial<Record<WorkspaceTabId, number>> => {
        const itineraryLegs = deals.flatMap(
            (d) => d.lead_flight_itineraries ?? [],
        );
        return {
            // Hide counts while deferred props resolve (Deal pattern) so the
            // tab bar doesn't flash 0 → N.
            notes: notesLoading ? undefined : notes.length,
            tasks: tasksLoading
                ? undefined
                : tasks.filter((t) => toLeadTaskPreview(t).isOpen).length,
            meetings: leadFollowUpsLoading ? undefined : leadFollowUps.length,
            // Deferred `callSummary`: undefined until it resolves (no 0 → N flash).
            calls: showCalls ? callSummary?.total : undefined,
            deals: deals.length,
            exposes: showExposes ? exposesCount : undefined,
            itinerary: itineraryCount(itineraryLegs),
            sally: sallyInsights.length > 0 ? sallyInsights.length : undefined,
            files: filesLoading
                ? undefined
                : files.length + documentsUploaded,
            qualification: showQualification
                ? qualification.history.length +
                  (qualification.current ? 1 : 0) || undefined
                : undefined,
        };
    }, [
        deals,
        documentsUploaded,
        files.length,
        filesLoading,
        leadFollowUps.length,
        leadFollowUpsLoading,
        notes.length,
        notesLoading,
        qualification.current,
        qualification.history.length,
        showQualification,
        showExposes,
        sallyInsights.length,
        exposesCount,
        showCalls,
        callSummary?.total,
        tasks,
        tasksLoading,
    ]);

    // Re-evaluate nextMeeting when a start or end boundary passes, so a live
    // meeting doesn't keep the "next" slot and an ended one drops to past.
    const meetingClockTick = useMeetingClockTick(leadFollowUps);

    const nextMeeting = useMemo(() => {
        // Soonest upcoming only — a live meeting is happening now, not "next".
        return (
            [...leadFollowUps]
                .map((followup) => ({
                    followup,
                    preview: toLeadMeetingPreview(followup),
                }))
                .filter(({ preview }) => preview.isUpcoming && preview.startsAt)
                .sort(
                    (left, right) =>
                        left.preview.startsAt!.getTime() -
                        right.preview.startsAt!.getTime(),
                )[0]?.followup ?? null
        );
        // meetingClockTick is a deliberate dependency: it forces re-evaluation
        // of "now" once the soonest follow-up's start or end passes.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [leadFollowUps, meetingClockTick]);

    const openTasks = useMemo(
        () => tasks.filter((task) => toLeadTaskPreview(task).isOpen),
        [tasks],
    );
    const nextTask = useMemo(() => {
        if (openTasks.length === 0) return null;
        return [...openTasks].sort((a, b) => {
            const aDue = toLeadTaskPreview(a).dueDate?.getTime() ?? Infinity;
            const bDue = toLeadTaskPreview(b).dueDate?.getTime() ?? Infinity;
            return aDue - bDue;
        })[0];
    }, [openTasks]);

    const mission = useLeadMissionFlow({
        qualification,
        deals,
        changeStatus,
        setQualificationOpen: nav.setQualificationOpen,
        onViewAnswers: () => nav.setTab("qualification"),
        onShowDeals: () => nav.setTab("deals"),
    });
    const { primaryDeal, openTemplatePicker, handleMissionAction } = mission;

    const handleBannerPrimary = useCallback(() => {
        handleMissionAction(lifecycle.banner.primaryCta.action);
    }, [handleMissionAction, lifecycle.banner.primaryCta.action]);

    const handleBannerSecondary = useCallback(() => {
        const action = lifecycle.banner.secondaryCta?.action;
        if (action && action !== "view_answers") {
            handleMissionAction(action);
        }
    }, [handleMissionAction, lifecycle.banner.secondaryCta?.action]);

    const handleBannerViewAnswers = useCallback(() => {
        handleMissionAction("view_answers");
    }, [handleMissionAction]);

    const handleMoreAction = useCallback(
        (id: MoreMenuActionId) => {
            switch (id) {
                case "task":
                    setCreateKind("task");
                    break;
                case "deal":
                    mission.openCreateDeal();
                    break;
                case "note":
                    setCreateKind("note");
                    break;
                case "find_duplicates":
                    void duplicates.findDuplicates();
                    break;
                case "delete":
                    deleteLead.requestDelete();
                    break;
                default:
                    break;
            }
        },
        [deleteLead, duplicates],
    );

    const renderTabBody = () => {
        switch (nav.tab) {
            case "overview":
                return (
                    <div data-tour="lead-overview">
                        {overviewPending ? (
                            <OverviewDeferredSkeleton />
                        ) : (
                            <OverviewTab
                                meetingTypes={props.meetingTypes ?? []}
                                taskBoardColumns={props.taskBoardColumns ?? []}
                                permissions={{
                                    notes: props.notePermissions,
                                    tasks:
                                        props.taskPermissions ??
                                        props.permissions,
                                    followUps: props.followUpPermissions,
                                }}
                                onNavigateTab={nav.setTab}
                                onAddNote={() => setCreateKind("note")}
                                onAddTask={() => setCreateKind("task")}
                                onAddMeeting={() => setCreateKind("meeting")}
                            />
                        )}
                    </div>
                );
            case "notes":
                return notesLoading && notes.length === 0 ? (
                    <TabDeferredSkeleton />
                ) : (
                    <NotesTab
                        permissions={props.notePermissions}
                        onAddNote={() => setCreateKind("note")}
                    />
                );
            case "tasks":
                return tasksLoading && tasks.length === 0 ? (
                    <TabDeferredSkeleton />
                ) : (
                    <TasksTab
                        taskBoardColumns={props.taskBoardColumns ?? []}
                        permissions={props.taskPermissions ?? props.permissions}
                        onAddTask={() => setCreateKind("task")}
                    />
                );
            case "meetings":
                return leadFollowUpsLoading && leadFollowUps.length === 0 ? (
                    <TabDeferredSkeleton />
                ) : (
                    <MeetingsTab
                        meetingTypes={props.meetingTypes ?? []}
                        permissions={props.followUpPermissions}
                        onMeetingCreated={() =>
                            router.reload({ only: ["leadFollowUps"] })
                        }
                    />
                );
            case "calls":
                return showCalls ? <CallsTab leadId={lead.id} /> : null;
            case "deals":
                return (
                    <DealsTab
                        meetingTypes={props.meetingTypes ?? []}
                        dealMeta={{
                            categories: props.categories,
                            packages: props.packages,
                            products: props.products,
                            pipelines: props.leadPipelines,
                            stages: props.leadStages ?? props.stages,
                            leadAgents: props.leadAgents,
                        }}
                    />
                );
            case "leadinfo":
                return (
                    <LeadInfoTab
                        fields={props.fields}
                        customFieldCategories={props.customFieldCategories}
                        activeSection={nav.infoSection}
                        onSectionChange={nav.setInfoSection}
                        editLeadPermission={props.editLeadPermission}
                    />
                );
            case "itinerary":
                return <ItineraryTab />;
            case "sally":
                return (
                    <SallyInsightsPanel
                        insights={sallyInsights}
                        loading={sallyInsightsLoading}
                        error={sallyInsightsError}
                        onRetry={refetchSallyInsights}
                        groupByDeal={deals}
                        patchInsight={patchSallyInsight}
                        onAddNote={addInsightToNote}
                        emptyTitle={t("pages.leads.sally.empty_title")}
                        emptyDescription={t(
                            "pages.leads.sally.empty_description",
                        )}
                    />
                );
            case "timeline":
                return (
                    <TimelineTab
                        leadId={lead.id}
                        leadName={lead.client_name}
                        userId={page.props.auth?.user?.id}
                        emailEnabled={emailQuickAction != null}
                        onOpenEmailMessage={(messageId) =>
                            openCommunication(messageId)
                        }
                    />
                );
            case "files":
                return (
                    <FilesTab
                        fields={props.fields}
                        editLeadPermission={props.editLeadPermission}
                    />
                );
            case "marketing":
                return <MarketingTab />;
            case "exposes":
                return showExposes ? (
                    <ExposesTab
                        leadId={lead.id}
                        currencySymbol={
                            resolveCurrencyDisplay(lead.currency, companyCurrency)
                                .symbol
                        }
                        onCountChange={setExposesCount}
                    />
                ) : null;
            case "qualification":
                return showQualification ? (
                    <QualificationTab
                        current={qualification.current}
                        history={qualification.history}
                        canStart={
                            qualification.current?.status !== "inProgress" &&
                            !qualification.history.some(
                                (run) => run.status === "inProgress",
                            )
                        }
                        starting={qualification.isStartingFlow}
                        resumingId={qualification.resumingId}
                        onResumeQualify={(run) => {
                            // Modal first — the tree load shows inside it.
                            nav.setQualificationOpen(true);
                            void qualification.resumeQualification(run);
                        }}
                        onDeleteQualify={async (run) => {
                            const wasOpenCurrent =
                                nav.qualificationOpen &&
                                qualification.current?.id === run.id;
                            const ok =
                                await qualification.deleteQualification(run.id);
                            if (ok && wasOpenCurrent) {
                                nav.setQualificationOpen(false);
                            }
                            return ok;
                        }}
                        onStartQualify={openTemplatePicker}
                    />
                ) : (
                    <p style={{ margin: 0, color: T.TEXT_HINT, fontSize: 13 }}>
                        {td("This tab is coming soon.", { source: "en" })}
                    </p>
                );
            default:
                return (
                    <p style={{ margin: 0, color: T.TEXT_HINT, fontSize: 13 }}>
                        {td("This tab is coming soon.", { source: "en" })}
                    </p>
                );
        }
    };

    const pageTitle = lead.client_name ?? td("Lead", { source: "en" });

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                {
                    name: t("app.menu.lead"),
                    url: route("lead-contact.index"),
                },
                { name: pageTitle },
            ]}
        >
            <div
                className={`lead-redesign ${
                    isMobileResponsive ? "lr-mobile-responsive" : ""
                }`}
            >
                {showProductTour && (
                    <ProductTour
                        ref={tourRef}
                        tourId={LEAD_TOUR_ID}
                        steps={leadTourSteps}
                        labels={LEAD_TOUR_LABELS}
                    />
                )}
                <div className="v2-page mx-auto flex flex-col gap-4 w-full max-w-[1320px]">
                    <LeadHeaderRoot
                        lead={lead}
                        lifecycle={lifecycle}
                        statuses={lifecycleStatuses}
                        valueLabel={valueLabel}
                        firstName={firstName}
                        templateName={
                            qualification.current?.template_name ??
                            qualification.current?.template_id
                        }
                        qualificationAnswered={qualificationProgress.answered}
                        qualificationTotal={qualificationProgress.total}
                        canDelete={props.deleteLeadPermission !== "none"}
                        canFindDuplicates={duplicates.canMerge}
                        canEditOwner={props.editLeadPermission !== "none"}
                        canEdit={canEditLead(
                            props.editLeadPermission,
                            lead,
                            page.props.auth?.user?.id,
                        )}
                        canUploadPhoto={canEditLead(
                            props.editLeadPermission,
                            lead,
                            page.props.auth?.user?.id,
                        )}
                        showQualification={showQualification}
                        onStatusChange={(key) => void changeStatus(key)}
                        statusSaving={statusSaving}
                        onMoreAction={handleMoreAction}
                        onReplayGuide={
                            showProductTour
                                ? () => tourRef.current?.restart()
                                : undefined
                        }
                        bannerBusy={
                            qualification.isStartingFlow ||
                            qualification.resumingId != null
                        }
                        onBannerPrimary={handleBannerPrimary}
                        onBannerSecondary={
                            lifecycle.banner.secondaryCta?.action &&
                            lifecycle.banner.secondaryCta.action !== "view_answers"
                                ? handleBannerSecondary
                                : undefined
                        }
                        onBannerViewAnswers={
                            lifecycle.banner.secondaryCta?.action === "view_answers"
                                ? handleBannerViewAnswers
                                : undefined
                        }
                        dealCount={deals.length}
                    />

                    <div className="v2-grid">
                        <div className="min-w-0">
                            {quickActionsInMainColumn && (
                                <div className="mb-4">
                                    <DossierQuickActions
                                        leadId={lead.id}
                                        phones={callPhones}
                                        phone={callPhones[0]?.phone}
                                        onLogAction={() =>
                                            setCreateKind("log")
                                        }
                                        onAddNote={() =>
                                            setCreateKind("note")
                                        }
                                        onScheduleMeeting={() =>
                                            setCreateKind("meeting")
                                        }
                                        emailQuickAction={emailQuickActionForUi}
                                        onEmail={() => openCommunication(null)}
                                    />
                                </div>
                            )}

                            {duplicates.visible && (
                                <DuplicateLeadsCard
                                    leadId={lead.id}
                                    duplicates={duplicates.duplicates}
                                    isLoading={duplicates.isLoading}
                                    onDismiss={duplicates.dismiss}
                                    onMerged={() => void duplicates.invalidate()}
                                />
                            )}

                            {showAiSummary && (
                                // Owns the gap below it (like DuplicateLeadsCard), so the
                                // workspace never touches the summary, strip or no strip.
                                <div data-tour="lead-ai-summary" className="mb-4">
                                    <AiSummaryCard
                                        leadId={lead.id}
                                        leadName={lead.client_name}
                                        summary={props.leadAiSummary}
                                        leadPhone={
                                            getDossierFieldValue(lead, "mobile") ||
                                            undefined
                                        }
                                        onCta={{
                                            onQualifyLead: openTemplatePicker,
                                            onCreateTask: () =>
                                                setCreateKind("task"),
                                            onScheduleCall: () =>
                                                setCreateKind("meeting"),
                                        }}
                                    />
                                </div>
                            )}

                            {showQuickStats && (
                                <QuickStats
                                    nextMeeting={nextMeeting}
                                    nextTask={nextTask}
                                    openTasksCount={openTasks.length}
                                    primaryDeal={primaryDeal}
                                    dealsCount={deals.length}
                                    taskBoardColumns={props.taskBoardColumns ?? []}
                                    meetingLoading={leadFollowUpsLoading}
                                    tasksLoading={tasksLoading}
                                    // Deals are shell props (not deferred) — keep
                                    // the slot in sync visually with the other two
                                    // while workspace deferred data is resolving.
                                    dealsLoading={
                                        leadFollowUpsLoading || tasksLoading
                                    }
                                    onSchedule={() => setCreateKind("meeting")}
                                    onCreateTask={() => setCreateKind("task")}
                                    onCreateDeal={() => mission.openCreateDeal()}
                                    onOpenMeeting={setDetailMeeting}
                                    onOpenTask={setDetailTask}
                                    onViewAllDeals={() => nav.setTab("deals")}
                                />
                            )}

                            <WorkspaceCard
                                activeTab={nav.tab}
                                onTabChange={nav.setTab}
                                tabCounts={tabCounts}
                                showQualification={showQualification}
                                showExposes={showExposes}
                                showCalls={showCalls}
                                showSally={showSally}
                            >
                                {renderTabBody()}
                            </WorkspaceCard>
                        </div>

                        <div className="v2-dossier-column">
                            {!quickActionsInMainColumn && (
                                <DossierQuickActions
                                    leadId={lead.id}
                                    phones={callPhones}
                                    phone={callPhones[0]?.phone}
                                    onLogAction={() =>
                                        setCreateKind("log")
                                    }
                                    onAddNote={() => setCreateKind("note")}
                                    onScheduleMeeting={() =>
                                        setCreateKind("meeting")
                                    }
                                    emailQuickAction={emailQuickActionForUi}
                                    onEmail={() => openCommunication(null)}
                                />
                            )}
                            <LeadDossier
                                lead={lead}
                                canEdit={canEditLead(
                                    props.editLeadPermission,
                                    lead,
                                    page.props.auth?.user?.id,
                                )}
                                onOpenLeadInfo={() => {
                                    nav.setInfoSection("personal");
                                    nav.setTab("leadinfo");
                                }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <LeadMissionModals
                flow={mission}
                qualification={qualification}
                dealCreate={dealCreate}
                showQualification={showQualification}
                qualificationOpen={nav.qualificationOpen}
                onCloseQualification={() => nav.setQualificationOpen(false)}
                pageProps={props}
            />

            <LeadCreateModals
                open={createKind}
                onClose={closeCreate}
                sourceEmailMessageId={sourceEmailMessageId}
                meetingTypes={props.meetingTypes ?? []}
                taskBoardColumns={props.taskBoardColumns ?? []}
                taskCategories={props.taskCategories ?? []}
            />

            <CommunicationModal
                open={communicationOpen && emailQuickAction != null}
                onClose={closeCommunication}
                record={{ type: "lead", id: lead.id }}
                recordLabel={lead.client_name}
                messageId={emailFocusMessageId}
                hasConnection={hasMailboxConnection}
                prefillTo={lead.client_email ?? null}
                onCreateFollowUp={openCreateFromEmail}
            />

            <LeadMeetingDetailModal
                meeting={detailMeeting}
                meetingTypes={props.meetingTypes ?? []}
                permissions={props.followUpPermissions}
                onClose={() => setDetailMeeting(null)}
            />

            <LeadTaskDetailModal
                task={detailTask}
                taskBoardColumns={props.taskBoardColumns ?? []}
                permissions={props.taskPermissions ?? props.permissions}
                onClose={() => setDetailTask(null)}
            />

            <ConfirmDialog {...deleteLead.dialogProps} />
        </PageLayout>
    );
}
