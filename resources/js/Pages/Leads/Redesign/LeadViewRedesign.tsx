import { useCallback, useMemo, useRef, useState } from "react";
import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import AddFollowup from "@/Pages/Deals/Components/Tabs/followups/AddFollowup";
import { router } from "@inertiajs/react";
import type { LeadRedesignProps } from "./types";
import "./lead-redesign.css";
import useLeadHeaderData from "./hooks/useLeadHeaderData";
import useLeadViewNavigation from "./hooks/useLeadViewNavigation";
import useLeadContextRail from "./hooks/useLeadContextRail";
import useLeadBantChecks from "./hooks/useLeadBantChecks";
import useLeadMission from "./hooks/useLeadMission";
import useLeadOverview from "./hooks/useLeadOverview";
import useLeadQualificationWorkspace from "./hooks/useLeadQualificationWorkspace";
import LeadBreadcrumbRow from "./components/header/LeadBreadcrumbRow";
import LeadIdentityHeader from "./components/header/LeadIdentityHeader";
import LeadMissionBar from "./components/header/LeadMissionBar";
import LeadContextRail from "./components/rail/LeadContextRail";
import QualificationScriptCard from "./components/workspace/QualificationScriptCard";
import QuickNoteCard, { type QuickNoteCardHandle } from "./components/workspace/QuickNoteCard";
import LeadDrawer from "./components/drawer/LeadDrawer";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";

export default function LeadViewRedesign(props: LeadRedesignProps) {
    const {
        lead,
        notes,
        tasks,
        deals,
        leadFollowUps = [],
        editLeadPermission,
        leadAiSummary,
        featureFlags: pageFeatureFlags,
    } = props;

    const page = usePage<PageProps>();
    const featureFlags = pageFeatureFlags ?? page.props.featureFlags;
    const showAiSummary = featureFlags?.["crm.lead-ai-summary"] === true;
    const showQualificationTab =
        featureFlags?.["crm.lead-qualification-tab"] === true;

    const header = useLeadHeaderData(lead);
    const nav = useLeadViewNavigation();
    const railData = useLeadContextRail({ tasks, leadFollowUps, deals });
    const qualificationWorkspace = useLeadQualificationWorkspace(lead, {
        enabled: showQualificationTab,
    });
    const overview = useLeadOverview({ notes, tasks, leadFollowUps });

    const [contactLoggedOverride, setContactLoggedOverride] = useState(false);
    const [scheduleMeetingOpen, setScheduleMeetingOpen] = useState(false);

    const qualificationRef = useRef<HTMLDivElement>(null);
    const noteRef = useRef<QuickNoteCardHandle>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const { checks } = useLeadBantChecks({
        lead,
        answers: showQualificationTab
            ? qualificationWorkspace.current?.answers
            : undefined,
        contactLogged:
            contactLoggedOverride ||
            notes.length > 0 ||
            leadFollowUps.length > 0 ||
            qualificationWorkspace.flowActive ||
            Boolean(qualificationWorkspace.outcome),
    });

    const mission = useLeadMission({
        lead,
        leadName: header.leadName,
        notes,
        tasks,
        leadFollowUps,
        flowActive: qualificationWorkspace.flowActive,
        outcome: qualificationWorkspace.outcome,
        qualificationAnswers: showQualificationTab
            ? qualificationWorkspace.current?.answers
            : undefined,
        contactLoggedOverride,
        qualificationEnabled: showQualificationTab,
    });

    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !nav.profileEditMode,
    });

    const latestNote = notes[0] ?? null;
    const canEdit = editLeadPermission === "all" || editLeadPermission === "added";

    const handleMissionCta = useCallback(() => {
        if (mission.ctaAction === "logContact") {
            setContactLoggedOverride(true);
            qualificationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        if (mission.ctaAction === "startFlow") {
            qualificationRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        if (mission.ctaAction === "focusNote") {
            noteRef.current?.focus();
            return;
        }
        if (mission.ctaAction === "scrollMeetings") {
            nav.setDrawerTab("meetings");
            drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
            return;
        }
        if (mission.ctaAction === "completeTopTask" && railData.topOpenTask) {
            router.reload({ only: ["tasks"] });
        }
    }, [mission.ctaAction, nav, railData.topOpenTask]);

    const handleOutcomeComplete = useCallback(() => {
        nav.setDrawerTab("meetings");
        drawerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, [nav]);

    const pageTitle = useMemo(() => header.leadName, [header.leadName]);

    return (
        <PageLayout title={pageTitle} breadcrumbs={[]} mainContentClassName="">
            <div className="lead-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto w-full max-w-[1320px]">
                    <LeadBreadcrumbRow
                        leadName={header.leadName}
                        isRefreshing={isRefreshing}
                        refreshDisabled={nav.profileEditMode}
                        onRefresh={refresh}
                    />
                    <LeadIdentityHeader
                        header={header}
                        canEdit={canEdit}
                        onEditLead={nav.openProfileEdit}
                    />
                    {showAiSummary && (
                        <EntityAiSummaryCard
                            entityType="lead"
                            entityId={lead.id}
                            initialSummary={leadAiSummary}
                            variant="redesign"
                            leadPhone={lead.mobile || lead.cell}
                            onQualifyLead={() => {
                                qualificationRef.current?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "start",
                                });
                            }}
                        />
                    )}
                    <LeadMissionBar
                        mission={mission}
                        leadPhone={lead.mobile || lead.cell}
                        onCta={mission.cta ? handleMissionCta : undefined}
                    />

                    <div className="grid grid-cols-1 gap-4 p-[26px] lg:grid-cols-[232px_minmax(0,1fr)]">
                        <LeadContextRail
                            lead={lead}
                            checks={checks}
                            railData={railData}
                            onNavigateMeetings={() => nav.setDrawerTab("meetings")}
                            onNavigateTasks={() => nav.setDrawerTab("tasks")}
                            onNavigateDeals={() => nav.setDrawerTab("deals")}
                        />
                        <div className="flex flex-col gap-4">
                            {showQualificationTab && (
                                <QualificationScriptCard
                                    lead={lead}
                                    workspace={qualificationWorkspace}
                                    workspaceRef={qualificationRef}
                                    onOutcomeComplete={handleOutcomeComplete}
                                />
                            )}
                            <QuickNoteCard
                                ref={noteRef}
                                lead={lead}
                                latestNote={latestNote}
                            />
                            <LeadDrawer
                                {...props}
                                drawerTab={nav.drawerTab}
                                onDrawerTabChange={nav.setDrawerTab}
                                overview={overview}
                                profileEditMode={nav.profileEditMode}
                                onProfileEditModeChange={nav.setProfileEditMode}
                                onScheduleMeeting={() => setScheduleMeetingOpen(true)}
                                drawerRef={drawerRef}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <AddFollowup
                context="lead"
                lead={lead}
                dealsForLead={deals.map((d) => ({
                    id: d.id,
                    name: d.name,
                }))}
                open={scheduleMeetingOpen}
                onClose={() => setScheduleMeetingOpen(false)}
            />
        </PageLayout>
    );
}
