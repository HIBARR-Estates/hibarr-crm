import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import ProductTour, {
    ProductTourHandle,
} from "@/Components/ProductTour/ProductTour";
import {
    DEAL_TOUR_ID,
    DEAL_TOUR_LABELS,
    buildDealTourSteps,
} from "./config/dealTourSteps";
import DealStickyHeader from "./components/header/DealStickyHeader";
import DealPipelineStepper from "./components/header/DealPipelineStepper";
import WorkspaceContextRail from "./components/workspace/rail/WorkspaceContextRail";
import DealAddTaskModal from "./components/workspace/DealAddTaskModal";
import DealAddNoteModal from "./components/workspace/DealAddNoteModal";
import DealScheduleMeetingModal from "./components/workspace/DealScheduleMeetingModal";
import DealAnalysisModal from "./components/analysis/DealAnalysisModal";
import AnalysisStatusBanner from "./components/analysis/AnalysisStatusBanner";
import useDealAnalysis from "./hooks/useDealAnalysis";

import useDealViewNavigation from "./hooks/useDealViewNavigation";
import useDealWorkspaceModel from "./hooks/useDealWorkspaceModel";
import DealWorkspaceTabs from "./components/workspace/DealWorkspaceTabs";
import { DealShowProps } from "./types";
import "@/Components/Redesign/redesign.css";
import "@/Components/CallRecordingPlayer.css";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { setDealDateLocale } from "./adapters/dateFormat";
import { highlightDealField } from "./adapters/highlightDealField";
import { useTd } from "@/Hooks/useDynamicTranslation";
import { DEAL_EXPOSES_FLAG } from "@/Hooks/useDealExposesFlag";
import useMobileResponsiveLayoutFlag from "@/Hooks/useMobileResponsiveLayoutFlag";
import {
    DealWorkspaceProvider,
    useDealWorkspace,
} from "./context/DealWorkspaceContext";
import CommunicationModal from "@/Email/CommunicationModal";
import { subscribeOpenSourceEmail } from "@/Email/openSourceEmail";
import type { EmailFollowUpKind, EmailQuickAction } from "@/Email/types";
import { replaceUrlKeepingHistoryState } from "@/lib/inertiaHistory";

export default function DealViewRedesign(props: DealShowProps) {
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showOnlinePayment =
        featureFlags?.["packages.online-payment"] === true;
    const sallyInsightsEnabled =
        featureFlags?.["crm.sally-insights-tab"] === true;

    return (
        <DealWorkspaceProvider
            deal={props.deal}
            paymentEnabled={showOnlinePayment}
            sallyInsightsEnabled={sallyInsightsEnabled}
        >
            <DealViewRedesignInner
                {...props}
                showOnlinePayment={showOnlinePayment}
                sallyInsightsEnabled={sallyInsightsEnabled}
            />
        </DealWorkspaceProvider>
    );
}

function DealViewRedesignInner(
    props: DealShowProps & {
        showOnlinePayment?: boolean;
        sallyInsightsEnabled?: boolean;
    },
) {
    const [isDealEditMode] = useState(false);
    const [addTaskOpen, setAddTaskOpen] = useState(false);
    const [addMeetingOpen, setAddMeetingOpen] = useState(false);
    const [addNoteOpen, setAddNoteOpen] = useState(false);
    const [sourceEmailMessageId, setSourceEmailMessageId] = useState<
        string | null
    >(null);
    const analysis = useDealAnalysis();
    const nav = useDealViewNavigation();
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;
    const showCompletionDot =
        featureFlags?.["crm.deal-info-count-indicator"] === true;
    const showAnalysis = featureFlags?.["crm.deal-analysis"] === true;
    const showExposes = featureFlags?.[DEAL_EXPOSES_FLAG] === true;
    // Fail closed: flag off or missing server gate → no Email Quick action.
    const emailQuickAction: EmailQuickAction | null =
        featureFlags?.["crm.email"] === true && props.emailQuickAction != null
            ? props.emailQuickAction
            : null;
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
        if (kind === "task") setAddTaskOpen(true);
        else if (kind === "note") setAddNoteOpen(true);
        else setAddMeetingOpen(true);
    };
    const closeAddTask = () => {
        setAddTaskOpen(false);
        setSourceEmailMessageId(null);
    };
    const closeAddNote = () => {
        setAddNoteOpen(false);
        setSourceEmailMessageId(null);
    };
    const closeAddMeeting = () => {
        setAddMeetingOpen(false);
        setSourceEmailMessageId(null);
    };
    const isMobileResponsive = useMobileResponsiveLayoutFlag();
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });
    const { deal, files } = useDealWorkspace();
    const pageTitle = props?.pageTitle || deal?.name;
    const { t, locale } = useTranslation();
    // Adapters are plain functions with no hook access, so publish the active
    // locale once here; every date/time in the redesign reads it.
    setDealDateLocale(locale);

    const model = useDealWorkspaceModel(props);
    const {
        meetingTypes,
        permissions,
        fields,
        pipelineCategoryIds,
        dealInfoCategories,
        analysisProgress,
        employees,
        canCreatePaymentRequest,
        canConfirmPaymentTransfer,
        advanceToNextStage,
        dealFileVisibilityMap,
    } = model;
    const tourRef = useRef<ProductTourHandle>(null);
    const dealTourSteps = useMemo(
        () => buildDealTourSteps(nav.setTab),
        [nav.setTab],
    );


    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.dashboard"), url: route("dashboard") },
                {
                    name: t("pages.deals.header.breadcrumb_deals"),
                    url: route("deals.index"),
                },
                { name: pageTitle },
            ]}
        >
            {/* Gate on isOpen as well as the flag: the modal's hooks build the whole
                section/progress/rail model, and mounting it while closed made every
                deal page render pay for an analysis nobody is looking at. */}
            {showAnalysis && analysis.isOpen && (
                <DealAnalysisModal
                    analysis={analysis}
                    dealInfoCategories={dealInfoCategories}
                    fields={fields}
                    visibleLeadFieldKeys={props.visibleLeadFieldKeys}
                    analysisScript={props.analysisScript}
                />
            )}
            <DealAddTaskModal
                open={addTaskOpen}
                onClose={closeAddTask}
                dealId={deal.id}
                dealName={deal.name}
                dealAgentUserId={
                    deal.lead_agent?.user?.id ??
                    deal.lead_agent?.user_id ??
                    deal.agent?.user?.id ??
                    deal.agent?.user_id ??
                    null
                }
                sourceEmailMessageId={sourceEmailMessageId}
            />
            <DealScheduleMeetingModal
                open={addMeetingOpen}
                onClose={closeAddMeeting}
                deal={deal}
                meetingTypes={meetingTypes}
                sourceEmailMessageId={sourceEmailMessageId}
            />
            <DealAddNoteModal
                open={addNoteOpen}
                onClose={closeAddNote}
                dealId={deal.id}
                sourceEmailMessageId={sourceEmailMessageId}
            />
            <ProductTour
                ref={tourRef}
                tourId={DEAL_TOUR_ID}
                steps={dealTourSteps}
                labels={DEAL_TOUR_LABELS}
            />
            <div
                className={`deal-redesign min-h-screen bg-dr-gray ${
                    isMobileResponsive ? "dr-mobile-responsive" : ""
                }`}
            >
                <div className="mx-auto flex flex-col gap-4 w-full max-w-[1320px]">
                    <DealStickyHeader
                        deal={deal}
                        permissions={permissions}
                        employees={employees}
                        isRefreshing={isRefreshing}
                        onRefresh={refresh}
                        onAddNote={() => setAddNoteOpen(true)}
                        onAddTask={() => setAddTaskOpen(true)}
                        onScheduleMeeting={() => setAddMeetingOpen(true)}
                        onOpenAnalysis={
                            showAnalysis ? analysis.open : undefined
                        }
                        onReplayGuide={() => tourRef.current?.restart()}
                        isMobileResponsive={isMobileResponsive}
                        emailQuickAction={emailQuickActionForUi}
                        onEmail={() => openCommunication(null)}
                    />

                    <div className="">
                        <div
                            className={`mb-[14px] flex items-stretch gap-4 ${
                                isMobileResponsive
                                    ? "flex-col lg:flex-row"
                                    : ""
                            }`}
                            data-tour="deal-pipeline-stepper"
                        >
                            <div className="min-w-0 flex-1">
                                <DealPipelineStepper
                                    deal={deal}
                                    permissions={permissions}
                                    onGoToField={({ section, fieldKey }) => {
                                        nav.goToDealInfo(section);
                                        // Highlight after the info tab + section mount.
                                        highlightDealField(fieldKey);
                                    }}
                                />
                            </div>
                            {showAnalysis && (
                                <AnalysisStatusBanner
                                    analysis={analysis}
                                    totalFilled={analysisProgress.totalFilled}
                                    totalFields={analysisProgress.totalFields}
                                    isMobileResponsive={isMobileResponsive}
                                />
                            )}
                        </div>
                        <div className="dr-grid">
                            <div className="flex min-w-0 flex-col gap-[14px]">
                                {showAiSummary && (
                                    <div data-tour="deal-ai-summary">
                                        <EntityAiSummaryCard
                                            entityType="deal"
                                            entityId={deal.id}
                                            initialSummary={props.dealAiSummary}
                                            variant="redesign"
                                            // Executable actions perform the real
                                            // thing (open the modal / advance the
                                            // stage), not just switch tabs.
                                            onCreateTask={() =>
                                                setAddTaskOpen(true)
                                            }
                                            onScheduleCall={() =>
                                                setAddMeetingOpen(true)
                                            }
                                            onRequestDocuments={() =>
                                                nav.setTab("files")
                                            }
                                            onReviewStaleDeal={() =>
                                                nav.setTab("timeline")
                                            }
                                            onAdvanceStage={advanceToNextStage}
                                        />
                                    </div>
                                )}

                                <DealWorkspaceTabs
                                    props={props}
                                    model={model}
                                    nav={nav}
                                    showExposes={showExposes}
                                    showCompletionDot={showCompletionDot}
                                    emailEnabled={emailQuickAction != null}
                                    onOpenEmailMessage={(messageId: string) =>
                                        openCommunication(messageId)
                                    }
                                    onAddTask={() => setAddTaskOpen(true)}
                                    onAddMeeting={() => setAddMeetingOpen(true)}
                                    onAddNote={() => setAddNoteOpen(true)}
                                />
                            </div>

                            <div
                                className="dr-dossier"
                                data-tour="deal-dossier"
                            >
                                <WorkspaceContextRail
                                    deal={deal}
                                    files={files}
                                    fields={fields}
                                    categoryIds={pipelineCategoryIds}
                                    visibilityMap={dealFileVisibilityMap}
                                    restrictPackageOrProperty={
                                        props.restrictPackageOrProperty
                                    }
                                    onNavigateToSubTab={nav.setTab}
                                    onSwitchToDealInfo={() =>
                                        nav.goToDealInfo("general")
                                    }
                                    showOnlinePayment={props.showOnlinePayment}
                                    canCreatePaymentRequest={
                                        canCreatePaymentRequest
                                    }
                                    canConfirmPaymentTransfer={
                                        canConfirmPaymentTransfer
                                    }
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <CommunicationModal
                open={communicationOpen && emailQuickAction != null}
                onClose={closeCommunication}
                record={{ type: "deal", id: deal.id }}
                recordLabel={deal.name}
                messageId={emailFocusMessageId}
                hasConnection={hasMailboxConnection}
                prefillTo={deal.contact?.client_email ?? null}
                onCreateFollowUp={openCreateFromEmail}
            />
        </PageLayout>
    );
}
