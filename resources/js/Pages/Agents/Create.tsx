import React, { useState } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { AgentCreateProps } from "@/Types/api/agents";
import { Card, Form, Input, Select, Button, Radio, Space, Alert } from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";

const Create = ({ pageTitle, employees, categories }: AgentCreateProps) => {
    const [form] = Form.useForm();
    const [agentType, setAgentType] = useState<"existing" | "new">("existing");
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate: store, status } = useApiMutate<any, any, ApiResponse<any>>(
        route("agents.store"),
        "POST",
    );

    const loading = getLoadingStatus({ status });

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            setErrors([]);
            const payload = {
                agent_type: agentType,
                ...values,
            };

            store(payload, {
                onSuccess: (response: any) => {
                    if (response?.redirectUrl) {
                        router.visit(response.redirectUrl);
                    } else {
                        router.visit(route("agents.index"));
                    }
                },
                onError: (err) => {
                    const responseErrors = errorFormatter(err)?.errors || [];
                    setErrors(Object.values(responseErrors).flat() as string[]);
                },
            });
        });
    };

    return (
        <PageLayout
            title={pageTitle}
            breadcrumbs={[
                { name: "Agents", url: route("agents.index") },
                { name: "Add Agent" },
            ]}
        >
            <div className="max-w-3xl mx-auto">
                <Card>
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
                        <Form.Item label="Agent Type">
                            <Radio.Group
                                value={agentType}
                                onChange={(e) => setAgentType(e.target.value)}
                            >
                                <Radio value="existing">
                                    Existing Employee
                                </Radio>
                                <Radio value="new">New External Agent</Radio>
                            </Radio.Group>
                        </Form.Item>

                        {agentType === "existing" ? (
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
                                    filterOption={(input, option) =>
                                        (option?.label ?? "")
                                            .toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                    options={employees.map((emp) => ({
                                        label: `${emp.name} (${emp.email})`,
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
                                            required: true,
                                            message:
                                                "Please enter the agent name",
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

                        <Form.Item name="category_id" label="Categories">
                            <Select
                                mode="multiple"
                                placeholder="Select categories (optional)"
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.label ?? "")
                                        .toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                options={categories.map((cat) => ({
                                    label: cat.category_name,
                                    value: cat.id,
                                }))}
                            />
                        </Form.Item>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button
                                onClick={() =>
                                    router.visit(route("agents.index"))
                                }
                            >
                                Cancel
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={loading}
                            >
                                Create Agent
                            </Button>
                        </div>
                    </Form>
                </Card>
            </div>
        </PageLayout>
    );
};

Create.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Create;
