import { Deal } from "@/Types/api/deals";
import { Link, router, usePage } from "@inertiajs/react";
import {
    Descriptions,
    Tag,
    Avatar,
    Tooltip,
    Tabs,
    Button,
    Space,
    message,
} from "antd";
import {
    MailOutlined,
    PhoneOutlined,
    EditOutlined,
    DeleteOutlined,
    CheckSquareOutlined,
    CloseOutlined,
    CheckOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect } from "react";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import { useDealPermissions } from "@/Hooks/useDealPermissions";
import DeleteDeal from "@/Features/Deals/DeleteDeal";
import CustomFieldDisplay from "@/Components/CustomFieldDisplay";
import UserIndicator from "@/Components/UserIndicator";
import MultiUserIndicator from "@/Components/MultiUserIndicator";
import DealDetailsTab from "./DealDetailsTab";
import { SaveTaskModal } from "@/Features/Tasks/SaveTask";
import { Task } from "@/Types/api/tasks";
import EditableField from "@/Components/EditableField";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { ApiResponse } from "@/lib/api/types";
import axios from "axios";

interface Props {
    deal: Deal;
    productNames: string[];
    customFieldCategories: any[];
    fields: any[];
    permissions: Record<string, string>;
    tasks: Task[];
    taskCategories: any[];
    taskLabels: any[];
    taskBoardColumns: any[];
    employees: any[];
    projects: any[];
}

export default function DealInfoSection({
    deal,
    productNames,
    customFieldCategories,
    fields,
    permissions,
    tasks,
    taskCategories,
    taskLabels,
    taskBoardColumns,
    employees,
    projects,
}: Props) {
    const { props } = usePage();
    const user = props.auth.user;
    const [activeTab, setActiveTab] = useState("overview");
    const { action, handleAction, handleClose } = useGenericEntityAction();
    const [currentDeal, setCurrentDeal] = useState<Deal>(deal);
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    // Edit mode state - when true, all fields become editable
    const [isEditMode, setIsEditMode] = useState(false);

    // Track pending changes in edit mode
    const [pendingChanges, setPendingChanges] = useState<Record<string, any>>(
        {},
    );
    const [isSavingAll, setIsSavingAll] = useState(false);

    // Check if there are unsaved changes
    const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

    // API Mutation for inline updates
    const { mutateAsync: updateDeal, status } = useApiMutate<
        {
            type: "details" | "contact" | "custom_field" | "hibarr_field";
            data: Record<string, any>;
        },
        Deal,
        ApiResponse<Deal>
    >(
        route("deals.gathering.inline_update", { id: currentDeal.id }),
        "PATCH",
        (response) => {
            if (response?.status === "success" && response?.data) {
                // Update local state with fresh data
                setCurrentDeal(response.data);
            }
            // Clear the updating field after completion
            setUpdatingField(null);
        },
    );

    // Helper to check if a specific field is loading
    const isFieldLoading = (fieldName: string) => updatingField === fieldName;

    // Sync currentDeal state when deal prop changes
    useEffect(() => {
        setCurrentDeal(deal);
    }, [deal]);

    // Use the deal permissions hook
    const dealPermissions = useDealPermissions(currentDeal);

    // Check edit permission - only creator and agent can edit
    const canEdit = dealPermissions.canEdit;
    const canDelete = dealPermissions.canDelete;

    // Fields are editable only when in edit mode AND user has permission
    const isFieldEditable = isEditMode && canEdit;

    // Toggle edit mode
    const handleToggleEditMode = () => {
        setIsEditMode(!isEditMode);
        // Clear pending changes when entering edit mode
        if (!isEditMode) {
            setPendingChanges({});
        }
    };

    // Exit edit mode
    const handleExitEditMode = () => {
        setIsEditMode(false);
        setPendingChanges({});
    };

    // Handle field change in edit mode (track pending changes)
    const handleFieldChange = (fieldName: string, value: any) => {
        setPendingChanges((prev) => ({
            ...prev,
            [fieldName]: value,
        }));
    };

    // Save all pending changes
    const handleSaveAll = async () => {
        if (!hasUnsavedChanges) return;

        setIsSavingAll(true);
        try {
            // Group changes by type for API calls
            const detailsChanges: Record<string, any> = {};
            const contactChanges: Record<string, any> = {};

            // Process each pending change
            for (const [fieldName, value] of Object.entries(pendingChanges)) {
                // Determine the type based on field name
                if (["email", "mobile", "company_name"].includes(fieldName)) {
                    const apiFieldName =
                        fieldName === "email" ? "client_email" : fieldName;
                    contactChanges[apiFieldName] = value;
                } else {
                    // Process value transformations
                    let processedValue = value;
                    if (fieldName === "value") {
                        processedValue = value
                            ? parseFloat(value.toString())
                            : 0;
                    } else if (fieldName === "close_date") {
                        processedValue = value || null;
                    }
                    detailsChanges[fieldName] = processedValue;
                }
            }

            // Make API calls for each type of change
            const promises: Promise<any>[] = [];

            if (Object.keys(detailsChanges).length > 0) {
                promises.push(
                    updateDeal({ type: "details", data: detailsChanges }),
                );
            }

            if (Object.keys(contactChanges).length > 0) {
                promises.push(
                    updateDeal({ type: "contact", data: contactChanges }),
                );
            }

            await Promise.all(promises);

            message.success("All changes saved successfully");
            setPendingChanges({});
            setIsEditMode(false);
        } catch (error: any) {
            message.error(error?.message || "Failed to save changes");
        } finally {
            setIsSavingAll(false);
        }
    };

    // Format currency
    const formatCurrency = (value: number, currencySymbol: string = "£") => {
        if (!value) return "--";
        return `${currencySymbol}${value.toLocaleString()}`;
    };

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
        value: any,
        type:
            | "details"
            | "contact"
            | "custom_field"
            | "hibarr_field" = "details",
    ): Promise<void> => {
        // Set the updating field to show loading only for this field
        setUpdatingField(fieldName);

        // Check if value is a File or array of Files (for file uploads)
        const isFile = value instanceof File;
        const isFileArray =
            Array.isArray(value) &&
            value.length > 0 &&
            value[0] instanceof File;

        try {
            if ((isFile || isFileArray) && type === "custom_field") {
                // Handle file upload via FormData for custom fields
                // Use POST with _method=PATCH for file uploads (Laravel method spoofing)
                const formData = new FormData();
                formData.append("_method", "PATCH");
                formData.append("type", "custom_field");

                if (isFileArray) {
                    // Multiple files - append each with array notation
                    (value as File[]).forEach((file, index) => {
                        formData.append(`data[${fieldName}][${index}]`, file);
                    });
                } else if (isFile) {
                    // Single file - cast to File type
                    formData.append(`data[${fieldName}]`, value as File);
                }

                const response = await axios.post(
                    route("deals.gathering.inline_update", {
                        id: currentDeal.id,
                    }),
                    formData,
                    {
                        headers: {
                            // Let axios set the Content-Type with proper boundary for FormData
                            Accept: "application/json",
                        },
                    },
                );

                if (
                    response.data?.status === "success" &&
                    response.data?.data
                ) {
                    setCurrentDeal(response.data.data);
                    message.success("File uploaded successfully");
                }
                setUpdatingField(null);
                return;
            }

            // Infer type and api field name if not explicitly set (for compatibility)
            let effectiveType = type;
            let apiFieldName = fieldName;
            let processedValue = value;

            // Backward compatibility inference
            if (fieldName === "email") {
                effectiveType = "contact";
                apiFieldName = "client_email";
            } else if (fieldName === "mobile") {
                effectiveType = "contact";
            } else if (fieldName === "company_name") {
                effectiveType = "contact";
            } else if (fieldName === "value") {
                processedValue = value ? parseFloat(value.toString()) : 0;
            } else if (fieldName === "close_date") {
                processedValue = value || null;
            }

            const payloadData = { [apiFieldName]: processedValue };

            await updateDeal({
                type: effectiveType,
                data: payloadData,
            });
        } catch (error: any) {
            // Clear the updating field on error
            setUpdatingField(null);
            // Error managed by useApiMutate, but re-throwing for EditableField state management
            throw error;
        }
    };

    // Action menu items - only show edit/delete for users with appropriate permissions
    const actionItems = [
        {
            key: "add_task",
            tooltip: "Add Task",
            type: "text" as const,
            icon: <CheckSquareOutlined />,
            label: <span>Add Task</span>,
            onClick: () => handleAction("add_task"),
        },
        // Toggle edit mode button - only show if user can edit
        ...(canEdit && !isEditMode
            ? [
                  {
                      key: "edit",
                      icon: <EditOutlined />,
                      tooltip: "Edit Deal",
                      type: "text" as const,
                      onClick: handleToggleEditMode,
                  },
              ]
            : []),
        // Save all button - only show when in edit mode with changes
        ...(isEditMode
            ? [
                  {
                      key: "save_all",
                      icon: <SaveOutlined />,
                      tooltip: hasUnsavedChanges
                          ? `Save All Changes (${
                                Object.keys(pendingChanges).length
                            })`
                          : "No changes to save",
                      type: "primary" as const,
                      onClick: handleSaveAll,
                      disabled: !hasUnsavedChanges || isSavingAll,
                      loading: isSavingAll,
                  },
              ]
            : []),
        // Cancel edit mode button - only show when in edit mode
        ...(isEditMode
            ? [
                  {
                      key: "cancel_edit",
                      icon: <CloseOutlined />,
                      tooltip: "Cancel Edit",
                      type: "text" as const,
                      onClick: handleExitEditMode,
                  },
              ]
            : []),
        // Only show delete button if user can delete
        ...(canDelete
            ? [
                  {
                      key: "delete",
                      icon: <DeleteOutlined />,
                      tooltip: "Delete Deal",
                      type: "text" as const,
                      danger: true,
                      onClick: () => {
                          handleAction("delete");
                      },
                  },
              ]
            : []),
    ];

    // Tab items for custom field categories
    const tabItems = [
        {
            key: "overview",
            label: "Overview",
            children: (
                <div className="p-6">
                    <Descriptions column={2} bordered size="middle">
                        <Descriptions.Item label="Deal Name" span={2}>
                            <EditableField
                                value={currentDeal.name}
                                fieldName="name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("name", value)
                                }
                                className="font-medium text-gray-900"
                                loading={isSavingAll || isFieldLoading("name")}
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Package(s)">
                            <EditableField
                                value={
                                    currentDeal.packages?.map(
                                        (p: any) => p.id,
                                    ) || []
                                }
                                fieldName="package_id"
                                selectorType="packages"
                                mode="multiple"
                                displayValue={
                                    currentDeal.packages?.length
                                        ? currentDeal.packages
                                              .map(
                                                  (pkg: any) =>
                                                      pkg?.name || pkg,
                                              )
                                              .join(", ")
                                        : "--"
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("package_id", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("package_id")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Lead Contact">
                            <EditableField
                                value={currentDeal?.lead_id}
                                fieldName="lead_id"
                                selectorType="leads"
                                displayValue={
                                    currentDeal.contact ? (
                                        <div className="space-y-1">
                                            <Link
                                                href={route(
                                                    "lead-contact.show",
                                                    currentDeal.contact.id,
                                                )}
                                                className="text-blue-600 hover:text-blue-800 font-medium"
                                            >
                                                {currentDeal.contact
                                                    .client_name_salutation ||
                                                    currentDeal.contact
                                                        .client_name}
                                            </Link>
                                            {currentDeal.contact.client_id && (
                                                <Tag
                                                    color="blue"
                                                    className="text-xs"
                                                >
                                                    Client
                                                </Tag>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("lead_id", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("lead_id")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Email">
                            {currentDeal.contact?.client_email ? (
                                <div className="flex items-center gap-x-2">
                                    <MailOutlined className="text-gray-400" />
                                    <EditableField
                                        value={currentDeal.contact.client_email}
                                        fieldName="email"
                                        fieldType="email"
                                        onSave={(value) =>
                                            handleFieldUpdate("email", value)
                                        }
                                        className="text-blue-600 hover:text-blue-800"
                                        alwaysEditing={isFieldEditable}
                                        onChange={handleFieldChange}
                                        loading={
                                            isSavingAll ||
                                            isFieldLoading("email")
                                        }
                                    />
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Mobile">
                            {currentDeal.contact ? (
                                <div className="flex items-center gap-x-2">
                                    <PhoneOutlined className="text-gray-400" />
                                    <EditableField
                                        value={getMobileNumber(
                                            currentDeal.contact.mobile,
                                        )}
                                        fieldName="mobile"
                                        fieldType="phone"
                                        onSave={(value) =>
                                            handleFieldUpdate("mobile", value)
                                        }
                                        alwaysEditing={isFieldEditable}
                                        onChange={handleFieldChange}
                                        loading={
                                            isSavingAll ||
                                            isFieldLoading("mobile")
                                        }
                                    />
                                </div>
                            ) : (
                                <span className="text-gray-500">--</span>
                            )}
                        </Descriptions.Item>

                        <Descriptions.Item label="Company Name">
                            <EditableField
                                value={currentDeal.contact?.company_name}
                                fieldName="company_name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("company_name", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll ||
                                    isFieldLoading("company_name")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Category">
                            <EditableField
                                value={currentDeal.category_id}
                                fieldName="category_id"
                                selectorType="categories"
                                displayValue={
                                    currentDeal.category?.category_name || (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("category_id", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("category_id")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Agent">
                            <EditableField
                                value={currentDeal.agent_id}
                                fieldName="agent_id"
                                selectorType="lead-agents"
                                displayValue={
                                    currentDeal.lead_agent?.user ? (
                                        <UserIndicator
                                            data={currentDeal.lead_agent.user}
                                            size="sm"
                                        />
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("agent_id", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("agent_id")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Watchers" span={2}>
                            <EditableField
                                value={
                                    currentDeal.deal_watchers?.map(
                                        (w: any) => w.id,
                                    ) || []
                                }
                                fieldName="deal_watcher"
                                selectorType="employees"
                                mode="multiple"
                                displayValue={
                                    currentDeal.deal_watchers &&
                                    currentDeal.deal_watchers.length > 0 ? (
                                        <MultiUserIndicator
                                            users={currentDeal.deal_watchers.map(
                                                (watcher: any) => ({
                                                    id: watcher.id,
                                                    image_url:
                                                        watcher.image_url ||
                                                        watcher.image, // Handle both structures
                                                    name: watcher.name,
                                                }),
                                            )}
                                            size="sm"
                                            maxCount={2}
                                            showTooltip={true}
                                        />
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("deal_watcher", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll ||
                                    isFieldLoading("deal_watcher")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Participants" span={2}>
                            <EditableField
                                value={
                                    currentDeal.deal_participants?.map(
                                        (p: any) => p.id,
                                    ) || []
                                }
                                fieldName="deal_participant"
                                selectorType="employees"
                                mode="multiple"
                                displayValue={
                                    currentDeal.deal_participants &&
                                    currentDeal.deal_participants.length > 0 ? (
                                        <MultiUserIndicator
                                            users={currentDeal.deal_participants.map(
                                                (participant: any) => ({
                                                    id: participant.id,
                                                    image_url:
                                                        participant.image_url ||
                                                        participant.image,
                                                    name: participant.name,
                                                }),
                                            )}
                                            size="sm"
                                            maxCount={2}
                                            showTooltip={true}
                                        />
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("deal_participant", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll ||
                                    isFieldLoading("deal_participant")
                                }
                            />
                        </Descriptions.Item>

                        {currentDeal?.lead_status && (
                            <Descriptions.Item label="Status">
                                <Tag
                                    color={currentDeal.lead_status.label_color}
                                    className="font-medium"
                                >
                                    {currentDeal.lead_status.type}
                                </Tag>
                            </Descriptions.Item>
                        )}

                        <Descriptions.Item label="Close Date">
                            <EditableField
                                value={currentDeal.close_date}
                                fieldName="close_date"
                                fieldType="date"
                                onSave={(value) =>
                                    handleFieldUpdate("close_date", value)
                                }
                                formatValue={(value) =>
                                    value
                                        ? dayjs(value.toString()).format(
                                              "MMM DD, YYYY",
                                          )
                                        : "--"
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("close_date")
                                }
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Deal Value">
                            <EditableField
                                value={currentDeal.value}
                                fieldName="value"
                                fieldType="number"
                                onSave={(value) =>
                                    handleFieldUpdate("value", value)
                                }
                                formatValue={(value) =>
                                    value
                                        ? formatCurrency(
                                              Number(value),
                                              currentDeal.currency
                                                  ?.currency_symbol,
                                          )
                                        : "--"
                                }
                                className="font-semibold"
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={isSavingAll || isFieldLoading("value")}
                            />
                        </Descriptions.Item>

                        <Descriptions.Item label="Properties" span={"filled"}>
                            <EditableField
                                value={
                                    currentDeal.products?.map(
                                        (p: any) => p.id,
                                    ) || []
                                }
                                fieldName="product_id"
                                selectorType="products"
                                mode="multiple"
                                displayValue={
                                    productNames.length > 0 ? (
                                        <div className="flex flex-wrap gap-1">
                                            {productNames.map(
                                                (product, index) => (
                                                    <Tag
                                                        key={index}
                                                        color="blue"
                                                    >
                                                        {product}
                                                    </Tag>
                                                ),
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-500">
                                            --
                                        </span>
                                    )
                                }
                                onSave={(value) =>
                                    handleFieldUpdate("product_id", value)
                                }
                                alwaysEditing={isFieldEditable}
                                onChange={handleFieldChange}
                                loading={
                                    isSavingAll || isFieldLoading("product_id")
                                }
                            />
                        </Descriptions.Item>
                    </Descriptions>
                </div>
            ),
        },
        {
            key: "details",
            label: "Details",
            children: (
                <DealDetailsTab
                    deal={currentDeal}
                    onUpdate={(field, value) =>
                        handleFieldUpdate(field, value, "hibarr_field")
                    }
                    editable={isFieldEditable}
                    loadingField={updatingField}
                    onChange={handleFieldChange}
                    globalLoading={isSavingAll}
                />
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
                        customFieldsData={currentDeal.custom_fields_data || {}}
                        categoryId={category.id}
                        column={2}
                        onUpdate={(field, value) =>
                            handleFieldUpdate(field, value, "custom_field")
                        }
                        editable={isFieldEditable}
                        loadingField={updatingField}
                        onChange={handleFieldChange}
                        globalLoading={isSavingAll}
                    />
                </div>
            ),
        })),
    ];

    return (
        <>
            <SaveTaskModal
                open={action === "add_task"}
                onClose={handleClose}
                categories={taskCategories}
                labels={taskLabels}
                columns={taskBoardColumns}
                users={employees}
                projects={projects}
                relatedEntity={{ type: "deal", id: currentDeal.id }}
            />

            <DeleteDeal
                open={action === "delete"}
                onClose={() => {
                    router.visit(route("deals.index"));
                    handleClose();
                }}
                deal={currentDeal}
            />
            <div>
                {/* Header */}
                <div
                    className={`flex items-center justify-between p-6 border-b border-gray-200 ${
                        isEditMode ? "bg-blue-50" : "bg-white"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-gray-900">
                            Deal Information
                        </h2>
                        {isEditMode && (
                            <Tag color="blue" className="text-xs">
                                Edit Mode
                            </Tag>
                        )}
                        {isEditMode && hasUnsavedChanges && (
                            <Tag color="orange" className="text-xs">
                                {Object.keys(pendingChanges).length} unsaved
                                change
                                {Object.keys(pendingChanges).length > 1
                                    ? "s"
                                    : ""}
                            </Tag>
                        )}
                    </div>
                    <Space size="small">
                        {actionItems.map((item) => (
                            <Tooltip key={item.key} title={item.tooltip}>
                                <Button
                                    type={item.type}
                                    icon={item.icon}
                                    danger={item.danger}
                                    onClick={item.onClick}
                                    size="small"
                                    disabled={item.disabled}
                                    loading={item.loading}
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
                    className="deal-info-tabs"
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
