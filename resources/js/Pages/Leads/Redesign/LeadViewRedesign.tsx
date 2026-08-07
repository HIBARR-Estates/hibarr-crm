import { useCallback, useMemo, useRef, useState } from "react";
import { router, usePage } from "@inertiajs/react";
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
import { buildEmptyMeetingForm } from "@/Components/Redesign/meeting/meetingFormUtils";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
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
import type { Deal } from "@/Types/api/deals";
import type { DealFollowup } from "@/Types/api/deal-followup";
import type { Task } from "@/Types/api/tasks";
import TemplatePickerModal from "./components/qualification/TemplatePickerModal";
import QualifyModal from "./components/qualification/QualifyModal";
import AnswersReviewModal from "./components/qualification/AnswersReviewModal";
import CreateDealModal from "./components/dealCreate/CreateDealModal";
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

    const {
        lead,
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
    } = useLeadWorkspace();

    const overviewPending =
        (notesLoading && notes.length === 0) ||
        (tasksLoading && tasks.length === 0) ||
        (leadFollowUpsLoading && leadFollowUps.length === 0);

    const nav = useLeadViewNavigation(props.customFieldCategories);
    const tourRef = useRef<ProductTourHandle>(null);
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

    const qualification = useLeadQualificationWorkspace(lead, {
        enabled: showQualification,
        seed: props.leadQualification ?? null,
    });

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [createDealOpen, setCreateDealOpen] = useState(false);
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

    const answerCount = useMemo(() => {
        const runs = [...qualification.history];
        if (qualification.current) runs.push(qualification.current);
        return runs.reduce(
            (sum, run) => sum + (run.answers?.length ?? 0),
            0,
        );
    }, [qualification.current, qualification.history]);

    const qualificationProgress = useMemo(() => {
        const tree = qualification.templateTree;
        const current = qualification.current;
        if (!tree || !current) {
            return { answered: 0, total: 0 };
        }
        const total = tree.segments.filter((s) => s.type === "question").length;
        const answered = current.answers?.length ?? 0;
        return { answered, total };
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
            itinerary: itineraryCount(itineraryLegs),
            files: filesLoading
                ? undefined
                : files.length + documentsUploaded,
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

    const handleMissionAction = useCallback(
        (action: LeadMissionCtaAction) => {
            switch (action) {
                case "qualify_start":
                    setTemplatePickerOpen(true);
                    break;
                case "qualify_resume":
                    nav.setQualificationOpen(true);
                    break;
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
                    nav.setAnswersOpen(true);
                    break;
                default:
                    break;
            }
        },
        [changeStatus, deals.length, nav, primaryDeal],
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
                case "answers":
                    nav.setAnswersOpen(true);
                    break;
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
        [deleteLead, duplicates, nav],
    );

    const handleTemplateSelect = useCallback(
        async (templateId: string) => {
            const started =
                await qualification.startQualificationScript(templateId);
            if (started) {
                setTemplatePickerOpen(false);
                nav.setQualificationOpen(true);
            }
        },
        [nav, qualification],
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
                    <NotesTab permissions={props.notePermissions} />
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
            default:
                return (
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        {td("This tab is coming soon.")}
                    </p>
                );
        }
    };

    const pageTitle = lead.client_name ?? td("Lead");

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
                        answerCount={answerCount}
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
                        onOpenAnswers={() => nav.setAnswersOpen(true)}
                        onMoreAction={handleMoreAction}
                        onReplayGuide={
                            showProductTour
                                ? () => tourRef.current?.restart()
                                : undefined
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
                                            lead.mobile ?? lead.cell ?? undefined
                                        }
                                        onCta={{
                                            onQualifyLead: () =>
                                                setTemplatePickerOpen(true),
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
                        leadName={lead.client_name ?? td("Lead")}
                        templates={qualification.templates}
                        loading={qualification.templatesLoading}
                        onClose={() => setTemplatePickerOpen(false)}
                        onSelect={(id) => void handleTemplateSelect(id)}
                    />

                    {qualification.current &&
                        qualification.templateTree &&
                        nav.qualificationOpen && (
                            <QualifyModal
                                open={nav.qualificationOpen}
                                lead={lead}
                                qualification={qualification.current}
                                templateTree={qualification.templateTree}
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
                            />
                        )}

                    <AnswersReviewModal
                        open={nav.answersOpen}
                        leadName={lead.client_name ?? td("Lead")}
                        history={qualification.history}
                        current={qualification.current}
                        onClose={() => nav.setAnswersOpen(false)}
                    />
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
                    title: td("Add note"),
                    cancel: td("Cancel"),
                    submit: td("Save note"),
                    titleField: td("Title"),
                    titlePlaceholder: td("Optional title"),
                    detailsField: td("Details"),
                    bodyPlaceholder: td("Write your note…"),
                }}
            />

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
                    title: td("Create task"),
                    cancel: td("Cancel"),
                    submit: td("Create task"),
                    titleField: td("Title"),
                    titlePlaceholder: td("What needs to be done?"),
                    description: td("Description"),
                    descriptionPlaceholder: td("Optional details"),
                    startDate: td("Start date"),
                    dueDate: td("Due date"),
                    dueTime: td("Due time"),
                    priority: td("Priority"),
                    priorityHigh: td("High"),
                    priorityMedium: td("Medium"),
                    priorityLow: td("Low"),
                    assignees: td("Assignees"),
                    dateRangeError: td(
                        "Due date must be on or after start date",
                    ),
                }}
            />

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
                    null,
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
                            remark: form.remark,
                            reminders: form.reminders,
                        },
                        () => setAddMeetingOpen(false),
                    )
                }
                labels={{
                    title: td("Schedule meeting"),
                    cancel: td("Cancel"),
                    submit: td("Schedule"),
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
