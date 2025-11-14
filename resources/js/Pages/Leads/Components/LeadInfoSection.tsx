import { useState } from "react";
import { Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import {
    Descriptions,
    Avatar,
    Tabs,
    Button,
    Dropdown,
    MenuProps,
    Tag,
    Divider,
    Space,
    Tooltip,
} from "antd";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import {
    EditOutlined,
    DeleteOutlined,
    UserOutlined,
    MailOutlined,
    PhoneOutlined,
    GlobalOutlined,
    HomeOutlined,
    CalendarOutlined,
    MoreOutlined,
} from "@ant-design/icons";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import DeleteLead from "@/Features/Leads/DeleteLead";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import dayjs from "dayjs";
import { icons } from "antd/es/image/PreviewGroup";

interface Props {
    lead: Lead;
    customFieldCategories?: any[];
    fields?: any[];
    editLeadPermission: string;
    deleteLeadPermission: string;
}

export default function LeadInfoSection({
    lead,
    customFieldCategories = [],
    fields = [],
    editLeadPermission,
    deleteLeadPermission,
}: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const [activeTab, setActiveTab] = useState("overview");
    const {
        action,
        handleAction,
        handleClose,
        selected: currentLead,
    } = useGenericEntityAction<Lead>();

    const canEdit = ["all", "added", "owned", "both"].includes(
        editLeadPermission
    );
    const canDelete = ["all", "added", "owned", "both"].includes(
        deleteLeadPermission
    );

    // Get mobile number from JSON format
    const getMobileNumber = (mobile: string | null | undefined) => {
        if (!mobile) return "--";

        if (typeof mobile === "string" && mobile.trim().startsWith("{")) {
            try {
                const mobileData = JSON.parse(mobile.trim());
                return mobileData?.phone || mobile;
            } catch (e) {
                return mobile;
            }
        }
        return mobile;
    };

    // Action menu items
    const actionItems = [
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      tooltip: "Edit Lead",
                      type: "text" as const,
                      icon: <EditOutlined />,
                      label: <span>Edit Lead</span>,
                      onClick: () => handleAction("edit", lead),
                  },
              ]
            : []),
        {
            key: "convert",
            tooltip: "Convert to Client",
            type: "text" as const,
            icon: <UserOutlined />,
            label: <span>Convert to Client</span>,
            onClick: () => handleAction("change_to_client", lead),
        },
        ...(canDelete
            ? [
                  {
                      key: "delete",
                      tooltip: "Delete Lead",
                      type: "text" as const,
                      icon: <DeleteOutlined />,
                      danger: true,
                      label: <span className="text-red-600">Delete Lead</span>,
                      onClick: () => handleAction("delete", lead),
                  },
              ]
            : []),
    ];

    // Tab items for overview and custom field categories
    const tabItems = [
        {
            key: "overview",
            label: "Overview",
            children: (
                <div className="p-6">
                    {/* Header with Avatar and Basic Info */}
                    <div className="flex items-start gap-x-4 mb-6">
                        <Avatar
                            size={80}
                            src={currentLead?.image_url || lead.image_url}
                            icon={<UserOutlined />}
                        />
                        <div className="flex-1">
                            <h2 className="text-2xl font-semibold mb-2">
                                {currentLead?.client_name_salutation ||
                                    lead.client_name_salutation}
                            </h2>
                            <p className="text-gray-600 mb-2">
                                {currentLead?.client_email || lead.client_email}
                            </p>
                            <div className="flex items-center gap-x-4">
                                {(currentLead?.mobile_with_phonecode ||
                                    lead.mobile_with_phonecode) !== "--" && (
                                    <span className="flex items-center">
                                        <PhoneOutlined className="mr-1" />
                                        {currentLead?.mobile_with_phonecode ||
                                            lead.mobile_with_phonecode}
                                    </span>
                                )}
                                {(currentLead?.company_name ||
                                    lead.company_name) && (
                                    <span className="text-gray-600">
                                        {currentLead?.company_name ||
                                            lead.company_name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <Divider />

                    <Descriptions column={2} bordered size="middle">
                        {/* Contact Information */}
                        <Descriptions.Item label="Name">
                            <span className="font-medium text-gray-900">
                                {currentLead?.client_name_salutation ||
                                    lead.client_name_salutation ||
                                    "--"}
                            </span>
                        </Descriptions.Item>

                        <Descriptions.Item label="Email">
                            {currentLead?.client_email || lead.client_email ? (
                                <div className="flex items-center gap-x-2">
                                    <MailOutlined className="text-gray-400" />
                                    <a
                                        href={`mailto:${
                                            currentLead?.client_email ||
                                            lead.client_email
                                        }`}
                                        className="text-blue-600 hover:text-blue-800"
                                    >
                                        {currentLead?.client_email ||
                                            lead.client_email}
                                    </a>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Mobile">
                            <div className="flex items-center gap-x-2">
                                <PhoneOutlined className="text-gray-400" />
                                <span>
                                    {getMobileNumber(
                                        currentLead?.mobile || lead.mobile
                                    ) ||
                                        currentLead?.mobile_with_phonecode ||
                                        lead.mobile_with_phonecode ||
                                        "--"}
                                </span>
                            </div>
                        </Descriptions.Item>

                        <Descriptions.Item label="Office Phone">
                            {currentLead?.office_phone_formatted ||
                                lead.office_phone_formatted || (
                                    <span className="text-gray-500">--</span>
                                )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Company">
                            {currentLead?.company_name || lead.company_name || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Website">
                            {currentLead?.website || lead.website ? (
                                <a
                                    href={String(
                                        currentLead?.website || lead.website
                                    )}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:text-blue-800"
                                >
                                    <GlobalOutlined className="mr-1" />
                                    {currentLead?.website || lead.website}
                                </a>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        {/* Lead Details */}
                        <Descriptions.Item label="Lead Owner">
                            {currentLead?.lead_owner || lead.lead_owner ? (
                                <div className="flex items-center gap-x-2">
                                    <Avatar
                                        size="small"
                                        src={
                                            (
                                                currentLead?.lead_owner ||
                                                lead.lead_owner
                                            )?.image_url
                                        }
                                        icon={<UserOutlined />}
                                    />
                                    <span>
                                        {
                                            (
                                                currentLead?.lead_owner ||
                                                lead.lead_owner
                                            )?.name
                                        }
                                    </span>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Added By">
                            {currentLead?.added_by || lead.added_by ? (
                                <div className="flex items-center gap-x-2">
                                    <Avatar
                                        size="small"
                                        src={
                                            (
                                                currentLead?.added_by ||
                                                lead.added_by
                                            )?.image_url
                                        }
                                        icon={<UserOutlined />}
                                    />
                                    <span>
                                        {
                                            (
                                                currentLead?.added_by ||
                                                lead.added_by
                                            )?.name
                                        }
                                    </span>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Lead Source">
                            {currentLead?.leadSource?.type ||
                                currentLead?.lead_source?.type ||
                                lead.leadSource?.type ||
                                lead.lead_source?.type || (
                                    <span className="text-gray-500">--</span>
                                )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Category">
                            {currentLead?.category?.category_name ||
                            lead.category?.category_name ? (
                                <Tag color="blue" className="font-medium">
                                    {currentLead?.category?.category_name ||
                                        lead.category?.category_name}
                                </Tag>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Created At">
                            {currentLead?.created_at || lead.created_at ? (
                                <span>
                                    <CalendarOutlined className="mr-1" />
                                    {dayjs(
                                        currentLead?.created_at ||
                                            lead.created_at
                                    ).format("MMM DD, YYYY HH:mm")}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Updated At">
                            {currentLead?.updated_at || lead.updated_at ? (
                                <span>
                                    <CalendarOutlined className="mr-1" />
                                    {dayjs(
                                        currentLead?.updated_at ||
                                            lead.updated_at
                                    ).format("MMM DD, YYYY HH:mm")}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        {/* Address Information */}
                        <Descriptions.Item label="Country">
                            {currentLead?.country || lead.country || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="State">
                            {currentLead?.state || lead.state || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="City">
                            {currentLead?.city || lead.city || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Postal Code">
                            {currentLead?.postal_code || lead.postal_code || (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Address" span={2}>
                            {currentLead?.address || lead.address ? (
                                <span>
                                    <HomeOutlined className="mr-1" />
                                    {currentLead?.address || lead.address}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        {/* Notes */}
                        {(currentLead?.note || lead.note) && (
                            <Descriptions.Item label="Notes" span={2}>
                                {currentLead?.note || lead.note}
                            </Descriptions.Item>
                        )}
                    </Descriptions>
                </div>
            ),
        },
        // Custom field categories as tabs
        ...(customFieldCategories || []).map((category) => ({
            key: `category-${category.id}`,
            label: category.name,
            children: (
                <div className="p-6">
                    <CustomFieldDisplay
                        fields={fields}
                        customFieldsData={
                            (currentLead || lead).custom_fields_data || {}
                        }
                        categoryId={category.id}
                        column={2}
                    />
                </div>
            ),
        })),
    ];

    return (
        <>
            <SaveLeadModal
                open={action === "edit"}
                onClose={handleClose}
                lead={currentLead || lead}
                setLead={(lead) => {
                    console.log("Lead updated:", lead);
                }}
            />

            <DeleteLead
                open={action === "delete"}
                onClose={() => handleClose()}
                lead={currentLead || lead}
            />

            <ChangeToClient
                open={action === "change_to_client"}
                onClose={() => handleClose()}
                lead={currentLead || lead}
            />

            <div>
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-white">
                    <h2 className="text-lg font-semibold text-gray-900">
                        Lead Information
                    </h2>
                    <Space size="small">
                        {actionItems.map((item) => (
                            <Tooltip key={item.key} title={item.tooltip}>
                                <Button
                                    type={item.type}
                                    icon={item.icon}
                                    danger={item.danger}
                                    onClick={item.onClick}
                                    size="small"
                                />
                            </Tooltip>
                        ))}
                    </Space>
                </div>

                {/* Content */}
                <Tabs
                    activeKey={activeTab}
                    onChange={setActiveTab}
                    items={tabItems}
                    className="lead-info-tabs"
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
