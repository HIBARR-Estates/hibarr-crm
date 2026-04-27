import React, { useState } from "react";
import { Head } from "@inertiajs/react";
import { Form, Card, Row, Col, Tabs, Button, Space } from "antd";

import CustomFieldTab from "@/Features/Clients/SaveClient/CustomFieldTab";
import {
    Lead,
    Country,
    ClientCategory,
    Salutation,
    Language,
    CustomField,
} from "@/Types";
import { router } from "@inertiajs/react";
import DashboardLayout from "@/Components/DashboardLayout";
import PageLayout from "@/Components/PageLayout";
import useTranslation from "@/Hooks/useTranslation";
import AccountDetailsTab from "@/Features/Clients/SaveClient/AccountDetailsTab";
import CompanyDetailsTab from "@/Features/Clients/SaveClient/CompanyDetailsTab";

interface Props {
    pageTitle: string;
    lead?: Lead;
    employees: any[];
    countries: Country[];
    categories: ClientCategory[];
    salutations: { value: string; label: string }[];
    languages: Language[];
    fields: CustomField[];
    permissions: {
        add_clients: string;
        manage_client_category: string;
        manage_client_subcategory: string;
        add_client_note: string;
    };
}

const CreateClient: React.FC<Props> = ({
    pageTitle,
    lead,
    employees,
    countries,
    categories,
    salutations,
    languages,
    fields,
    permissions,
}) => {
    const { t } = useTranslation();
    const [form] = Form.useForm();
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("account");

    const handleSubmit = async (values: any) => {
        setLoading(true);
        try {
            const formData = new FormData();

            // Add all form values to FormData
            Object.keys(values).forEach((key) => {
                if (values[key] !== undefined && values[key] !== null) {
                    if (key === "image" || key === "company_logo") {
                        if (values[key]?.file) {
                            formData.append(key, values[key].file);
                        }
                    } else if (typeof values[key] === "object") {
                        formData.append(key, JSON.stringify(values[key]));
                    } else {
                        formData.append(key, values[key]);
                    }
                }
            });

            // Add lead ID if converting from lead
            if (lead) {
                formData.append("lead", lead.id.toString());
            }

            router.post(route("clients.store"), formData, {
                onSuccess: (page) => {
                    // showNotification('success', 'Client created successfully');
                    router.visit(route("clients.index"));
                },
                onError: (errors) => {
                    console.error("Client creation failed:", errors);
                    // showNotification('error', 'Failed to create client. Please check the form for errors.');
                },
                onFinish: () => setLoading(false),
            });
        } catch (error) {
            console.error("Error creating client:", error);
            // showNotification('error', 'An error occurred while creating the client');
            setLoading(false);
        }
    };

    const tabItems = [
        {
            key: "account",
            label: "Account Details",
            children: (
                <AccountDetailsTab
                    form={form}
                    lead={lead}
                    employees={employees}
                    categories={categories}
                    salutations={salutations}
                    languages={languages}
                    permissions={permissions}
                />
            ),
        },
        {
            key: "company",
            label: "Company Details",
            children: (
                <CompanyDetailsTab
                    form={form}
                    lead={lead}
                    employees={employees}
                    permissions={permissions}
                />
            ),
        },
        ...(fields && fields.length > 0
            ? [
                  {
                      key: "custom_fields",
                      label: "Custom Fields",
                      children: <CustomFieldTab form={form} fields={fields} />,
                  },
              ]
            : []),
    ];

    return (
        <DashboardLayout>
            <PageLayout
                title={pageTitle}
                breadcrumbs={[
                    { name: t("app.menu.clients"), url: route("clients.index") },
                    {
                        name: lead
                            ? `Convert Lead: ${lead.client_name}`
                            : "Create Client",
                    },
                ]}
            >
                <Card>
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                        initialValues={{
                            // Pre-fill from lead if converting
                            ...(lead && {
                                salutation: lead.salutation,
                                name: lead.client_name,
                                email: lead.client_email,
                                mobile: lead.mobile,
                                company_name: lead.company_name,
                                website: lead.website,
                                address: lead.address,
                                city: lead.city,
                                state: lead.state,
                                country: lead.country,
                                postal_code: lead.postal_code,
                                office: lead.office,
                            }),
                            // Default values
                            login: "disable",
                            sendMail: "yes",
                            gender: "male",
                            locale: "en",
                        }}
                    >
                        <Tabs
                            activeKey={activeTab}
                            onChange={setActiveTab}
                            items={tabItems}
                        />

                        <Row gutter={16} className="mt-6">
                            <Col>
                                <Space>
                                    <Button
                                        type="primary"
                                        htmlType="submit"
                                        loading={loading}
                                        size="large"
                                    >
                                        {lead
                                            ? "Convert to Client"
                                            : "Create Client"}
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            router.visit(route("clients.index"))
                                        }
                                        size="large"
                                    >
                                        Cancel
                                    </Button>
                                </Space>
                            </Col>
                        </Row>
                    </Form>
                </Card>
            </PageLayout>
        </DashboardLayout>
    );
};

export default CreateClient;
