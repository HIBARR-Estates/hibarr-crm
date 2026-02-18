import React, { useEffect, useCallback } from "react";
import dayjs from "dayjs";
import { Form, Modal, Input, message, Skeleton, Divider } from "antd";
import {
    BuildOutlined,
    AppstoreOutlined,
    DollarOutlined,
    EnvironmentOutlined,
    CheckSquareOutlined,
    PictureOutlined,
    FileTextOutlined,
    BlockOutlined,
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

    // ── Fetch unit types for the project (edit mode only) ──
    const unitTypesQueryPath =
        isEditing && project?.id
            ? route("developer-projects.unit-types.index", {
                  projectId: project.id,
              })
            : "";
    const { data: unitTypesData, refetch: refetchUnitTypes } = useApiQuery<{
        status: string;
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: unitTypesQueryPath,
        options: { enabled: open && isEditing && !!project?.id },
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
        isEditing ? route("developer-projects.update", project!.id) : "",
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
    const handleSubmit = useCallback(() => {
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

                if (isEditing) {
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
    }, [form, isEditing, createMutation, updateMutation]);

    const handleClose = useCallback(() => {
        form.resetFields();
        onClose();
    }, [form, onClose]);

    const dataLoading = developersLoading || enumsLoading;

    return (
        <Modal
            title={
                isEditing
                    ? "Edit Construction Project"
                    : "Create Construction Project"
            }
            open={open}
            onCancel={handleClose}
            onOk={handleSubmit}
            okText={isEditing ? "Update Project" : "Create Project"}
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
                                projectId={project?.id}
                            />
                        </FormSection>

                        {/* Description */}
                        <FormSection
                            title="Description"
                            icon={<FileTextOutlined />}
                            description="Project description and notes"
                            defaultOpen={false}
                        >
                            <Form.Item
                                name="description"
                                label="Project Description"
                            >
                                <Input.TextArea
                                    rows={4}
                                    placeholder="Describe the construction project..."
                                />
                            </Form.Item>
                        </FormSection>

                        {/* Unit Types — only shown when editing an existing project */}
                        {isEditing && project?.id && (
                            <>
                                <Divider />
                                <FormSection
                                    title="Unit Types"
                                    icon={<BlockOutlined />}
                                    description="Manage unit types and their specifications"
                                    defaultOpen={true}
                                >
                                    <UnitTypesSection
                                        projectId={project.id}
                                        unitTypes={unitTypes}
                                        onRefresh={() => {
                                            refetchUnitTypes();
                                        }}
                                    />
                                </FormSection>
                            </>
                        )}
                    </div>
                </Form>
            )}
        </Modal>
    );
};

export default ConstructionProjectFormModal;
