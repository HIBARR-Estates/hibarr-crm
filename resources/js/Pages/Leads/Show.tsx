import React, { useState } from "react";
import { Lead, LeadCategory, User } from "@/Types/api/leads";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { Card, Descriptions, Button, Space, Avatar, Divider, Tabs } from "antd";
import {
    EditOutlined,
    DeleteOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    GlobalOutlined,
    HomeOutlined,
    CalendarOutlined,
} from "@ant-design/icons";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import dayjs from "dayjs";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import DeleteLead from "@/Features/Leads/DeleteLead";
import ChangeToClient from "@/Features/Leads/ChangeToClient";

export interface LeadShowProps {
    lead: Lead;
    categories: LeadCategory[];
    sources: any[];
    employees: User[];
    countries: Array<{ iso: string; nicename: string; iso3: string }>;
    salutations: Array<{ value: string; label: string }>;
    customFieldCategories?: any[];
    fields?: any[];
    editLeadPermission: string;
    deleteLeadPermission: string;
}

const Show: React.FC<LeadShowProps> = ({
    lead,

    editLeadPermission,
    deleteLeadPermission,
}) => {
    const [editModalOpen, setEditModalOpen] = useState(false);
    const [currentLead, setCurrentLead] = useState<Lead>(lead);

    const canEdit = ["all", "added", "owned", "both"].includes(
        editLeadPermission
    );
    const canDelete = ["all", "added", "owned", "both"].includes(
        deleteLeadPermission
    );

    const handleEdit = () => {
        setEditModalOpen(true);
    };

    const { action, handleAction, handleClose, selected } =
        useGenericEntityAction<Lead>();

    const actionButtons = (
        <Space>
            {canEdit && (
                <Button
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={handleEdit}
                >
                    Edit
                </Button>
            )}
            <Button
                icon={<UserOutlined />}
                onClick={() => handleAction("change_to_client", lead)}
            >
                Convert to Client
            </Button>
            {canDelete && (
                <Button
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleAction("delete", lead)}
                >
                    Delete
                </Button>
            )}
        </Space>
    );

    const tabItems = [
        {
            key: "profile",
            label: "Profile",
            children: (
                <Card className="w-full">
                    <div className="flex flex-col space-y-6">
                        {/* Header with Avatar and Basic Info */}
                        <div className="flex items-start space-x-4">
                            <Avatar
                                size={80}
                                src={currentLead.image_url}
                                icon={<UserOutlined />}
                            />
                            <div className="flex-1">
                                <h2 className="text-2xl font-semibold">
                                    {currentLead.client_name_salutation}
                                </h2>
                                <p className="text-gray-600">
                                    {currentLead.client_email}
                                </p>
                                <div className="flex items-center space-x-4 mt-2">
                                    {currentLead.mobile_with_phonecode !==
                                        "--" && (
                                        <span className="flex items-center">
                                            <PhoneOutlined className="mr-1" />
                                            {currentLead.mobile_with_phonecode}
                                        </span>
                                    )}
                                    {currentLead.company_name && (
                                        <span className="text-gray-600">
                                            {currentLead.company_name}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>

                        <Divider />

                        {/* Contact Information */}
                        <Descriptions
                            title="Contact Information"
                            column={2}
                            bordered
                        >
                            <Descriptions.Item label="Name">
                                {currentLead.client_name_salutation || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Email">
                                {currentLead.client_email ? (
                                    <span>
                                        <MailOutlined className="mr-1" />
                                        {currentLead.client_email}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Mobile">
                                {currentLead.mobile_with_phonecode || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Office Phone">
                                {currentLead.office_phone_formatted || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Company">
                                {currentLead.company_name || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Website">
                                {currentLead.website ? (
                                    <a
                                        href={currentLead.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        <GlobalOutlined className="mr-1" />
                                        {currentLead.website}
                                    </a>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Lead Details */}
                        <Descriptions title="Lead Details" column={2} bordered>
                            <Descriptions.Item label="Lead Owner">
                                {currentLead.lead_owner ? (
                                    <div className="flex items-center">
                                        <Avatar
                                            size="small"
                                            src={
                                                currentLead.lead_owner.image_url
                                            }
                                            className="mr-2"
                                        />
                                        {currentLead.lead_owner.name}
                                    </div>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Added By">
                                {currentLead.added_by ? (
                                    <div className="flex items-center">
                                        <Avatar
                                            size="small"
                                            src={currentLead.added_by.image_url}
                                            className="mr-2"
                                        />
                                        {currentLead.added_by.name}
                                    </div>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Lead Source">
                                {currentLead.leadSource?.type ||
                                    currentLead.lead_source?.type ||
                                    "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Category">
                                {currentLead.category?.category_name || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Created At">
                                {currentLead.created_at ? (
                                    <span>
                                        <CalendarOutlined className="mr-1" />
                                        {dayjs(currentLead.created_at).format(
                                            "MMM DD, YYYY HH:mm"
                                        )}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                            <Descriptions.Item label="Updated At">
                                {currentLead.updated_at ? (
                                    <span>
                                        <CalendarOutlined className="mr-1" />
                                        {dayjs(currentLead.updated_at).format(
                                            "MMM DD, YYYY HH:mm"
                                        )}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Address Information */}
                        <Descriptions
                            title="Address Information"
                            column={2}
                            bordered
                        >
                            <Descriptions.Item label="Country">
                                {currentLead.country || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="State">
                                {currentLead.state || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="City">
                                {currentLead.city || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Postal Code">
                                {currentLead.postal_code || "--"}
                            </Descriptions.Item>
                            <Descriptions.Item label="Address" span={2}>
                                {currentLead.address ? (
                                    <span>
                                        <HomeOutlined className="mr-1" />
                                        {currentLead.address}
                                    </span>
                                ) : (
                                    "--"
                                )}
                            </Descriptions.Item>
                        </Descriptions>

                        {/* Notes */}
                        {currentLead.note && (
                            <Descriptions title="Notes" bordered>
                                <Descriptions.Item label="Notes" span={3}>
                                    {currentLead.note}
                                </Descriptions.Item>
                            </Descriptions>
                        )}
                    </div>
                </Card>
            ),
        },
        {
            key: "deals",
            label: "Deals",
            children: (
                <Card>
                    <p>Deals related to this lead will be displayed here.</p>
                    {/* TODO: Implement deals table */}
                </Card>
            ),
        },
        {
            key: "notes",
            label: "Notes",
            children: (
                <Card>
                    <p>
                        Notes and activities for this lead will be displayed
                        here.
                    </p>
                    {/* TODO: Implement notes/activities */}
                </Card>
            ),
        },
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={currentLead.client_name_salutation}
                breadcrumbs={[
                    { name: "Leads", url: route("lead-contact.index") },
                    { name: currentLead?.client_name || "" },
                ]}
                filterSection={actionButtons}
            >
                <div className="max-w-7xl mx-auto space-y-6">
                    <Tabs items={tabItems} />
                </div>
            </PageLayout>

            {/* Edit Modal */}
            <SaveLeadModal
                open={editModalOpen}
                onClose={() => setEditModalOpen(false)}
                lead={currentLead}
                setLead={(lead) => lead && setCurrentLead(lead)}
            />
            <DeleteLead
                open={action === "delete"}
                onClose={() => handleClose()}
                lead={lead}
            />
            <ChangeToClient
                open={action === "change_to_client"}
                onClose={() => handleClose()}
                lead={lead}
            />
        </DashboardLayout>
    );
};

export default Show;
