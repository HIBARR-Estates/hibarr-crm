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
} from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate, useApiQuery } from "@/lib/api/client";
import type { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import type { Offer, OfferFormValues } from "@/Types/api/offers";
import type { Developer, DeveloperProject } from "@/Types/developerProject";
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
                            ]}
                        />
                    </Form.Item>

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
                            max={offerType === "percentage" ? 100 : undefined}
                        />
                    </Form.Item>
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
