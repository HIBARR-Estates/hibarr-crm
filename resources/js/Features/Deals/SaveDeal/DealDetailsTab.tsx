import React, { useEffect, useState } from "react";
import { Form, Button, Steps, Card, Divider, Row, Col } from "antd";
import { Deal } from "@/Types/api/deals";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { SaveOutlined } from "@ant-design/icons";
import { DealFormProps } from "./DealForm";

import StepClient from "./Steps/StepClient";
import StepAgent from "./Steps/StepAgent";
import StepCustomFields from "./Steps/StepCustomFields";
import StepPackages from "./Steps/StepPackages";
import StepPipeline from "./Steps/StepPipeline";
import StepOtherDetails from "./Steps/StepOtherDetails";

interface DealDetailsTabProps
    extends Pick<
        DealFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    setDeal?: (deal: Deal | undefined) => void;
    disableFields?: string[];
}

const DealDetailsTab: React.FC<DealDetailsTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Deal",
    cancelText = "Cancel",
    onErrorsClear,
    setErrors,
    disableFields = [],
}) => {
    const [form] = Form.useForm();
    const { props } = usePage<any>();
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const {
        leadContacts = [],
        leadPipelines = [],
        categories = [],
        products = [],
        employees = [],
        leadAgents = [],
        stage = null,
        contactID = null,
        columnId = null,
        stages = [],
        packages = [],
        customFieldCategories = [],
        dealCustomFieldCategories = [],
    } = props;

    const allCustomFieldCategories =
        dealCustomFieldCategories.length > 0
            ? dealCustomFieldCategories
            : customFieldCategories;

    const [currentStep, setCurrentStep] = useState(0);
    const [selectedLeadId, setSelectedLeadId] = useState<number | undefined>(
        data?.lead_contact
    );
    const [selectedAgentId, setSelectedAgentId] = useState<number | undefined>(
        data?.agent_id
    );

    // Watch client name for auto-generating deal name
    const clientName = Form.useWatch("client_name", form);

    useEffect(() => {
        if (clientName && !data?.name) {
            form.setFieldValue("name", `New Deal – ${clientName}`);
        }
    }, [clientName, data, form]);

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            const formData = {
                ...data,
                pipeline: data.pipeline,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
                package_id: data.packages
                    ? data.packages.map((p: any) => p.id)
                    : data.package_id || [],
            };
            form.setFieldsValue(formData);
            if (data.lead_contact) setSelectedLeadId(data.lead_contact);
            if (data.agent_id) setSelectedAgentId(data.agent_id);
        }
    }, [data, form]);

    // Initialize form with default values
    useEffect(() => {
        if (columnId && !data?.stage_id) {
            form.setFieldValue("stage_id", columnId);
        }
        if (stage && stage.lead_pipeline_id && !data?.pipeline) {
            form.setFieldValue("pipeline", stage.lead_pipeline_id);
        } else if (!data?.pipeline && leadPipelines.length > 0) {
            const defaultPipeline =
                leadPipelines.find((p: any) => p.default === 1) ||
                leadPipelines[0];
            if (defaultPipeline) {
                form.setFieldValue("pipeline", defaultPipeline.id);
            }
        }
    }, [columnId, stage, data, form, leadPipelines]);

    const handleSubmit = (values: any) => {
        const formData = {
            ...values,
            close_date: values.close_date
                ? values.close_date.format("YYYY-MM-DD")
                : "",
            deal_watcher: values.deal_watcher || [],
            product_id: values.product_id || [],
            strategy_accepted: values.strategy_accepted || false,
            downpayment_confirmed: values.downpayment_confirmed || false,
        };
        onSubmit(formData);
    };

    // Find categories for steps
    const generalInfoCategory = allCustomFieldCategories.find(
        (c: any) => c.name === "General Information"
    );
    const investmentExpCategory = allCustomFieldCategories.find(
        (c: any) => c.name === "Investment Experience"
    );

    const steps = [
        {
            title: "Client Information",
            description: "Mandatory",
            content: (
                <StepClient
                    form={form}
                    leadContacts={leadContacts}
                    onLeadSelect={(value) =>
                        value ? setSelectedLeadId(value) : null
                    }
                    selectedLeadId={selectedLeadId}
                />
            ),
        },
        {
            title: "Agent Information",
            description: "Optional",
            content: (
                <StepAgent
                    form={form}
                    leadAgents={leadAgents}
                    onAgentSelect={(value) =>
                        value ? setSelectedAgentId(value) : null
                    }
                    selectedAgentId={selectedAgentId}
                />
            ),
        },
        {
            title: "General Information",
            description: "Optional",
            content: generalInfoCategory ? (
                <StepCustomFields
                    categoryId={generalInfoCategory.id}
                    categoryName={generalInfoCategory.name}
                    data={data}
                />
            ) : (
                <div className="text-gray-500 italic">
                    No General Information fields configured.
                </div>
            ),
        },
        {
            title: "Investment Experience",
            description: "Optional",
            content: investmentExpCategory ? (
                <StepCustomFields
                    categoryId={investmentExpCategory.id}
                    categoryName={investmentExpCategory.name}
                    data={data}
                />
            ) : (
                <div className="text-gray-500 italic">
                    No Investment Experience fields configured.
                </div>
            ),
        },
        {
            title: "Packages & Value",
            description: "Optional",
            content: (
                <StepPackages
                    form={form}
                    packages={packages}
                    products={products}
                    defaultCurrencySymbol={defaultCurrencySymbol}
                />
            ),
        },
        {
            title: "Pipeline & Stage",
            description: "Optional",
            content: (
                <StepPipeline
                    form={form}
                    leadPipelines={leadPipelines}
                    stages={stages}
                />
            ),
        },
        {
            title: "Other Details",
            description: "Optional",
            content: (
                <StepOtherDetails
                    form={form}
                    categories={categories}
                    employees={employees}
                />
            ),
        },
    ];

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                console.log("Form validation failed:", errorInfo);
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat()
                );
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <div className="flex h-full">
                <div className="w-1/4 pr-4">
                    <Steps
                        direction="vertical"
                        current={currentStep}
                        onChange={setCurrentStep}
                        items={steps.map((s) => ({
                            title: s.title,
                            description: s.description,
                        }))}
                        className="h-full"
                        size="small"
                    />
                </div>
                <div className="w-3/4 pl-4">
                    <h4 className="text-lg font-medium m-0 flex-1 w-full mb-4 text-slate-400/50">
                        {steps[currentStep].title}
                    </h4>
                    <Card className="h-full overflow-y-auto">
                        {steps[currentStep].content}
                    </Card>
                </div>
            </div>

            <Divider />

            <Row justify="end" gutter={8}>
                <Col>
                    <Button onClick={onCancel}>{cancelText}</Button>
                </Col>
                <Col>
                    <Button
                        type="primary"
                        htmlType="submit"
                        loading={loading}
                        icon={<SaveOutlined />}
                    >
                        {submitText}
                    </Button>
                </Col>
            </Row>
        </Form>
    );
};

export default DealDetailsTab;
