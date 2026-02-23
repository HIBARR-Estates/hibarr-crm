import React, { useEffect, useCallback, useState, useRef } from "react";
import dayjs from "dayjs";
import {
    Form,
    Modal,
    Input,
    message,
    Skeleton,
    Divider,
    Button,
    Alert,
    App,
    Typography,
} from "antd";
import {
    BuildOutlined,
    AppstoreOutlined,
    DollarOutlined,
    EnvironmentOutlined,
    CheckSquareOutlined,
    PictureOutlined,
    FileTextOutlined,
    BlockOutlined,
    ThunderboltOutlined,
    SaveOutlined,
} from "@ant-design/icons";
import type {
    DeveloperProject,
    Developer,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import type { PropertyEnumValues } from "@/Types";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import { useApiQuery } from "@/lib/api/client/useApiQuery";
import type { ApiSuccessResponse } from "@/lib/api/types";
import { useQueryClient } from "@tanstack/react-query";
import { useGenerateDescription } from "@/lib/ai";

// Reuse the existing construction-project section components
import FormSection from "@/Features/Properties/SaveProperty/sections/FormSection";
import ConstructionProjectInfoSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectInfoSection";
import ConstructionProjectDetailsSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectDetailsSection";
import ConstructionProjectPricingSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectPricingSection";
import ConstructionProjectLocationSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectLocationSection";
import ConstructionProjectFacilitiesSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectFacilitiesSection";
import ConstructionProjectPhotosSection from "@/Features/Properties/SaveProperty/sections/ConstructionProjectPhotosSection";
import UnitTypesSection from "./UnitTypesSection";

// ============================================
// Types
// ============================================

interface DeveloperOption {
    id: number;
    name: string;
    logo_url?: string | null;
    project_list: string[] | null;
    whatsapp_group_link: string | null;
}

interface DevelopersAllResponse {
    status: string;
    developers: DeveloperOption[];
}

interface ConstructionProjectFormModalProps {
    open: boolean;
    onClose: () => void;
    /** Existing project for edit mode. Omit for create mode. */
    project?: DeveloperProject | null;
    /** Pre-selected developer (e.g. when opening from a Developer's Show page). */
    developer?: Developer | null;
    /** Callback after successful create/update. */
    onSuccess?: () => void;
}

// ============================================
// Component
// ============================================

const ConstructionProjectFormModal: React.FC<
    ConstructionProjectFormModalProps
> = ({ open, onClose, project, developer, onSuccess }) => {
    const [form] = Form.useForm();
    const isEditing = !!project?.id;
    const queryClient = useQueryClient();
    const { modal } = App.useApp();
    const {
        isEnabled: aiEnabled,
        isGenerating,
        error: aiError,
        insufficientMessage,
        generate,
    } = useGenerateDescription();

    // ── "Save & Continue" state — allows create mode to transition to edit-like state ──
    const [localProject, setLocalProject] = useState<DeveloperProject | null>(
        null,
    );
    const saveForUploadRef = useRef(false);

    // The effective project is the prop (edit mode) or the locally-saved project (save & continue)
    const effectiveProject = project ?? localProject;
    const effectiveProjectId = effectiveProject?.id;
    const isEffectivelyEditing = !!effectiveProjectId;

    // Reset local state when modal closes
    useEffect(() => {
        if (!open) {
            setLocalProject(null);
            saveForUploadRef.current = false;
        }
    }, [open]);

    // ── Fetch unit types for the project (when we have a project ID) ──
    const unitTypesQueryPath = effectiveProjectId
        ? route("developer-projects.unit-types.index", {
              projectId: effectiveProjectId,
          })
        : "";
    const { data: unitTypesData, refetch: refetchUnitTypes } = useApiQuery<{
        status: string;
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: unitTypesQueryPath,
        options: { enabled: open && !!effectiveProjectId },
    });
    const unitTypes = unitTypesData?.unit_types ?? [];

    // ── Fetch developers list (for InfoSection dropdown) ──
    const { data: developersData, isLoading: developersLoading } =
        useApiQuery<DevelopersAllResponse>({
            path: route("developers.all"),
            options: { enabled: open },
        });
    const developers = developersData?.developers ?? [];

    // ── Fetch enum values (for LocationSection city/area dropdowns) ──
    const { data: enumValues, isLoading: enumsLoading } =
        useApiQuery<PropertyEnumValues>({
            path: route("properties.enum_values"),
            options: { enabled: open },
        });

    // ── Mutations ──
    const createMutation = useApiMutate<
        any,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(route("developer-projects.store"), "POST", (res) => {
        if (res?.status === "success") {
            // If this was a "save & continue" flow, stay on the form
            if (saveForUploadRef.current) {
                saveForUploadRef.current = false;
                const createdProject = (res.data as any)?.project || res.data;
                if (createdProject?.id) {
                    setLocalProject(createdProject);
                }
                message.success(
                    "Project saved! You can now upload photos and manage unit types.",
                );
                return;
            }

            message.success("Construction project created!");
            handleClose();
            onSuccess?.();
        }
    });

    const updateMutation = useApiMutate<
        any,
        DeveloperProject,
        ApiSuccessResponse<DeveloperProject>
    >(
        effectiveProjectId
            ? route("developer-projects.update", effectiveProjectId)
            : "",
        "PUT",
        (res) => {
            if (res?.status === "success") {
                message.success("Construction project updated!");
                handleClose();
                onSuccess?.();
            }
        },
    );

    const processing = createMutation.isPending || updateMutation.isPending;

    // ── Populate form when opening in edit mode ──
    useEffect(() => {
        if (!open) return;

        if (project) {
            // Flatten location fields from the related location object
            const locationFields = project.location
                ? {
                      city: (project.location as any).city ?? undefined,
                      area: (project.location as any).area ?? undefined,
                      address: (project.location as any).address ?? undefined,
                      latitude: (project.location as any).latitude ?? undefined,
                      longitude:
                          (project.location as any).longitude ?? undefined,
                  }
                : {};
            console.log(project, "_____||");
            form.setFieldsValue({
                developer_id: project.developer_id,
                name: project.name,
                reference_code: project.reference_code,
                description: project.description,
                google_drive_link: project.google_drive_link,
                availability_link: project.availability_link,
                starting_price: project.starting_price,
                primary_categories: project.primary_categories,
                title_deed_type: project.title_deed_type,
                unit_types: project.unit_types,
                number_of_units: project.number_of_units,
                number_of_blocks: project.number_of_blocks,
                project_total_area_sqm: project.project_total_area_sqm,
                construction_status: project.construction_status,
                completion_date: project.completion_date
                    ? dayjs(project.completion_date)
                    : undefined,
                number_of_phases: project.number_of_phases,
                furniture_package: project.furniture_package,
                rental_guarantee: project.rental_guarantee,
                payment_plan: project.payment_plan,
                facilities: project.facilities,
                distances: project.distances,
                project_location_id: project.project_location_id,
                ...locationFields,
            });
        } else {
            form.resetFields();
            // Pre-select developer if provided (e.g. from Developer Show page)
            if (developer) {
                form.setFieldValue("developer_id", developer.id);
            }
        }
    }, [open, project, developer, form]);

    // ── Transform & submit ──
    const doSubmit = useCallback(
        (isSaveForUpload = false) => {
            form.validateFields()
                .then((values) => {
                    const { _selected_developer_id, ...cleanData } = values;

                    const submitData = {
                        ...cleanData,
                        completion_date: cleanData.completion_date
                            ? cleanData.completion_date.format("YYYY-MM-DD")
                            : null,
                        primary_categories: cleanData.primary_categories || [],
                        unit_types: cleanData.unit_types || [],
                        facilities: cleanData.facilities || [],
                        distances: cleanData.distances || {},
                        payment_plan: cleanData.payment_plan || {},
                    };

                    const onError = (error: any) => {
                        if (error?.errors) {
                            const errorMessages = Object.values(
                                error.errors,
                            ).flat() as string[];
                            message.error(
                                errorMessages[0] ||
                                    "Please check the form for errors",
                            );
                        } else if (error?.message) {
                            message.error(error.message);
                        }
                    };

                    if (isSaveForUpload) {
                        saveForUploadRef.current = true;
                    }

                    if (isEffectivelyEditing) {
                        updateMutation.mutate(submitData, { onError });
                    } else {
                        createMutation.mutate(submitData, { onError });
                    }
                })
                .catch((errorInfo) => {
                    const errCount = errorInfo?.errorFields?.length || 0;
                    message.warning(
                        `Please fix ${errCount} error${errCount !== 1 ? "s" : ""} before submitting`,
                    );
                    form.scrollToField(errorInfo?.errorFields?.[0]?.name, {
                        behavior: "smooth",
                        block: "center",
                    });
                });
        },
        [form, isEffectivelyEditing, createMutation, updateMutation],
    );

    const handleSubmit = useCallback(() => doSubmit(false), [doSubmit]);

    // ── Save & Continue — save project first so Photos / Unit Types can work ──
    const handleSaveForUpload = useCallback(() => {
        const values = form.getFieldsValue(true);
        if (!values.name || !values.developer_id) {
            message.error(
                "Please fill in at least Construction Company and Project Name before saving.",
            );
            return;
        }
        modal.confirm({
            title: "Save project to continue?",
            content:
                "Your project will be saved so you can upload photos and manage unit types.",
            okText: "Save & Continue",
            cancelText: "Cancel",
            onOk: () => doSubmit(true),
        });
    }, [form, modal, doSubmit]);

    const handleClose = useCallback(() => {
        form.resetFields();
        setLocalProject(null);
        saveForUploadRef.current = false;
        onClose();
    }, [form, onClose]);

    const dataLoading = developersLoading || enumsLoading;

    return (
        <Modal
            title={
                isEffectivelyEditing
                    ? "Edit Construction Project"
                    : "Create Construction Project"
            }
            open={open}
            onCancel={handleClose}
            onOk={handleSubmit}
            okText={isEffectivelyEditing ? "Update Project" : "Create Project"}
            confirmLoading={processing}
            width={1000}
            destroyOnClose
        >
            {dataLoading ? (
                <div className="flex justify-center items-center py-16">
                    <Skeleton paragraph={{ rows: 4 }} />
                </div>
            ) : (
                <Form form={form} layout="vertical" size="middle">
                    <div className="overflow-y-auto max-h-[65vh] space-y-4 pb-4 pr-1">
                        {/* Project Info — company & project name */}
                        <FormSection
                            title="Project Info"
                            icon={<BuildOutlined />}
                            description="Construction company and project name"
                        >
                            <ConstructionProjectInfoSection
                                form={form}
                                developers={developers}
                            />
                        </FormSection>

                        {/* Project Details — classification & specs */}
                        <FormSection
                            title="Project Details"
                            icon={<AppstoreOutlined />}
                            description="Construction status, unit types, and specifications"
                        >
                            <ConstructionProjectDetailsSection form={form} />
                        </FormSection>

                        {/* Pricing & Payment Plan */}
                        <FormSection
                            title="Pricing & Payment"
                            icon={<DollarOutlined />}
                            description="Starting price, payment plan, and availability"
                        >
                            <ConstructionProjectPricingSection form={form} />
                        </FormSection>

                        {/* Location */}
                        <FormSection
                            title="Location"
                            icon={<EnvironmentOutlined />}
                            description="Project location and distances to amenities"
                            defaultOpen={false}
                        >
                            <ConstructionProjectLocationSection
                                form={form}
                                enumValues={enumValues}
                            />
                        </FormSection>

                        {/* Facilities */}
                        <FormSection
                            title="Project Facilities"
                            icon={<CheckSquareOutlined />}
                            description="Amenities and facilities available in the project"
                            defaultOpen={false}
                        >
                            <ConstructionProjectFacilitiesSection form={form} />
                        </FormSection>

                        {/* Photos */}
                        <FormSection
                            title="Project Photos"
                            icon={<PictureOutlined />}
                            description="Site plans and exterior photos"
                            defaultOpen={false}
                        >
                            <ConstructionProjectPhotosSection
                                form={form}
                                projectId={effectiveProjectId}
                                onSaveForUpload={
                                    !effectiveProjectId
                                        ? handleSaveForUpload
                                        : undefined
                                }
                            />
                        </FormSection>

                        {/* Description */}
                        <FormSection
                            title="Description"
                            icon={<FileTextOutlined />}
                            description="Project description and notes"
                            defaultOpen={false}
                        >
                            <div className="flex items-center justify-between mb-1">
                                <label className="ant-form-item-label">
                                    <span>Project Description</span>
                                </label>
                                {aiEnabled && (
                                    <Button
                                        size="small"
                                        icon={<ThunderboltOutlined />}
                                        onClick={async () => {
                                            const formData = {
                                                ...form.getFieldsValue(true),
                                                primary_category:
                                                    "construction_project",
                                            };
                                            const existing =
                                                formData.description;

                                            const doGenerate = async () => {
                                                const desc =
                                                    await generate(formData);
                                                if (desc) {
                                                    form.setFieldValue(
                                                        "description",
                                                        desc,
                                                    );
                                                }
                                            };

                                            if (existing?.trim()) {
                                                modal.confirm({
                                                    title: "Replace existing description?",
                                                    content:
                                                        "This will replace your current description with an AI-generated one.",
                                                    okText: "Replace",
                                                    cancelText: "Cancel",
                                                    onOk: doGenerate,
                                                });
                                            } else {
                                                await doGenerate();
                                            }
                                        }}
                                        loading={isGenerating}
                                        type="default"
                                    >
                                        {isGenerating
                                            ? "Generating…"
                                            : "Generate with AI"}
                                    </Button>
                                )}
                            </div>
                            <Form.Item name="description" noStyle>
                                <Input.TextArea
                                    rows={4}
                                    placeholder="Describe the construction project..."
                                    showCount
                                    maxLength={5000}
                                    disabled={isGenerating}
                                />
                            </Form.Item>
                            {insufficientMessage && (
                                <div className="mt-2">
                                    <Alert
                                        message={insufficientMessage}
                                        type="info"
                                        showIcon
                                        closable
                                    />
                                </div>
                            )}
                            {aiError && (
                                <div className="mt-2">
                                    <Alert
                                        message={aiError}
                                        type="error"
                                        showIcon
                                        closable
                                    />
                                </div>
                            )}
                        </FormSection>

                        {/* Unit Types — always visible, shows placeholder in create mode */}
                        <Divider />
                        <FormSection
                            title="Unit Types"
                            icon={<BlockOutlined />}
                            description="Manage unit types and their specifications"
                            defaultOpen={true}
                        >
                            {effectiveProjectId ? (
                                <UnitTypesSection
                                    projectId={effectiveProjectId}
                                    unitTypes={unitTypes}
                                    onRefresh={() => {
                                        refetchUnitTypes();
                                    }}
                                />
                            ) : (
                                <div className="text-center py-8">
                                    <BlockOutlined
                                        style={{
                                            fontSize: 48,
                                            color: "#d9d9d9",
                                        }}
                                        className="mb-4"
                                    />
                                    <Typography.Title
                                        level={5}
                                        type="secondary"
                                    >
                                        Save the project to manage unit types
                                    </Typography.Title>
                                    <Typography.Text
                                        type="secondary"
                                        className="block mb-4"
                                    >
                                        Unit types can be added once the project
                                        has been saved.
                                    </Typography.Text>
                                    <Button
                                        type="primary"
                                        icon={<SaveOutlined />}
                                        onClick={handleSaveForUpload}
                                    >
                                        Save & Continue
                                    </Button>
                                </div>
                            )}
                        </FormSection>
                    </div>
                </Form>
            )}
        </Modal>
    );
};

export default ConstructionProjectFormModal;
