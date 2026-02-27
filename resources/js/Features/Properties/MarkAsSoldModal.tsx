import React, { useState } from "react";
import { Modal, Form, Select, Typography, Alert, Divider } from "antd";
import { ShoppingCartOutlined } from "@ant-design/icons";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client/useApiMutate";
import type { ApiSuccessResponse } from "@/lib/api/types";

const { Text } = Typography;

interface DealOption {
    id: number;
    name: string;
    contact_name: string;
}

interface MarkAsSoldModalProps {
    open: boolean;
    onClose: () => void;
    unitTypeId: number;
    unitTypeLabel: string;
    projectName: string;
    deals: DealOption[];
    employees: { id: number; name: string }[];
    onSuccess: (propertyId: number) => void;
}

interface MarkAsSoldPayload {
    deal_id?: number | null;
    responsible_agent_id?: number | null;
}

interface MarkAsSoldResponse {
    property_id: number;
    redirectUrl: string;
}

export default function MarkAsSoldModal({
    open,
    onClose,
    unitTypeId,
    unitTypeLabel,
    projectName,
    deals,
    employees,
    onSuccess,
}: MarkAsSoldModalProps) {
    const [form] = Form.useForm();
    const [submitting, setSubmitting] = useState(false);

    const handleOk = async () => {
        try {
            const values = await form.validateFields();
            setSubmitting(true);

            // Use axios directly since we need to handle the response
            const response = await fetch(
                route("properties.unit-type.mark-as-sold", unitTypeId),
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-Requested-With": "XMLHttpRequest",
                        "X-CSRF-TOKEN":
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute("content") || "",
                    },
                    body: JSON.stringify({
                        deal_id: values.deal_id || null,
                        responsible_agent_id:
                            values.responsible_agent_id || null,
                    }),
                },
            );

            const data = await response.json();

            if (data.status === "success") {
                form.resetFields();
                onSuccess(data.property_id);
            } else {
                // Error is handled by the message display
                console.error("Mark as sold failed:", data);
            }
        } catch (error) {
            console.error("Validation or submission error:", error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        form.resetFields();
        onClose();
    };

    return (
        <Modal
            title={
                <div className="flex items-center gap-2">
                    <ShoppingCartOutlined className="text-orange-500" />
                    <span>Mark as Sold</span>
                </div>
            }
            open={open}
            onOk={handleOk}
            onCancel={handleCancel}
            confirmLoading={submitting}
            okText="Confirm Sale"
            okButtonProps={{ danger: true }}
            width={520}
            destroyOnClose
        >
            <Alert
                type="info"
                showIcon
                className="mb-4"
                message="Create Property from Unit Type"
                description={
                    <span>
                        This will create a new <strong>Property</strong> record
                        from <strong>{unitTypeLabel}</strong> ({projectName})
                        with status set to <strong>Sold</strong>. All unit type
                        details will be copied to the new property.
                    </span>
                }
            />

            <Form form={form} layout="vertical">
                {/* Deal selector (optional) */}
                <Form.Item
                    name="deal_id"
                    label="Link to Deal"
                    extra="Optional — select a deal to associate with this sale"
                >
                    <Select
                        placeholder="Search and select a deal..."
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        options={deals.map((d) => ({
                            value: d.id,
                            label:
                                d.name +
                                (d.contact_name ? ` (${d.contact_name})` : ""),
                        }))}
                    />
                </Form.Item>

                <Divider className="my-3" />

                {/* Responsible Agent (optional) */}
                <Form.Item
                    name="responsible_agent_id"
                    label="Responsible Agent"
                    extra="Optional — assign a responsible agent to the new property"
                >
                    <Select
                        placeholder="Select agent..."
                        allowClear
                        showSearch
                        optionFilterProp="label"
                        options={employees.map((e) => ({
                            value: e.id,
                            label: e.name,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Modal>
    );
}
