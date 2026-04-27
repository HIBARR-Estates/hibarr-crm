import { Deal } from "@/Types/api/deals";
import { Link, router, usePage } from "@inertiajs/react";
import {
    Tag,
    Avatar,
    Tooltip,
    Tabs,
    Button,
    Space,
    message,
    Typography,
} from "antd";
import {
    MailOutlined,
    PhoneOutlined,
    EditOutlined,
    DeleteOutlined,
    CheckSquareOutlined,
    CloseOutlined,
    SaveOutlined,
    LockOutlined,
    GiftOutlined,
    InfoCircleOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import { useState, useEffect, useMemo } from "react";
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
import { DetailSection, DetailField } from "@/Components/DetailSection";
import PropertyCarousel from "./PropertyCarousel";
import ManageDealPropertiesModal from "@/Features/Deals/Properties/AttachPropertiesModal";
import useTranslation from "@/Hooks/useTranslation";
import { getDealValueInsight } from "@/Features/Deals/utils/valueInsights";

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
    isEditMode: boolean;
    onEditModeChange: (value: boolean) => void;
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
    isEditMode,
    onEditModeChange,
}: Props) {
    const { props } = usePage<any>();
    const { t } = useTranslation();
    const user = props.auth.user;
    const currencies = props.currencies || [];
    const defaultCurrencyCode = props.default_currency_code || "TRY";
    const [activeTab, setActiveTab] = useState("overview");
    const { action, handleAction, handleClose } = useGenericEntityAction();
    const [currentDeal, setCurrentDeal] = useState<Deal>(deal);
    const [updatingField, setUpdatingField] = useState<string | null>(null);
    const [propertyModalOpen, setPropertyModalOpen] = useState(false);

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
    const isLocked = dealPermissions.isLocked;
    const valueInsight = useMemo(
        () => getDealValueInsight(currentDeal),
        [currentDeal],
    );

    // Fields are editable only when in edit mode AND user has permission
    const isFieldEditable = isEditMode && canEdit;

    // Toggle edit mode
    const handleToggleEditMode = () => {
        onEditModeChange(!isEditMode);
        // Clear pending changes when entering edit mode
        if (!isEditMode) {
            setPendingChanges({});
        }
    };

    // Exit edit mode
    const handleExitEditMode = () => {
        onEditModeChange(false);
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
            const customFieldChanges: Record<string, any> = {};
            const hibarrFieldChanges: Record<string, any> = {};

            // Hibarr field names (from DealDetailsTab)
            const hibarrFieldNames = [
                "interested_in",
                "budget_range",
                "purchase_timeline",
                "motivation",
                "strategy_meeting_booked",
                "downpayment_paid",
                "inspection_trip_date",
                "deposit_confirmation",
                "reservation_agreement",
                "sales_contract",
                "message",
            ];

            // Process each pending change
            for (const [fieldName, value] of Object.entries(pendingChanges)) {
                // Determine the type based on field name
                if (["email", "mobile", "company_name"].includes(fieldName)) {
                    const apiFieldName =
                        fieldName === "email" ? "client_email" : fieldName;
                    contactChanges[apiFieldName] = value;
                } else if (fieldName.startsWith("field_")) {
                    // Custom fields use format field_XX
                    customFieldChanges[fieldName] = value;
                } else if (hibarrFieldNames.includes(fieldName)) {
                    // Hibarr fields
                    hibarrFieldChanges[fieldName] = value;
                } else {
                    // Process value transformations for regular details fields
                    let processedValue = value;
                    if (fieldName === "value") {
                        // Handle new currency format: { amount, currency }
                        if (
                            value &&
                            typeof value === "object" &&
                            ("amount" in value || "currency" in value)
                        ) {
                            const currencyCode =
                                typeof value.currency === "string"
                                    ? value.currency
                                    : defaultCurrencyCode;

                            // Find currency_id from currency_code
                            const foundCurrency = currencies.find(
                                (c: any) =>
                                    (c.currency_code || "").toUpperCase() ===
                                    currencyCode.toUpperCase(),
                            );

                            // Only set value if amount is explicitly provided (don't overwrite with 0)
                            if (
                                value.amount !== null &&
                                value.amount !== undefined &&
                                value.amount !== ""
                            ) {
                                detailsChanges.value = Number(value.amount);
                            }
                            if (foundCurrency?.id) {
                                detailsChanges.currency_id = foundCurrency.id;
                            }
                        } else {
                            // Fallback for old format (just a number)
                            processedValue = value
                                ? parseFloat(value.toString())
                                : 0;
                            detailsChanges[fieldName] = processedValue;
                        }
                    } else if (fieldName === "manual_value") {
                        if (
                            value &&
                            typeof value === "object" &&
                            ("amount" in value || "currency" in value)
                        ) {
                            const currencyCode =
                                typeof value.currency === "string"
                                    ? value.currency
                                    : defaultCurrencyCode;

                            const foundCurrency = currencies.find(
                                (c: any) =>
                                    (c.currency_code || "").toUpperCase() ===
                                    currencyCode.toUpperCase(),
                            );

                            if (
                                value.amount !== null &&
                                value.amount !== undefined &&
                                value.amount !== ""
                            ) {
                                detailsChanges.manual_value = Number(
                                    value.amount,
                                );
                            } else {
                                detailsChanges.manual_value = null;
                            }
                            if (foundCurrency?.id) {
                                detailsChanges.currency_id = foundCurrency.id;
                            }
                        } else {
                            detailsChanges.manual_value =
                                value !== null &&
                                value !== undefined &&
                                value !== ""
                                    ? Number(value)
                                    : null;
                        }
                    } else if (fieldName === "close_date") {
                        processedValue = value || null;
                        detailsChanges[fieldName] = processedValue;
                    } else {
                        detailsChanges[fieldName] = processedValue;
                    }
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

            if (Object.keys(customFieldChanges).length > 0) {
                promises.push(
                    updateDeal({
                        type: "custom_field",
                        data: customFieldChanges,
                    }),
                );
            }

            if (Object.keys(hibarrFieldChanges).length > 0) {
                promises.push(
                    updateDeal({
                        type: "hibarr_field",
                        data: hibarrFieldChanges,
                    }),
                );
            }

            await Promise.all(promises);

            message.success(t("pages.deals.info.save_all_success"));
            setPendingChanges({});
            onEditModeChange(false);
        } catch (error: any) {
            message.error(
                error?.message || t("pages.deals.info.save_all_error"),
            );
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
            if (
                (isFile || isFileArray) &&
                (type === "custom_field" || type === "hibarr_field")
            ) {
                // Handle file upload via FormData (custom fields + hibarr fields)
                // Use POST with _method=PATCH for file uploads (Laravel method spoofing)
                const formData = new FormData();
                formData.append("_method", "PATCH");
                formData.append("type", type);

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
                    message.success(t("pages.deals.info.file_upload_success"));
                }

                // Clear loading state for this field (we bypass useApiMutate here)
                setUpdatingField(null);

                // Important: don't fall through to JSON PATCH after multipart upload
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
            } else if (fieldName === "value" || fieldName === "manual_value") {
                // Handle new currency format: { amount, currency }
                if (
                    value &&
                    typeof value === "object" &&
                    ("amount" in value || "currency" in value)
                ) {
                    const currencyCode =
                        typeof value.currency === "string"
                            ? value.currency
                            : defaultCurrencyCode;

                    // Find currency_id from currency_code
                    const foundCurrency = currencies.find(
                        (c: any) =>
                            (c.currency_code || "").toUpperCase() ===
                            currencyCode.toUpperCase(),
                    );

                    // Set currency_id and (optionally) value
                    const payloadData: Record<string, any> = {};
                    if (foundCurrency?.id) {
                        payloadData.currency_id = foundCurrency.id;
                    }
                    if (
                        value.amount !== null &&
                        value.amount !== undefined &&
                        value.amount !== ""
                    ) {
                        payloadData[apiFieldName] = Number(value.amount);
                    } else if (fieldName === "manual_value") {
                        payloadData[apiFieldName] = null;
                    }

                    // If neither amount nor currency_id is resolvable, do nothing
                    if (Object.keys(payloadData).length === 0) {
                        setUpdatingField(null);
                        return;
                    }

                    await updateDeal({
                        type: effectiveType,
                        data: payloadData,
                    });
                    return;
                } else {
                    // Fallback for old format (just a number)
                    processedValue = value ? parseFloat(value.toString()) : 0;
                }
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
            tooltip: t("pages.deals.actions.add_task"),
            type: "text" as const,
            icon: <CheckSquareOutlined />,
            label: <span>{t("pages.deals.actions.add_task")}</span>,
            onClick: () => handleAction("add_task"),
        },
        // Toggle edit mode button - only show if user can edit
        ...(canEdit && !isEditMode
            ? [
                  {
                      key: "edit",
                      icon: <EditOutlined />,
                      tooltip: t("pages.deals.info.actions.edit"),
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
                          ? `${t("pages.deals.info.actions.save_all_tooltip")} (${Object.keys(pendingChanges).length})`
                          : t("pages.deals.info.actions.no_changes"),
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
                      tooltip: t("pages.deals.info.actions.cancel_edit"),
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
                      tooltip: t("pages.deals.info.actions.delete"),
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
            label: t("pages.deals.info.tab_overview"),
            children: (
                <div className="p-4 space-y-4">
                    {/* Deal Overview */}
                    <DetailSection
                        title={t("pages.deals.info.sections.overview")}
                    >
                        <DetailField
                            label={t("pages.deals.info.fields.deal_name")}
                        >
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.deal_value")}
                        >
                            <div className="flex items-center gap-2 flex-wrap">
                                <EditableField
                                    value={{
                                        amount: currentDeal.value ?? null,
                                        currency:
                                            currentDeal.currency
                                                ?.currency_code ||
                                            defaultCurrencyCode,
                                    }}
                                    fieldName="value"
                                    fieldType="currency"
                                    onSave={(val) =>
                                        handleFieldUpdate("value", val)
                                    }
                                    className="font-semibold"
                                    alwaysEditing={isFieldEditable}
                                    onChange={handleFieldChange}
                                    loading={
                                        isSavingAll || isFieldLoading("value")
                                    }
                                    disabled={!canEdit || isLocked}
                                />
                                <Tooltip
                                    placement="topLeft"
                                    title={
                                        <div style={{ minWidth: 220 }}>
                                            <div>
                                                Base:{" "}
                                                {valueInsight.baseTotal !== null
                                                    ? formatCurrency(
                                                          valueInsight.baseTotal,
                                                          currentDeal.currency
                                                              ?.currency_symbol ||
                                                              "£",
                                                      )
                                                    : "--"}
                                            </div>
                                            <div>
                                                Discount: -
                                                {formatCurrency(
                                                    valueInsight.discountTotal,
                                                    currentDeal.currency
                                                        ?.currency_symbol ||
                                                        "£",
                                                )}
                                            </div>
                                            <div>
                                                Calculated:{" "}
                                                {valueInsight.calculatedValue !==
                                                null
                                                    ? formatCurrency(
                                                          valueInsight.calculatedValue,
                                                          currentDeal.currency
                                                              ?.currency_symbol ||
                                                              "£",
                                                      )
                                                    : "--"}
                                            </div>
                                            {valueInsight.deltaVsManual !==
                                                null &&
                                                valueInsight.deltaVsManual !==
                                                    0 && (
                                                    <div
                                                        style={{
                                                            marginTop: 6,
                                                            color:
                                                                valueInsight.deltaVsManual >
                                                                0
                                                                    ? "#faad14"
                                                                    : "#ff4d4f",
                                                        }}
                                                    >
                                                        Adjusted:{" "}
                                                        {valueInsight.deltaVsManual >
                                                        0
                                                            ? "+"
                                                            : ""}
                                                        {formatCurrency(
                                                            valueInsight.deltaVsManual,
                                                            currentDeal.currency
                                                                ?.currency_symbol ||
                                                                "£",
                                                        )}{" "}
                                                        vs calculated
                                                    </div>
                                                )}
                                            {valueInsight.status ===
                                                "no-offers" && (
                                                <div style={{ marginTop: 6 }}>
                                                    No applied offers yet.
                                                </div>
                                            )}
                                        </div>
                                    }
                                >
                                    <InfoCircleOutlined className="text-blue-500 cursor-help" />
                                </Tooltip>
                                {currentDeal.total_discount != null &&
                                    currentDeal.total_discount > 0 && (
                                        <Tag
                                            color="green"
                                            icon={<GiftOutlined />}
                                            className="ml-2"
                                        >
                                            -
                                            {Number(
                                                currentDeal.total_discount,
                                            ).toLocaleString("en-GB")}
                                        </Tag>
                                    )}
                            </div>
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.close_date")}
                        >
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.packages")}
                        >
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.lead_contact")}
                        >
                            <EditableField
                                value={currentDeal?.lead_id}
                                fieldName="lead_id"
                                selectorType="leads"
                                displayValue={
                                    currentDeal.contact ? (
                                        <div className="flex items-center gap-2">
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
                                                    {t(
                                                        "pages.deals.info.client_tag",
                                                    )}
                                                </Tag>
                                            )}
                                        </div>
                                    ) : (
                                        <span className="text-gray-400">
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.deal_category")}
                        >
                            <EditableField
                                value={currentDeal.category_id}
                                fieldName="category_id"
                                selectorType="categories"
                                displayValue={
                                    currentDeal.category?.category_name ? (
                                        <span className="text-gray-700">
                                            {currentDeal.category.category_name}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.properties")}
                            span={2}
                        >
                            <div className="w-full">
                                <div className="flex items-center justify-between mb-1">
                                    <Button
                                        type="link"
                                        size="small"
                                        icon={<EditOutlined />}
                                        onClick={() =>
                                            setPropertyModalOpen(true)
                                        }
                                        className="!px-0 !text-xs"
                                    >
                                        {t(
                                            "pages.deals.info.actions.manage_properties",
                                        )}
                                    </Button>
                                </div>
                                {currentDeal.products &&
                                currentDeal.products.length > 0 ? (
                                    <PropertyCarousel
                                        products={currentDeal.products}
                                    />
                                ) : (
                                    <span className="text-gray-400 text-sm">
                                        {t("pages.deals.info.no_properties")}
                                    </span>
                                )}
                            </div>
                            <ManageDealPropertiesModal
                                open={propertyModalOpen}
                                onClose={() => setPropertyModalOpen(false)}
                                deal={currentDeal}
                                onRefresh={() =>
                                    router.reload({ only: ["deal"] })
                                }
                            />
                        </DetailField>

                        {currentDeal?.lead_status && (
                            <DetailField
                                label={t("pages.deals.info.fields.status")}
                            >
                                <Tag
                                    color={currentDeal.lead_status.label_color}
                                    className="font-medium"
                                >
                                    {currentDeal.lead_status.type}
                                </Tag>
                            </DetailField>
                        )}
                    </DetailSection>

                    {/* Contact Info */}
                    <DetailSection
                        title={t("pages.deals.info.sections.contact_info")}
                    >
                        <DetailField
                            label={t("pages.deals.info.fields.email")}
                            copyValue={
                                currentDeal.contact?.client_email || undefined
                            }
                        >
                            <div className="w-full flex items-center gap-x-2">
                                {currentDeal.contact?.client_email && (
                                    <MailOutlined className="text-gray-400 flex-shrink-0" />
                                )}
                                {currentDeal.contact?.client_email ? (
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
                                        disabled={!canEdit}
                                    />
                                ) : (
                                    <span className="text-gray-400">--</span>
                                )}
                            </div>
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.mobile")}
                            copyValue={
                                getMobileNumber(currentDeal.contact?.mobile) ||
                                undefined
                            }
                        >
                            {currentDeal.contact ? (
                                <div className="flex items-center gap-x-2">
                                    <PhoneOutlined className="text-gray-400 flex-shrink-0" />
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
                                        disabled={!canEdit}
                                    />
                                </div>
                            ) : (
                                <span className="text-gray-400">--</span>
                            )}
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.company_name")}
                            span={2}
                        >
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
                                disabled={!canEdit}
                            />
                        </DetailField>
                    </DetailSection>

                    {/* Team */}
                    <DetailSection title={t("pages.deals.info.sections.team")}>
                        <DetailField
                            label={t("pages.deals.info.fields.deal_agent")}
                        >
                            <EditableField
                                value={currentDeal.agent_id}
                                fieldName="agent_id"
                                selectorType="lead-agents"
                                displayValue={
                                    currentDeal.lead_agent?.user ? (
                                        <UserIndicator
                                            data={currentDeal.lead_agent.user}
                                            size="sm"
                                            maxNameLength={40}
                                        />
                                    ) : (
                                        <span className="text-gray-400">
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t(
                                "pages.deals.info.fields.deal_participants",
                            )}
                        >
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
                                        <span className="text-gray-400">
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
                                disabled={!canEdit}
                            />
                        </DetailField>

                        <DetailField
                            label={t("pages.deals.info.fields.deal_watchers")}
                            span={2}
                        >
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
                                                        watcher.image,
                                                    name: watcher.name,
                                                }),
                                            )}
                                            size="sm"
                                            maxCount={2}
                                            showTooltip={true}
                                        />
                                    ) : (
                                        <span className="text-gray-400">
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
                                disabled={!canEdit}
                            />
                        </DetailField>
                    </DetailSection>
                </div>
            ),
        },
        {
            key: "details",
            label: t("pages.deals.info.tab_details"),
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
                    disabled={!canEdit}
                />
            ),
        },
        // Custom field categories as tabs
        ...(customFieldCategories || []).map((category) => ({
            key: `category-${category.id}`,
            label: category.name,
            children: (
                <div className="p-4">
                    <CustomFieldDisplay
                        fields={fields}
                        customFieldsData={currentDeal.custom_fields_data || {}}
                        categoryId={category.id}
                        title={category.name}
                        column={2}
                        onUpdate={(field, value) =>
                            handleFieldUpdate(field, value, "custom_field")
                        }
                        editable={isFieldEditable}
                        loadingField={updatingField}
                        onChange={handleFieldChange}
                        globalLoading={isSavingAll}
                        disabled={!canEdit}
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
                    handleClose();
                }}
                handleSuccessCallback={() => {
                    router.visit(route("deals.index"));
                }}
                deal={currentDeal}
            />
            <div>
                {/* Header */}
                <div
                    className={`flex items-center justify-between px-5 py-3 border-b ${
                        isEditMode
                            ? "bg-blue-50 border-blue-100"
                            : "bg-gray-50/80 border-gray-100"
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <h2 className="text-sm font-semibold text-gray-700">
                            {t("pages.deals.info.title")}
                        </h2>
                        {isLocked && (
                            <Tag
                                color="orange"
                                icon={<LockOutlined />}
                                className="text-xs"
                            >
                                {t("pages.deals.info.locked")}
                            </Tag>
                        )}
                        {isEditMode && (
                            <Tag color="blue" className="text-xs">
                                {t("pages.deals.info.edit_mode")}
                            </Tag>
                        )}
                        {isEditMode && hasUnsavedChanges && (
                            <Tag color="orange" className="text-xs">
                                {t("pages.deals.info.unsaved_changes", {
                                    count: Object.keys(pendingChanges).length,
                                })}
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
                    tabBarExtraContent={{
                        right: <div style={{ width: 48 }} />,
                    }}
                />
            </div>
        </>
    );
}
