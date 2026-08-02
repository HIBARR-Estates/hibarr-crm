import { useCallback, useMemo, useState } from "react";
import { Deferred, router, usePage } from "@inertiajs/react";
import PageLayout from "@/Components/PageLayout";
import {
    AddNoteModal,
    AddTaskModal,
    AgentPicker,
    ConfirmDialog,
    ScheduleMeetingModal,
} from "@/Components/Redesign";
import type { AddNoteFormState } from "@/Components/Redesign/modals/AddNoteModal";
import type { AddTaskFormState } from "@/Components/Redesign/modals/AddTaskModal";
import type { MeetingFormState } from "@/Components/Redesign/meeting/meetingFormUtils";
import { buildEmptyMeetingForm } from "@/Components/Redesign/meeting/meetingFormUtils";
import type { PageProps } from "@/Components/DashboardLayout";
import { useTd } from "@/Hooks/useDynamicTranslation";
import type { LeadRedesignProps } from "./types";
import type { LeadMissionCtaAction, WorkspaceTabId } from "./types";
import type { MoreMenuActionId } from "./config/moreMenuItems";
import { resolveLifecycle } from "./adapters/lifecycleAdapter";
import { getDossierFieldValue } from "./adapters/dossierAdapter";
import { toLeadTaskPreview } from "./adapters/taskAdapter";
import { itineraryCount } from "./adapters/itineraryAdapter";
import {
    LeadWorkspaceProvider,
    useLeadWorkspace,
} from "./context/LeadWorkspaceContext";
import useLeadViewNavigation from "./hooks/useLeadViewNavigation";
import useLeadQualificationWorkspace from "./hooks/useLeadQualificationWorkspace";
import useLeadLifecycleChange from "./hooks/useLeadLifecycleChange";
import useLeadOwnerReassign from "./hooks/useLeadOwnerReassign";
import useLeadDelete from "./hooks/useLeadDelete";
import useLeadDealCreate from "./hooks/useLeadDealCreate";
import useLeadNoteCreate from "./hooks/useLeadNoteCreate";
import useLeadTaskCreate from "./hooks/useLeadTaskCreate";
import useLeadMeetingCreate from "./hooks/useLeadMeetingCreate";
import LeadHeaderRoot from "./components/header/LeadHeaderRoot";
import AiSummaryCard from "./components/workspace/AiSummaryCard";
import QuickStats from "./components/workspace/QuickStats";
import WorkspaceCard from "./components/workspace/WorkspaceCard";
import LeadDossier from "./components/dossier/LeadDossier";
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
import TemplatePickerModal from "./components/qualification/TemplatePickerModal";
import QualifyModal from "./components/qualification/QualifyModal";
import AnswersReviewModal from "./components/qualification/AnswersReviewModal";
import EditLeadDetailsModal from "./components/qualification/EditLeadDetailsModal";
import CreateDealModal from "./components/dealCreate/CreateDealModal";
import "@/Components/Redesign/redesign.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "./lead-redesign.css";

function WorkspaceDeferredSkeleton() {
    return (
        <div className="v2-workspace" style={{ padding: 24 }}>
            <div
                style={{
                    height: 36,
                    background: "#eef0f3",
                    borderRadius: 8,
                    marginBottom: 16,
                }}
            />
            <div
                style={{
                    height: 120,
                    background: "#f8f9fb",
                    borderRadius: 10,
                }}
            />
        </div>
    );
}

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
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;
    const showQualification =
        featureFlags?.["crm.lead-qualification-tab"] === true;

    const {
        lead,
        deals,
        notesLoading,
        tasksLoading,
        leadFollowUpsLoading,
        leadFollowUps,
        tasks,
        notes,
        addNote,
        addTask,
    } = useLeadWorkspace();

    const nav = useLeadViewNavigation(props.customFieldCategories);

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
            })),
        [props.leadLifecycleStatuses],
    );

    const { changeStatus, saving: statusSaving } =
        useLeadLifecycleChange(lifecycleStatuses);
    const { reassign, pendingAgentId, saving: reassignSaving } =
        useLeadOwnerReassign();
    const deleteLead = useLeadDelete(lead);
    const dealCreate = useLeadDealCreate(lead);
    const { createNote, isSaving: noteSaving, errors: noteErrors, clearErrors: clearNoteErrors } =
        useLeadNoteCreate(lead.id);
    const { createTask, isCreating: taskCreating, errors: taskErrors, clearErrors: clearTaskErrors } =
        useLeadTaskCreate(lead.id);
    const { createMeeting, isCreating: meetingCreating, errors: meetingErrors, clearErrors: clearMeetingErrors } =
        useLeadMeetingCreate(lead);

    const qualification = useLeadQualificationWorkspace(lead, {
        enabled: showQualification,
        seed: props.leadQualification ?? null,
    });

    const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
    const [editLeadOpen, setEditLeadOpen] = useState(false);
    const [createDealOpen, setCreateDealOpen] = useState(false);
    const [reassignOpen, setReassignOpen] = useState(false);
    const [addNoteOpen, setAddNoteOpen] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);

    const firstName = useMemo(() => {
        const parts = (lead.client_name ?? "").trim().split(/\s+/);
        return parts[0] || lead.client_name || "Lead";
    }, [lead.client_name]);

    const valueLabel = useMemo(() => {
        const value = getDossierFieldValue(lead, "leadValue");
        const currency = getDossierFieldValue(lead, "currency");
        if (!value.trim()) return null;
        return currency ? `${currency} ${value}` : value;
    }, [lead]);

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

    const tabCounts = useMemo((): Partial<Record<WorkspaceTabId, number>> => {
        const itineraryLegs = deals.flatMap(
            (d) => d.lead_flight_itineraries ?? [],
        );
        return {
            notes: notes.length,
            tasks: tasks.filter((t) => toLeadTaskPreview(t).isOpen).length,
            meetings: leadFollowUps.length,
            deals: deals.length,
            itinerary: itineraryCount(itineraryLegs),
            files: 0,
        };
    }, [deals, leadFollowUps.length, notes.length, tasks]);

    const openTasksCount = tabCounts.tasks ?? 0;
    const nextMeetingLabel = useMemo(() => {
        const upcoming = [...leadFollowUps]
            .filter((f) => f.status !== "completed")
            .sort(
                (a, b) =>
                    new Date(a.next_follow_up_date).getTime() -
                    new Date(b.next_follow_up_date).getTime(),
            )[0];
        return upcoming?.next_follow_up_date
            ? String(upcoming.next_follow_up_date)
            : undefined;
    }, [leadFollowUps]);

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
                    const first = deals[0];
                    if (first?.id) {
                        router.visit(route("deals.show", first.id));
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
        [changeStatus, deals, nav],
    );

    const handleBannerPrimary = useCallback(() => {
        handleMissionAction(lifecycle.banner.primaryCta.action);
    }, [handleMissionAction, lifecycle.banner.primaryCta.action]);

    const handleBannerViewAnswers = useCallback(() => {
        const action = lifecycle.banner.secondaryCta?.action;
        if (action) handleMissionAction(action);
    }, [handleMissionAction, lifecycle.banner.secondaryCta?.action]);

    const handleMoreAction = useCallback(
        (id: MoreMenuActionId) => {
            switch (id) {
                case "answers":
                    nav.setAnswersOpen(true);
                    break;
                case "edit":
                    setEditLeadOpen(true);
                    break;
                case "reassign":
                    setReassignOpen(true);
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
                case "delete":
                    deleteLead.requestDelete();
                    break;
                default:
                    break;
            }
        },
        [deleteLead, nav],
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
        if (
            nav.tab === "overview" &&
            (notesLoading || tasksLoading || leadFollowUpsLoading)
        ) {
            return (
                <p style={{ margin: 0, fontSize: 13, color: "#9ca3af" }}>
                    {td("Loading workspace…")}
                </p>
            );
        }

        switch (nav.tab) {
            case "overview":
                return (
                    <OverviewTab
                        meetingTypes={props.meetingTypes ?? []}
                        taskBoardColumns={props.taskBoardColumns ?? []}
                        permissions={{
                            notes: props.notePermissions,
                            tasks: props.taskPermissions ?? props.permissions,
                            followUps: props.followUpPermissions,
                        }}
                        onNavigateTab={nav.setTab}
                        onAddNote={() => setAddNoteOpen(true)}
                        onAddTask={() => setAddTaskOpen(true)}
                        onAddMeeting={() => setAddMeetingOpen(true)}
                    />
                );
            case "notes":
                return notesLoading ? (
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        {td("Loading notes…")}
                    </p>
                ) : (
                    <NotesTab permissions={props.notePermissions} />
                );
            case "tasks":
                return tasksLoading ? (
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        {td("Loading tasks…")}
                    </p>
                ) : (
                    <TasksTab
                        taskBoardColumns={props.taskBoardColumns ?? []}
                        permissions={props.taskPermissions ?? props.permissions}
                        onAddTask={() => setAddTaskOpen(true)}
                    />
                );
            case "meetings":
                return leadFollowUpsLoading ? (
                    <p style={{ margin: 0, color: "#9ca3af", fontSize: 13 }}>
                        {td("Loading meetings…")}
                    </p>
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
                    />
                );
            case "itinerary":
                return (
                    <ItineraryTab onCreateDeal={() => setCreateDealOpen(true)} />
                );
            case "timeline":
                return (
                    <TimelineTab
                        leadId={lead.id}
                        leadName={lead.client_name}
                        userId={page.props.auth?.user?.id}
                    />
                );
            case "files":
                return <FilesTab />;
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
        <PageLayout title={pageTitle}>
            <div className="lead-redesign">
                <div className="v2-page">
                    <div
                        style={{
                            maxWidth: 1180,
                            margin: "0 auto",
                            padding: "16px 20px 32px",
                        }}
                    >
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
                            onStatusChange={(key) => void changeStatus(key)}
                            statusSaving={statusSaving}
                            onOpenAnswers={() => nav.setAnswersOpen(true)}
                            onMoreAction={handleMoreAction}
                            onBannerPrimary={handleBannerPrimary}
                            onBannerViewAnswers={
                                lifecycle.banner.secondaryCta
                                    ? handleBannerViewAnswers
                                    : undefined
                            }
                        />

                        <div className="v2-grid">
                            <div>
                                {showAiSummary && (
                                    <AiSummaryCard
                                        leadId={lead.id}
                                        summary={props.leadAiSummary}
                                        leadPhone={lead.mobile ?? lead.cell ?? undefined}
                                        onCta={{
                                            onQualifyLead: () =>
                                                setTemplatePickerOpen(true),
                                            onCreateTask: () => setAddTaskOpen(true),
                                            onScheduleCall: () =>
                                                setAddMeetingOpen(true),
                                        }}
                                    />
                                )}

                                <QuickStats
                                    nextMeetingLabel={nextMeetingLabel}
                                    openTasksCount={openTasksCount}
                                    dealsCount={deals.length}
                                    onSchedule={() => setAddMeetingOpen(true)}
                                    onCreateTask={() => setAddTaskOpen(true)}
                                    onCreateDeal={() => setCreateDealOpen(true)}
                                />

                                <Deferred
                                    data={["notes", "tasks", "leadFollowUps"]}
                                    fallback={<WorkspaceDeferredSkeleton />}
                                >
                                    <WorkspaceCard
                                        activeTab={nav.tab}
                                        onTabChange={nav.setTab}
                                        tabCounts={tabCounts}
                                    >
                                        {renderTabBody()}
                                    </WorkspaceCard>
                                </Deferred>
                            </div>

                            <LeadDossier lead={lead} />
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
                                    nav.setQualificationOpen(false);
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

            <EditLeadDetailsModal
                open={editLeadOpen}
                onClose={() => setEditLeadOpen(false)}
                lead={lead}
                salutations={props.salutations ?? []}
                countries={props.countries ?? []}
                sources={props.sources ?? []}
                categories={props.categories ?? []}
            />

            <CreateDealModal
                open={createDealOpen}
                onClose={() => {
                    setCreateDealOpen(false);
                    dealCreate.clearErrors();
                }}
                saving={dealCreate.isCreating}
                errors={dealCreate.errors}
                defaultAgentId={
                    (lead as { agent_id?: number }).agent_id ??
                    lead.lead_owner?.id ??
                    null
                }
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
                        if (input.addKickoffMeeting) {
                            router.reload({ only: ["leadFollowUps"] });
                        }
                    })
                }
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
                    createNote({ text: form.text || form.title }, (note) => {
                        addNote(note);
                        setAddNoteOpen(false);
                    })
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

            {reassignOpen && (
                <div
                    className="modal-overlay redesign-modal-overlay"
                    onClick={() => !reassignSaving && setReassignOpen(false)}
                    role="presentation"
                >
                    <div
                        className="modal-panel"
                        style={{ maxWidth: 360 }}
                        onClick={(e) => e.stopPropagation()}
                        role="dialog"
                        aria-modal="true"
                        aria-label={td("Reassign owner")}
                    >
                        <div style={{ padding: "16px 18px" }}>
                            <h3 style={{ margin: "0 0 12px", fontSize: 15 }}>
                                {td("Reassign owner")}
                            </h3>
                            <AgentPicker
                                autoFocus
                                pendingId={pendingAgentId}
                                onPick={(agent) => {
                                    void reassign(agent).then(() =>
                                        setReassignOpen(false),
                                    );
                                }}
                            />
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog {...deleteLead.dialogProps} />
        </PageLayout>
    );
}
