import { Deal } from "@/Types/api/deals";
import { Button, Alert, Drawer } from "antd";
import SideNavTabs, { SideNavItem } from "@/Components/SideNavTabs";
import { useEffect, useState } from "react";
import { PlusOutlined, GiftOutlined } from "@ant-design/icons";
import NotesTab from "./Tabs/NotesTab";
import FollowUpTab from "./Tabs/FollowUpTab";
import FilesTab from "./Tabs/FilesTab";
import HistoryTab from "./Tabs/HistoryTab";
import GdprTab from "./Tabs/GdprTab";
import RecommendationsTab from "./Tabs/RecommendationsTab";
import usePipelineHasPackages from "../Redesign/hooks/usePipelineHasPackages";
import DealOffersTab from "@/Features/Deals/DealOffersTab";
import { Note } from "@/Types/api/note";
import { DealFollowup } from "@/Types/api/deal-followup";
import { DealFile } from "@/Types/api/file";
import { Proposal } from "@/Types/api/proposal";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import AddNote from "./Tabs/notes/AddNote";
import AddFollowup from "./Tabs/followups/AddFollowup";
import FileUpload from "./Tabs/files/FileUpload";
import SaveProposal from "./Tabs/proposals/SaveProposal";
import TasksTab from "@/Components/TasksTab";
import { Task } from "@/Types/api/tasks";
import { SaveTaskModal } from "@/Features/Tasks/SaveTask";
import useTranslation from "@/Hooks/useTranslation";
import LeadFlightItineraryTab from "@/Components/LeadFlightItineraryTab";
import useDealPermissions from "@/Hooks/useDealPermissions";

interface Props {
    deal: Deal;
    notes: Note[];
    dealFollowUps: DealFollowup[];
    meetingTypes: Array<{ id: number; name: string; color?: string }>;
    files: DealFile[];
    proposals: Proposal[];
    histories: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

export default function DealTabs({
    deal,
    notes = [],
    dealFollowUps = [],
    meetingTypes = [],
    files = [],
    proposals = [],
    histories = [],
    consents = [],
    gdprSetting = null,
    permissions = {},
    tasks = [],
    taskCategories = [],
    taskLabels = [],
    taskBoardColumns = [],
    employees = [],
    projects = [],
}: Props) {
    const [activeTab, setActiveTabState] = useState(
        () => new URLSearchParams(window.location.search).get("tab") || "notes",
    );
    const setActiveTab = (key: string) => {
        setActiveTabState(key);
        const url = new URL(window.location.href);
        url.searchParams.set("tab", key);
        window.history.replaceState({}, "", url.toString());
    };
    const { t } = useTranslation();
    const { canEdit: canModifyDeal, isWatcherOnly } = useDealPermissions(deal);
    const pipelineHasPackages = usePipelineHasPackages();
    const offersEligible =
        permissions.view_lead_proposals !== "none" && !pipelineHasPackages;
    // Visibility comes straight off the already-loaded deal payload — no
    // need for a separate eager fetch on every eligible deal just to answer
    // "does this deal have any offers". DealOffersTab fetches the full offer
    // rows itself, only once the tab is actually opened, and owns its own
    // retry UI for that fetch.
    const showOffersTab =
        offersEligible && (deal.offer_applications?.length ?? 0) > 0;

    const { action, handleAction, handleClose } = useGenericEntityAction();

    // Build tab items based on permissions
    const buildTabItems = () => {
        const items = [];

        // Notes Tab
        if (permissions.view_deal_note !== "none") {
            items.push({
                key: "notes",
                label: t("pages.deals.tabs.notes"),
                children: (
                    <NotesTab
                        deal={deal}
                        notes={notes}
                        permissions={permissions}
                    />
                ),
            });
        }

        // Tasks Tab
        items.push({
            key: "tasks",
            label: "Tasks",
            children: (
                <TasksTab
                    tasks={tasks}
                    relatedEntity={{ type: "deal", id: deal.id }}
                    taskCategories={taskCategories}
                    taskLabels={taskLabels}
                    taskBoardColumns={taskBoardColumns}
                    employees={employees}
                    projects={projects}
                    permissions={permissions as any}
                />
            ),
        });

        // Follow-up Tab
        if (permissions.view_lead_follow_up !== "none") {
            items.push({
                key: "follow-up",
                label: t("pages.deals.tabs.meeting"),
                children: (
                    <FollowUpTab
                        deal={deal}
                        followUps={dealFollowUps}
                        permissions={permissions}
                    />
                ),
            });
        }

        // Files Tab
        if (permissions.view_lead_files !== "none") {
            items.push({
                key: "files",
                label: t("pages.deals.tabs.files"),
                children: (
                    <FilesTab
                        deal={deal}
                        files={files}
                        permissions={permissions}
                    />
                ),
            });
        }

        // Recommendations Tab - AI-powered property recommendations.
        // Hidden for package pipelines, which do not sell properties.
        if (!pipelineHasPackages) {
            items.push({
                key: "recommendations",
                label: t("pages.deals.tabs.recommendations"),
                children: (
                    <RecommendationsTab deal={deal} permissions={permissions} />
                ),
            });
        }

        // Proposals Tab
        // TODO: Enable proposals tab when ready
        // if (permissions.view_lead_proposals !== "none") {
        //     items.push({
        //         key: "proposals",
        //         label: "Proposals",
        //         children: (
        //             <ProposalsTab
        //                 deal={deal}
        //                 proposals={proposals}
        //                 permissions={permissions}
        //             />
        //         ),
        //     });
        // }

        // GDPR Tab
        if (gdprSetting?.enable_gdpr) {
            items.push({
                key: "gdpr",
                label: "GDPR",
                children: (
                    <GdprTab
                        deal={deal}
                        consents={consents}
                        gdprSetting={gdprSetting}
                    />
                ),
            });
        }

        // Offers — only when a property on this deal has an applied offer.
        if (showOffersTab) {
            items.push({
                key: "offers",
                label: (
                    <span>
                        <GiftOutlined className="mr-1" />
                        {t("pages.deals.tabs.offers")}
                    </span>
                ),
                children: <DealOffersTab deal={deal} />,
            });
        }

        // History Tab
        items.push({
            key: "history",
            label: t("pages.deals.tabs.history"),
            children: <HistoryTab deal={deal} histories={histories} />,
        });

        // Itinerary Tab
        items.push({
            key: "itinerary",
            label: t("pages.flight_itinerary.tab"),
            children: (
                <LeadFlightItineraryTab
                    itineraryLegs={deal.lead_flight_itineraries || []}
                    dealId={deal.id}
                    permissions={{
                        canAdd: canModifyDeal,
                        canEdit: canModifyDeal,
                        canDelete: canModifyDeal,
                    }}
                />
            ),
        });

        return items;
    };

    // Get action button for current tab
    const getTabAction = () => {
        switch (activeTab) {
            case "notes":
                if (
                    !isWatcherOnly &&
                    (permissions.add_deal_note === "all" ||
                        permissions.add_deal_note === "added" ||
                        permissions.add_deal_note === "both")
                ) {
                    return (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                handleAction("add_note");
                            }}
                        >
                            {t("pages.deals.actions.add_note")}
                        </Button>
                    );
                }
                break;

            case "follow-up":
                if (
                    !isWatcherOnly &&
                    deal.lead_stage?.slug !== "win" &&
                    deal.lead_stage?.slug !== "lost" &&
                    (permissions.add_lead_follow_up === "all" ||
                        permissions.add_lead_follow_up === "added")
                ) {
                    return (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                handleAction("add_follow_up");
                            }}
                        >
                            {t("pages.deals.actions.add_meeting")}
                        </Button>
                    );
                }

                if (
                    deal.lead_stage?.slug === "win" ||
                    deal.lead_stage?.slug === "lost"
                ) {
                    return (
                        <Alert
                            message={t("pages.deals.tabs.followup_locked")}
                            type="info"
                            showIcon
                        />
                    );
                }
                break;

            case "files":
                if (
                    permissions.add_lead_files === "all" ||
                    permissions.add_lead_files === "added"
                ) {
                    return (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                handleAction("add_file");
                            }}
                        >
                            {t("pages.deals.actions.upload_file")}
                        </Button>
                    );
                }
                break;

            case "proposals":
                if (
                    permissions.add_lead_proposals === "all" ||
                    permissions.add_lead_proposals === "added"
                ) {
                    return (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                handleAction("add_proposal");
                            }}
                        >
                            {t("pages.deals.actions.create_proposal")}
                        </Button>
                    );
                }
                break;
            case "tasks":
                return (
                    <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => {
                            handleAction("add_task");
                        }}
                    >
                        {t("pages.deals.actions.add_task")}
                    </Button>
                );

                break;

            default:
                return null;
        }
        return null;
    };

    const tabItems = buildTabItems();
    const sideNavItems: SideNavItem[] = tabItems.map((item) => ({
        key: item.key,
        label:
            typeof item.label === "string"
                ? item.label
                : t(`pages.deals.tabs.${item.key}`),
    }));
    // A ?tab= deep link can name a tab this deal does not show (e.g. offers on
    // a package pipeline) — fall back to the first available tab rather than
    // rendering an empty panel.
    const dealTabActiveContent =
        tabItems.find((item) => item.key === activeTab)?.children ??
        tabItems[0]?.children;

    // Keep activeTab (and hence the URL + SideNavTabs' highlighted item) in
    // sync when the tab it names is no longer visible — otherwise the
    // sidebar highlights nothing (or a stale key) while the content pane
    // above already fell back to the first tab.
    useEffect(() => {
        if (tabItems.length === 0) return;
        if (!tabItems.some((item) => item.key === activeTab)) {
            setActiveTab(tabItems[0].key);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tabItems, activeTab]);

    return (
        <>
            <AddNote
                deal={deal}
                onClose={() => handleClose()}
                open={action === "add_note"}
            />
            <AddFollowup
                context="deal"
                deal={deal}
                onClose={() => handleClose()}
                open={action === "add_follow_up"}
            />

            <Drawer
                open={action === "add_proposal"}
                onClose={() => handleClose()}
            >
                <SaveProposal
                    visible={action === "add_proposal"}
                    onClose={() => handleClose()}
                    deal={deal}
                    mode="create"
                />
            </Drawer>
            <SaveTaskModal
                open={action === "add_task"}
                onClose={() => handleClose()}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={{
                    type: "deal",
                    id: deal.id,
                }}
            />
            <FileUpload
                deal={deal}
                onClose={() => handleClose()}
                open={action === "add_file"}
            />
            <div className="bg-white">
                {/* Tab Header with Action */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {t("pages.deals.tabs.header")}
                    </h2>
                    <div className="tab-action">{getTabAction()}</div>
                </div>

                {/* Sidebar + Content */}
                <div className="flex min-h-0">
                    <SideNavTabs
                        items={sideNavItems}
                        activeKey={activeTab}
                        onChange={setActiveTab}
                    />
                    <div className="flex-1 min-w-0 overflow-y-auto h-[40vh]">
                        {dealTabActiveContent}
                    </div>
                </div>
            </div>
        </>
    );
}
