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
import { useTd } from "@/Hooks/useDynamicTranslation";

interface SaveAgentModalProps extends Omit<IModalProps, "onClose"> {
    agent?: Agent;
    onClose: () => void;
}

const SaveAgentModal: React.FC<SaveAgentModalProps> = ({
    agent,
    onClose,
    open,
}) => {
    const { td } = useTd();
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
                    <Button onClick={handleCancel}>{td("Cancel", { source: "en" })}</Button>
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
                    message={td("Validation Errors", { source: "en" })}
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
                    <Form.Item label={td("Agent Type", { source: "en" })}>
                        <Radio.Group
                            value={agentType}
                            onChange={(e) => setAgentType(e.target.value)}
                        >
                            <Radio value="existing">{td("Existing Employee", { source: "en" })}</Radio>
                            <Radio value="new">{td("New External Agent", { source: "en" })}</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                {!isEditing && agentType === "existing" ? (
                    <Form.Item
                        name="user_id"
                        label={td("Select Employee", { source: "en" })}
                        rules={[
                            {
                                required: true,
                                message: "Please select an employee",
                            },
                        ]}
                    >
                        <Select
                            placeholder={td("Search and select an employee...", { source: "en" })}
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
                            label={td("Full Name", { source: "en" })}
                            rules={[
                                {
                                    required: !isEditing,
                                    message: "Please enter the agent name",
                                },
                            ]}
                        >
                            <Input placeholder={td("Agent full name", { source: "en" })} />
                        </Form.Item>

                        <Form.Item name="email" label={td("Email", { source: "en" })}>
                            <Input
                                type="email"
                                placeholder={td("agent@example.com", { source: "en" })}
                            />
                        </Form.Item>

                        <Form.Item name="mobile" label={td("Phone", { source: "en" })}>
                            <Input placeholder={td("Phone number", { source: "en" })} />
                        </Form.Item>
                    </>
                )}

                {isEditing && (
                    <Form.Item name="status" label={td("Status", { source: "en" })}>
                        <Radio.Group>
                            <Radio value="enabled">{td("Active", { source: "en" })}</Radio>
                            <Radio value="disabled">{td("Disabled", { source: "en" })}</Radio>
                        </Radio.Group>
                    </Form.Item>
                )}

                <Form.Item name="category_id" label={td("Categories", { source: "en" })}>
                    <Select
                        mode="multiple"
                        placeholder={td("Select categories (optional)", { source: "en" })}
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
