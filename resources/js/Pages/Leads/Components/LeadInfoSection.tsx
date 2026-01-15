import { useState, useEffect } from "react";
import { Lead } from "@/Types/api/leads";
import { router, usePage } from "@inertiajs/react";
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
    message,
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
    CheckSquareOutlined,
} from "@ant-design/icons";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import DeleteLead from "@/Features/Leads/DeleteLead";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import SaveTaskModal from "@/Features/Tasks/SaveTask/SaveTaskModal";
import dayjs from "dayjs";
import { icons } from "antd/es/image/PreviewGroup";
import EditableField from "@/Components/EditableField";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import UserIndicator from "@/Components/UserIndicator";
import axios from "axios";

interface Props {
    lead: Lead;
    customFieldCategories?: any[];
    fields?: any[];
    editLeadPermission: string;
    deleteLeadPermission: string;
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

export default function LeadInfoSection({
    lead,
    customFieldCategories = [],
    fields = [],
    editLeadPermission,
    deleteLeadPermission,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
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

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [currentLeadState, setCurrentLeadState] = useState<Lead>(lead);
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    // API Mutation for inline updates
    const { mutateAsync: updateLead, status } = useApiMutate<
        Record<string, any>,
        { lead: Lead },
        any
    >(
        route("lead-contact.patch", { lead_contact: currentLeadState.id }),
        "PATCH",
        (response: any) => {
            if (response?.status === "success" && response?.data?.lead) {
                // Merge only the updated attributes into current state
                // This preserves relationships and custom fields that weren't reloaded
                setCurrentLeadState((prev) => {
                    const updated = { ...prev } as Record<string, any>;
                    // Only update the fields that were returned
                    const leadData = response.data.lead as Record<string, any>;
                    Object.keys(leadData).forEach((key) => {
                        if (leadData[key] !== undefined) {
                            updated[key] = leadData[key];
                        }
                    });
                    return updated as Lead;
                });
            }
            // Clear the updating field after completion
            setUpdatingField(null);
        }
    );

    // Helper to check if a specific field is loading
    const isFieldLoading = (fieldName: string) => updatingField === fieldName;

    // Sync currentLeadState when lead prop changes
    useEffect(() => {
        setCurrentLeadState(lead);
    }, [lead]);

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

    // Handle field update
    const handleFieldUpdate = async (
        fieldName: string,
        value: any
    ): Promise<void> => {
        // Set the updating field to show loading only for this field
        setUpdatingField(fieldName);

        // Check if this is a custom field (starts with "field_")
        const isCustomField = fieldName.startsWith("field_");

        // Check if value is a File (for file uploads)
        const isFile = value instanceof File;

        try {
            if (isFile) {
                // Handle file upload via FormData
                const formData = new FormData();
                formData.append(`custom_fields[${fieldName}]`, value);

                const response = await axios.patch(
                    route("lead-contact.patch", {
                        lead_contact: currentLeadState.id,
                    }),
                    formData,
                    {
                        headers: {
                            "Content-Type": "multipart/form-data",
                            Accept: "application/json",
                        },
                    }
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data?.lead
                ) {
                    setCurrentLeadState((prev) => {
                        const updated = { ...prev } as Record<string, any>;
                        const leadData = response.data.data.lead as Record<
                            string,
                            any
                        >;
                        Object.keys(leadData).forEach((key) => {
                            if (leadData[key] !== undefined) {
                                updated[key] = leadData[key];
                            }
                        });
                        return updated as Lead;
                    });
                    message.success("File uploaded successfully");
                }
                setUpdatingField(null);
                return;
            }

            let payloadData: Record<string, any>;

            if (isCustomField) {
                // Handle custom fields - send as custom_fields object
                payloadData = {
                    custom_fields: {
                        [fieldName]: value,
                    },
                };
            } else {
                // Map frontend field names to API field names and process values
                let processedValue = value;

                // Process value based on field type
                if (fieldName === "mobile") {
                    // Keep mobile as is, backend will handle JSON formatting if needed
                    processedValue = value;
                } else if (
                    fieldName === "close_date" ||
                    fieldName === "next_follow_up"
                ) {
                    processedValue = value || null;
                } else if (fieldName === "value") {
                    processedValue = value ? parseFloat(value.toString()) : 0;
                } else if (fieldName === "gender") {
                    // Ensure gender is sent as the actual value (male/female) or null
                    processedValue = value || null;
                }

                payloadData = { [fieldName]: processedValue };
            }

            await updateLead(payloadData);
        } catch (error: any) {
            // Clear the updating field on error
            setUpdatingField(null);
            // Error managed by useApiMutate, but re-throwing for EditableField state management
            throw error;
        }
    };

    // Action menu items
    const actionItems = [
        {
            key: "add_task",
            tooltip: "Add Task",
            type: "text" as const,
            icon: <CheckSquareOutlined />,
            label: <span>Add Task</span>,
            onClick: () => setIsTaskModalOpen(true),
        },
        ...(canEdit
            ? [
                  {
                      key: "edit",
                      tooltip: "Edit Contact",
                      type: "text" as const,
                      icon: <EditOutlined />,
                      label: <span>Edit Contact</span>,
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
                    {/* <div className="flex items-start gap-x-4 mb-6">
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
                    </div> */}

                    {/* <Divider /> */}

                    <Descriptions column={2} bordered size="middle">
                        {/* Contact Information */}
                        <Descriptions.Item label="Name">
                            <EditableField
                                value={
                                    currentLeadState.client_name_salutation ||
                                    currentLeadState.client_name
                                }
                                fieldName="client_name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("client_name", value)
                                }
                                className="font-medium text-gray-900"
                                loading={isFieldLoading("client_name")}
                                disabled={!canEdit}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Email">
                            {currentLeadState.client_email ? (
                                <div className="flex items-center gap-x-2">
                                    <MailOutlined className="text-gray-400" />
                                    <EditableField
                                        value={currentLeadState.client_email}
                                        fieldName="client_email"
                                        fieldType="email"
                                        onSave={(value) =>
                                            handleFieldUpdate(
                                                "client_email",
                                                value
                                            )
                                        }
                                        className="text-blue-600 hover:text-blue-800"
                                        disabled={!canEdit}
                                        loading={isFieldLoading("client_email")}
                                    />
                                </div>
                            ) : (
                                <EditableField
                                    value=""
                                    fieldName="client_email"
                                    fieldType="email"
                                    onSave={(value) =>
                                        handleFieldUpdate("client_email", value)
                                    }
                                    placeholder="Add email"
                                    disabled={!canEdit}
                                    loading={isFieldLoading("client_email")}
                                />
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Mobile">
                            <div className="flex items-center gap-x-2">
                                <PhoneOutlined className="text-gray-400" />
                                <EditableField
                                    value={
                                        getMobileNumber(
                                            currentLeadState.mobile
                                        ) ||
                                        currentLeadState.mobile_with_phonecode ||
                                        ""
                                    }
                                    fieldName="mobile"
                                    fieldType="text"
                                    onSave={(value) =>
                                        handleFieldUpdate("mobile", value)
                                    }
                                    placeholder="Add mobile"
                                    disabled={!canEdit}
                                    loading={isFieldLoading("mobile")}
                                />
                            </div>
                        </Descriptions.Item>

                        <Descriptions.Item label="Office Phone">
                            <EditableField
                                value={
                                    currentLeadState.office_phone_formatted ||
                                    currentLeadState.office ||
                                    ""
                                }
                                fieldName="office"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("office", value)
                                }
                                placeholder="Add office phone"
                                disabled={!canEdit}
                                loading={isFieldLoading("office")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Gender">
                            <EditableField
                                value={currentLeadState.gender || ""}
                                fieldName="gender"
                                fieldType="select"
                                options={[
                                    { label: "Male", value: "male" },
                                    { label: "Female", value: "female" },
                                ]}
                                onSave={(value) =>
                                    handleFieldUpdate("gender", value)
                                }
                                displayValue={
                                    currentLeadState.gender ? (
                                        <span className="capitalize">
                                            {currentLeadState.gender}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                disabled={!canEdit}
                                loading={isFieldLoading("gender")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Company">
                            <EditableField
                                value={currentLeadState.company_name || ""}
                                fieldName="company_name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("company_name", value)
                                }
                                placeholder="Add company name"
                                disabled={!canEdit}
                                loading={isFieldLoading("company_name")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Website">
                            {currentLeadState.website ? (
                                <EditableField
                                    value={currentLeadState.website}
                                    fieldName="website"
                                    fieldType="text"
                                    onSave={(value) =>
                                        handleFieldUpdate("website", value)
                                    }
                                    displayValue={
                                        <a
                                            href={String(
                                                currentLeadState.website
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <GlobalOutlined className="mr-1" />
                                            {currentLeadState.website}
                                        </a>
                                    }
                                    disabled={!canEdit}
                                    loading={isFieldLoading("website")}
                                />
                            ) : (
                                <EditableField
                                    value=""
                                    fieldName="website"
                                    fieldType="text"
                                    onSave={(value) =>
                                        handleFieldUpdate("website", value)
                                    }
                                    placeholder="Add website"
                                    disabled={!canEdit}
                                    loading={isFieldLoading("website")}
                                />
                            )}
                        </Descriptions.Item>

                        {/* Lead Details */}
                        <Descriptions.Item label="Lead Owner">
                            <EditableField
                                value={
                                    currentLeadState.lead_owner &&
                                    typeof currentLeadState.lead_owner ===
                                        "object"
                                        ? currentLeadState.lead_owner.id
                                        : (currentLeadState.lead_owner as
                                              | number
                                              | null) ?? null
                                }
                                fieldName="lead_owner"
                                selectorType="employees"
                                onSave={(value) =>
                                    handleFieldUpdate("lead_owner", value)
                                }
                                displayValue={
                                    currentLeadState.lead_owner ? (
                                        <UserIndicator
                                            data={currentLeadState.lead_owner}
                                            size="sm"
                                        />
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                disabled={!canEdit}
                                loading={isFieldLoading("lead_owner")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Added By">
                            {currentLeadState.added_by ? (
                                <div className="flex items-center gap-x-2">
                                    <Avatar
                                        size="small"
                                        src={
                                            currentLeadState.added_by?.image_url
                                        }
                                        icon={<UserOutlined />}
                                    />
                                    <span>
                                        {currentLeadState.added_by?.name}
                                    </span>
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Lead Source">
                            <EditableField
                                value={currentLeadState.source_id || null}
                                fieldName="source_id"
                                selectorType="sources"
                                onSave={(value) =>
                                    handleFieldUpdate("source_id", value)
                                }
                                displayValue={
                                    currentLeadState.leadSource?.type ||
                                    currentLeadState.lead_source?.type ? (
                                        <Tag
                                            color="green"
                                            className="font-medium"
                                        >
                                            {currentLeadState.leadSource
                                                ?.type ||
                                                currentLeadState.lead_source
                                                    ?.type}
                                        </Tag>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                disabled={!canEdit}
                                loading={isFieldLoading("source_id")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Category">
                            <EditableField
                                value={currentLeadState.category_id || null}
                                fieldName="category_id"
                                selectorType="categories"
                                onSave={(value) =>
                                    handleFieldUpdate("category_id", value)
                                }
                                displayValue={
                                    currentLeadState.category?.category_name ? (
                                        <Tag
                                            color="blue"
                                            className="font-medium"
                                        >
                                            {
                                                currentLeadState.category
                                                    .category_name
                                            }
                                        </Tag>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                disabled={!canEdit}
                                loading={isFieldLoading("category_id")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Created At">
                            {currentLeadState.created_at ? (
                                <span>
                                    <CalendarOutlined className="mr-1" />
                                    {dayjs(currentLeadState.created_at).format(
                                        "MMM DD, YYYY HH:mm"
                                    )}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Updated At">
                            {currentLeadState.updated_at ? (
                                <span>
                                    <CalendarOutlined className="mr-1" />
                                    {dayjs(currentLeadState.updated_at).format(
                                        "MMM DD, YYYY HH:mm"
                                    )}
                                </span>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        {/* Address Information */}
                        <Descriptions.Item label="Country">
                            <EditableField
                                value={currentLeadState.country || ""}
                                fieldName="country"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("country", value)
                                }
                                placeholder="Add country"
                                disabled={!canEdit}
                                loading={isFieldLoading("country")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="State">
                            <EditableField
                                value={currentLeadState.state || ""}
                                fieldName="state"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("state", value)
                                }
                                placeholder="Add state"
                                disabled={!canEdit}
                                loading={isFieldLoading("state")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="City">
                            <EditableField
                                value={currentLeadState.city || ""}
                                fieldName="city"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("city", value)
                                }
                                placeholder="Add city"
                                disabled={!canEdit}
                                loading={isFieldLoading("city")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Postal Code">
                            <EditableField
                                value={currentLeadState.postal_code || ""}
                                fieldName="postal_code"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("postal_code", value)
                                }
                                placeholder="Add postal code"
                                disabled={!canEdit}
                                loading={isFieldLoading("postal_code")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Address" span={2}>
                            <EditableField
                                value={currentLeadState.address || ""}
                                fieldName="address"
                                fieldType="textarea"
                                onSave={(value) =>
                                    handleFieldUpdate("address", value)
                                }
                                displayValue={
                                    currentLeadState.address ? (
                                        <span>
                                            <HomeOutlined className="mr-1" />
                                            {currentLeadState.address}
                                        </span>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                placeholder="Add address"
                                disabled={!canEdit}
                                loading={isFieldLoading("address")}
                            />
                        </Descriptions.Item>

                        {/* Notes */}
                        <Descriptions.Item label="Notes" span={2}>
                            <EditableField
                                value={currentLeadState.note || ""}
                                fieldName="note"
                                fieldType="textarea"
                                onSave={(value) =>
                                    handleFieldUpdate("note", value)
                                }
                                placeholder="Add notes"
                                disabled={!canEdit}
                                loading={isFieldLoading("note")}
                            />
                        </Descriptions.Item>
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
                            currentLeadState.custom_fields_data || {}
                        }
                        categoryId={category.id}
                        column={2}
                        onUpdate={(field, value) =>
                            handleFieldUpdate(field, value)
                        }
                        editable={canEdit}
                        loadingField={updatingField}
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
                onClose={() => {
                    router.visit(route("lead-contact.index"));
                    handleClose();
                }}
                lead={currentLead || lead}
            />

            <ChangeToClient
                open={action === "change_to_client"}
                onClose={() => handleClose()}
                lead={currentLead || lead}
            />

            <SaveTaskModal
                open={isTaskModalOpen}
                onClose={() => setIsTaskModalOpen(false)}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={{ type: "lead", id: currentLeadState.id }}
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
