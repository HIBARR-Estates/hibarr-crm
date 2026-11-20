import React, { useState } from "react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import { AgentEditProps } from "@/Types/api/agents";
import { Card, Form, Input, Select, Button, Alert, Radio } from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { useTd } from "@/Hooks/useDynamicTranslation";

const Edit = ({
    pageTitle,
    agent,
    categories,
    currentCategoryIds,
}: AgentEditProps) => {
    const { td } = useTd();
    const [form] = Form.useForm();
    const [errors, setErrors] = useState<string[]>([]);

    const { mutate: update, status } = useApiMutate<any, any, ApiResponse<any>>(
        route("agents.update", agent.id),
        "PUT",
    );

    const loading = getLoadingStatus({ status });

    const handleSubmit = () => {
        form.validateFields().then((values) => {
            setErrors([]);

            update(values, {
                onSuccess: (response: any) => {
                    if (response?.redirectUrl) {
                        router.visit(response.redirectUrl);
                    } else {
                        router.visit(route("agents.show", agent.id));
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
                {
                    name: agent.user?.name ?? "Agent",
                    url: route("agents.show", agent.id),
                },
                { name: "Edit" },
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

                    <Form
                        form={form}
                        layout="vertical"
                        initialValues={{
                            name: agent.user?.name ?? "",
                            email: agent.user?.email ?? "",
                            mobile: agent.user?.mobile_with_phone_code ?? "",
                            status: agent.status,
                            category_id: currentCategoryIds,
                        }}
                    >
                        <Form.Item
                            name="name"
                            label={td("Full Name", { source: "en" })}
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter the agent name",
                                },
                            ]}
                        >
                            <Input />
                        </Form.Item>

                        <Form.Item name="email" label={td("Email", { source: "en" })}>
                            <Input type="email" />
                        </Form.Item>

                        <Form.Item name="mobile" label={td("Phone", { source: "en" })}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="status" label={td("Status", { source: "en" })}>
                            <Radio.Group>
                                <Radio value="enabled">{td("Active", { source: "en" })}</Radio>
                                <Radio value="disabled">{td("Disabled", { source: "en" })}</Radio>
                            </Radio.Group>
                        </Form.Item>

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
                                    router.visit(route("agents.show", agent.id))
                                }
                            >
                                {td("Cancel", { source: "en" })}
                            </Button>
                            <Button
                                type="primary"
                                onClick={handleSubmit}
                                loading={loading}
                            >
                                {td("Update Agent", { source: "en" })}
                            </Button>
                        </div>
                    </Form>
                </Card>
            </div>
        </PageLayout>
    );
};

Edit.layout = (page: React.ReactNode) => (
    <DashboardLayout>{page}</DashboardLayout>
);

export default Edit;
