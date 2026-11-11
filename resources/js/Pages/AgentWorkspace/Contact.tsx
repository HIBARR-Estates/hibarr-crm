import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Head, router, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentPillRow, AgentSecondRow, AgentWorkspaceLayout, agentPillPanelProps, useMinuteClock } from "@/Components/Redesign/agent";
import ConfirmDialog from "@/Components/Redesign/primitives/ConfirmDialog";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { getDossierFieldValue } from "@/Pages/Leads/Redesign/adapters/dossierAdapter";
import { canEditLead } from "@/Pages/Leads/Redesign/adapters/leadEditAccess";
import { resolveLifecycle } from "@/Pages/Leads/Redesign/adapters/lifecycleAdapter";
import EditLeadDetailsModal from "@/Pages/Leads/Redesign/components/qualification/EditLeadDetailsModal";
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
import { LEAD_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import type { Note } from "@/Types/api/note";
import ActivityCards, { type ActivityPermissions, type ActivitySource } from "./contact/ActivityCards";
import AiBriefStrip from "./contact/AiBriefStrip";
import ContactHeader, { leadPhone } from "./contact/ContactHeader";
import GoalPanel from "./contact/GoalPanel";
import KeyFacts from "./contact/KeyFacts";
import LeadStatusPath from "./contact/LeadStatusPath";
import { buildKeyFacts } from "./contact/model";
import { buildQualificationFact } from "./contact/qualificationFact";
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
    const dealCreate = useLeadDealCreate(lead);
    const deleteLead = useLeadDelete(lead);
    const duplicates = useLeadDuplicates(lead.id);

    const [createKind, setCreateKind] = useState<LeadCreateKind | null>(null);
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

    const keyFacts = useMemo(
        () => {
            const facts = buildKeyFacts(
                lead,
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
            );
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
        [companyCurrency, lead, qualification.current, qualification.templateTree, showQualification, t],
    );

    const hasLost = statuses.some((status) => status.key === "lost");
    const canMarkLost = canEdit && hasLost && lifecycle.statusKey !== "lost";

    const onMoreAction = (id: MoreMenuActionId) => {
        if (id === "task" || id === "note") setCreateKind(id);
        else if (id === "deal") mission.openCreateDeal();
        else if (id === "find_duplicates") void duplicates.findDuplicates();
        else if (id === "delete") deleteLead.requestDelete();
    };

    const name = lead.client_name || td("Lead", { source: "en" });
    const pills = [{ key: "lead" as const, label: t("pages.agent_workspace.contact.lead_pill", { status: td(lifecycle.statusLabel, { source: "en" }) }) }];

    return (
        <>
            <Head title={name} />
            <AgentSecondRow>
                <AgentPillRow
                    pills={pills}
                    active="lead"
                    onChange={() => {}}
                    ariaLabel={t("pages.agent_workspace.contact.views_aria")}
                    idPrefix="agent-contact"
                />
            </AgentSecondRow>

            <div
                className="lead-redesign agent-contact agent-deal"
                {...agentPillPanelProps("agent-contact", "lead")}
            >
                <div className="agent-deal__top">
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
                                    onEdit={() => setEditOpen(true)}
                                    onMoreAction={onMoreAction}
                                />
                            </div>
                            {showAiSummary ? (
                                <AiBriefStrip
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
                                    />
                                </div>
                            ) : null}
                            <LeadStatusPath
                                statuses={statuses}
                                currentKey={lifecycle.statusKey}
                                onMarkLost={canMarkLost ? () => setConfirmLost(true) : undefined}
                                saving={statusSaving}
                            />
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
                            />
                        </aside>
                    ) : null}
                </div>
            </div>

            <LeadCreateModals
                open={createKind}
                onClose={() => setCreateKind(null)}
                meetingTypes={props.meetingTypes ?? []}
                taskBoardColumns={props.taskBoardColumns ?? []}
                taskCategories={props.taskCategories ?? []}
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
                qualificationPlacement="under-dock"
            />
            {canEdit ? (
                <EditLeadDetailsModal
                    open={editOpen}
                    onClose={() => setEditOpen(false)}
                    lead={lead}
                    salutations={props.salutations ?? []}
                    ageRanges={props.ageRanges ?? []}
                    countries={props.countries ?? []}
                    sources={props.sources ?? []}
                    categories={props.categories ?? []}
                />
            ) : null}
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
        </>
    );
}

Contact.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
