import PageLayout from "@/Components/PageLayout";
import usePageRefresh from "@/Hooks/usePageRefresh";
import { useState } from "react";
import DealStickyHeader from "./components/header/DealStickyHeader";
import DealMainTabs from "./components/tabs/DealMainTabs";
import DealInfoTab from "./components/tabs/DealInfoTab";
import TimelineTab from "./components/tabs/TimelineTab";
import WorkspaceTab from "./components/workspace/WorkspaceTab";
import useDealViewNavigation from "./hooks/useDealViewNavigation";
import { DealShowProps } from "./types";
import "./deal-redesign.css";

export default function DealViewRedesign(props: DealShowProps) {
    const [isDealEditMode] = useState(false);
    const nav = useDealViewNavigation();
    const { refresh, isRefreshing } = usePageRefresh({
        canRefresh: () => !isDealEditMode,
    });

    return (
        <PageLayout title={props.pageTitle} breadcrumbs={[]}>
            <div className="deal-redesign min-h-screen bg-[#f5f6f8]">
                <div className="mx-auto w-full max-w-[1320px]">
                    <DealStickyHeader
                        deal={props.deal}
                        permissions={props.permissions}
                        employees={props.employees}
                        isRefreshing={isRefreshing}
                        onRefresh={refresh}
                    />
                    <DealMainTabs mainTab={nav.mainTab} onChange={nav.setMainTab} />

                    <div className="p-[26px]">
                        {nav.mainTab === "workspace" && (
                            <WorkspaceTab
                                deal={props.deal}
                                notes={props.notes}
                                tasks={props.tasks}
                                dealFollowUps={props.dealFollowUps}
                                files={props.files}
                                proposals={props.proposals}
                                taskCategories={props.taskCategories}
                                taskLabels={props.taskLabels}
                                taskBoardColumns={props.taskBoardColumns}
                                employees={props.employees}
                                projects={props.projects}
                                permissions={props.permissions}
                                activeSubTab={nav.workspaceSubTab}
                                onChangeSubTab={nav.setWorkspaceSubTab}
                                onSwitchToDealInfo={() => nav.switchToDealInfo("general")}
                            />
                        )}
                        {nav.mainTab === "dealinfo" && (
                            <DealInfoTab
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
