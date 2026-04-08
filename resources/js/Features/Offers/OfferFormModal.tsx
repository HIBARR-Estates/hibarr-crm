import React, { useState, useEffect, useMemo } from "react";
import {
    Drawer,
    Form,
    Input,
    InputNumber,
    Select,
    Switch,
    DatePicker,
    Button,
    Alert,
    Divider,
    Space,
    Tag,
} from "antd";
import { router } from "@inertiajs/react";
import { MinusCircleOutlined, PlusOutlined } from "@ant-design/icons";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import type { Offer, OfferFormValues } from "@/Types/api/offers";
import type {
    Developer,
    DeveloperProject,
    DeveloperProjectUnitType,
} from "@/Types/developerProject";
import dayjs from "dayjs";

interface OfferFormModalProps {
    open: boolean;
    onClose: () => void;
    offer?: Offer | null;
    onSuccess?: () => void;
    /** Pre-fill developer when creating from Developer Show page */
    defaultDeveloperId?: number;
}

const OfferFormModal: React.FC<OfferFormModalProps> = ({
    open,
    onClose,
    offer,
    onSuccess,
    defaultDeveloperId,
}) => {
    const [form] = Form.useForm<OfferFormValues>();
    const [errors, setErrors] = useState<string[]>([]);
    const isEditing = !!offer;

    const offerType = Form.useWatch("type", form);
    const selectedDeveloperId = Form.useWatch("developer_id", form);
    const selectedProjectIds: number[] =
        Form.useWatch("project_ids", form) ?? [];

    // Unit type scope: "all" means apply to all unit types, "specific" lets the user pick
    const [unitTypeScope, setUnitTypeScope] = useState<"all" | "specific">(
        "all",
    );

    // Fetch developers for dropdown
    const { data: developersData } = useApiQuery<{
        status: string;
        developers: Developer[];
    }>({
        path: route("developers.all"),
        options: { enabled: open },
    });
    const developers = developersData?.developers ?? [];

    // Fetch all projects for cascading dropdown
    const { data: projectsData } = useApiQuery<{
        status: string;
        projects: DeveloperProject[];
    }>({
        path: route("developer-projects.all"),
        options: { enabled: open && !!selectedDeveloperId },
    });

    // Filter projects to selected developer
    const developerProjects = useMemo(() => {
        if (!selectedDeveloperId || !projectsData?.projects) return [];
        return projectsData.projects.filter(
            (p) => p.developer_id === selectedDeveloperId,
        );
    }, [selectedDeveloperId, projectsData]);

    // Fetch full offer details (with attached projects) when editing
    const { data: offerDetailData } = useApiQuery<{
        status: string;
        offer: Offer;
    }>({
        path: isEditing && offer?.id ? route("offers.show", offer.id) : "",
        options: { enabled: open && isEditing && !!offer?.id },
    });
    const attachedProjects = offerDetailData?.offer?.developer_projects ?? [];

    // Fetch unit types for selected projects (create mode only)
    const firstProjectId =
        !isEditing && selectedProjectIds.length > 0
            ? selectedProjectIds[0]
            : null;
    const { data: unitTypesData } = useApiQuery<{
        status: string;
        unit_types: DeveloperProjectUnitType[];
    }>({
        path: firstProjectId
            ? route("developer-projects.unit-types.index", {
                  projectId: firstProjectId,
              })
            : "",
        options: { enabled: open && !isEditing && !!firstProjectId },
    });

    // Aggregate unit types across all selected projects
    const availableUnitTypes = useMemo(() => {
        // For simplicity, when multiple projects are selected we fetch the first project's
        // unit types. A more complete implementation would fetch for each project.
        return unitTypesData?.unit_types ?? [];
    }, [unitTypesData]);

    const { mutate: createOffer, status: createStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(route("offers.store"), "POST");

    const { mutate: updateOffer, status: updateStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(isEditing ? route("offers.update", offer?.id) : "", "PUT");

    useEffect(() => {
        if (open && isEditing && offer) {
            form.setFieldsValue({
                developer_id: offer.developer_id ?? undefined,
                name: offer.name,
                description: offer.description,
                links: offer.links ?? [],
                type: offer.type,
                value: offer.value,
                max_discount_amount: offer.max_discount_amount,
                is_active: offer.is_active,
                starts_at: offer.starts_at
                    ? (dayjs(offer.starts_at) as any)
                    : null,
                ends_at: offer.ends_at ? (dayjs(offer.ends_at) as any) : null,
            });
        } else if (open && !isEditing) {
            form.resetFields();
            form.setFieldsValue({
                is_active: true,
                type: "percentage",
                developer_id: defaultDeveloperId,
            });
            setUnitTypeScope("all");
        }
    }, [open, offer, isEditing, form, defaultDeveloperId]);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            setErrors([]);
            const payload = {
                ...values,
                starts_at: values.starts_at
                    ? dayjs(values.starts_at).format("YYYY-MM-DD")
                    : null,
                ends_at: values.ends_at
                    ? dayjs(values.ends_at).format("YYYY-MM-DD")
                    : null,
            };

            const callback = {
                onSuccess: () => {
                    handleCancel();
                    if (onSuccess) {
                        onSuccess();
                    } else {
                        router.reload();
                    }
                },
                onError: (err: any) => {
                    const responseErrors = errorFormatter(err)?.errors || [];
                    setErrors(Object.values(responseErrors).flat() as string[]);
                },
            };

            if (isEditing) {
                updateOffer(payload, callback);
            } else {
                createOffer(payload, callback);
            }
        });
    };

    const handleCancel = () => {
        form.resetFields();
        setErrors([]);
        onClose();
    };

    const loading =
        getLoadingStatus({ status: createStatus }) ||
        getLoadingStatus({ status: updateStatus });

    return (
        <Drawer
            title={isEditing ? "Edit Offer" : "Create Offer"}
            placement="right"
            size="large"
            open={open}
            onClose={handleCancel}
            destroyOnHidden
            footer={
                <div className="flex justify-end gap-3">
                    <Button onClick={handleCancel}>Cancel</Button>
                    <Button
                        type="primary"
                        onClick={handleSubmit}
                        loading={loading}
                    >
                        {isEditing ? "Update Offer" : "Create Offer"}
                    </Button>
                </div>
            }
        >
            {errors.length > 0 && (
                <Alert
                    type="error"
                    className="mb-4"
                    message="Validation Errors"
                    description={
                        <ul className="list-disc list-inside">
                            {errors.map((e, i) => (
                                <li key={i}>{e}</li>
                            ))}
                        </ul>
                    }
                    closable
                    onClose={() => setErrors([])}
                />
            )}

            <Form form={form} layout="vertical">
                <Form.Item
                    name="developer_id"
                    label="Developer (Construction Company)"
                    rules={[
                        {
                            required: true,
                            message: "Please select a developer",
                        },
                    ]}
                >
                    <Select
                        placeholder="Select a developer..."
                        showSearch
                        filterOption={(input, option) =>
                            (option?.label ?? "")
                                .toString()
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        options={developers.map((d) => ({
                            label: d.name,
                            value: d.id,
                        }))}
                        onChange={() => {
                            // Clear project selection when developer changes
                            form.setFieldValue("project_ids", []);
                        }}
                        disabled={isEditing}
                    />
                </Form.Item>

                {!isEditing && selectedDeveloperId && (
                    <Form.Item
                        name="project_ids"
                        label="Attach to Projects (optional)"
                        tooltip="Select projects to attach this offer to immediately. You can also attach later."
                    >
                        <Select
                            mode="multiple"
                            placeholder="Select projects..."
                            showSearch
                            filterOption={(input, option) =>
                                (option?.label ?? "")
                                    .toString()
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={developerProjects.map((p) => ({
                                label: p.name,
                                value: p.id,
                            }))}
                        />
                    </Form.Item>
                )}

                {!isEditing &&
                    selectedProjectIds.length > 0 &&
                    availableUnitTypes.length > 0 && (
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">
                                Apply to Unit Types
                            </label>
                            <Select
                                className="w-full mb-2"
                                value={unitTypeScope}
                                onChange={(v) => {
                                    setUnitTypeScope(v);
                                    if (v === "all") {
                                        form.setFieldValue(
                                            "unit_type_ids" as any,
                                            undefined,
                                        );
                                    }
                                }}
                                options={[
                                    { label: "All unit types", value: "all" },
                                    {
                                        label: "Specific unit types",
                                        value: "specific",
                                    },
                                ]}
                            />
                            {unitTypeScope === "specific" && (
                                <Form.Item
                                    name="unit_type_ids"
                                    className="mb-0"
                                >
                                    <Select
                                        mode="multiple"
                                        placeholder="Select unit types..."
                                        showSearch
                                        filterOption={(input, option) =>
                                            (option?.label ?? "")
                                                .toString()
                                                .toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                        options={availableUnitTypes.map(
                                            (ut) => ({
                                                label:
                                                    ut.display_label ||
                                                    `${ut.primary_category} - ${ut.property_type || "N/A"}${ut.bedrooms != null ? ` (${ut.bedrooms} bed)` : ""}`,
                                                value: ut.id,
                                            }),
                                        )}
                                    />
                                </Form.Item>
                            )}
                        </div>
                    )}

                {isEditing && attachedProjects.length > 0 && (
                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-1">
                            Attached Projects
                        </label>
                        <div className="flex flex-wrap gap-1">
                            {attachedProjects.map((p) => (
                                <Tag
                                    key={p.id}
                                    color={
                                        p.pivot?.is_active !== false
                                            ? "blue"
                                            : "default"
                                    }
                                >
                                    {p.name}
                                    {p.pivot?.is_active === false &&
                                        " · Disabled"}
                                </Tag>
                            ))}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">
                            Manage project attachments from the offer detail
                            view.
                        </p>
                    </div>
                )}

                <Divider className="my-3" />

                <Form.Item
                    name="name"
                    label="Offer Name"
                    rules={[
                        {
                            required: true,
                            message: "Please enter the offer name",
                        },
                    ]}
                >
                    <Input placeholder="e.g. Summer 2026 Early Bird" />
                </Form.Item>

                <Form.Item name="description" label="Description">
                    <Input.TextArea
                        rows={3}
                        placeholder="Optional description"
                    />
                </Form.Item>

                {/* Links */}
                <Form.List name="links">
                    {(fields, { add, remove }) => (
                        <div className="mb-4">
                            <label className="block text-sm font-medium mb-1">
                                Links
                            </label>
                            {fields.map(({ key, name, ...restField }) => (
                                <Space
                                    key={key}
                                    className="flex mb-2"
                                    align="start"
                                >
                                    <Form.Item
                                        {...restField}
                                        name={[name, "label"]}
                                        rules={[
                                            {
                                                required: true,
                                                message: "Label required",
                                            },
                                        ]}
                                        className="mb-0"
                                    >
                                        <Input placeholder="Label" />
                                    </Form.Item>
                                    <Form.Item
                                        {...restField}
                                        name={[name, "url"]}
                                        rules={[
                                            {
                                                required: true,
                                                message: "URL required",
                                            },
                                            {
                                                type: "url",
                                                message: "Enter a valid URL",
                                            },
                                        ]}
                                        className="mb-0 flex-1"
                                    >
                                        <Input placeholder="https://..." />
                                    </Form.Item>
                                    <MinusCircleOutlined
                                        className="mt-2 text-red-500 cursor-pointer"
                                        onClick={() => remove(name)}
                                    />
                                </Space>
                            ))}
                            <Button
                                type="dashed"
                                onClick={() => add()}
                                icon={<PlusOutlined />}
                                size="small"
                            >
                                Add Link
                            </Button>
                        </div>
                    )}
                </Form.List>

                <Divider className="my-3" />

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item
                        name="type"
                        label="Discount Type"
                        rules={[
                            {
                                required: true,
                                message: "Please select a type",
                            },
                        ]}
                    >
                        <Select
                            options={[
                                {
                                    label: "Percentage (%)",
                                    value: "percentage",
                                },
                                {
                                    label: "Fixed Amount",
                                    value: "fixed",
                                },
                                {
                                    label: "Perks",
                                    value: "perks",
                                },
                            ]}
                            onChange={() => {
                                // Clear value fields when switching to perks
                                if (form.getFieldValue("type") !== "perks") {
                                    form.setFieldsValue({
                                        value: undefined,
                                        max_discount_amount: undefined,
                                    });
                                }
                            }}
                        />
                    </Form.Item>

                    {offerType !== "perks" && (
                        <Form.Item
                            name="value"
                            label="Discount Value"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter the discount value",
                                },
                                {
                                    type: "number",
                                    min: 0.01,
                                    message: "Must be greater than 0",
                                },
                                ...(offerType === "percentage"
                                    ? [
                                          {
                                              type: "number" as const,
                                              max: 100,
                                              message:
                                                  "Percentage cannot exceed 100",
                                          },
                                      ]
                                    : []),
                            ]}
                        >
                            <InputNumber
                                className="w-full"
                                placeholder={
                                    offerType === "percentage"
                                        ? "e.g. 10"
                                        : "e.g. 5000"
                                }
                                suffix={offerType === "percentage" ? "%" : ""}
                                min={0.01}
                                max={
                                    offerType === "percentage" ? 100 : undefined
                                }
                            />
                        </Form.Item>
                    )}
                </div>

                {offerType === "percentage" && (
                    <Form.Item
                        name="max_discount_amount"
                        label="Max Discount Cap"
                        tooltip="Maximum absolute discount amount when using percentage. Leave empty for no cap."
                    >
                        <InputNumber
                            className="w-full"
                            placeholder="e.g. 50000"
                            min={0}
                        />
                    </Form.Item>
                )}

                <div className="grid grid-cols-2 gap-4">
                    <Form.Item name="starts_at" label="Start Date">
                        <DatePicker className="w-full" />
                    </Form.Item>

                    <Form.Item name="ends_at" label="End Date">
                        <DatePicker className="w-full" />
                    </Form.Item>
                </div>

                <Form.Item
                    name="is_active"
                    label="Active"
                    valuePropName="checked"
                >
                    <Switch />
                </Form.Item>
            </Form>
        </Drawer>
    );
};

export default OfferFormModal;
