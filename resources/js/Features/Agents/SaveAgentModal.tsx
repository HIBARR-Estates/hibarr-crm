import React, { useState, useEffect } from "react";
import { router } from "@inertiajs/react";
import {
    Drawer,
    Form,
    Input,
    Select,
    Radio,
    Button,
    Alert,
    message,
} from "antd";
import { Agent } from "@/Types/api/agents";
import { IModalProps } from "@/Types/common";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { FormDataType, useFormDataBatch } from "@/Hooks/useFormData";

interface SaveAgentModalProps extends Omit<IModalProps, "onClose"> {
    agent?: Agent;
    onClose: () => void;
}

const SaveAgentModal: React.FC<SaveAgentModalProps> = ({
    agent,
    onClose,
    open,
}) => {
    const [form] = Form.useForm();
    const [agentType, setAgentType] = useState<"existing" | "new">("existing");
    const [errors, setErrors] = useState<string[]>([]);

    const isEditing = !!agent;

    const { data: formData, loading: formDataLoading } = useFormDataBatch([
        "employees",
        "categories",
    ] as FormDataType[]);

    const employees = formData.employees || [];
    const categories = formData.categories || [];

    const { mutate: createAgent, status: createStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(route("agents.store"), "POST");

    const { mutate: updateAgent, status: updateStatus } = useApiMutate<
        any,
        any,
        ApiResponse<any>
    >(isEditing ? route("agents.update", agent?.id) : "", "PUT");

    useEffect(() => {
        if (open && isEditing && agent) {
            form.setFieldsValue({
                name: agent.user?.name ?? "",
                email: agent.user?.email ?? "",
                mobile: agent.user?.mobile_with_phone_code ?? "",
                status: agent.status,
            });
        } else if (open && !isEditing) {
            form.resetFields();
            setAgentType("existing");
        }
    }, [open, agent, isEditing, form]);

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            setErrors([]);

            if (isEditing) {
                updateAgent(values, {
                    onSuccess: () => {
                        handleCancel();
                        router.reload();
                    },
                    onError: (err) => {
                        const responseErrors =
                            errorFormatter(err)?.errors || [];
                        setErrors(
                            Object.values(responseErrors).flat() as string[],
                        );
                    },
                });
            } else {
                const payload = { agent_type: agentType, ...values };
                createAgent(payload, {
                    onSuccess: () => {
                        handleCancel();
                        router.reload();
                    },
                    onError: (err) => {
                        const responseErrors =
                            errorFormatter(err)?.errors || [];
                        setErrors(
                            Object.values(responseErrors).flat() as string[],
                        );
                    },
                });
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
            title={isEditing ? "Edit Agent" : "Add Agent"}
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
                        {isEditing ? "Update Agent" : "Create Agent"}
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
                {!isEditing && (
                    <Form.Item label="Agent Type">
                        <Radio.Group
                            value={agentType}
                            onChange={(e) => setAgentType(e.target.value)}
                        >
                            <Radio value="existing">Existing Employee</Radio>
                            <Radio value="new">New External Agent</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {!isEditing && agentType === "existing" ? (
                    <Form.Item
                        name="user_id"
                        label="Select Employee"
                        rules={[
                            {
                                required: true,
                                message: "Please select an employee",
                            },
                        ]}
                    >
                        <Select
                            placeholder="Search and select an employee..."
                            showSearch
                            loading={formDataLoading}
                            filterOption={(input, option) =>
                                String(option?.label ?? "")
                                    .toLowerCase()
                                    .includes(input.toLowerCase())
                            }
                            options={employees.map((emp: any) => ({
                                label: `${emp.name} (${emp.email || ""})`,
                                value: emp.id,
                            }))}
                        />
                    </Form.Item>
                ) : (
                    <>
                        <Form.Item
                            name="name"
                            label="Full Name"
                            rules={[
                                {
                                    required: !isEditing,
                                    message: "Please enter the agent name",
                                },
                            ]}
                        >
                            <Input placeholder="Agent full name" />
                        </Form.Item>

                        <Form.Item name="email" label="Email">
                            <Input
                                type="email"
                                placeholder="agent@example.com"
                            />
                        </Form.Item>

                        <Form.Item name="mobile" label="Phone">
                            <Input placeholder="Phone number" />
                        </Form.Item>
                    </>
                )}

                {isEditing && (
                    <Form.Item name="status" label="Status">
                        <Radio.Group>
                            <Radio value="enabled">Active</Radio>
                            <Radio value="disabled">Disabled</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                <Form.Item name="category_id" label="Categories">
                    <Select
                        mode="multiple"
                        placeholder="Select categories (optional)"
                        showSearch
                        loading={formDataLoading}
                        filterOption={(input, option) =>
                            String(option?.label ?? "")
                                .toLowerCase()
                                .includes(input.toLowerCase())
                        }
                        options={categories.map((cat: any) => ({
                            label: cat.category_name || cat.name,
                            value: cat.id,
                        }))}
                    />
                </Form.Item>
            </Form>
        </Drawer>
    );
};

export default SaveAgentModal;
