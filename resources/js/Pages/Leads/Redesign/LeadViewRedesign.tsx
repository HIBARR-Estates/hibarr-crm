import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Deferred, router, usePage } from "@inertiajs/react";
import PageLayout from "@/Components/PageLayout";
import ProductTour, { ProductTourHandle } from "@/Components/ProductTour/ProductTour";
import {
    AddNoteModal,
    AddTaskModal,
    ConfirmDialog,
    ScheduleMeetingModal,
} from "@/Components/Redesign";
import type { AddNoteFormState } from "@/Components/Redesign/modals/AddNoteModal";
import type { AddTaskFormState } from "@/Components/Redesign/modals/AddTaskModal";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import { buildEmptyMeetingForm, getMeetingOwner } from "@/Components/Redesign/meeting/meetingFormUtils";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { DEAL_EXPOSES_FLAG } from "@/Hooks/useDealExposesFlag";
import {
    OverviewDeferredSkeleton,
    TabDeferredSkeleton,
} from "@/Pages/Deals/Redesign/components/workspace/overview/overviewShared";
import type { LeadRedesignProps } from "./types";
import type { LeadMissionCtaAction, WorkspaceTabId } from "./types";
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
import { itineraryCount } from "./adapters/itineraryAdapter";
import { formatMobileForDisplay } from "@/lib/utils";
import type { Lead } from "@/Types/api/leads";
import type { QualificationLeadPatch } from "@/Types/qualification";
import {
    LeadWorkspaceProvider,
    useLeadWorkspace,
} from "./context/LeadWorkspaceContext";
import useLeadViewNavigation from "./hooks/useLeadViewNavigation";
import useLeadQualificationWorkspace from "./hooks/useLeadQualificationWorkspace";
import useLeadLifecycleChange from "./hooks/useLeadLifecycleChange";
import useLeadDelete from "./hooks/useLeadDelete";
import useLeadDealCreate from "./hooks/useLeadDealCreate";
import useLeadNoteCreate from "./hooks/useLeadNoteCreate";
import useLeadTaskCreate from "./hooks/useLeadTaskCreate";
import useLeadMeetingCreate from "./hooks/useLeadMeetingCreate";
import useLeadDocuments from "./hooks/useLeadDocuments";
import useLeadDuplicates from "./hooks/useLeadDuplicates";
import type { Task as RedesignedTask } from "@/Types/Task";
import useTasksWorkspaceRedesignFlag from "@/Hooks/useTasksWorkspaceRedesignFlag";
import useTasksWorkspaceMutations from "@/Pages/Tasks/Redesign/hooks/useTasksWorkspaceMutations";
import useTaskExtras from "@/Pages/Tasks/Redesign/hooks/useTaskExtras";
import TaskRedesignFormModal from "@/Pages/Tasks/Redesign/components/embed/TaskRedesignFormModal";
import { formLinksPayload } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import { afterCreateTaskFormSubmit, patchTaskListExtrasCounts } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import LeadHeaderRoot from "./components/header/LeadHeaderRoot";
import AiSummaryCard from "./components/workspace/AiSummaryCard";
import DuplicateLeadsCard from "./components/workspace/DuplicateLeadsCard";
import QuickStats from "./components/workspace/QuickStats";
import WorkspaceCard from "./components/workspace/WorkspaceCard";
import LeadDossier from "./components/dossier/LeadDossier";
import DossierQuickActions from "./components/dossier/DossierQuickActions";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import { LEAD_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import LeadMeetingDetailModal from "./components/workspace/LeadMeetingDetailModal";
import LeadTaskDetailModal from "./components/workspace/LeadTaskDetailModal";
import OverviewTab from "./components/workspace/tabs/OverviewTab";
import NotesTab from "./components/workspace/tabs/NotesTab";
import TasksTab from "./components/workspace/tabs/TasksTab";
import MeetingsTab from "./components/workspace/tabs/MeetingsTab";
import DealsTab from "./components/workspace/tabs/DealsTab";
import LeadInfoTab from "./components/workspace/tabs/LeadInfoTab";
import ItineraryTab from "./components/workspace/tabs/ItineraryTab";
import TimelineTab from "./components/workspace/tabs/TimelineTab";
import FilesTab from "./components/workspace/tabs/FilesTab";
import MarketingTab from "./components/workspace/tabs/MarketingTab";
import ExposesTab from "./components/workspace/tabs/ExposesTab";
import QualificationTab from "./components/workspace/tabs/QualificationTab";
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import TemplatePickerModal from "./components/qualification/TemplatePickerModal";
import QualifyModal from "./components/qualification/QualifyModal";
import CreateDealModal from "./components/dealCreate/CreateDealModal";
import {
    answersFromQualification,
    computeWalkSegments,
    hasAnswerContent,
} from "@/Pages/Leads/Components/Qualification/qualificationUtils";
import "@/Components/Redesign/redesign.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "./lead-redesign.css";

export default function LeadViewRedesign(props: LeadRedesignProps) {
    return (
        <LeadWorkspaceProvider
            lead={props.lead}
            notes={props.notes}
            tasks={props.tasks}
            leadFollowUps={props.leadFollowUps}
            deals={props.deals}
        >
            <LeadViewRedesignInner {...props} />
        </LeadWorkspaceProvider>
    );
}

function LeadViewRedesignInner(props: LeadRedesignProps) {
    const { td } = useTd();
    const { t } = useTranslation();
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;
    const showQualification =
        featureFlags?.["crm.lead-qualification-tab"] === true;
    const showProductTour = featureFlags?.["crm.leads-product-tour"] === true;
    const showExposes =
        featureFlags?.[DEAL_EXPOSES_FLAG] === true &&
        (page.props.auth?.permissions?.view_lead_proposals ?? "none") !==
            "none";

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
        addTask,
        setTasks,
    } = useLeadWorkspace();

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
    }, [nav.setTab, nav.tab, showQualification, showExposes]);

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
    const { createNote, isSaving: noteSaving, errors: noteErrors, clearErrors: clearNoteErrors } =
        useLeadNoteCreate(lead.id);
    const { createTask, isCreating: taskCreating, errors: taskErrors, clearErrors: clearTaskErrors } =
        useLeadTaskCreate(lead.id);
    const { createMeeting, isCreating: meetingCreating, errors: meetingErrors, clearErrors: clearMeetingErrors } =
        useLeadMeetingCreate(lead);
    const duplicates = useLeadDuplicates(lead.id);

    // Behind crm.tasks-workspace-redesign, "Add task" opens the redesigned
    // form (checklist/attachments fields, multi-record linking) instead of
    // the older AddTaskModal — createRedesignedTask's own setTasks patch is
    // a no-op (this page's task list is patched via addTask, same as the
    // old flow already does) since it only needs the created task back.
    const useRedesignedTasks = useTasksWorkspaceRedesignFlag();
    const { persistExtras } = useTaskExtras();
    const {
        createTask: createRedesignedTask,
        isCreating: isCreatingRedesignedTask,
        createErrors: createRedesignedTaskErrors,
        clearCreateErrors: clearCreateRedesignedErrors,
    } = useTasksWorkspaceMutations(() => {}, null);

    const qualification = useLeadQualificationWorkspace(lead, {
        enabled: showQualification,
        seed: props.leadQualification ?? null,
    });

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [createDealOpen, setCreateDealOpen] = useState(false);
    // undefined until the tab is opened, so the pill stays hidden rather than
    // reading 0 for a lead whose exposes have never been loaded.
    const [exposesCount, setExposesCount] = useState<number | undefined>(
        undefined,
    );
    const [addNoteOpen, setAddNoteOpen] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
    const [logActionOpen, setLogActionOpen] = useState(false);
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
            deals: deals.length,
            exposes: showExposes ? exposesCount : undefined,
            itinerary: itineraryCount(itineraryLegs),
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
        exposesCount,
        tasks,
        tasksLoading,
    ]);

    const nextMeeting = useMemo(() => {
        return (
            [...leadFollowUps]
                .filter((f) => f.status !== "completed")
                .sort(
                    (a, b) =>
                        new Date(a.next_follow_up_date).getTime() -
                        new Date(b.next_follow_up_date).getTime(),
                )[0] ?? null
        );
    }, [leadFollowUps]);

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

    const primaryDeal = useMemo((): Deal | null => {
        if (deals.length === 0) return null;
        // Prefer highest id as latest when order is ambiguous.
        return [...deals].sort((a, b) => b.id - a.id)[0] ?? null;
    }, [deals]);

    const handleTemplateSelect = useCallback(
        async (templateId: string) => {
            // Open first so this feels instant; the start call and script
            // load show inside the modal.
            setTemplatePickerOpen(false);
            nav.setQualificationOpen(true);

            const started =
                await qualification.startQualificationScript(templateId);
            if (!started) {
                // Start failed — don't leave an empty modal hanging.
                nav.setQualificationOpen(false);
            }
        },
        [nav, qualification],
    );

    const openTemplatePicker = useCallback(() => {
        if (qualification.templates.length === 1) {
            void handleTemplateSelect(qualification.templates[0].id);
            return;
        }
        setTemplatePickerOpen(true);
    }, [handleTemplateSelect, qualification.templates]);

    const handleMissionAction = useCallback(
        (action: LeadMissionCtaAction) => {
            switch (action) {
                case "qualify_start":
                    openTemplatePicker();
                    break;
                case "qualify_resume": {
                    const active =
                        qualification.current?.status === "inProgress"
                            ? qualification.current
                            : qualification.history.find(
                                  (run) => run.status === "inProgress",
                              ) ?? null;
                    if (!active) break;
                    // Modal first — the tree load shows inside it.
                    nav.setQualificationOpen(true);
                    void qualification.resumeQualification(active);
                    break;
                }
                case "create_deal":
                    setCreateDealOpen(true);
                    break;
                case "open_deal": {
                    const latest = primaryDeal;
                    if (latest?.id) {
                        router.visit(route("deals.show", latest.id));
                    } else if (deals.length > 0) {
                        nav.setTab("deals");
                    }
                    break;
                }
                case "reactivate":
                    void changeStatus("new");
                    break;
                case "view_answers":
                    nav.setTab("qualification");
                    break;
                default:
                    break;
            }
        },
        [
            changeStatus,
            deals.length,
            nav,
            openTemplatePicker,
            primaryDeal,
            qualification,
        ],
    );

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
                    setAddTaskOpen(true);
                    break;
                case "deal":
                    setCreateDealOpen(true);
                    break;
                case "note":
                    setAddNoteOpen(true);
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
                                onAddNote={() => setAddNoteOpen(true)}
                                onAddTask={() => setAddTaskOpen(true)}
                                onAddMeeting={() => setAddMeetingOpen(true)}
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
                        onAddNote={() => setAddNoteOpen(true)}
                    />
                );
            case "tasks":
                return tasksLoading && tasks.length === 0 ? (
                    <TabDeferredSkeleton />
                ) : (
                    <TasksTab
                        taskBoardColumns={props.taskBoardColumns ?? []}
                        permissions={props.taskPermissions ?? props.permissions}
                        onAddTask={() => setAddTaskOpen(true)}
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
            case "timeline":
                return (
                    <TimelineTab
                        leadId={lead.id}
                        leadName={lead.client_name}
                        userId={page.props.auth?.user?.id}
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
                            lead.currency?.currency_symbol || "£"
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
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        {td("This tab is coming soon.", { source: "en" })}
                    </p>
                );
            default:
                return (
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
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
            <div className="lead-redesign">
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
                        <div>
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
                                <div data-tour="lead-ai-summary">
                                    <AiSummaryCard
                                        leadId={lead.id}
                                        summary={props.leadAiSummary}
                                        leadPhone={
                                            getDossierFieldValue(lead, "mobile") ||
                                            undefined
                                        }
                                        onCta={{
                                            onQualifyLead: openTemplatePicker,
                                            onCreateTask: () =>
                                                setAddTaskOpen(true),
                                            onScheduleCall: () =>
                                                setAddMeetingOpen(true),
                                        }}
                                    />
                                </div>
                            )}

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
                                onSchedule={() => setAddMeetingOpen(true)}
                                onCreateTask={() => setAddTaskOpen(true)}
                                onCreateDeal={() => setCreateDealOpen(true)}
                                onOpenMeeting={setDetailMeeting}
                                onOpenTask={setDetailTask}
                                onOpenDeal={(deal) =>
                                    router.visit(route("deals.show", deal.id))
                                }
                                onViewAllDeals={() => nav.setTab("deals")}
                            />

                            <WorkspaceCard
                                activeTab={nav.tab}
                                onTabChange={nav.setTab}
                                tabCounts={tabCounts}
                                showQualification={showQualification}
                                showExposes={showExposes}
                            >
                                {renderTabBody()}
                            </WorkspaceCard>
                        </div>

                        <div className="v2-dossier-column">
                            <DossierQuickActions
                                onLogAction={() => setLogActionOpen(true)}
                                onAddNote={() => setAddNoteOpen(true)}
                                onScheduleMeeting={() => setAddMeetingOpen(true)}
                            />
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

            {showQualification && (
                <>
                    <TemplatePickerModal
                        open={templatePickerOpen}
                        leadName={lead.client_name ?? td("Lead", { source: "en" })}
                        templates={qualification.templates}
                        loading={qualification.templatesLoading}
                        selecting={qualification.isStartingFlow}
                        onClose={() => setTemplatePickerOpen(false)}
                        onSelect={(id) => void handleTemplateSelect(id)}
                    />

                    {nav.qualificationOpen && (
                            <QualifyModal
                                open={nav.qualificationOpen}
                                lead={lead}
                                qualification={qualification.current}
                                templateTree={qualification.templateTree}
                                treeLoading={qualification.treeLoading}
                                starting={qualification.isStartingFlow}
                                fields={props.fields}
                                customFieldCategories={
                                    props.customFieldCategories
                                }
                                editLeadPermission={props.editLeadPermission}
                                meetingTypes={props.meetingTypes ?? []}
                                onClose={() => nav.setQualificationOpen(false)}
                                onCompleted={(updated) => {
                                    qualification.handleQualificationUpdated(
                                        updated,
                                    );
                                }}
                                onActionsDone={(updated) => {
                                    qualification.finishQualificationSession(
                                        updated,
                                    );
                                }}
                                onLeadUpdated={(patch) => {
                                    setLead((prev) =>
                                        mergeQualificationLeadPatch(prev, patch),
                                    );
                                }}
                            />
                        )}
                </>
            )}

            <CreateDealModal
                open={createDealOpen}
                onClose={() => {
                    setCreateDealOpen(false);
                    dealCreate.clearErrors();
                }}
                saving={dealCreate.isCreating}
                errors={dealCreate.errors}
                defaultAgentId={(() => {
                    const agents = props.leadAgents ?? [];
                    const ownerUserId = lead.lead_owner?.id;
                    if (!ownerUserId) return null;
                    const match = agents.find(
                        (agent: {
                            id: number;
                            user_id?: number;
                            user?: { id?: number };
                        }) =>
                            agent.user_id === ownerUserId ||
                            agent.user?.id === ownerUserId,
                    );
                    return match?.id ?? null;
                })()}
                meetingTypes={props.meetingTypes ?? []}
                dealMeta={{
                    categories: props.categories,
                    packages: props.packages,
                    products: props.products,
                    pipelines: props.leadPipelines,
                    stages: props.leadStages ?? props.stages,
                    leadAgents: props.leadAgents,
                }}
                onSubmit={(input) =>
                    dealCreate.createDeal(input, () => {
                        setCreateDealOpen(false);
                    })
                }
            />

            <LogActionModal
                open={logActionOpen}
                onClose={() => setLogActionOpen(false)}
                onSuccess={() => setLogActionOpen(false)}
                modelType={LEAD_TIMELINE_MODEL_TYPE}
                modelId={lead.id}
                userId={page.props.auth?.user?.id}
            />

            <AddNoteModal
                open={addNoteOpen}
                onClose={() => {
                    setAddNoteOpen(false);
                    clearNoteErrors();
                }}
                saving={noteSaving}
                errors={noteErrors}
                onSubmit={(form: AddNoteFormState) =>
                    createNote(
                        { title: form.title, text: form.text },
                        () => setAddNoteOpen(false),
                    )
                }
                labels={{
                    title: td("Add note", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Save note", { source: "en" }),
                    titleField: td("Title", { source: "en" }),
                    titlePlaceholder: td("Optional title", { source: "en" }),
                    detailsField: td("Details", { source: "en" }),
                    bodyPlaceholder: td("Write your note…", { source: "en" }),
                }}
            />

            {useRedesignedTasks ? (
                <Deferred data="taskCategories" fallback={null}>
                    <TaskRedesignFormModal
                        open={addTaskOpen}
                        mode="create"
                        columns={props.taskBoardColumns ?? []}
                        categories={props.taskCategories ?? []}
                        lockedLinks={[
                            {
                                type: "lead",
                                id: lead.id,
                                name: lead.client_name || "Lead",
                            },
                        ]}
                        saving={isCreatingRedesignedTask}
                        errors={createRedesignedTaskErrors}
                        onClose={() => {
                            setAddTaskOpen(false);
                            clearCreateRedesignedErrors();
                        }}
                        onSubmit={(values) =>
                            createRedesignedTask(
                                {
                                    title: values.title,
                                    startDate: values.startDate,
                                    dueDate: values.dueDate,
                                    dueTime: values.dueTime,
                                    priority: values.priority,
                                    description: values.description,
                                    assignees: values.assignees,
                                    categoryId: values.categoryId,
                                    boardColumnId:
                                        values.boardColumnId ?? undefined,
                                    links: formLinksPayload(values),
                                },
                                afterCreateTaskFormSubmit(
                                    values,
                                    persistExtras,
                                    (task) => {
                                        if (task) {
                                            addTask(
                                                task as unknown as Parameters<
                                                    typeof addTask
                                                >[0],
                                            );
                                        }
                                        setAddTaskOpen(false);
                                    },
                                    (task, result) => {
                                        setTasks(
                                            (prev) =>
                                                patchTaskListExtrasCounts(
                                                    prev as unknown as RedesignedTask[],
                                                    task.id,
                                                    result,
                                                ) as unknown as typeof prev,
                                        );
                                    },
                                ),
                            )
                        }
                    />
                </Deferred>
            ) : (
                <AddTaskModal
                    open={addTaskOpen}
                    onClose={() => {
                        setAddTaskOpen(false);
                        clearTaskErrors();
                    }}
                    saving={taskCreating}
                    errors={taskErrors}
                    defaultAssigneeUserId={lead.lead_owner?.id}
                    onSubmit={(form: AddTaskFormState) =>
                        createTask(form, (task) => {
                            if (task) addTask(task);
                            setAddTaskOpen(false);
                        })
                    }
                    labels={{
                        title: td("Create task", { source: "en" }),
                        cancel: td("Cancel", { source: "en" }),
                        submit: td("Create task", { source: "en" }),
                        titleField: td("Title", { source: "en" }),
                        titlePlaceholder: td("What needs to be done?", { source: "en" }),
                        description: td("Description", { source: "en" }),
                        descriptionPlaceholder: td("Optional details", { source: "en" }),
                        startDate: td("Start date", { source: "en" }),
                        dueDate: td("Due date", { source: "en" }),
                        dueTime: td("Due time", { source: "en" }),
                        priority: td("Priority", { source: "en" }),
                        priorityHigh: td("High", { source: "en" }),
                        priorityMedium: td("Medium", { source: "en" }),
                        priorityLow: td("Low", { source: "en" }),
                        priorityHighest: td("Highest", { source: "en" }),
                        priorityUrgent: td("Urgent", { source: "en" }),
                        assignees: td("Assignees", { source: "en" }),
                        dateRangeError: td("Due date must be on or after start date", { source: "en" }),
                    }}
                />
            )}

            <ScheduleMeetingModal
                open={addMeetingOpen}
                onClose={() => {
                    setAddMeetingOpen(false);
                    clearMeetingErrors();
                }}
                saving={meetingCreating}
                errors={meetingErrors}
                meetingTypes={props.meetingTypes ?? []}
                initialForm={buildEmptyMeetingForm(
                    lead,
                    page.props.auth?.user?.id,
                    page.props.auth?.user?.email,
                )}
                onSubmit={(form: MeetingFormState) =>
                    createMeeting(
                        {
                            meetingTypeId: form.meetingTypeId,
                            date: form.date,
                            startTime: form.startTime,
                            endTime: form.endTime,
                            duration: form.duration,
                            platform: form.platform,
                            locationDetail: form.locationDetail,
                            meetingLink: form.meetingLink,
                            participants: form.participants,
                            hostId: form.hostId,
                            remark: form.remark,
                            reminders: form.reminders,
                        },
                        () => setAddMeetingOpen(false),
                    )
                }
                mustIncludeOwner={getMeetingOwner(lead)}
                labels={{
                    title: td("Schedule meeting", { source: "en" }),
                    cancel: td("Cancel", { source: "en" }),
                    submit: td("Schedule", { source: "en" }),
                }}
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

/** Apply the qualification-complete lead patch into workspace state (no reload). */
function mergeQualificationLeadPatch(
    prev: Lead,
    patch: QualificationLeadPatch,
): Lead {
    const next = { ...prev } as Record<string, unknown>;

    Object.entries(patch).forEach(([key, val]) => {
        if (val === undefined) return;
        next[key] =
            (key === "languages" ||
                key === "categories" ||
                key === "category_ids") &&
            !Array.isArray(val)
                ? []
                : val;
    });

    const lifecycle =
        patch.lead_lifecycle_status ?? patch.lifecycleStatus;
    if (lifecycle != null) {
        next.lead_lifecycle_status = lifecycle;
        next.lifecycleStatus = lifecycle;
    }

    if (patch.custom_fields_data && typeof patch.custom_fields_data === "object") {
        next.custom_fields_data = patch.custom_fields_data;
    }

    if (patch.mobile !== undefined) {
        const formatted = formatMobileForDisplay(String(patch.mobile ?? ""));
        next.mobile_with_phonecode =
            formatted && formatted !== "--"
                ? formatted
                : (patch.mobile_with_phonecode as string | undefined) ?? "--";
    }

    if (patch.office !== undefined) {
        const formatted = formatMobileForDisplay(String(patch.office ?? ""));
        next.office_phone_formatted =
            formatted && formatted !== "--"
                ? formatted
                : (patch.office_phone_formatted as string | undefined) ||
                  String(patch.office ?? "") ||
                  "--";
    }

    return next as unknown as Lead;
}
