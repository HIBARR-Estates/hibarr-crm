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
import { useTd } from "@/Hooks/useDynamicTranslation";

const Create = ({ pageTitle, employees, categories }: AgentCreateProps) => {
    const { td } = useTd();
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
                        <Form.Item label={td("Agent Type", { source: "en" })}>
                            <Radio.Group
                                value={agentType}
                                onChange={(e) => setAgentType(e.target.value)}
                            >
                                <Radio value="existing">
                                    {td("Existing Employee", { source: "en" })}
                                </Radio>
                                <Radio value="new">{td("New External Agent", { source: "en" })}</Radio>
                            </Radio.Group>
                        </Form.Item>

                        {agentType === "existing" ? (
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
                                    label={td("Full Name", { source: "en" })}
                                    rules={[
                                        {
                                            required: true,
                                            message:
                                                "Please enter the agent name",
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

                        <Form.Item name="category_id" label={td("Categories", { source: "en" })}>
                            <Select
                                mode="multiple"
                                placeholder={td("Select categories (optional)", { source: "en" })}
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
                                {td("Cancel", { source: "en" })}
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={loading}
                            >
                                {td("Create Agent", { source: "en" })}
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
