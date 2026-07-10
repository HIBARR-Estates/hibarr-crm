import { useCallback, useMemo, useRef, useState } from "react";
import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
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
import useLeadFirstContact from "./hooks/useLeadFirstContact";
import LeadIdentityHeader from "./components/header/LeadIdentityHeader";
import LeadMissionBar from "./components/header/LeadMissionBar";
import LeadContextRail from "./components/rail/LeadContextRail";
import QualificationScriptCard from "./components/workspace/QualificationScriptCard";
import QuickNoteCard, {
    type QuickNoteCardHandle,
} from "./components/workspace/QuickNoteCard";
import LeadDrawer from "./components/drawer/LeadDrawer";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import useTranslation from "@/Hooks/useTranslation";

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
    const { t } = useTranslation();

    const header = useLeadHeaderData(lead);
    const nav = useLeadViewNavigation();
    const railData = useLeadContextRail({ tasks, leadFollowUps, deals });
    const qualificationWorkspace = useLeadQualificationWorkspace(lead, {
        enabled: showQualificationTab,
    });
    const overview = useLeadOverview({ notes, tasks, leadFollowUps });
    const firstContact = useLeadFirstContact(lead.id);

    const [ctaLoading, setCtaLoading] = useState(false);

    const qualificationRef = useRef<HTMLDivElement>(null);
    const noteRef = useRef<QuickNoteCardHandle>(null);
    const drawerRef = useRef<HTMLDivElement>(null);

    const { checks } = useLeadBantChecks({
        lead,
        answers: showQualificationTab
            ? qualificationWorkspace.current?.answers
            : undefined,
        contactLogged: firstContact.contactLogged,
    });

    const mission = useLeadMission({
        lead,
        leadName: header.leadName,
        tasks,
        leadFollowUps,
        flowActive: qualificationWorkspace.flowActive,
        outcome: qualificationWorkspace.outcome,
        qualificationAnswers: showQualificationTab
            ? qualificationWorkspace.current?.answers
            : undefined,
        contactLogged: firstContact.contactLogged,
        qualificationEnabled: showQualificationTab,
    });

    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !nav.profileEditMode,
    });

    const latestNote = notes[0] ?? null;
    const canEdit =
        editLeadPermission === "all" || editLeadPermission === "added";

    const handleLogContact = useCallback(async () => {
        await firstContact.logContact();
    }, [firstContact]);

    const handleMissionCta = useCallback(async () => {
        if (mission.ctaAction === "logContact") {
            setCtaLoading(true);
            try {
                await handleLogContact();
            } finally {
                setCtaLoading(false);
            }
            return;
        }

        if (mission.ctaAction === "startFlow") {
            setCtaLoading(true);
            try {
                const started =
                    await qualificationWorkspace.startQualificationScript();
                if (started) {
                    qualificationRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                } else {
                    qualificationRef.current?.scrollIntoView({
                        behavior: "smooth",
                        block: "start",
                    });
                }
            } finally {
                setCtaLoading(false);
            }
            return;
        }

        if (mission.ctaAction === "focusNote") {
            noteRef.current?.focus();
            return;
        }

        if (mission.ctaAction === "scrollMeetings") {
            nav.setDrawerTab("meetings");
            drawerRef.current?.scrollIntoView({
                behavior: "smooth",
                block: "start",
            });
            return;
        }

        if (mission.ctaAction === "completeTopTask" && railData.topOpenTask) {
            router.reload({ only: ["tasks"] });
        }
    }, [
        handleLogContact,
        mission.ctaAction,
        nav,
        qualificationWorkspace,
        railData.topOpenTask,
    ]);

    const handleOutcomeComplete = useCallback(() => {
        nav.setDrawerTab("meetings");
        drawerRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "start",
        });
    }, [nav]);

    const pageTitle = useMemo(() => header.leadName, [header.leadName]);
    const leadName = [
        lead?.salutation_value
            ? lead.salutation_value.charAt(0).toUpperCase() +
              lead.salutation_value.slice(1)
            : null,
        lead?.client_name,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                {
                    name: t("pages.leads.contacts"),
                    url: route("lead-contact.index"),
                },
                { name: leadName },
            ]}
            mainContentClassName=""
        >
            <div className="lead-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto w-full max-w-[1320px]">
                    <LeadIdentityHeader
                        isRefreshing={isRefreshing}
                        refreshDisabled={nav.profileEditMode}
                        header={header}
                        onRefresh={refresh}
                        canEdit={canEdit}
                        onEditLead={nav.openProfileEdit}
                    />

                    <LeadMissionBar
                        mission={mission}
                        leadPhone={lead.mobile || lead.cell}
                        onCta={
                            mission.cta
                                ? () => void handleMissionCta()
                                : undefined
                        }
                        ctaLoading={
                            ctaLoading ||
                            firstContact.isLogging ||
                            qualificationWorkspace.isStartingFlow
                        }
                    />

                    <div className="grid grid-cols-1 gap-4 p-[26px] lg:grid-cols-[232px_minmax(0,1fr)]">
                        <LeadContextRail
                            lead={lead}
                            checks={checks}
                            railData={railData}
                            contactLogged={firstContact.contactLogged}
                            isLoggingContact={firstContact.isLogging}
                            onLogContact={() => void handleLogContact()}
                            onEditProfile={
                                canEdit ? nav.openProfileEdit : undefined
                            }
                            onNavigateMeetings={() =>
                                nav.setDrawerTab("meetings")
                            }
                            onNavigateTasks={() => nav.setDrawerTab("tasks")}
                            onNavigateDeals={() => nav.setDrawerTab("deals")}
                            quickNoteCard={{
                                ref: noteRef,
                                props: {
                                    lead,
                                    latestNote,
                                },
                            }}
                        />
                        <div className="flex flex-col gap-4">
                            {showAiSummary && (
                                <EntityAiSummaryCard
                                    entityType="lead"
                                    entityId={lead.id}
                                    initialSummary={leadAiSummary}
                                    variant="redesign"
                                    leadPhone={lead.mobile || lead.cell}
                                    onQualifyLead={() => {
                                        qualificationRef.current?.scrollIntoView(
                                            {
                                                behavior: "smooth",
                                                block: "start",
                                            },
                                        );
                                    }}
                                    className=""
                                />
                            )}
                            {showQualificationTab && (
                                <QualificationScriptCard
                                    lead={lead}
                                    workspace={qualificationWorkspace}
                                    workspaceRef={qualificationRef}
                                    onOutcomeComplete={handleOutcomeComplete}
                                />
                            )}

                            <LeadDrawer
                                {...props}
                                drawerTab={nav.drawerTab}
                                onDrawerTabChange={nav.setDrawerTab}
                                overview={overview}
                                profileEditMode={nav.profileEditMode}
                                onProfileEditModeChange={nav.setProfileEditMode}
                                drawerRef={drawerRef}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
