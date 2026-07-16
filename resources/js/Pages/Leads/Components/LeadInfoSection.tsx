import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import useTranslation from "@/Hooks/useTranslation";
import { Lead } from "@/Types/api/leads";
import { router, usePage } from "@inertiajs/react";
import {
    Avatar,
    Button,
    Tag,
    Space,
    Tooltip,
    message,
} from "antd";
import {
    PlusSquareOutlined,
    MinusSquareOutlined,
} from "@ant-design/icons";
import SideNavTabs from "@/Components/SideNavTabs";
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
    CheckSquareOutlined,
    SaveOutlined,
    CloseOutlined,
} from "@ant-design/icons";
import { useGenericEntityAction } from "@/Hooks/useGenericEntityAction";
import SaveLeadModal from "@/Features/Leads/SaveLead/SaveLeadModal";
import DeleteLead from "@/Features/Leads/DeleteLead";
import ChangeToClient from "@/Features/Leads/ChangeToClient";
import SaveTaskModal from "@/Features/Tasks/SaveTask/SaveTaskModal";
import dayjs from "dayjs";
import EditableField from "@/Components/EditableField";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { formatMobileForDisplay } from "@/lib/utils";
import {
    computeAgeFieldsFromDateOfBirth,
    resolveLeadAgeFields,
} from "@/lib/leadAge";
import UserIndicator from "@/Components/UserIndicator";
import axios from "axios";
import { DetailSection, DetailField } from "@/Components/DetailSection";
import LeadAgeFieldsGroup from "@/Components/LeadAgeFieldsGroup";

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
    isEditMode: boolean;
    onEditModeChange: (value: boolean) => void;
    useLeadCoreFields?: boolean;
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
    isEditMode,
    onEditModeChange,
    useLeadCoreFields = false,
}: Props) {
    const { props } = usePage();
    const languageOptions = (
        (props.languages as Array<{ language_code: string; language_name: string }>) || []
    ).map((lang) => ({
        value: lang.language_code,
        label: lang.language_name,
    }));
const ageRangeOptions = useMemo(
        () =>
            (
                (props.ageRanges as Array<{ value: string; label: string }>) ||
                []
            ).map((option) => ({
                value: option.value,
                label: option.label,
            })),
        [props.ageRanges],
    );
    const leadLifecycleStatuses = useMemo(
        () =>
            (props.leadLifecycleStatuses as Array<{
                id: number;
                label: string;
                label_color?: string;
            }>) || [],
        [props.leadLifecycleStatuses],
    );
    const leadLifecycleStatusOptions = useMemo(
        () =>
            leadLifecycleStatuses.map((option) => ({
                value: option.id,
                label: option.label,
            })),
        [leadLifecycleStatuses],
    );

    const resolveAgeRangeLabel = useCallback(
        (value: string) =>
            ageRangeOptions.find(
                (option) => option.value === value,
            )?.label || value,
        [ageRangeOptions],
    );

    const salutationOptions = (
        (props.salutations as Array<{ value: string; label: string }>) || []
    );



    const resolveLanguageLabel = useCallback(
        (code: string) =>
            languageOptions.find(
                (option) =>
                    option.value.toLowerCase() === code.toLowerCase(),
            )?.label || code,
        [languageOptions],
    );
    const user = props.auth.user;
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState("overview");
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        "lead-contact": true,
    });

    const ALL_SECTIONS = useMemo(() => [
        "lead-contact",
        "lead-personal",
        "lead-classification",
        "lead-address",
        "lead-notes",
        ...(customFieldCategories || []).map((cat: any) => `lead-category-${cat.id}`),
    ], [customFieldCategories]);

    const toggleSection = (id: string) => {
        setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const allSectionsOpen =
        ALL_SECTIONS.length > 0 &&
        ALL_SECTIONS.every((id) => openSections[id] ?? false);

    const handleToggleAll = () => {
        const next = !allSectionsOpen;
        setOpenSections((prev) => {
            const updated = { ...prev };
            ALL_SECTIONS.forEach((id) => {
                updated[id] = next;
            });
            return updated;
        });
    };

    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    const getSectionsForKey = useCallback((key: string): string[] => {
        if (key === "overview") return ["lead-contact", "lead-personal", "lead-classification", "lead-address", "lead-notes"];
        if (key.startsWith("category-")) return [`lead-category-${key.replace("category-", "")}`];
        return [];
    }, []);

    const handleNavClick = useCallback((key: string) => {
        const el = sectionRefs.current[key];
        const container = scrollContainerRef.current;
        if (el && container) {
            const elTop = el.getBoundingClientRect().top;
            const containerTop = container.getBoundingClientRect().top;
            const targetScrollTop = container.scrollTop + (elTop - containerTop);
            container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: "smooth" });
        }
        const sectionsToExpand = getSectionsForKey(key);
        if (sectionsToExpand.length > 0) {
            setOpenSections((prev) => {
                const updated = { ...prev };
                sectionsToExpand.forEach((id) => { updated[id] = true; });
                return updated;
            });
        }
        setActiveSection(key);
    }, [getSectionsForKey]);

    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const observer = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const key = entry.target.getAttribute("data-section-key");
                        if (key) setActiveSection(key);
                    }
                }
            },
            { root: container, threshold: 0.2, rootMargin: "0px 0px -60% 0px" },
        );
        const refs = sectionRefs.current;
        Object.values(refs).forEach((el) => {
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, [customFieldCategories?.length]);

    const {
        action,
        handleAction,
        handleClose,
        selected: currentLead,
    } = useGenericEntityAction<Lead>();

    const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
    const [currentLeadState, setCurrentLeadState] = useState<Lead>(lead);
    const [updatingField, setUpdatingField] = useState<string | null>(null);

    // Memoized so SaveTaskModal/TaskForm receive a stable reference across
    // re-renders — an inline object literal here would get a new identity on
    // every render (e.g. whenever an unrelated reload elsewhere on the page
    // updates Inertia's page props), which was re-triggering TaskForm's
    // populate effect and wiping in-progress "Add Task" input.
    const taskRelatedEntity = useMemo(
        () => ({ type: "lead" as const, id: currentLeadState.id }),
        [currentLeadState.id],
    );

    // Derived from the id (the field the backend reliably keeps in sync on
    // every save) rather than trusting `lead_lifecycle_status` to always be
    // re-attached to the merged state — the nested relation object is only
    // as fresh as whatever the last response happened to include.
    const selectedLifecycleStatus = useMemo(
        () =>
            leadLifecycleStatuses.find(
                (status) => status.id === currentLeadState.lead_lifecycle_status_id,
            ),
        [leadLifecycleStatuses, currentLeadState.lead_lifecycle_status_id],
    );

    // Track pending changes in edit mode
    const [pendingChanges, setPendingChanges] = useState<Record<string, any>>(
        {},
    );
    const [isSavingAll, setIsSavingAll] = useState(false);

    const resolvedAgeFields = useMemo(() => {
        const dateOfBirth =
            pendingChanges.date_of_birth !== undefined
                ? pendingChanges.date_of_birth
                : currentLeadState.date_of_birth ?? null;
        const age =
            pendingChanges.age !== undefined
                ? pendingChanges.age
                : currentLeadState.age ?? null;
        const ageRange =
            pendingChanges.age_range !== undefined
                ? pendingChanges.age_range
                : currentLeadState.age_range ?? null;

        return resolveLeadAgeFields({
            dateOfBirth,
            age,
            ageRange,
        });
    }, [currentLeadState, pendingChanges]);

    // Check if there are unsaved changes
    const hasUnsavedChanges = Object.keys(pendingChanges).length > 0;

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
                            updated[key] =
                                key === "languages"
                                    ? Array.isArray(leadData[key])
                                        ? leadData[key]
                                        : []
                                    : leadData[key];
                        }
                    });
                    if (leadData.mobile !== undefined) {
                        const formatted = formatMobileForDisplay(
                            leadData.mobile,
                        );
                        updated.mobile_with_phonecode =
                            formatted && formatted !== "--"
                                ? formatted
                                : "--";
                    }
                    if (leadData.office !== undefined) {
                        const formatted = formatMobileForDisplay(
                            leadData.office,
                        );
                        updated.office_phone_formatted =
                            formatted && formatted !== "--"
                                ? formatted
                                : leadData.office || "--";
                    }
                    return updated as Lead;
                });
            }
            // Clear the updating field after completion
            setUpdatingField(null);
        },
    );

    // Helper to check if a specific field is loading
    const isFieldLoading = (fieldName: string) =>
        isSavingAll || updatingField === fieldName;

    // Sync currentLeadState when lead prop changes
    useEffect(() => {
        setCurrentLeadState(lead);
    }, [lead]);

    const canEdit = ["all", "added", "owned", "both"].includes(
        editLeadPermission,
    );
    const canDelete = ["all", "added", "owned", "both"].includes(
        deleteLeadPermission,
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
        setPendingChanges((prev) => {
            const next = {
                ...prev,
                [fieldName]: value,
            };

            if (fieldName === "date_of_birth") {
                if (value) {
                    const { age, age_range } =
                        computeAgeFieldsFromDateOfBirth(value);
                    next.age = age;
                    next.age_range = age_range;
                } else {
                    next.age = null;
                    next.age_range = null;
                }
            }

            return next;
        });
    };

    // Save all pending changes
    const handleSaveAll = async () => {
        if (!hasUnsavedChanges) return;

        setIsSavingAll(true);
        try {
            // Process each pending change
            const standardChanges: Record<string, any> = {};
            const customFieldChanges: Record<string, any> = {};

            for (const [fieldName, value] of Object.entries(pendingChanges)) {
                // Check if this is a custom field (field_ prefix pattern)
                if (fieldName.startsWith("field_")) {
                    customFieldChanges[fieldName] = value;
                } else {
                    // Process value transformations
                    let processedValue = value;
                    if (fieldName === "value") {
                        processedValue = value
                            ? parseFloat(value.toString())
                            : 0;
                    } else if (
                        fieldName === "close_date" ||
                        fieldName === "next_follow_up"
                    ) {
                        processedValue = value || null;
                    } else if (fieldName === "gender") {
                        processedValue = value || null;
                    } else if (fieldName === "languages") {
                        processedValue = Array.isArray(value) ? value : [];
                    } else if (fieldName === "age") {
                        processedValue =
                            value === null || value === "" || value === undefined
                                ? null
                                : Number(value);
                    } else if (fieldName === "age_range") {
                        processedValue = value || null;
                    } else if (fieldName === "date_of_birth") {
                        processedValue = value || null;
                    }
                    standardChanges[fieldName] = processedValue;
                }
            }

            if (standardChanges.date_of_birth !== undefined) {
                if (standardChanges.date_of_birth) {
                    const computed = computeAgeFieldsFromDateOfBirth(
                        standardChanges.date_of_birth,
                    );
                    standardChanges.age = computed.age;
                    standardChanges.age_range = computed.age_range;
                } else {
                    standardChanges.age = null;
                    standardChanges.age_range = null;
                }
            }

            // Make API calls for each type of change
            const promises: Promise<any>[] = [];

            if (Object.keys(standardChanges).length > 0) {
                promises.push(updateLead(standardChanges));
            }

            if (Object.keys(customFieldChanges).length > 0) {
                promises.push(
                    updateLead({ custom_fields: customFieldChanges }),
                );
            }

            await Promise.all(promises);

            if (standardChanges.languages !== undefined) {
                setCurrentLeadState((prev) => ({
                    ...prev,
                    languages: Array.isArray(standardChanges.languages)
                        ? standardChanges.languages
                        : [],
                }));
            }

            if (standardChanges.date_of_birth !== undefined) {
                const computed = standardChanges.date_of_birth
                    ? computeAgeFieldsFromDateOfBirth(
                          standardChanges.date_of_birth,
                      )
                    : { age: null, age_range: null };
                setCurrentLeadState((prev) => ({
                    ...prev,
                    date_of_birth: standardChanges.date_of_birth || null,
                    age: computed.age,
                    age_range: computed.age_range,
                }));
            }

            message.success(t("pages.leads.info.save_all_success"));
            setPendingChanges({});
            onEditModeChange(false);
        } catch (error: any) {
            message.error(error?.message || t("pages.leads.info.save_all_error"));
        } finally {
            setIsSavingAll(false);
        }
    };

    // Resolve mobile for display/edit — handles JSON (legacy + antd-phone-input shapes)
    const getMobileNumber = (mobile: string | null | undefined): string => {
        if (!mobile) return "";

        if (typeof mobile === "string" && mobile.trim().startsWith("{")) {
            try {
                const mobileData = JSON.parse(mobile.trim());
                if (typeof mobileData?.phone === "string") {
                    return mobileData.phone.trim();
                }
                return formatMobileForDisplay(mobile) || "";
            } catch {
                return mobile;
            }
        }

        return mobile;
    };

    const resolvePhoneFieldValue = (
        mobile: string | null | undefined,
        formattedFallback?: string | null,
    ): string => {
        const fromMobile = getMobileNumber(mobile);
        if (fromMobile) return fromMobile;
        if (formattedFallback && formattedFallback !== "--") {
            return formattedFallback;
        }
        return "";
    };

    // Handle field update
    const handleFieldUpdate = async (
        fieldName: string,
        value: any,
    ): Promise<void> => {
        // Set the updating field to show loading only for this field
        setUpdatingField(fieldName);

        // Check if this is a custom field (starts with "field_")
        const isCustomField = fieldName.startsWith("field_");

        // Check if value is a File or array of Files (for file uploads)
        const isFile = value instanceof File;
        const isFileArray =
            Array.isArray(value) &&
            value.length > 0 &&
            value[0] instanceof File;

        try {
            if (isFile || isFileArray) {
                // Handle file upload via FormData
                // Use POST with _method=PATCH for file uploads (Laravel method spoofing)
                // PATCH with multipart/form-data can have issues with some servers
                const formData = new FormData();
                formData.append("_method", "PATCH");

                if (isFileArray) {
                    // Multiple files - append each with array notation
                    (value as File[]).forEach((file, index) => {
                        formData.append(
                            `custom_fields[${fieldName}][${index}]`,
                            file,
                        );
                    });
                } else if (isFile) {
                    // Single file - cast to File type
                    formData.append(
                        `custom_fields[${fieldName}]`,
                        value as File,
                    );
                }

                const response = await axios.post(
                    route("lead-contact.patch", {
                        lead_contact: currentLeadState.id,
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
                    message.success(t("pages.leads.info.file_upload_success"));
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
                payloadData = { [fieldName]: value };

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
                } else if (fieldName === "languages") {
                    processedValue = Array.isArray(value) ? value : [];
                } else if (fieldName === "age") {
                    processedValue =
                        value === null || value === "" || value === undefined
                            ? null
                            : Number(value);
                } else if (fieldName === "age_range") {
                    processedValue = value || null;
                } else if (fieldName === "date_of_birth") {
                    processedValue = value || null;
                    if (value) {
                        const computed = computeAgeFieldsFromDateOfBirth(value);
                        payloadData = {
                            date_of_birth: processedValue,
                            age: computed.age,
                            age_range: computed.age_range,
                        };
                    } else {
                        payloadData = {
                            date_of_birth: null,
                            age: null,
                            age_range: null,
                        };
                    }
                } else if (
                    fieldName === "category_id" ||
                    fieldName === "source_id" ||
                    fieldName === "lead_owner" ||
                    fieldName === "status_id" ||
                    fieldName === "agent_id" ||
                    fieldName === "lead_lifecycle_status_id"
                ) {
                    // Convert empty/falsy values to null for nullable integer fields
                    processedValue = value ? value : null;
                }

                if (fieldName !== "date_of_birth") {
                    payloadData = { [fieldName]: processedValue };
                }
            }

            await updateLead(payloadData);

            if (!isCustomField && fieldName === "date_of_birth") {
                const computed = value
                    ? computeAgeFieldsFromDateOfBirth(value)
                    : { age: null, age_range: null };
                setCurrentLeadState((prev) => ({
                    ...prev,
                    date_of_birth: value || null,
                    age: computed.age,
                    age_range: computed.age_range,
                }));
            }

            if (!isCustomField && fieldName === "languages") {
                setCurrentLeadState((prev) => ({
                    ...prev,
                    languages: Array.isArray(payloadData.languages)
                        ? payloadData.languages
                        : [],
                }));
            }
        } catch (error: any) {
            // Clear the updating field on error
            setUpdatingField(null);
            // Error managed by useApiMutate, but re-throwing for EditableField state management
            throw error;
        }
    };

    // Action menu items
    const actionItems = [
        // Save All button (only shown in edit mode with unsaved changes)
        ...(isEditMode && hasUnsavedChanges
            ? [
                  {
                      key: "save_all",
                      tooltip: `${t("pages.leads.info.actions.save_all_tooltip")} (${Object.keys(pendingChanges).length})`,
                      type: "primary" as const,
                      icon: <SaveOutlined />,
                      label: (
                          <span>
                              {t("pages.leads.info.actions.save_all")} ({Object.keys(pendingChanges).length})
                          </span>
                      ),
                      onClick: handleSaveAll,
                      loading: isSavingAll,
                  },
              ]
            : []),
        // Cancel Edit button (only shown in edit mode)
        ...(isEditMode
            ? [
                  {
                      key: "cancel_edit",
                      tooltip: t("pages.leads.info.actions.cancel_edit"),
                      type: "text" as const,
                      icon: <CloseOutlined />,
                      label: <span>{t("pages.leads.info.actions.cancel_edit")}</span>,
                      onClick: handleExitEditMode,
                  },
              ]
            : []),
        // Edit button (only shown when not in edit mode)
        ...(canEdit && !isEditMode
            ? [
                  {
                      key: "toggle_edit",
                      tooltip: t("pages.leads.info.actions.edit_mode"),
                      type: "text" as const,
                      icon: <EditOutlined />,
                      label: <span>{t("pages.leads.info.actions.edit_mode")}</span>,
                      onClick: handleToggleEditMode,
                  },
              ]
            : []),
        {
            key: "add_task",
            tooltip: t("pages.leads.info.actions.add_task"),
            type: "text" as const,
            icon: <CheckSquareOutlined />,
            label: <span>{t("pages.leads.info.actions.add_task")}</span>,
            onClick: () => setIsTaskModalOpen(true),
        },
        // ...(canEdit  //deprecated
        //     ? [
        //           {
        //               key: "edit",
        //               tooltip: "Edit Contact",
        //               type: "text" as const,
        //               icon: <EditOutlined />,
        //               label: <span>Edit Contact</span>,
        //               onClick: () => handleAction("edit", lead),
        //           },
        //       ]
        //     : []),
        {
            key: "convert",
            tooltip: t("pages.leads.info.actions.convert_to_client"),
            type: "text" as const,
            icon: <UserOutlined />,
            label: <span>{t("pages.leads.info.actions.convert_to_client")}</span>,
            onClick: () => handleAction("change_to_client", lead),
        },
        ...(canDelete
            ? [
                  {
                      key: "delete",
                      tooltip: t("pages.leads.info.actions.delete_lead"),
                      type: "text" as const,
                      icon: <DeleteOutlined />,
                      danger: true,
                      label: <span className="text-red-600">{t("pages.leads.info.actions.delete_lead")}</span>,
                      onClick: () => handleAction("delete", lead),
                  },
              ]
            : []),
    ];

    // Section groups for scroll nav
    const sectionGroups = [
        {
            key: "overview",
            children: (
                <div className="p-4 space-y-4">
                    {/* Contact Information */}
                    <DetailSection
                        title={t("pages.leads.info.sections.contact")}
                        accordion
                        sectionId="lead-contact"
                        isOpen={openSections["lead-contact"] ?? false}
                        onToggle={() => toggleSection("lead-contact")}
                    >
                        <DetailField label={t("pages.leads.info.fields.salutation", { defaultValue: "Salutation" })}>
                            <EditableField
                                value={currentLeadState.salutation_value ?? currentLeadState.salutation ?? ""}
                                fieldName="salutation"
                                fieldType="select"
                                options={salutationOptions}
                                onSave={(value) =>
                                    handleFieldUpdate("salutation", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    (currentLeadState.salutation_value || currentLeadState.salutation) ? (
                                        <span className="capitalize">{currentLeadState.salutation_value ?? currentLeadState.salutation}</span>
                                    ) : (
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("salutation")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.name")}>
                            <EditableField
                                value={currentLeadState.client_name || ""}
                                fieldName="client_name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("client_name", value)
                                }
                                onChange={handleFieldChange}
                                className="font-medium text-gray-900"
                                loading={isFieldLoading("client_name")}
                                alwaysEditing={isFieldEditable}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.email")} copyValue={currentLeadState.client_email || undefined}>
                            <div className="flex items-center gap-x-2">
                                {currentLeadState.client_email && (
                                    <MailOutlined className="text-gray-400 flex-shrink-0" />
                                )}
                                <EditableField
                                    value={currentLeadState.client_email || ""}
                                    fieldName="client_email"
                                    fieldType="email"
                                    onSave={(value) =>
                                        handleFieldUpdate("client_email", value)
                                    }
                                    onChange={handleFieldChange}
                                    placeholder={t("pages.leads.info.placeholders.email")}
                                    className="text-blue-600 hover:text-blue-800"
                                    alwaysEditing={isFieldEditable}
                                    loading={isFieldLoading("client_email")}
                                />
                            </div>
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.mobile")} copyValue={resolvePhoneFieldValue(currentLeadState.mobile, currentLeadState.mobile_with_phonecode) || undefined}>
                            <div className="flex items-center gap-x-2">
                                <PhoneOutlined className="text-gray-400 flex-shrink-0" />
                                <EditableField
                                    value={resolvePhoneFieldValue(
                                        currentLeadState.mobile,
                                        currentLeadState.mobile_with_phonecode,
                                    )}
                                    fieldName="mobile"
                                    fieldType="phone"
                                    onSave={(value) =>
                                        handleFieldUpdate("mobile", value)
                                    }
                                    onChange={handleFieldChange}
                                    placeholder={t("pages.leads.info.placeholders.mobile")}
                                    alwaysEditing={isFieldEditable}
                                    loading={isFieldLoading("mobile")}
                                />
                            </div>
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.office_phone")} copyValue={resolvePhoneFieldValue(currentLeadState.office, currentLeadState.office_phone_formatted) || undefined}>
                            <EditableField
                                value={resolvePhoneFieldValue(
                                    currentLeadState.office,
                                    currentLeadState.office_phone_formatted,
                                )}
                                fieldName="office"
                                fieldType="phone"
                                onSave={(value) =>
                                    handleFieldUpdate("office", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.office_phone")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("office")}
                            />
                        </DetailField>
                    </DetailSection>

                    {/* Personal Details */}
                    <DetailSection
                        title={t("pages.leads.info.sections.personal")}
                        accordion
                        sectionId="lead-personal"
                        isOpen={openSections["lead-personal"] ?? false}
                        onToggle={() => toggleSection("lead-personal")}
                    >
                        <DetailField label={t("pages.leads.info.fields.gender")}>
                            <EditableField
                                value={currentLeadState.gender || ""}
                                fieldName="gender"
                                fieldType="select"
                                options={[
                                    { label: t("pages.leads.info.fields.gender_male"), value: "male" },
                                    { label: t("pages.leads.info.fields.gender_female"), value: "female" },
                                ]}
                                onSave={(value) =>
                                    handleFieldUpdate("gender", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.gender ? (
                                        <span className="capitalize">
                                            {currentLeadState.gender}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("gender")}
                            />
                        </DetailField>

                        {useLeadCoreFields && (
                            <>
                                <DetailField label={t("pages.leads.info.fields.languages", { defaultValue: "Languages" })}>
                                    <EditableField
                                        value={currentLeadState.languages || []}
                                        fieldName="languages"
                                        fieldType="multiselect"
                                        options={languageOptions}
                                        onSave={(value) =>
                                            handleFieldUpdate("languages", value)
                                        }
                                        onChange={handleFieldChange}
                                        displayValue={
                                            currentLeadState.languages?.length ? (
                                                <span>
                                                    {currentLeadState.languages
                                                        .map((code) =>
                                                            resolveLanguageLabel(
                                                                code,
                                                            ),
                                                        )
                                                        .join(", ")}
                                                </span>
                                            ) : (
                                                <span className="text-gray-400">--</span>
                                            )
                                        }
                                        alwaysEditing={isFieldEditable}
                                        loading={isFieldLoading("languages")}
                                    />
                                </DetailField>

                                <DetailField
                                    label={t(
                                        "pages.leads.info.fields.date_of_birth_and_age",
                                        {
                                            defaultValue: "Date of Birth & Age",
                                        },
                                    )}
                                    span={2}
                                >
                                    <LeadAgeFieldsGroup
                                        dateOfBirth={
                                            resolvedAgeFields.dateOfBirth
                                        }
                                        age={resolvedAgeFields.age}
                                        ageRange={
                                            (resolvedAgeFields.ageRange as string) ||
                                            null
                                        }
                                        ageRangeOptions={ageRangeOptions}
                                        resolveAgeRangeLabel={
                                            resolveAgeRangeLabel
                                        }
                                        alwaysEditing={isFieldEditable}
                                        disabled={!canEdit}
                                        loading={
                                            isSavingAll ||
                                            updatingField ===
                                                "date_of_birth" ||
                                            updatingField === "age" ||
                                            updatingField === "age_range"
                                        }
                                        onSave={async (values) => {
                                            setUpdatingField("date_of_birth");
                                            try {
                                                await updateLead(values);
                                                setCurrentLeadState((prev) => ({
                                                    ...prev,
                                                    date_of_birth:
                                                        values.date_of_birth,
                                                    age: values.age,
                                                    age_range:
                                                        values.age_range,
                                                }));
                                            } finally {
                                                setUpdatingField(null);
                                            }
                                        }}
                                        onChange={handleFieldChange}
                                    />
                                </DetailField>

                                <DetailField label={t("pages.leads.info.fields.nationality", { defaultValue: "Nationality" })}>
                                    <EditableField
                                        value={currentLeadState.nationality || ""}
                                        fieldName="nationality"
                                        fieldType="country"
                                        onSave={(value) =>
                                            handleFieldUpdate("nationality", value)
                                        }
                                        onChange={handleFieldChange}
                                        alwaysEditing={isFieldEditable}
                                        loading={isFieldLoading("nationality")}
                                    />
                                </DetailField>

                                <DetailField label={t("pages.leads.info.fields.occupation", { defaultValue: "Occupation" })}>
                                    <EditableField
                                        value={currentLeadState.occupation || ""}
                                        fieldName="occupation"
                                        fieldType="text"
                                        onSave={(value) =>
                                            handleFieldUpdate("occupation", value)
                                        }
                                        onChange={handleFieldChange}
                                        alwaysEditing={isFieldEditable}
                                        loading={isFieldLoading("occupation")}
                                    />
                                </DetailField>
                            </>
                        )}

                        <DetailField label={t("pages.leads.info.fields.company")}>
                            <EditableField
                                value={currentLeadState.company_name || ""}
                                fieldName="company_name"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("company_name", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.company")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("company_name")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.website")}>
                            <EditableField
                                value={currentLeadState.website || ""}
                                fieldName="website"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("website", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.website ? (
                                        <a
                                            href={String(
                                                currentLeadState.website,
                                            )}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800"
                                        >
                                            <GlobalOutlined className="mr-1" />
                                            {currentLeadState.website}
                                        </a>
                                    ) : undefined
                                }
                                placeholder={t("pages.leads.info.placeholders.website")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("website")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.lead_owner")}>
                            <EditableField
                                value={
                                    currentLeadState.lead_owner &&
                                    typeof currentLeadState.lead_owner ===
                                        "object"
                                        ? currentLeadState.lead_owner.id
                                        : ((currentLeadState.lead_owner as
                                              | number
                                              | null) ?? null)
                                }
                                fieldName="lead_owner"
                                selectorType="employees"
                                onSave={(value) =>
                                    handleFieldUpdate("lead_owner", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.lead_owner ? (
                                        <UserIndicator
                                            data={currentLeadState.lead_owner}
                                            size="sm"
                                            maxNameLength={40}
                                        />
                                    ) : (
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("lead_owner")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.added_by")}>
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
                                <span className="text-gray-400">--</span>
                            )}
                        </DetailField>
                    </DetailSection>

                    {/* Classification */}
                    <DetailSection
                        title={t("pages.leads.info.sections.classification")}
                        accordion
                        sectionId="lead-classification"
                        isOpen={openSections["lead-classification"] ?? false}
                        onToggle={() => toggleSection("lead-classification")}
                    >
                        <DetailField label={t("pages.leads.info.fields.lead_source")}>
                            <EditableField
                                value={currentLeadState.source_id || null}
                                fieldName="source_id"
                                selectorType="sources"
                                onSave={(value) =>
                                    handleFieldUpdate("source_id", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.leadSource?.type ||
                                    currentLeadState.lead_source?.type ? (
                                        <span className="text-gray-700">
                                            {currentLeadState.leadSource
                                                ?.type ||
                                                currentLeadState.lead_source
                                                    ?.type}
                                        </span>
                                    ) : (
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("source_id")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.category")}>
                            <EditableField
                                value={currentLeadState.category_id || null}
                                fieldName="category_id"
                                selectorType="categories"
                                onSave={(value) =>
                                    handleFieldUpdate("category_id", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.category
                                        ?.category_name ? (
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
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("category_id")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.lifecycle_status")}>
                            <EditableField
                                value={
                                    currentLeadState.lead_lifecycle_status_id ||
                                    null
                                }
                                fieldName="lead_lifecycle_status_id"
                                fieldType="select"
                                options={leadLifecycleStatusOptions}
                                onSave={(value) =>
                                    handleFieldUpdate(
                                        "lead_lifecycle_status_id",
                                        value,
                                    )
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    selectedLifecycleStatus?.label ? (
                                        <Tag
                                            color={
                                                selectedLifecycleStatus.label_color ||
                                                "blue"
                                            }
                                            className="font-medium"
                                        >
                                            {selectedLifecycleStatus.label}
                                        </Tag>
                                    ) : (
                                        <span className="text-gray-400">--</span>
                                    )
                                }
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading(
                                    "lead_lifecycle_status_id",
                                )}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.created_at")}>
                            {currentLeadState.created_at ? (
                                <span className="flex items-center gap-1">
                                    <CalendarOutlined className="text-gray-400" />
                                    {dayjs(currentLeadState.created_at).format(
                                        "MMM DD, YYYY HH:mm",
                                    )}
                                </span>
                            ) : (
                                <span className="text-gray-400">--</span>
                            )}
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.updated_at")}>
                            {currentLeadState.updated_at ? (
                                <span className="flex items-center gap-1">
                                    <CalendarOutlined className="text-gray-400" />
                                    {dayjs(currentLeadState.updated_at).format(
                                        "MMM DD, YYYY HH:mm",
                                    )}
                                </span>
                            ) : (
                                <span className="text-gray-400">--</span>
                            )}
                        </DetailField>
                    </DetailSection>

                    {/* Address */}
                    <DetailSection
                        title={t("pages.leads.info.sections.address")}
                        accordion
                        sectionId="lead-address"
                        isOpen={openSections["lead-address"] ?? false}
                        onToggle={() => toggleSection("lead-address")}
                    >
                         <DetailField label={t("pages.leads.info.fields.address")} span={2}>
                            <EditableField
                                value={currentLeadState.address || ""}
                                fieldName="address"
                                fieldType="textarea"
                                onSave={(value) =>
                                    handleFieldUpdate("address", value)
                                }
                                onChange={handleFieldChange}
                                displayValue={
                                    currentLeadState.address ? (
                                        <span>
                                            <HomeOutlined className="mr-1" />
                                            {currentLeadState.address}
                                        </span>
                                    ) : undefined
                                }
                                placeholder={t("pages.leads.info.placeholders.address")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("address")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.postal_code")}>
                            <EditableField
                                value={currentLeadState.postal_code || ""}
                                fieldName="postal_code"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("postal_code", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.postal_code")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("postal_code")}
                            />
                        </DetailField>
                        <DetailField label={t("pages.leads.info.fields.city")}>
                            <EditableField
                                value={currentLeadState.city || ""}
                                fieldName="city"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("city", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.city")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("city")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.state")}>
                            <EditableField
                                value={currentLeadState.state || ""}
                                fieldName="state"
                                fieldType="text"
                                onSave={(value) =>
                                    handleFieldUpdate("state", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.state")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("state")}
                            />
                        </DetailField>

                        <DetailField label={t("pages.leads.info.fields.country")}>
                            <EditableField
                                value={currentLeadState.country || ""}
                                fieldName="country"
                                fieldType="country"
                                onSave={(value) =>
                                    handleFieldUpdate("country", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.country")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("country")}
                            />
                        </DetailField> 
                    </DetailSection>

                    {/* Notes */}
                    <DetailSection
                        title={t("pages.leads.info.sections.notes")}
                        gridClassName="grid grid-cols-1"
                        accordion
                        sectionId="lead-notes"
                        isOpen={openSections["lead-notes"] ?? false}
                        onToggle={() => toggleSection("lead-notes")}
                    >
                        <DetailField label={t("pages.leads.info.fields.notes")} span={2}>
                            <EditableField
                                value={currentLeadState.note || ""}
                                fieldName="note"
                                fieldType="textarea"
                                onSave={(value) =>
                                    handleFieldUpdate("note", value)
                                }
                                onChange={handleFieldChange}
                                placeholder={t("pages.leads.info.placeholders.notes")}
                                alwaysEditing={isFieldEditable}
                                loading={isFieldLoading("note")}
                            />
                        </DetailField>
                    </DetailSection>
                </div>
            ),
        },
        // Custom field categories as scroll sections
        ...(customFieldCategories || []).map((category) => ({
            key: `category-${category.id}`,
            children: (
                <div className="p-4">
                    <CustomFieldDisplay
                        fields={fields}
                        customFieldsData={
                            currentLeadState.custom_fields_data || {}
                        }
                        categoryId={category.id}
                        title={category.name}
                        column={2}
                        onUpdate={(field, value) =>
                            handleFieldUpdate(field, value)
                        }
                        onChange={handleFieldChange}
                        editable={isFieldEditable}
                        loadingField={updatingField}
                        globalLoading={isSavingAll}
                        accordion
                        sectionId={`lead-category-${category.id}`}
                        isOpen={
                            openSections[`lead-category-${category.id}`] ??
                            false
                        }
                        onToggle={() =>
                            toggleSection(`lead-category-${category.id}`)
                        }
                    />
                </div>
            ),
        })),
    ];

    const sideNavItems = [
        { key: "overview", label: t("pages.leads.info.tab_overview") },
        ...(customFieldCategories || []).map((cat) => ({
            key: `category-${cat.id}`,
            label: cat.name,
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
                    handleClose();
                }}
                successCallback={() => {
                    router.visit(route("lead-contact.index"));
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
                relatedEntity={taskRelatedEntity}
                reloadKeys={["tasks"]}
            />

            <div>
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50/80">
                    <div className="flex items-center gap-x-3 flex-wrap">
                        <h2 className="text-sm font-semibold text-gray-700">
                            {t("pages.leads.info.title")}
                        </h2>
                        {isEditMode && (
                            <Tag color="blue" className="text-xs">
                                {t("pages.leads.info.editing")}
                            </Tag>
                        )}
                        {hasUnsavedChanges && (
                            <Tag color="orange" className="text-xs">
                                {Object.keys(pendingChanges).length} unsaved
                            </Tag>
                        )}
                        <Button
                            type="text"
                            size="small"
                            className="text-gray-600"
                            icon={
                                allSectionsOpen ? (
                                    <MinusSquareOutlined />
                                ) : (
                                    <PlusSquareOutlined />
                                )
                            }
                            onClick={handleToggleAll}
                        >
                            {allSectionsOpen
                                ? t("app.common.actions.collapse_all")
                                : t("app.common.actions.expand_all")}
                        </Button>
                    </div>
                    <Space size="small">
                        {actionItems.map((item) => (
                            <Tooltip key={item.key} title={item.tooltip}>
                                <Button
                                    type={item.type}
                                    icon={item.icon}
                                    danger={item.danger}
                                    onClick={item.onClick}
                                    loading={item.loading}
                                    size="small"
                                />
                            </Tooltip>
                        ))}
                    </Space>
                </div>

                {/* Sidebar + Content */}
                <div className="flex overflow-hidden h-[70vh]">
                    <SideNavTabs
                        items={sideNavItems}
                        activeKey={activeSection}
                        onChange={handleNavClick}
                    />
                    <div ref={scrollContainerRef} className="flex-1 min-w-0 overflow-y-auto">
                        {sectionGroups.map((item) => (
                            <div
                                key={item.key}
                                ref={(el) => { sectionRefs.current[item.key] = el; }}
                                data-section-key={item.key}
                            >
                                {item.children}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
}
