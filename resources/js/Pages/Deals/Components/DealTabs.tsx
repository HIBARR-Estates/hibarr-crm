import { Deal } from "@/Types/api/deals";
import { Tabs, Button, Alert, Drawer } from "antd";
import { useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import NotesTab from "./Tabs/NotesTab";
import FollowUpTab from "./Tabs/FollowUpTab";
import FilesTab from "./Tabs/FilesTab";
import HistoryTab from "./Tabs/HistoryTab";
import GdprTab from "./Tabs/GdprTab";
import RecommendationsTab from "./Tabs/RecommendationsTab";
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
    notes,
    dealFollowUps,
    meetingTypes,
    files,
    proposals,
    histories,
    consents,
    gdprSetting,
    permissions,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: Props) {
    const [activeTab, setActiveTab] = useState("notes");

    const { action, handleAction, handleClose } = useGenericEntityAction();

    // Build tab items based on permissions
    const buildTabItems = () => {
        const items = [];

        // Notes Tab
        if (permissions.view_deal_note !== "none") {
            items.push({
                key: "notes",
                label: "Notes",
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
                label: "Meeting",
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
                label: "Files",
                children: (
                    <FilesTab
                        deal={deal}
                        files={files}
                        permissions={permissions}
                    />
                ),
            });
        }

        // Recommendations Tab - AI-powered property recommendations
        items.push({
            key: "recommendations",
            label: "Recommendations",
            children: (
                <RecommendationsTab deal={deal} permissions={permissions} />
            ),
        });

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

        // History Tab
        items.push({
            key: "history",
            label: "History",
            children: <HistoryTab deal={deal} histories={histories} />,
        });

        return items;
    };

    // Get action button for current tab
    const getTabAction = () => {
        switch (activeTab) {
            case "notes":
                if (
                    permissions.add_deal_note === "all" ||
                    permissions.add_deal_note === "added" ||
                    permissions.add_deal_note === "both"
                ) {
                    return (
                        <Button
                            type="primary"
                            icon={<PlusOutlined />}
                            onClick={() => {
                                handleAction("add_note");
                            }}
                        >
                            Add Note
                        </Button>
                    );
                }
                break;

            case "follow-up":
                if (
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
                            Add Meeting
                        </Button>
                    );
                }

                if (
                    deal.lead_stage?.slug === "win" ||
                    deal.lead_stage?.slug === "lost"
                ) {
                    return (
                        <Alert
                            message="Cannot add follow-up for completed deals"
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
                            Upload File
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
                            Create Proposal
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
                        Add Task
                    </Button>
                );

                break;

            default:
                return null;
        }
        return null;
    };

    return (
        <>
            <AddNote
                deal={deal}
                onClose={() => handleClose()}
                open={action === "add_note"}
            />
            <AddFollowup
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
                        Deal Details
                    </h2>
                    <div className="tab-action">{getTabAction()}</div>
                </div>

                {/* Tabs */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={buildTabItems()}
                    className="deal-detail-tabs"
                    tabBarStyle={{
                        paddingLeft: 24,
                        paddingRight: 24,
                        marginBottom: 0,
                        backgroundColor: "#fafafa",
                        borderBottom: "1px solid #f0f0f0",
                    }}
                />
            </div>
        </>
    );
}
