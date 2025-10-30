import { Deal } from "@/Types/api/deals";
import { Tabs, Button, Alert } from "antd";
import { useState } from "react";
import { PlusOutlined } from "@ant-design/icons";
import NotesTab from "./Tabs/NotesTab";
import FollowUpTab from "./Tabs/FollowUpTab";
import FilesTab from "./Tabs/FilesTab";
import ProposalsTab from "./Tabs/ProposalsTab";
import HistoryTab from "./Tabs/HistoryTab";
import GdprTab from "./Tabs/GdprTab";

interface Props {
    deal: Deal;
    notes: any[];
    dealFollowUps: any[];
    proposals: any[];
    histories: any[];
    consents: any[];
    gdprSetting: any;
    permissions: Record<string, string>;
}

export default function DealTabs({
    deal,
    notes,
    dealFollowUps,
    proposals,
    histories,
    consents,
    gdprSetting,
    permissions,
}: Props) {
    const [activeTab, setActiveTab] = useState("notes");

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

        // Follow-up Tab
        if (permissions.view_lead_follow_up !== "none") {
            items.push({
                key: "follow-up",
                label: "Follow-up",
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
                children: <FilesTab deal={deal} permissions={permissions} />,
            });
        }

        // Proposals Tab
        if (permissions.view_lead_proposals !== "none") {
            items.push({
                key: "proposals",
                label: "Proposals",
                children: (
                    <ProposalsTab
                        deal={deal}
                        proposals={proposals}
                        permissions={permissions}
                    />
                ),
            });
        }

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
                                // Handle note creation
                                window.location.href = route(
                                    "deal-notes.create",
                                    { lead: deal.id }
                                );
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
                                // Handle follow-up creation
                                window.location.href = route(
                                    "deals.follow_up",
                                    deal.id
                                );
                            }}
                        >
                            Add Follow-up
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
                            size="small"
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
                                // Handle file upload
                                // You'll need to implement modal or navigation
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
                                window.open(
                                    route("proposals.create", {
                                        deal_id: deal.id,
                                    }),
                                    "_blank"
                                );
                            }}
                        >
                            Create Proposal
                        </Button>
                    );
                }
                break;

            default:
                return null;
        }
        return null;
    };

    return (
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
    );
}
