import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Head, usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import { AgentLinkPills, AgentSecondRow, AgentWorkspaceLayout, useMinuteClock } from "@/Components/Redesign/agent";
import { initialsFromName } from "@/Components/Redesign";
import Icon from "@/Components/Redesign/primitives/Icon";
import { REDESIGN_TOKENS } from "@/Components/Redesign/tokens";
import LogActionModal from "@/Components/CrmEvents/LogActionModal";
import CommunicationModal from "@/Email/CommunicationModal";
import { subscribeOpenSourceEmail } from "@/Email/openSourceEmail";
import type { EmailFollowUpKind, EmailQuickAction } from "@/Email/types";
import { DEAL_EXPOSES_FLAG } from "@/Hooks/useDealExposesFlag";
import { useTd } from "@/Hooks/useDynamicTranslation";
import useTranslation from "@/Hooks/useTranslation";
import { useUserDateTime } from "@/Hooks/useUserDateTime";
import { resolveDealOutcome } from "@/lib/dealOutcome";
import { setDealDateLocale } from "@/Pages/Deals/Redesign/adapters/dateFormat";
import { isDealEffectivelyLocked } from "@/lib/dealOutcome";
import { buildRailGroups } from "@/Pages/Deals/Redesign/components/analysis/analysisRailItems";
import DealAnalysisModal from "@/Pages/Deals/Redesign/components/analysis/DealAnalysisModal";
import DealPipelineStepper, { normalizeFieldKey, resolveSectionForField } from "@/Pages/Deals/Redesign/components/header/DealPipelineStepper";
import type { StageRequirementCondition } from "@/Pages/Deals/Redesign/adapters/stageRequirementEvaluator";
import DealAddNoteModal from "@/Pages/Deals/Redesign/components/workspace/DealAddNoteModal";
import DealAddTaskModal from "@/Pages/Deals/Redesign/components/workspace/DealAddTaskModal";
import DealMeetingDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealMeetingDetailModal";
import DealNoteDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealNoteDetailModal";
import DealScheduleMeetingModal from "@/Pages/Deals/Redesign/components/workspace/DealScheduleMeetingModal";
import DealTaskDetailModal from "@/Pages/Deals/Redesign/components/workspace/DealTaskDetailModal";
import { DealWorkspaceProvider, useDealWorkspace } from "@/Pages/Deals/Redesign/context/DealWorkspaceContext";
import useDealAnalysis from "@/Pages/Deals/Redesign/hooks/useDealAnalysis";
import useDealDocuments from "@/Pages/Deals/Redesign/hooks/useDealDocuments";
import useDealHeaderData from "@/Pages/Deals/Redesign/hooks/useDealHeaderData";
import useDealTimeline, { DEAL_TIMELINE_MODEL_TYPE } from "@/Pages/Deals/Redesign/hooks/useDealTimeline";
import useDealWorkspaceModel from "@/Pages/Deals/Redesign/hooks/useDealWorkspaceModel";
import type { DealShowProps } from "@/Pages/Deals/Redesign/types";
import { useCompanyCurrency } from "@/Pages/Leads/Redesign/adapters/currencyAdapter";
import { canEditLead } from "@/Pages/Leads/Redesign/adapters/leadEditAccess";
import type { EditOptions } from "./edit/leadEditForm";
import type { LeadCreateKind } from "@/Pages/Leads/Redesign/components/workspace/LeadCreateModals";
import ActivityCards, { SHOW_ACTIVITY_CARD, type ActivityPermissions, type ActivitySource } from "./contact/ActivityCards";
import AiSummaryPanel from "./contact/AiSummaryPanel";
import { NewActivityProvider } from "./contact/NewActivityContext";
import ContactHeader, { leadPhone, type ExtraActivity } from "./contact/ContactHeader";
import KeyFacts from "./contact/KeyFacts";
import StatusBar, { StatusMenuLabel } from "./contact/StatusBar";
import LeadLockCard from "./contact/LeadLockCard";
import RestrictedDealHeader, { type LeadRestriction } from "./contact/RestrictedDealHeader";
import { buildKeyFacts } from "./contact/model";
import "@/Components/Redesign/redesign.css";
import "@/Components/CallRecordingPlayer.css";
import "@/Pages/Deals/Redesign/deal-redesign.css";
import "@/Pages/Leads/Redesign/lead-redesign.css";
import ContactEditPanel from "./deal/ContactEditPanel";
import DealDetailsModal, { type DealDetailsTarget } from "./deal/DealDetailsModal";
import MeetingBrief from "./deal/MeetingBrief";
import DealMoreMenu from "./deal/DealMoreMenu";
import DealPinnedBar, { type SectionPill } from "./deal/DealPinnedBar";
import { buildDealFacts } from "./deal/dealFacts";
import StageConditionsPanel from "./deal/StageConditionsPanel";
import { nextStageConditions } from "./deal/stageConditions";
import { scrollToSection, useScrolledPast, useSectionSpy } from "./deal/useDealScroll";
import AnalysisSection from "./deal/sections/AnalysisSection";
import ExposesSection from "./deal/sections/ExposesSection";
import ItinerarySection from "./deal/sections/ItinerarySection";
import FilesSection from "./deal/sections/FilesSection";
import HistorySection from "./deal/sections/HistorySection";
import MarketingSection from "./deal/sections/MarketingSection";
import PaymentsSection from "./deal/sections/PaymentsSection";
import QualificationSection from "./deal/sections/QualificationSection";
import "./contact/contact.css";
import "./deal/deal.css";

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
    /** Set when the viewer may see this deal but not its lead: the deal-only view (LeadVisibility). */
    leadRestricted?: LeadRestriction | null;
    showOnlinePayment?: boolean;
    sallyInsightsEnabled?: boolean;
    /** edit_lead, for editing the person from the deal (left out in the deal-only view). */
    editLeadPermission?: string;
    /** Deferred: the lead editor's option lists. */
    contactEditOptions?: EditOptions;
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
    const showQualification = featureFlags?.["crm.lead-qualification-tab"] === true;
    const { timezone, formatDate } = useUserDateTime();
    const nowMs = useMinuteClock();
    const companyCurrency = useCompanyCurrency();
    // Adapters are plain functions with no hook access; publish the locale.
    setDealDateLocale(locale);

    const { deal, notes, notesLoading, tasks, tasksLoading, dealFollowUps, dealFollowUpsLoading, files, filesLoading } = useDealWorkspace();
    const model = useDealWorkspaceModel(props);
    const { permissions, dealPermissions, meetingTypes, taskBoardColumns } = model;
    // The page opens first; the analysis only when the agent asks (canvas L8).
    const analysis = useDealAnalysis({ openOnMount: false });
    const timeline = useDealTimeline(deal.id);
    const { documents } = useDealDocuments(
        deal,
        files,
        model.fields,
        model.pipelineCategoryIds,
        model.dealFileVisibilityMap,
        model.leadFileFields,
        model.leadFileFieldsData,
    );
    const userId = page.props.auth?.user?.id;

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
    const [details, setDetails] = useState<DealDetailsTarget | null>(null);
    const [contactEditing, setContactEditing] = useState(false);
    const [briefId, setBriefId] = useState<number | null>(null);

    // The deal header's own create checks; watchers never write.
    const writer = !dealPermissions.isWatcherOnly;
    const canCreate = {
        task: writer && canAdd(permissions.add_tasks, ["all", "added", "both"]),
        meeting: writer && canAdd(permissions.add_lead_follow_up, ["all", "added"]),
        note: writer && canAdd(permissions.add_deal_note, ["all", "added", "both"]),
        // The deal's timeline logs an action from the same dialog the deal page uses.
        log: writer,
    };
    const activityPermissions: ActivityPermissions = {
        viewNotes: permissions.view_deal_note !== "none",
        viewTasks: permissions.view_tasks !== "none",
        viewMeetings: permissions.view_lead_follow_up !== "none",
        create: canCreate,
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
    const filePermissions = (page.props.auth?.permissions ?? {}) as Record<string, string>;
    const canUpload = canAdd(permissions.add_lead_files ?? filePermissions.add_lead_files, ["all", "added"]);
    const viewFiles = permissions.view_lead_files !== "none";
    const viewExposes = showExposes && permissions.view_lead_proposals !== "none";

    const contact = deal.contact;
    const restricted = props.leadRestricted ?? null;
    const dealHeader = useDealHeaderData(deal);

    // ----- key facts: the person, the analysis answers, the deal's budget -----
    const railGroups = useMemo(
        () =>
            buildRailGroups(
                model.analysisProgress.sections,
                model.fields,
                (page.props.leadCustomFields as any[] | null | undefined) ?? [],
                { ...(deal.custom_fields_data ?? {}), ...((page.props.leadCustomFieldsData as Record<string, unknown> | undefined) ?? {}) },
                deal,
                new Set<string>(),
            ),
        [deal, model.analysisProgress.sections, model.fields, page.props.leadCustomFields, page.props.leadCustomFieldsData],
    );
    const keyFacts = useMemo(() => {
        if (!contact) return [];
        // The deal-only view has no person's facts: only the deal's.
        const person = restricted
            ? []
            : buildKeyFacts(
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
              );
        const hasValue = deal.value != null || deal.value_breakdown?.final_value != null;
        const budgetRange = String(deal.hibarr_fields?.budget_range ?? "").trim();
        return buildDealFacts(
            person,
            railGroups,
            {
                value: hasValue ? dealHeader.value : "",
                valueLine: hasValue ? t("pages.agent_workspace.deal.facts.value_line", { value: dealHeader.value }) : "",
                budgetRange,
                closeLine: deal.close_date ? t("pages.agent_workspace.contact.facts.close_date", { date: dealHeader.closeDate }) : "",
                packages: (deal.packages ?? []).map((item) => item.name),
            },
            t("pages.agent_workspace.deal.facts.not_asked"),
        );
    }, [companyCurrency, contact, deal, dealHeader.closeDate, dealHeader.value, railGroups, restricted, t]);

    // ----- stage: the next stage's conditions, and the move -----
    const stageRequirements = page.props.stageAutomationRequirements as Record<number, StageRequirementCondition[]> | undefined;
    const stage = useMemo(() => nextStageConditions(deal, stageRequirements), [deal, stageRequirements]);
    const outcome = resolveDealOutcome(deal);
    const closedLabel = outcome
        ? outcome === "won"
            ? t("pages.deals.header.won")
            : t("pages.deals.header.lost")
        : null;
    const locked = isDealEffectivelyLocked(deal);
    const stageName = deal.lead_stage?.name ? td(deal.lead_stage.name, { source: "en" }) : "";
    const stageDays = deal.stage_entered_at ? Math.max(0, Math.floor((nowMs - Date.parse(deal.stage_entered_at)) / 86_400_000)) : null;
    const stageNote = [
        deal.created_at ? t("pages.agent_workspace.deal.stage.opened", { date: formatDate(deal.created_at) }) : "",
        stageDays !== null && Number.isFinite(stageDays) ? t(stageDays === 1 ? "pages.agent_workspace.deal.stage.in_stage_one" : "pages.agent_workspace.deal.stage.in_stage_other", { count: stageDays }) : "",
    ]
        .filter(Boolean)
        .join(" · ");
    const analysisDone = model.analysisProgress.totalFilled;
    const analysisTotal = model.analysisProgress.totalFields;
    const openField = (condition: StageRequirementCondition) =>
        setDetails({
            section: resolveSectionForField(condition.field, model.fields) ?? "general",
            fieldKey: normalizeFieldKey(condition.field),
        });

    // ----- the second row: the person's deals -----
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
    const dealPills = contactDeals.map((summary) => ({
        key: String(summary.id),
        label: pillLabel(summary),
        title: summary.name ?? undefined,
        // Blue for an open deal, grey once won or lost: not the stage's config colour.
        dot: summary.outcome ? REDESIGN_TOKENS.TEXT_HINT : REDESIGN_TOKENS.BLUE,
        href: route("agent.people.deal", { lead: leadId, deal: summary.id }),
        current: summary.id === deal.id,
    }));
    // Two deals in the same stage read the same; add their names.
    const labelCounts = new Map<string, number>();
    dealPills.forEach((pill) => labelCounts.set(pill.label, (labelCounts.get(pill.label) ?? 0) + 1));
    dealPills.forEach((pill, index) => {
        if ((labelCounts.get(pill.label) ?? 0) > 1 && contactDeals[index].name) {
            pill.label = `${pill.label} · ${contactDeals[index].name}`;
        }
    });

    // ----- the section pills under the dock -----
    const headRef = useRef<HTMLDivElement>(null);
    const scrolledPast = useScrolledPast(headRef);
    const uploadedFiles = documents.filter((doc) => doc.uploaded).length;
    const flightCount = (deal.lead_flight_itineraries ?? []).filter((leg) => leg.id != null).length;
    const sectionPills = useMemo(() => {
        const pill = (id: string, key: string, count?: number): SectionPill => ({
            id,
            label: count && count > 0 ? `${t(`pages.agent_workspace.deal.pills.${key}`)} · ${count}` : t(`pages.agent_workspace.deal.pills.${key}`),
        });
        const list: SectionPill[] = [pill("agent-deal-top", "summary")];
        if (activityPermissions.viewTasks || activityPermissions.viewMeetings) list.push(pill("agent-activity-coming_up", "coming_up"));
        // The deal-only view draws just the activity strip (coming up, notes, files); every other section is left out, so it has no pill.
        if (restricted) {
            if (activityPermissions.viewNotes) list.push(pill("agent-activity-notes", "notes", notes.length));
            if (viewFiles) list.push(pill("deal-files", "files", uploadedFiles));
            return list;
        }
        list.push(pill("agent-activity-touches", "conversation"));
        if (activityPermissions.viewNotes) list.push(pill("agent-activity-notes", "notes", notes.length));
        if (viewFiles) list.push(pill("deal-files", "files", uploadedFiles));
        if (props.showOnlinePayment) list.push(pill("deal-payments", "payments"));
        if (viewExposes) list.push(pill("deal-exposes", "exposes"));
        list.push(pill("deal-itinerary", "flights", flightCount));
        if (showQualification) list.push(pill("deal-qualification", "qualification"));
        if (showAnalysis) list.push(pill("deal-analysis", "analysis"));
        list.push(pill("deal-marketing", "marketing"), pill("deal-history", "history"));
        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [t, restricted, notes.length, uploadedFiles, flightCount, viewFiles, viewExposes, showQualification, showAnalysis, props.showOnlinePayment, permissions.view_tasks, permissions.view_lead_follow_up, permissions.view_deal_note]);
    const [activeSection, setActiveSection] = useSectionSpy(
        sectionPills.map((pill) => pill.id),
        scrolledPast,
    );
    const jump = (id: string) => {
        setActiveSection(id);
        // A card of the activity strip is a tab on a phone: show it first. In the
        // deal-only view the files are one of those cards too.
        const card = id.startsWith("agent-activity-") ? id.slice("agent-activity-".length) : restricted && id === "deal-files" ? "files" : null;
        if (card) {
            window.dispatchEvent(new CustomEvent(SHOW_ACTIVITY_CARD, { detail: card }));
            window.requestAnimationFrame(() => scrollToSection(id));
            return;
        }
        scrollToSection(id);
    };

    const name = contact?.client_name || deal.name || td("Deal", { source: "en" });
    const comingUpTitle = t("pages.agent_workspace.contact.coming_up.deal_title");
    const extraActivities: ExtraActivity[] =
        // No lead address to write to in the deal-only view.
        emailQuickAction != null && !restricted
            ? [{ key: "email", icon: <Icon name="mail" size={14} />, label: t("pages.agent_workspace.deal.new_email"), onSelect: () => openCommunication(null) }]
            : [];

    // Edit details: the person's details (they stay editable after qualification) and the deal's.
    const canEditContact =
        !restricted && contact != null && props.contactEditOptions != null && canEditLead(props.editLeadPermission, contact, userId);
    const openContactEdit = () => {
        setContactEditing(true);
        window.scrollTo({ top: 0 });
    };
    const editMenu = [
        ...(canEditContact ? [{ key: "contact", label: t("pages.agent_workspace.deal.edit.contact_details"), onSelect: openContactEdit }] : []),
        ...(dealPermissions.canEdit ? [{ key: "deal", label: t("pages.agent_workspace.deal.edit.deal_details"), onSelect: () => setDetails({ section: "general" }) }] : []),
    ];

    // The stage menu: every stage of the pipeline, the current one ticked.
    const canMoveStage = model.canChangeStages && !locked && !outcome;
    const stageMenu = canMoveStage
        ? model.pipeline.stages.map((item) => ({
              key: String(item.id),
              label: <StatusMenuLabel name={td(item.name, { source: "en" })} current={item.id === model.pipeline.currentStageId} />,
              disabled: item.id === model.pipeline.currentStageId,
          }))
        : [];

    const newActivityScope = useMemo(
        () => ({ person: contact?.client_name ?? "", deal: deal.name ?? null, meetingTypes: meetingTypes.map((type) => type.name) }),
        [contact, deal.name, meetingTypes],
    );

    return (
        <NewActivityProvider value={newActivityScope}>
            <Head title={name} />
            <AgentSecondRow>
                <AgentLinkPills pills={dealPills} ariaLabel={t("pages.agent_workspace.contact.deals_aria")} />
            </AgentSecondRow>
            <DealPinnedBar
                visible={scrolledPast && !contactEditing}
                name={name}
                initials={initialsFromName(contact?.client_name ?? name)}
                stageName={stageName}
                conditions={stage.next ? { met: stage.met, total: stage.conditions.length } : null}
                phone={contact && !restricted ? leadPhone(contact) : ""}
                callEntityId={deal.id}
                allowedCreate={canCreate}
                onCreate={setCreateKind}
                editMenu={editMenu}
                pills={sectionPills}
                active={activeSection}
                onJump={jump}
            />

            {contactEditing && canEditContact && contact && props.contactEditOptions ? (
                <ContactEditPanel
                    contact={contact}
                    options={props.contactEditOptions}
                    statusLabel={t("pages.agent_workspace.deal.edit.qualified")}
                    onEditDeal={
                        dealPermissions.canEdit
                            ? () => {
                                  setContactEditing(false);
                                  setDetails({ section: "general" });
                              }
                            : undefined
                    }
                    onClose={() => setContactEditing(false)}
                />
            ) : (
            <div className="lead-redesign deal-redesign dr-mobile-responsive agent-contact agent-deal">
                <div className="agent-deal__top">
                    <div className="agent-deal__main">
                        <section id="agent-deal-top" className="agent-deal__card">
                            {contact ? (
                                <>
                                    <div ref={headRef} className="agent-deal__head">
                                        {restricted ? (
                                            <RestrictedDealHeader
                                                name={name}
                                                restriction={restricted}
                                                canEdit={dealPermissions.canEdit}
                                                onEdit={() => setDetails({ section: "general" })}
                                                onCreate={setCreateKind}
                                                allowedCreate={canCreate}
                                                extraActivities={extraActivities}
                                            />
                                        ) : (
                                        <ContactHeader
                                            lead={contact}
                                            canEdit={dealPermissions.canEdit}
                                            canDelete={false}
                                            canFindDuplicates={false}
                                            onCreate={setCreateKind}
                                            allowedCreate={canCreate}
                                            onEdit={() => setDetails({ section: "general" })}
                                            editMenu={editMenu}
                                            moreMenu={<DealMoreMenu dealId={deal.id} />}
                                            extraActivities={extraActivities}
                                            callEntity={{ type: "deal", id: deal.id }}
                                            staticAvatar
                                        />
                                        )}
                                    </div>
                                    <StatusBar
                                        label={[t("pages.agent_workspace.contact.deal_stage"), deal.pipeline?.name ? td(deal.pipeline.name, { source: "en" }) : "", deal.name ?? ""]
                                            .filter(Boolean)
                                            .join(" · ")}
                                        note={stageNote}
                                        menuLabel={t("pages.agent_workspace.deal.stage.menu")}
                                        menuItems={stageMenu}
                                        onMenuSelect={(key) => void model.pipeline.updateStage(Number(key))}
                                        busy={model.pipeline.isUpdating}
                                    >
                                        <DealPipelineStepper variant="ramp" showProgression={false} deal={deal} permissions={permissions} onGoToField={({ section, fieldKey }) => setDetails({ section, fieldKey })} />
                                    </StatusBar>
                                    {showAiSummary ? (
                                        <AiSummaryPanel
                                            entityType="deal"
                                            entityId={deal.id}
                                            initialSummary={props.dealAiSummary}
                                            leadName={contact.client_name}
                                            leadPhone={restricted ? "" : leadPhone(contact)}
                                            onCreateTask={() => setCreateKind("task")}
                                            onScheduleCall={() => setCreateKind("meeting")}
                                            onRequestDocuments={() => jump("deal-files")}
                                            onReviewStaleDeal={() =>
                                                jump(
                                                    !restricted
                                                        ? "deal-history"
                                                        : activityPermissions.viewNotes
                                                          ? "agent-activity-notes"
                                                          : activityPermissions.viewTasks || activityPermissions.viewMeetings
                                                            ? "agent-activity-coming_up"
                                                            : "agent-deal-top",
                                                )
                                            }
                                            onAdvanceStage={model.advanceToNextStage}
                                        />
                                    ) : null}
                                </>
                            ) : null}

                            {keyFacts.length > 0 ? (
                                <KeyFacts groups={keyFacts} title={restricted ? t("pages.agent_workspace.deal.restricted.deal_facts") : undefined} />
                            ) : null}
                            {restricted && contact ? <LeadLockCard name={contact.client_name ?? name} restriction={restricted} /> : null}
                        </section>

                        <div className="agent-deal__activity">
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
                                onOpenBrief={restricted ? undefined : setBriefId}
                                dealOnly={
                                    restricted
                                        ? {
                                              notesTitle: t("pages.agent_workspace.deal.restricted.notes_title"),
                                              extraCards: viewFiles
                                                  ? [
                                                        {
                                                            id: "files",
                                                            label: t("pages.agent_workspace.deal.files.title"),
                                                            node: <FilesSection deal={deal} documents={documents} files={files} loading={filesLoading} canUpload={canUpload} title={t("pages.agent_workspace.deal.restricted.files_title")} />,
                                                        },
                                                    ]
                                                  : [],
                                          }
                                        : undefined
                                }
                            />
                        </div>
                    </div>

                    <aside className="agent-deal__rail">
                        <StageConditionsPanel
                            stage={stage}
                            analysis={showAnalysis && analysisTotal > 0 ? { done: analysisDone, total: analysisTotal, onOpen: analysis.open } : undefined}
                            onMove={!locked && !outcome ? model.advanceToNextStage : undefined}
                            moving={model.pipeline.isUpdating}
                            closedLabel={closedLabel}
                            onOpenField={openField}
                        />
                    </aside>
                </div>

                {restricted ? null : (
                    <div className="agent-deal__sections">
                        {viewFiles ? <FilesSection deal={deal} documents={documents} files={files} loading={filesLoading} canUpload={canUpload} /> : null}
                        {props.showOnlinePayment ? (
                            <PaymentsSection deal={deal} canCreate={model.canCreatePaymentRequest} canConfirmTransfer={model.canConfirmPaymentTransfer} />
                        ) : null}
                        {viewExposes ? <ExposesSection deal={deal} canEdit={dealPermissions.canEdit} /> : null}
                        <ItinerarySection deal={deal} canEdit={dealPermissions.canEdit} />
                        {showQualification && contact ? <QualificationSection leadId={contact.id} enabled /> : null}
                        {showAnalysis ? (
                            <AnalysisSection
                                pipelineName={deal.pipeline?.name ?? null}
                                progress={model.analysisProgress}
                                onContinue={analysis.open}
                                complete={deal.analysis_status === "completed"}
                            />
                        ) : null}
                        <MarketingSection marketing={contact?.marketing} />
                        <HistorySection recordId={deal.id} timeline={timeline} emailEnabled={emailQuickAction != null} onOpenEmailMessage={(messageId) => openCommunication(messageId)} />
                    </div>
                )}
            </div>
            )}

            {/* Mounted only while open, as on the deal page: its hooks build
                the whole analysis model. */}
            {showAnalysis && analysis.isOpen ? (
                <DealAnalysisModal
                    analysis={analysis}
                    dealInfoCategories={model.dealInfoCategories}
                    fields={model.fields}
                    visibleLeadFieldKeys={props.visibleLeadFieldKeys}
                    analysisScript={props.analysisScript}
                    placement="under-dock"
                />
            ) : null}
            <MeetingBrief
                meeting={briefId != null ? (dealFollowUps.find((meeting) => meeting.id === briefId) ?? null) : null}
                deal={deal}
                stage={stage}
                analysis={showAnalysis && analysisTotal > 0 ? { progress: model.analysisProgress, onOpen: analysis.open } : undefined}
                events={timeline.events}
                notes={notes}
                documents={documents}
                showExposes={viewExposes}
                showPayments={props.showOnlinePayment === true}
                onOpenFiles={() => jump("deal-files")}
                onClose={() => setBriefId(null)}
            />
            <DealDetailsModal target={details} onClose={() => setDetails(null)} props={props} model={model} showCompletionDot={showCompletionDot} />
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
            <LogActionModal
                open={createKind === "log"}
                onClose={closeCreate}
                onSuccess={() => void timeline.refetch()}
                modelType={DEAL_TIMELINE_MODEL_TYPE}
                modelId={deal.id}
                userId={userId}
            />
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
        </NewActivityProvider>
    );
}

ContactDeal.layout = (page: ReactNode) => <AgentWorkspaceLayout>{page}</AgentWorkspaceLayout>;
