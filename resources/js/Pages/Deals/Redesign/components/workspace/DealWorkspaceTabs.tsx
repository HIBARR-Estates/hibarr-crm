import { useCallback, useEffect, useMemo, useState } from "react";
import type { SallyMeetingInsight } from "@/Types/api/sally-meeting-insight";
import DealTabBar from "../tabs/DealTabBar";
import DealInfoTab from "../tabs/DealInfoTab";
import TimelineTab from "../tabs/TimelineTab";
import WorkspaceOverviewTab from "./WorkspaceOverviewTab";
import WorkspaceNotesTab from "./WorkspaceNotesTab";
import WorkspaceTasksTab from "./WorkspaceTasksTab";
import WorkspaceMeetingsTab from "./WorkspaceMeetingsTab";
import WorkspaceFilesTab from "./WorkspaceFilesTab";
import WorkspaceOffersTab from "./WorkspaceOffersTab";
import WorkspaceExposesTab from "./WorkspaceExposesTab";
import WorkspaceRecommendationsTab from "./WorkspaceRecommendationsTab";
import WorkspaceItineraryTab from "./WorkspaceItineraryTab";
import WorkspaceSallyTab from "./WorkspaceSallyTab";
import WorkspacePaymentsTab from "./WorkspacePaymentsTab";
import {
    OverviewDeferredSkeleton,
    TabDeferredSkeleton,
} from "./overview/overviewShared";
import { useDealWorkspace } from "../../context/DealWorkspaceContext";
import type useDealViewNavigation from "../../hooks/useDealViewNavigation";
import useDealDocuments from "../../hooks/useDealDocuments";
import useWorkspaceOverview from "../../hooks/useWorkspaceOverview";
import type { DealWorkspaceModel } from "../../hooks/useDealWorkspaceModel";
import type { DealShowProps, DealTab } from "../../types";

interface DealWorkspaceTabsProps {
    props: DealShowProps & {
        showOnlinePayment?: boolean;
        sallyInsightsEnabled?: boolean;
    };
    model: DealWorkspaceModel;
    nav: ReturnType<typeof useDealViewNavigation>;
    showExposes: boolean;
    showCompletionDot: boolean;
    /** Fail-closed Email gate; the Timeline tab links emails only when on. */
    emailEnabled: boolean;
    onOpenEmailMessage: (messageId: string) => void;
    onAddTask: () => void;
    onAddMeeting: () => void;
    onAddNote: () => void;
    className?: string;
}

/**
 * The deal's tab bar and tab bodies (overview, notes, tasks, meetings, files,
 * payments, offers, exposés, recommendations, Sally, itinerary, deal info,
 * timeline): which tabs the viewer sees, their counts, and what each renders.
 * Used by the deal page and by the agent workspace's contact page in its
 * deal state.
 */
export default function DealWorkspaceTabs({
    props,
    model,
    nav,
    showExposes,
    showCompletionDot,
    emailEnabled,
    onOpenEmailMessage,
    onAddTask,
    onAddMeeting,
    onAddNote,
    className = "overflow-hidden rounded-xl border border-dr-border bg-white",
}: DealWorkspaceTabsProps) {
    const {
        deal,
        notes,
        notesLoading,
        tasks,
        tasksLoading,
        dealFollowUps,
        dealFollowUpsLoading,
        sallyInsights,
        setSallyInsights,
        sallyInsightsLoading,
        sallyInsightsSettled,
        sallyInsightsError,
        refetchSallyInsights,
        files,
        filesLoading,
        paymentRequests,
        paymentRequestLoading,
    } = useDealWorkspace();
    const {
        meetingTypes,
        permissions,
        fields,
        pipelineCategoryIds,
        dealInfoCategories,
        dealInfoFieldKeys,
        taskBoardColumns,
        dealPermissions,
        pipelineHasPackages,
        canCreatePaymentRequest,
        canConfirmPaymentTransfer,
        leadFileFields,
        leadFileFieldsData,
        dealFileVisibilityMap,
    } = model;
    const sallyInsightsEnabled = props.sallyInsightsEnabled === true;
    const [recommendationsCount, setRecommendationsCount] = useState<
        number | undefined
    >(undefined);
    // Keyed by deal.id: this component isn't remounted across an Inertia
    // navigation to a different deal, so a stale count from the previous
    // deal must not flash before WorkspaceExposesTab reports the new one.
    const [exposesCount, setExposesCount] = useState<
        { dealId: number; count: number } | undefined
    >(undefined);
    const handleExposesCountChange = useCallback(
        (count: number) => setExposesCount({ dealId: props.deal.id, count }),
        [props.deal.id],
    );
    const offersEligible =
        permissions.view_lead_proposals !== "none" && !pipelineHasPackages;
    // Visibility comes straight off the deal payload already shipped on
    // first paint — no need for a separate eager fetch on every eligible
    // deal just to answer "does this deal have any offers". WorkspaceOffersTab
    // fetches the full offer rows itself, only once the tab is actually
    // opened, and owns its own retry UI for that fetch.
    const offerApplicationsCount = deal.offer_applications?.length ?? 0;
    const showOffersTab = offersEligible && offerApplicationsCount > 0;

    const overview = useWorkspaceOverview({
        notes,
        tasks,
        dealFollowUps,
    });

    const visibleTabs = useMemo(() => {
        const tabs: DealTab[] = ["overview"];
        if (permissions.view_deal_note !== "none") tabs.push("notes");
        if (permissions.view_tasks !== "none") tabs.push("tasks");
        if (permissions.view_lead_follow_up !== "none") tabs.push("meetings");
        if (permissions.view_lead_files !== "none") tabs.push("files");
        if (props.showOnlinePayment) {
            tabs.push("payments");
        }
        // Offers only appear when a property on this deal has an applied offer.
        if (showOffersTab) {
            tabs.push("offers");
        }
        // Exposes are documents shown to the buyer, so unlike offers they are
        // not tied to the package/property split — only to the flag.
        if (showExposes && permissions.view_lead_proposals !== "none") {
            tabs.push("exposes");
        }
        if (!pipelineHasPackages) {
            tabs.push("recommendations");
        }
        // Insights come from an async client fetch, so keep the tab in play
        // until the query settles — otherwise a ?tab=sally deep link is reset
        // to overview before the data arrives. With the flag off, the query
        // never runs, so the tab is absent outright.
        if (
            sallyInsightsEnabled &&
            (sallyInsights.length > 0 ||
                !sallyInsightsSettled ||
                sallyInsightsError)
        ) {
            tabs.push("sally");
        }
        // itinerary / dealinfo / timeline have no matching permission in this
        // system, so they follow deal visibility itself.
        // Note `view_events` is the calendar module, not the CRM timeline.
        tabs.push("itinerary", "dealinfo", "timeline");
        return tabs;
    }, [
        permissions,
        pipelineHasPackages,
        showExposes,
        showOffersTab,
        sallyInsightsEnabled,
        sallyInsights.length,
        sallyInsightsSettled,
        sallyInsightsError,
        props.showOnlinePayment,
    ]);

    // Sally edits patch the local list in place — no Inertia reload. Each
    // card owns its own mutations (the routes are keyed by insight id).
    const patchSallyInsight = useCallback(
        (insightId: number, data: Partial<SallyMeetingInsight>) => {
            setSallyInsights((prev) =>
                prev.map((insight) =>
                    insight.id === insightId
                        ? { ...insight, ...data }
                        : insight,
                ),
            );
        },
        [setSallyInsights],
    );

    const activeTab = visibleTabs.includes(nav.tab) ? nav.tab : "overview";

    useEffect(() => {
        if (activeTab !== nav.tab) {
            nav.setTab(activeTab);
        }
    }, [activeTab, nav]);

    // Badge must count the same thing the Files tab body renders — document
    // slots (HIBARR/custom file fields) plus loose attachments, deduped — not
    // just the raw loose-attachment list, or the badge can read 0 while the
    // tab shows every uploaded document.
    const { documents: fileDocuments } = useDealDocuments(
        deal,
        files,
        fields,
        pipelineCategoryIds,
        dealFileVisibilityMap,
        leadFileFields,
        leadFileFieldsData,
    );

    const counts = useMemo(
        () => ({
            notes: notesLoading ? undefined : notes.length,
            tasks: tasksLoading ? undefined : overview.openTasksCount,
            meetings: dealFollowUpsLoading ? undefined : dealFollowUps.length,
            files: filesLoading
                ? undefined
                : fileDocuments.filter((doc) => doc.uploaded).length,
            payments: props.showOnlinePayment
                ? paymentRequestLoading
                    ? undefined
                    : paymentRequests.length
                : undefined,
            offers: showOffersTab ? offerApplicationsCount : undefined,
            exposes:
                exposesCount?.dealId === deal.id
                    ? exposesCount.count
                    : undefined,
            recommendations: recommendationsCount,
            itinerary: deal.lead_flight_itineraries?.length ?? 0,
            sally: sallyInsights.length > 0 ? sallyInsights.length : undefined,
        }),
        [
            notesLoading,
            tasksLoading,
            dealFollowUpsLoading,
            sallyInsights.length,
            filesLoading,
            notes.length,
            fileDocuments,
            deal.id,
            deal.lead_flight_itineraries?.length,
            overview.openTasksCount,
            dealFollowUps.length,
            showOffersTab,
            offerApplicationsCount,
            exposesCount,
            recommendationsCount,
            props.showOnlinePayment,
            paymentRequestLoading,
            paymentRequests.length,
        ],
    );

    return (
        <section className={className}>
            <div data-tour="deal-tabs">
                <DealTabBar
                    activeTab={activeTab}
                    counts={counts}
                    visibleTabs={visibleTabs}
                    onChange={nav.setTab}
                />
            </div>
            <div className="p-4">
                {activeTab === "overview" &&
                    ((notesLoading && notes.length === 0) ||
                    (tasksLoading && tasks.length === 0) ||
                    (dealFollowUpsLoading && dealFollowUps.length === 0) ? (
                        <OverviewDeferredSkeleton />
                    ) : (
                        <div data-tour="deal-overview">
                            <WorkspaceOverviewTab
                                deal={deal}
                                notes={notes}
                                tasks={tasks}
                                dealFollowUps={dealFollowUps}
                                taskBoardColumns={taskBoardColumns}
                                permissions={permissions}
                                meetingTypes={meetingTypes}
                                onNavigateToSubTab={nav.setTab}
                                onAddTask={onAddTask}
                                onAddMeeting={onAddMeeting}
                                onAddNote={onAddNote}
                            />
                        </div>
                    ))}
                {activeTab === "notes" &&
                    (notesLoading && notes.length === 0 ? (
                        <TabDeferredSkeleton />
                    ) : (
                        <WorkspaceNotesTab
                            notes={notes}
                            permissions={permissions}
                            onAddNote={() => onAddNote()}
                        />
                    ))}
                {activeTab === "tasks" &&
                    (tasksLoading && tasks.length === 0 ? (
                        <TabDeferredSkeleton />
                    ) : (
                        <WorkspaceTasksTab
                            tasks={tasks}
                            taskBoardColumns={taskBoardColumns}
                            permissions={permissions}
                            onAddTask={() => onAddTask()}
                        />
                    ))}
                {activeTab === "meetings" &&
                    (dealFollowUpsLoading && dealFollowUps.length === 0 ? (
                        <TabDeferredSkeleton />
                    ) : (
                        <WorkspaceMeetingsTab
                            deal={deal}
                            followUps={dealFollowUps}
                            meetingTypes={meetingTypes}
                            permissions={permissions}
                            onScheduleMeeting={() => onAddMeeting()}
                        />
                    ))}
                {activeTab === "files" &&
                    (filesLoading && files.length === 0 ? (
                        <TabDeferredSkeleton />
                    ) : (
                        <WorkspaceFilesTab
                            deal={deal}
                            files={files}
                            permissions={permissions}
                            fields={fields}
                            categoryIds={pipelineCategoryIds}
                            visibilityMap={dealFileVisibilityMap}
                            leadFileFields={leadFileFields}
                            leadFileFieldsData={leadFileFieldsData}
                        />
                    ))}
                {activeTab === "payments" &&
                    props.showOnlinePayment &&
                    (paymentRequestLoading && paymentRequests.length === 0 ? (
                        <TabDeferredSkeleton />
                    ) : (
                        <WorkspacePaymentsTab
                            deal={deal}
                            canCreatePaymentRequest={canCreatePaymentRequest}
                            canConfirmPaymentTransfer={
                                canConfirmPaymentTransfer
                            }
                        />
                    ))}
                {activeTab === "offers" && showOffersTab && (
                    <WorkspaceOffersTab deal={deal} />
                )}
                {activeTab === "exposes" && (
                    <WorkspaceExposesTab
                        deal={deal}
                        canEdit={dealPermissions.canEdit}
                        onCountChange={handleExposesCountChange}
                    />
                )}
                {activeTab === "recommendations" && (
                    <WorkspaceRecommendationsTab
                        deal={deal}
                        permissions={permissions}
                        restrictPackageOrProperty={
                            props.restrictPackageOrProperty
                        }
                        onCountChange={setRecommendationsCount}
                    />
                )}
                {activeTab === "sally" && (
                    <WorkspaceSallyTab
                        insights={sallyInsights}
                        loading={sallyInsightsLoading}
                        error={sallyInsightsError}
                        onRetry={refetchSallyInsights}
                        patchInsight={patchSallyInsight}
                    />
                )}
                {activeTab === "itinerary" && (
                    <WorkspaceItineraryTab
                        deal={deal}
                        canAdd={dealPermissions.canEdit}
                        canDelete={dealPermissions.canEdit}
                    />
                )}
                {activeTab === "dealinfo" && (
                    <DealInfoTab
                        deal={deal}
                        customFieldCategories={dealInfoCategories}
                        visibleFieldKeys={dealInfoFieldKeys}
                        fields={fields}
                        activeSection={nav.infoSection}
                        onSectionChange={nav.setInfoSection}
                        restrictPackageOrProperty={
                            props.restrictPackageOrProperty
                        }
                        consents={props.consents}
                        gdprSetting={props.gdprSetting}
                        showCompletionDot={showCompletionDot}
                    />
                )}
                {activeTab === "timeline" && (
                    <TimelineTab
                        dealId={deal.id}
                        dealName={deal.name}
                        userId={props.auth?.user?.id}
                        recordType="deal"
                        emailEnabled={emailEnabled}
                        onOpenEmailMessage={(messageId) =>
                            onOpenEmailMessage(messageId)
                        }
                    />
                )}
            </div>
        </section>
    );
}
