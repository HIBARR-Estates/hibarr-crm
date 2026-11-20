import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { MenuProps } from "antd";
import { Head, router, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentPillRow, AgentRelatedRecord, AgentSecondRow, AgentWorkspaceLayout, agentPillPanelProps, useMinuteClock } from "@/Components/Redesign/agent";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { getDossierFieldValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import { canEditLead } from "@/Pages/Leads/Redesign/adapters/leadEditAccess";
import { resolveLifecycle } from "@/Pages/Leads/Redesign/adapters/lifecycleAdapter";
import { useResumeQualificationRequest } from "@/Components/Redesign/agent/call/agentCallBridge";
import LeadMissionModals from "@/Pages/Leads/Redesign/components/qualification/LeadMissionModals";
import DuplicateLeadsCard from "@/Pages/Leads/Redesign/components/workspace/DuplicateLeadsCard";
import LeadCreateModals, { type LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import LeadMeetingDetailModal from "@/Pages/Leads/Redesign/components/workspace/LeadMeetingDetailModal";
import LeadNoteDetailModal from "@/Pages/Leads/Redesign/components/workspace/LeadNoteDetailModal";
import LeadTaskDetailModal from "@/Pages/Leads/Redesign/components/workspace/LeadTaskDetailModal";
import type { MoreMenuActionId } from "@/Pages/Leads/Redesign/config/moreMenuItems";
import { LeadWorkspaceProvider, useLeadWorkspace } from "@/Pages/Leads/Redesign/context/LeadWorkspaceContext";
import useLeadDealCreate from "@/Pages/Leads/Redesign/hooks/useLeadDealCreate";
import useLeadDelete from "@/Pages/Leads/Redesign/hooks/useLeadDelete";
import useLeadDuplicates from "@/Pages/Leads/Redesign/hooks/useLeadDuplicates";
import useLeadLifecycleChange from "@/Pages/Leads/Redesign/hooks/useLeadLifecycleChange";
import useLeadMissionFlow from "@/Pages/Leads/Redesign/hooks/useLeadMissionFlow";
import useLeadQualificationWorkspace from "@/Pages/Leads/Redesign/hooks/useLeadQualificationWorkspace";
import type { LeadRedesignProps } from "@/Pages/Leads/Redesign/types";
import useDealTimeline, { LEAD_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import HistorySection from "./deal/sections/HistorySection";
import MarketingSection from "./deal/sections/MarketingSection";
import QualificationSection from "./deal/sections/QualificationSection";
import type { Note } from "@/Types/api/note";
import LeadEditPage from "./edit/LeadEditPage";
import AgentTaskModal from "./tasks/AgentTaskModal";
import useAgentTaskCreate from "./tasks/useAgentTaskCreate";
import { patchTaskListExtrasCounts } from "@/Pages/Tasks/Redesign/adapters/taskFormSubmitAdapter";
import type { TaskLinkRef } from "@/Pages/Tasks/Redesign/adapters/taskFormValues";
import type { Task as WorkspaceTask } from "@/Types/Task";
import useAgentMerge from "./contact/useAgentMerge";
import type { EditOptions } from "./edit/leadEditForm";
import ActivityCards, { type ActivityPermissions, type ActivitySource } from "./contact/ActivityCards";
import AiSummaryPanel from "./contact/AiSummaryPanel";
import LeadFilesSection from "./contact/LeadFilesSection";
import { NewActivityProvider } from "./contact/NewActivityContext";
import ContactHeader, { leadPhone } from "./contact/ContactHeader";
import BookingBanner, { BookingPendingRow } from "./contact/BookingBanner";
import { bookingPendingOf, firstNameOf } from "./contact/bookingPending";
import GoalPanel from "./contact/GoalPanel";
import KeyFacts from "./contact/KeyFacts";
import { LeadPathSteps } from "./contact/LeadStatusPath";
import StatusBar, { StatusMenuLabel } from "./contact/StatusBar";
import { buildKeyFacts, buildLeadPath } from "./contact/model";
import useKeyFactLabels from "./contact/useKeyFactLabels";
import { buildQualificationFact } from "./contact/qualificationFact";
import { wantsNextStep } from "./donext/doNext";
import useDoNext, { DoNext } from "./donext/useDoNext";
import "@/Components/Redesign/redesign.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "@/Pages/Leads/Redesign/lead-redesign.css";
import "./contact/contact.css";
import "./deal/deal.css";

const allowed = (permissions: Record<string, string> | undefined, key: string) =>
    !permissions || (permissions[key] ?? "none") !== "none";

/**
 * The agent workspace's page for one person, in its lead state (canvas
 * L7-05): who they are and how to reach them, the lifecycle path, the AI
 * summary, key facts, then what's coming up, the last touches and notes,
 * with the next goal on the right.
 *
 * It runs on the lead page's own props (LeadContactController::agentShow),
 * context and hooks, so every edit patches local state and nothing reloads.
 */
export default function Contact(props: LeadRedesignProps) {
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;

    return (
        <LeadWorkspaceProvider
            lead={props.lead}
            notes={props.notes}
            tasks={props.tasks}
            leadFollowUps={props.leadFollowUps}
            deals={props.deals}
            sallyInsightsEnabled={featureFlags?.["crm.sally-insights-tab"] === true}
        >
            <ContactLead {...props} />
        </LeadWorkspaceProvider>
    );
}

function ContactLead(props: LeadRedesignProps) {
    const { t } = useTranslation();
    const { td } = useTd();
    const page = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? page.props.featureFlags;
    const showQualification = featureFlags?.["crm.lead-qualification-tab"] === true;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;
    const viewerId = page.props.auth?.user?.id;
    const { timezone } = useUserDateTime();
    const nowMs = useMinuteClock();
    const companyCurrency = useCompanyCurrency();

    const { lead, deals, notes, tasks, leadFollowUps, notesLoading, tasksLoading, leadFollowUpsLoading } = useLeadWorkspace();
    const activitySource: ActivitySource = {
        tasks,
        tasksLoading,
        meetings: leadFollowUps,
        meetingsLoading: leadFollowUpsLoading,
        // Lead notes carry the same fields the notes card reads.
        notes: notes as unknown as Note[],
        notesLoading,
        timelineId: lead.id,
        timelineModelType: LEAD_TIMELINE_MODEL_TYPE,
    };

    const statuses = useMemo(
        () =>
            (props.leadLifecycleStatuses ?? []).map((status) => ({
                id: status.id,
                key: status.key,
                label: status.label,
                label_color: status.label_color ?? null,
            })),
        [props.leadLifecycleStatuses],
    );
    const lifecycle = useMemo(() => resolveLifecycle(lead, props.leadLifecycleStatuses), [lead, props.leadLifecycleStatuses]);
    const { changeStatus, saving: statusSaving } = useLeadLifecycleChange(statuses);

    const qualification = useLeadQualificationWorkspace(lead, {
        enabled: showQualification,
        seed: props.leadQualification ?? null,
    });
    const [qualificationOpen, setQualificationOpen] = useState(false);
    // A person with a deal is shown in the deal's state, so deals open there.
    const dealHref = useCallback((dealId: number) => route("agent.people.deal", { lead: lead.id, deal: dealId }), [lead.id]);
    const mission = useLeadMissionFlow({ qualification, deals, changeStatus, setQualificationOpen, dealHref });
    // Booking pending (canvas L7-26): qualified, the consultation link went out
    // at the wrap-up, and no deal yet. The booking's webhook creates the deal.
    const booking = useMemo(
        () =>
            showQualification && lifecycle.bannerMode === "qualified" && deals.length === 0
                ? bookingPendingOf(qualification.current)
                : null,
        [deals.length, lifecycle.bannerMode, qualification.current, showQualification],
    );
    // "Continue qualification" on the call card, from any page, lands here and opens the running one.
    // The page opens first; the qualification follows a frame later (canvas L8).
    const resumeRequest = useResumeQualificationRequest(lead.id);
    const [resumePending, setResumePending] = useState(false);
    useEffect(() => {
        if (!resumeRequest.requested) return;
        resumeRequest.consume();
        if (showQualification) setResumePending(true);
    }, [resumeRequest, showQualification]);
    useEffect(() => {
        if (!resumePending) return undefined;
        let second = 0;
        const first = window.requestAnimationFrame(() => {
            second = window.requestAnimationFrame(() => {
                setResumePending(false);
                mission.handleMissionAction("qualify_resume");
            });
        });
        return () => {
            window.cancelAnimationFrame(first);
            window.cancelAnimationFrame(second);
        };
    }, [mission, resumePending]);
    const dealCreate = useLeadDealCreate(lead);
    // "+ New deal" on a deal page lands here with ?new_deal=1 (the page
    // otherwise redirects to the first deal): open the form straight away,
    // and go back to that deal if the agent cancels.
    const [newDealFromDeal, setNewDealFromDeal] = useState(
        () => typeof window !== "undefined" && new URLSearchParams(window.location.search).get("new_deal") === "1",
    );
    useEffect(() => {
        if (!newDealFromDeal) return;
        mission.openCreateDeal();
        const url = new URL(window.location.href);
        url.searchParams.delete("new_deal");
        window.history.replaceState(window.history.state, "", url.toString());
        // eslint-disable-next-line react-hooks/exhaustive-deps -- once, on arrival
    }, []);
    const canStartDeal = lifecycle.statusKey === "qualified" || newDealFromDeal;
    const deleteLead = useLeadDelete(lead);
    const duplicates = useLeadDuplicates(lead.id);
    const afterMerge = useAgentMerge(lead.id);

    const [createKind, setCreateKind] = useState<LeadCreateKind | null>(null);

    // Add task (L7-33), linked to this person.
    const { addTask, setTasks, addLeadFollowUp } = useLeadWorkspace();
    const taskLinks = useMemo<TaskLinkRef[]>(() => [{ type: "lead", id: lead.id, name: lead.client_name ?? "" }], [lead.id, lead.client_name]);
    const taskCreate = useAgentTaskCreate({
        onCreated: (task) => {
            if (task) addTask(task as unknown as Parameters<typeof addTask>[0]);
            setCreateKind(null);
        },
        onExtras: (task, result) =>
            setTasks((prev) => patchTaskListExtrasCounts(prev as unknown as WorkspaceTask[], task.id, result) as unknown as typeof prev),
    });
    const closeTask = () => {
        if (taskCreate.saving) return;
        taskCreate.clearErrors();
        setCreateKind(null);
    };
    const [editOpen, setEditOpen] = useState(false);
    const [confirmLost, setConfirmLost] = useState(false);
    const [openTaskId, setOpenTaskId] = useState<number | null>(null);
    const [openMeetingId, setOpenMeetingId] = useState<number | null>(null);
    const [openNoteId, setOpenNoteId] = useState<number | null>(null);

    const canEdit = canEditLead(props.editLeadPermission, lead, viewerId);
    const taskPermissions = props.taskPermissions ?? props.permissions;
    const activityPermissions: ActivityPermissions = {
        viewNotes: allowed(props.notePermissions, "view_lead_note"),
        viewTasks: allowed(taskPermissions, "view_tasks"),
        viewMeetings: allowed(props.followUpPermissions, "view_lead_follow_up"),
        create: {
            task: allowed(taskPermissions, "add_tasks"),
            meeting: allowed(props.followUpPermissions, "add_lead_follow_up"),
            note: allowed(props.notePermissions, "add_lead_note"),
        },
    };

    // Do next from an empty Coming up (L7-47): only while the lead keeps a
    // next step, which ends once it is qualified (its deal takes over).
    const doNext = useDoNext();
    const doNextRecord = useMemo(
        () => ({
            type: "lead" as const,
            id: lead.id,
            name: lead.client_name ?? "",
            person: lead.client_name ?? null,
            status: lifecycle.statusLabel,
            status_key: lifecycle.statusKey,
        }),
        [lead.id, lead.client_name, lifecycle.statusLabel, lifecycle.statusKey],
    );
    const canDoNext = activityPermissions.create.task && wantsNextStep(doNextRecord);

    const keyFactLabels = useKeyFactLabels();
    const keyFacts = useMemo(
        () => {
            const facts = buildKeyFacts(lead, keyFactLabels, companyCurrency);
            // The qualification's progress sits before where they came from.
            const progress = showQualification
                ? buildQualificationFact(qualification.templateTree, qualification.current, {
                      answered: (answered, total) => t("pages.agent_workspace.contact.facts.qualification_answered", { answered, total }),
                      next: (step) => t("pages.agent_workspace.contact.facts.qualification_next", { step }),
                      complete: t("pages.agent_workspace.contact.facts.qualification_complete"),
                  })
                : null;
            if (!progress) return facts;
            const at = facts.findIndex((group) => group.id === "came_from");
            return at < 0 ? [...facts, progress] : [...facts.slice(0, at), progress, ...facts.slice(at)];
        },
        [companyCurrency, keyFactLabels, lead, qualification.current, qualification.templateTree, showQualification, t],
    );

    const editOptions = useMemo<EditOptions>(
        () => ({
            salutations: props.salutations ?? [],
            ageRanges: props.ageRanges ?? [],
            countries: props.countries ?? [],
            sources: props.sources ?? [],
            categories: props.categories ?? [],
        }),
        [props.ageRanges, props.categories, props.countries, props.salutations, props.sources],
    );
    const editing = canEdit && editOpen;
    const openEdit = useCallback(() => {
        setEditOpen(true);
        window.scrollTo({ top: 0 });
    }, []);

    const hasLost = statuses.some((status) => status.key === "lost");
    const canMarkLost = canEdit && hasLost && lifecycle.statusKey !== "lost";

    // The status menu (canvas L8-02): the path, Qualified set only by the
    // qualification outcome, the other statuses, then Mark as lost.
    const path = useMemo(() => buildLeadPath(statuses, lifecycle.statusKey), [lifecycle.statusKey, statuses]);
    const statusMenu: MenuProps["items"] = canEdit
        ? [
              {
                  type: "group",
                  key: "path",
                  label: t("pages.agent_workspace.contact.status.on_path"),
                  children: path.steps.map((step) => {
                      const current = step.key === lifecycle.statusKey;
                      const qualified = step.key === "qualified";
                      return {
                          key: step.key,
                          disabled: current || qualified,
                          label: (
                              <StatusMenuLabel
                                  name={td(step.label, { source: "en" })}
                                  current={current}
                                  sub={current ? t("pages.agent_workspace.contact.status.current") : qualified ? t("pages.agent_workspace.contact.status.qualified_by_outcome") : undefined}
                              />
                          ),
                      };
                  }),
              },
              ...(path.offPath.some((status) => status.key !== "lost")
                  ? [
                        { type: "divider" as const, key: "d1" },
                        {
                            type: "group" as const,
                            key: "off",
                            label: t("pages.agent_workspace.contact.status.off_path"),
                            children: path.offPath
                                .filter((status) => status.key !== "lost")
                                .map((status) => ({
                                    key: status.key,
                                    disabled: status.current,
                                    label: <StatusMenuLabel name={td(status.label, { source: "en" })} current={status.current} />,
                                })),
                        },
                    ]
                  : []),
              ...(canMarkLost
                  ? [
                        { type: "divider" as const, key: "d2" },
                        {
                            key: "lost",
                            danger: true,
                            label: <StatusMenuLabel name={t("pages.agent_workspace.contact.status.mark_lost_menu")} sub={t("pages.agent_workspace.contact.status.mark_lost_sub")} />,
                        },
                    ]
                  : []),
          ]
        : [];
    const onStatusSelect = (key: string) => {
        if (key === "lost") setConfirmLost(true);
        else void changeStatus(key);
    };
    const timeline = useDealTimeline(lead.id, LEAD_TIMELINE_MODEL_TYPE);

    const onMoreAction = (id: MoreMenuActionId) => {
        if (id === "task" || id === "note") setCreateKind(id);
        else if (id === "deal") mission.openCreateDeal();
        else if (id === "find_duplicates") void duplicates.findDuplicates();
        else if (id === "delete") deleteLead.requestDelete();
    };

    const name = lead.client_name || td("Lead", { source: "en" });
    const pills = [{ key: "lead" as const, label: t("pages.agent_workspace.contact.lead_pill", { status: td(lifecycle.statusLabel, { source: "en" }) }) }];

    const newActivityScope = useMemo(
        () => ({ person: lead.client_name ?? "", deal: null, meetingTypes: (props.meetingTypes ?? []).map((type) => type.name) }),
        [lead.client_name, props.meetingTypes],
    );

    return (
        <NewActivityProvider value={newActivityScope}>
            <Head title={name} />
            <AgentSecondRow>
                <AgentPillRow
                    pills={pills}
                    active="lead"
                    onChange={() => {}}
                    ariaLabel={t("pages.agent_workspace.contact.views_aria")}
                    idPrefix="agent-contact"
                    trailing={
                        canStartDeal ? (
                            <button type="button" className="agent-pills__pill agent-pills__pill--new" onClick={mission.openCreateDeal}>
                                + {t("pages.agent_workspace.contact.new_deal")}
                            </button>
                        ) : undefined
                    }
                />
            </AgentSecondRow>

            {editing ? (
                <div {...agentPillPanelProps("agent-contact", "lead")}>
                    <LeadEditPage
                        options={editOptions}
                        statusLabel={lifecycle.statusLabel}
                        duplicates={duplicates}
                        onMergedInto={afterMerge}
                        onClose={() => setEditOpen(false)}
                    />
                </div>
            ) : (
            <div
                className="lead-redesign agent-contact agent-deal"
                {...agentPillPanelProps("agent-contact", "lead")}
            >
                <div className={`agent-deal__top${showQualification ? "" : " agent-deal__top--solo"}`}>
                    <div className="agent-deal__main">
                        <section className="agent-deal__card">
                            <div className="agent-deal__head">
                                <ContactHeader
                                    lead={lead}
                                    canEdit={canEdit}
                                    canDelete={props.deleteLeadPermission !== "none"}
                                    canFindDuplicates={duplicates.canMerge}
                                    onCreate={setCreateKind}
                                    allowedCreate={activityPermissions.create}
                                    onEdit={openEdit}
                                    onMoreAction={onMoreAction}
                                />
                            </div>
                            {booking ? <BookingBanner pending={booking} name={firstNameOf(lead.client_name)} nowMs={nowMs} timeZone={timezone} /> : null}
                            <StatusBar
                                label={t("pages.agent_workspace.contact.status.title")}
                                note={t("pages.agent_workspace.contact.status.note")}
                                menuLabel={t("pages.agent_workspace.contact.status.menu")}
                                menuItems={statusMenu}
                                onMenuSelect={onStatusSelect}
                                busy={statusSaving}
                            >
                                <LeadPathSteps statuses={statuses} currentKey={lifecycle.statusKey} />
                            </StatusBar>
                            {showAiSummary ? (
                                <AiSummaryPanel
                                    entityType="lead"
                                    entityId={lead.id}
                                    initialSummary={props.leadAiSummary}
                                    leadName={lead.client_name}
                                    leadPhone={leadPhone(lead)}
                                    onQualifyLead={showQualification ? mission.openTemplatePicker : undefined}
                                    onCreateTask={() => setCreateKind("task")}
                                    onScheduleCall={() => setCreateKind("meeting")}
                                />
                            ) : null}
                            {duplicates.visible ? (
                                <div className="agent-contact__section">
                                    <DuplicateLeadsCard
                                        leadId={lead.id}
                                        duplicates={duplicates.duplicates}
                                        isLoading={duplicates.isLoading}
                                        onDismiss={duplicates.dismiss}
                                        onMerged={() => void duplicates.invalidate()}
                                        onMergedInto={afterMerge}
                                        variant="agent"
                                    />
                                </div>
                            ) : null}
                            <KeyFacts groups={keyFacts} />
                        </section>

                        <div className="agent-deal__activity">
                            <ActivityCards
                                source={activitySource}
                                nowMs={nowMs}
                                timeZone={timezone}
                                permissions={activityPermissions}
                                onCreate={setCreateKind}
                                onOpenTask={setOpenTaskId}
                                onOpenMeeting={setOpenMeetingId}
                                onOpenNote={setOpenNoteId}
                                comingUpPinned={booking ? <BookingPendingRow name={firstNameOf(lead.client_name)} /> : undefined}
                                onDoNext={canDoNext ? (anchor) => doNext.offer({ record: doNextRecord, anchor }) : undefined}
                            />
                        </div>
                    </div>

                    {showQualification ? (
                        <aside className="agent-deal__rail">
                            <GoalPanel
                                lead={lead}
                                lifecycle={lifecycle}
                                qualification={qualification}
                                busy={qualification.isStartingFlow || qualification.resumingId != null}
                                onAction={mission.handleMissionAction}
                                booking={booking}
                                nowMs={nowMs}
                                timeZone={timezone}
                            />
                        </aside>
                    ) : null}
                </div>

                <div className="agent-deal__sections agent-deal__sections--lead">
                    {showQualification ? <QualificationSection leadId={lead.id} enabled /> : null}
                    <LeadFilesSection canUpload={canEdit} />
                    <MarketingSection marketing={lead.marketing} />
                    <HistorySection recordId={lead.id} recordType="lead" timeline={timeline} emailEnabled={false} onOpenEmailMessage={() => undefined} />
                </div>
            </div>
            )}

            <AgentTaskModal
                open={createKind === "task"}
                onClose={closeTask}
                onSubmit={taskCreate.submit}
                saving={taskCreate.saving}
                errors={taskCreate.errors}
                columns={props.taskBoardColumns ?? []}
                categories={props.taskCategories ?? []}
                lockedLinks={taskLinks}
                subtitle={t("pages.agent_workspace.task_form.subtitle_lead", { name: lead.client_name ?? "" })}
            />
            <LeadCreateModals
                open={createKind === "task" ? null : createKind}
                onClose={() => setCreateKind(null)}
                meetingTypes={props.meetingTypes ?? []}
                taskBoardColumns={props.taskBoardColumns ?? []}
                taskCategories={props.taskCategories ?? []}
                meetingAgent={{
                    subtitle: lead.client_name ?? "",
                    closeLabel: t("pages.agent_workspace.meeting_form.close"),
                    relatedField: (
                        <AgentRelatedRecord
                            kind="lead"
                            label={t("pages.agent_workspace.meeting_form.related")}
                            name={lead.client_name ?? ""}
                            hint={t("pages.agent_workspace.meeting_form.from_lead")}
                        />
                    ),
                }}
            />
            <LeadMissionModals
                flow={mission}
                qualification={qualification}
                dealCreate={dealCreate}
                showQualification={showQualification}
                qualificationOpen={qualificationOpen}
                onCloseQualification={() => setQualificationOpen(false)}
                pageProps={props}
                onDealCreated={(deal) => router.visit(dealHref(deal.id))}
                createDealAgent={{
                    subtitle: [lead.client_name, t("pages.agent_workspace.contact.lead_pill", { status: td(lifecycle.statusLabel, { source: "en" }) })]
                        .filter(Boolean)
                        .join(" · "),
                }}
                onCreateDealCancelled={() => {
                    if (!newDealFromDeal) return;
                    setNewDealFromDeal(false);
                    window.history.back();
                }}
                qualificationPlacement="under-dock"
            />
            <DoNext
                request={doNext.request}
                onClose={doNext.close}
                onSaved={(saved) => {
                    doNext.close();
                    if (saved.kind === "task" && saved.task) addTask(saved.task as unknown as Parameters<typeof addTask>[0]);
                    if (saved.kind === "meeting" && saved.meeting) addLeadFollowUp(saved.meeting);
                }}
                onAllMeetingFields={() => setCreateKind("meeting")}
            />
            <LeadTaskDetailModal
                task={tasks.find((task) => task.id === openTaskId) ?? null}
                taskBoardColumns={props.taskBoardColumns ?? []}
                permissions={taskPermissions}
                onClose={() => setOpenTaskId(null)}
            />
            <LeadMeetingDetailModal
                meeting={leadFollowUps.find((meeting) => meeting.id === openMeetingId) ?? null}
                meetingTypes={props.meetingTypes ?? []}
                permissions={props.followUpPermissions}
                onClose={() => setOpenMeetingId(null)}
            />
            <LeadNoteDetailModal
                note={notes.find((note) => note.id === openNoteId) ?? null}
                permissions={props.notePermissions}
                onClose={() => setOpenNoteId(null)}
            />
            <ConfirmDialog
                open={confirmLost}
                title={t("pages.agent_workspace.contact.status.lost_title", { name })}
                message={t("pages.agent_workspace.contact.status.lost_message")}
                confirmLabel={t("pages.agent_workspace.contact.status.mark_lost")}
                cancelLabel={t("app.cancel")}
                danger
                onConfirm={() => {
                    setConfirmLost(false);
                    void changeStatus("lost");
                }}
                onCancel={() => setConfirmLost(false)}
            />
            <ConfirmDialog {...deleteLead.dialogProps} />
        </NewActivityProvider>
    );
}

Contact.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
