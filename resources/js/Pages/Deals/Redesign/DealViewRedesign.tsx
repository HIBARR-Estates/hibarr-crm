import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useState } from "react";
import { usePage } from "@inertiajs/react";
import type { PageProps } from "@/Components/DashboardLayout";
import EntityAiSummaryCard from "@/Components/EntitySummary/EntityAiSummaryCard";
import DealStickyHeader from "./components/header/DealStickyHeader";
import DealMainTabs from "./components/tabs/DealMainTabs";
import DealInfoTab from "./components/tabs/DealInfoTab";
import TimelineTab from "./components/tabs/TimelineTab";
import WorkspaceTab from "./components/workspace/WorkspaceTab";
import useDealViewNavigation from "./hooks/useDealViewNavigation";
import { DealShowProps } from "./types";
import "./deal-redesign.css";
import useTranslation from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

export default function DealViewRedesign(props: DealShowProps) {
    const [isDealEditMode] = useState(false);
    const nav = useDealViewNavigation();
    const { props: pageProps } = usePage<PageProps>();
    const featureFlags = props.featureFlags ?? pageProps.featureFlags;
    const showAiSummary = featureFlags?.["sales.ai-entity-summary"] === true;
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });
    const pageTitle = props?.pageTitle || props?.deal?.name;
    const { t } = useTranslation();
    const { td } = useTd();

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: t("app.menu.dashboard"), url: route("dashboard") },
                { name: td("Deals"), url: route("deals.index") },
                { name: td(pageTitle) },
            ]}
        >
            <div className="deal-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto w-full max-w-[1320px]">
                    <DealStickyHeader
                        deal={props.deal}
                        permissions={props.permissions}
                        employees={props.employees}
                        isRefreshing={isRefreshing}
                        onRefresh={refresh}
                    />
                    {showAiSummary && (
                        <EntityAiSummaryCard
                            entityType="deal"
                            entityId={props.deal.id}
                            initialSummary={props.dealAiSummary}
                            variant="redesign"
                            onCreateTask={() => nav.setWorkspaceSubTab("tasks")}
                            onScheduleCall={() =>
                                nav.setWorkspaceSubTab("meetings")
                            }
                            onRequestDocuments={() =>
                                nav.setWorkspaceSubTab("files")
                            }
                            onReviewStaleDeal={() => nav.setMainTab("timeline")}
                        />
                    )}
                    <DealMainTabs
                        mainTab={nav.mainTab}
                        onChange={nav.setMainTab}
                    />

                    <div className="p-[26px]">
                        {nav.mainTab === "workspace" && (
                            <WorkspaceTab
                                deal={props.deal}
                                notes={props.notes}
                                tasks={props.tasks}
                                dealFollowUps={props.dealFollowUps}
                                files={props.files}
                                proposals={props.proposals}
                                fields={props.fields}
                                meetingTypes={props.meetingTypes}
                                taskBoardColumns={props.taskBoardColumns}
                                permissions={props.permissions}
                                activeSubTab={nav.workspaceSubTab}
                                onChangeSubTab={nav.setWorkspaceSubTab}
                                onSwitchToDealInfo={() =>
                                    nav.switchToDealInfo("general")
                                }
                            />
                        )}
                        {nav.mainTab === "dealinfo" && (
                            <DealInfoTab
                                deal={props.deal}
                                customFieldCategories={props.customFieldCategories}
                                fields={props.fields}
                                activeSection={nav.infoSection}
                                onSectionChange={nav.setInfoSection}
                            />
                        )}
                        {nav.mainTab === "timeline" && (
                            <TimelineTab
                                dealId={props.deal.id}
                                dealName={props.deal.name}
                                userId={props.auth?.user?.id}
                            />
                        )}
                    </div>
                </div>
            </div>
        </PageLayout>
    );
}
