import React, { useEffect, useState, useMemo, useRef } from "react";
import {
    Row,
    Col,
    Input,
    Select,
    DatePicker,
    InputNumber,
    Switch,
    Form,
    Button,
    Card,
    Divider,
} from "antd";
import { Deal } from "@/Types/api/deals";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { SaveOutlined } from "@ant-design/icons";
import { DealFormProps } from "./DealForm";
import { formatCurrency } from "@/lib/utils";
import CurrencyInput from "@/Components/CurrencyInput";
import { useCurrencies } from "@/Hooks/useFormData";

interface DealDetailsTabProps extends Pick<
    DealFormProps,
    | "onCancel"
    | "loading"
    | "submitText"
    | "cancelText"
    | "data"
    | "onSubmit"
    | "setErrors"
    | "onErrorsClear"
    | "formReferenceData"
> {
    setDeal?: (deal: Deal | undefined) => void;
    disableFields?: string[];
    onPipelineChange?: (pipelineId: number | undefined) => void;
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
    setDeal,
    disableFields = [], // prop to disable fields
    onPipelineChange,
    formReferenceData = {},
}) => {
    const [form] = Form.useForm();
    const selectedValueSource = Form.useWatch("value_source", form) || "manual";
    const { props } = usePage<any>();
    const { currencies } = useCurrencies();
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const defaultCurrencyCode = props.default_currency_code || "TRY";
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
        company = {},
        stages = [],
        packages = [],
    } = {
        ...props,
        ...formReferenceData,
    };

    const [pipelineId, setPipelineId] = useState<number>();
    const pipelineIdRef = useRef<number | undefined>(pipelineId);
    const [selectedCategoryId, setSelectedCategoryId] = useState<number>();

    useEffect(() => {
        pipelineIdRef.current = pipelineId;
    }, [pipelineId]);

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            const rawValue = (data as any).manual_value ?? (data as any).value;
            // CurrencyInput expects { amount, currency }; support both DB shape (number + currency/currency_id) and existing object
            let valueForForm: { amount: number | null; currency: string };
            if (
                rawValue != null &&
                typeof rawValue === "object" &&
                ("amount" in rawValue || "currency" in rawValue)
            ) {
                const amt =
                    rawValue.amount !== undefined &&
                    rawValue.amount !== "" &&
                    rawValue.amount !== null
                        ? Number(rawValue.amount)
                        : null;
                valueForForm = {
                    amount: amt !== null && !isNaN(amt) ? amt : null,
                    currency:
                        typeof rawValue.currency === "string"
                            ? rawValue.currency
                            : defaultCurrencyCode,
                };
            } else {
                const numVal =
                    rawValue !== null &&
                    rawValue !== undefined &&
                    rawValue !== ""
                        ? Number(rawValue)
                        : null;
                const currencyCode =
                    (data as any).currency?.currency_code ||
                    (currencies as any[]).find(
                        (c: any) => c.id === (data as any).currency_id,
                    )?.currency_code ||
                    defaultCurrencyCode;
                valueForForm = {
                    amount: numVal !== null && !isNaN(numVal) ? numVal : null,
                    currency: currencyCode,
                };
            }
            const formData = {
                ...data,
                manual_value: valueForForm,
                value_source: (data as any).value_source || "manual",
                pipeline: data.pipeline,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                deal_watcher: data.deal_watcher || [],
                deal_participant: data.deal_participant || [],
                product_id: data.product_id || [],
                package_id: data.packages
                    ? data.packages.map((p: any) => p.id)
                    : data.package_id || [],
            };
            setPipelineId(formData.pipeline);
            setSelectedCategoryId(formData.category_id);
            form.setFieldsValue(formData as any);

            if (
                typeof formData.pipeline !== "undefined" &&
                formData.pipeline !== pipelineIdRef.current
            ) {
                onPipelineChange?.(formData.pipeline);
            }
        }
    }, [data, form, defaultCurrencyCode, currencies]);

    // Initialize form with default values
    useEffect(() => {
        if (columnId && !data?.stage_id) {
            form.setFieldValue("stage_id", columnId);
        }

        let derivedPipelineId: number | undefined = pipelineId;

        if (stage && stage.lead_pipeline_id && !data?.pipeline) {
            derivedPipelineId = stage.lead_pipeline_id;
            form.setFieldValue("pipeline", derivedPipelineId);
            setPipelineId(derivedPipelineId);
        } else if (!data?.pipeline && !pipelineId && leadPipelines.length > 0) {
            const defaultPipeline =
                leadPipelines.find((p: any) => p.default === 1) ||
                leadPipelines[0];
            if (defaultPipeline) {
                derivedPipelineId = defaultPipeline.id;
                form.setFieldValue("pipeline", derivedPipelineId);
                setPipelineId(derivedPipelineId);
            }
        }

        if (
            typeof derivedPipelineId !== "undefined" &&
            derivedPipelineId !== pipelineId
        ) {
            onPipelineChange?.(derivedPipelineId);
        }
    }, [contactID, columnId, stage, data, form, leadPipelines, pipelineId]);

    // Fetch stages when pipeline changes
    const handlePipelineChange = (pipelineId: number) => {
        form.setFieldValue("pipeline", pipelineId);
        form.setFieldValue("stage_id", undefined); // Reset stage when pipeline changes
        setPipelineId(pipelineId);
        onPipelineChange?.(pipelineId);
    };

    // Fetch agents when category changes
    const handleCategoryChange = (categoryId: number) => {
        form.setFieldValue("category_id", categoryId);
        setSelectedCategoryId(categoryId);
    };

    const uniqueAgents = useMemo(() => {
        const unique = new Map();
        leadAgents.forEach((agent: any) => {
            if (agent.user && !unique.has(agent.user_id)) {
                unique.set(agent.user_id, agent);
            }
        });
        return Array.from(unique.values());
    }, [leadAgents]);

    const displayedAgents = useMemo(() => {
        if (selectedCategoryId) {
            return leadAgents.filter(
                (agent: any) => agent.lead_category_id === selectedCategoryId,
            );
        }
        return uniqueAgents;
    }, [selectedCategoryId, leadAgents, uniqueAgents]);

    const calculateTotalValue = (currentPackageIds?: number[]) => {
        let total = 0;

        // Package value
        const packageIds =
            currentPackageIds !== undefined
                ? currentPackageIds
                : form.getFieldValue("package_id");

        if (Array.isArray(packageIds)) {
            packageIds.forEach((id) => {
                const selectedPackage = packages.find((p: any) => p.id === id);
                if (selectedPackage) {
                    total += parseFloat(selectedPackage.value);
                }
            });
        }

        // form.setFieldValue("value", total);
    };

    const handlePackageChange = (packageIds: number[]) => {
        calculateTotalValue(packageIds);
    };

    const handleSubmit = (values: any) => {
        // CurrencyInput stores { amount, currency }; API expects value (number) and currency_id
        let valueToSend: number | null = null;
        let currencyIdToSend: number | undefined;
        const v = values.manual_value;
        if (v != null && v !== "") {
            if (typeof v === "object" && ("amount" in v || "currency" in v)) {
                const amt = v.amount;
                if (amt !== null && amt !== undefined && amt !== "") {
                    const n = Number(amt);
                    if (!isNaN(n)) valueToSend = n;
                }
                const code =
                    typeof v.currency === "string"
                        ? v.currency
                        : defaultCurrencyCode;
                const found = (currencies as any[]).find(
                    (c: any) =>
                        (c.currency_code || "").toUpperCase() ===
                        code.toUpperCase(),
                );
                if (found?.id) currencyIdToSend = found.id;
            } else {
                const n = Number(v);
                if (!isNaN(n)) valueToSend = n;
            }
        }
        const formData = {
            ...values,
            manual_value: valueToSend,
            value: valueToSend,
            value_source: values.value_source || "manual",
            ...(currencyIdToSend !== undefined && {
                currency_id: currencyIdToSend,
            }),
            close_date: values.close_date
                ? values.close_date.format("YYYY-MM-DD")
                : "",
            deal_watcher: values.deal_watcher || [],
            deal_participant: values.deal_participant || [],
            product_id: values.product_id || [],
            strategy_accepted: values.strategy_accepted || false,
            downpayment_confirmed: values.downpayment_confirmed || false,
        };

        onSubmit(formData);
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                console.log("Form validation failed:", errorInfo);
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat(),
                );
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <Card title="Deal Information" size="small" variant="outlined">
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Form.Item
                            name="lead_contact"
                            label="Lead Contact"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a lead contact",
                                },
                            ]}
                        >
                            <Select
                                // Disabled if "lead_contact" is in the disableFields array
                                disabled={disableFields.includes(
                                    "lead_contact",
                                )}
                                placeholder="Select Lead Contact"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {leadContacts.map((contact: any) => (
                                    <Select.Option
                                        key={contact.id}
                                        value={contact.id}
                                    >
                                        {contact.client_name_salutation}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="name"
                            label="Deal Name"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter deal name",
                                },
                            ]}
                        >
                            <Input placeholder="Enter deal name" />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="pipeline"
                            label="Pipeline"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a pipeline",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select Pipeline"
                                onChange={handlePipelineChange}
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {leadPipelines.map((pipeline: any) => (
                                    <Select.Option
                                        key={pipeline.id}
                                        value={pipeline.id}
                                    >
                                        {pipeline.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="stage_id"
                            label="Stage"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select a stage",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select Stage"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {stages
                                    .filter((stage: any) =>
                                        pipelineId
                                            ? stage.lead_pipeline_id ===
                                              pipelineId
                                            : false,
                                    )
                                    .map((stage: any) => (
                                        <Select.Option
                                            key={stage.id}
                                            value={stage.id}
                                        >
                                            <span
                                                className="inline-block w-2 h-2 rounded-full mr-2"
                                                style={{
                                                    backgroundColor:
                                                        stage.label_color,
                                                }}
                                            ></span>
                                            {stage.name}
                                        </Select.Option>
                                    ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="value_source"
                            label="Value Source"
                            initialValue="manual"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select value source",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select value source"
                                disabled={disableFields.includes("deal_value")}
                                options={[
                                    { value: "manual", label: "Manual" },
                                    {
                                        value: "calculated",
                                        label: "Calculated",
                                    },
                                ]}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="manual_value"
                            label="Manual Value"
                            rules={[
                                () => ({
                                    validator(_, value) {
                                        if (
                                            selectedValueSource === "calculated"
                                        ) {
                                            return Promise.resolve();
                                        }

                                        const amount =
                                            value &&
                                            typeof value === "object" &&
                                            "amount" in value
                                                ? value.amount
                                                : value;

                                        if (
                                            amount !== null &&
                                            amount !== undefined &&
                                            amount !== ""
                                        ) {
                                            return Promise.resolve();
                                        }

                                        return Promise.reject(
                                            new Error(
                                                "Please enter manual value",
                                            ),
                                        );
                                    },
                                }),
                            ]}
                        >
                            <CurrencyInput
                                placeholder={
                                    selectedValueSource === "calculated"
                                        ? "Manual value is optional in calculated mode"
                                        : "Enter manual value"
                                }
                                showLabel={false}
                                noFormItem={true}
                                disabled={
                                    disableFields.includes("deal_value") ||
                                    selectedValueSource === "calculated"
                                }
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="close_date"
                            label="Close Date"
                            rules={[
                                {
                                    required: false,
                                    message: "Please select close date",
                                },
                            ]}
                        >
                            <DatePicker
                                placeholder="Select close date"
                                className="w-full"
                                format="YYYY-MM-DD"
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="category_id" label="Deal Category">
                            <Select
                                placeholder="Select Category"
                                onChange={handleCategoryChange}
                                allowClear
                            >
                                {categories.map((category: any) => (
                                    <Select.Option
                                        key={category.id}
                                        value={category.id}
                                    >
                                        {category.category_name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="agent_id" label="Deal Agent">
                            <Select
                                placeholder="Select Agent"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {displayedAgents.map((agent: any) => (
                                    <Select.Option
                                        key={agent.id}
                                        value={agent?.id}
                                    >
                                        {agent.user?.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="package_id" label="Packages">
                            <Select
                                mode="multiple"
                                placeholder="Select Packages"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                                onChange={handlePackageChange}
                            >
                                {packages.map(
                                    (p: {
                                        id: number;
                                        name: string;
                                        value: number;
                                    }) => (
                                        <Select.Option key={p.id} value={p.id}>
                                            <div className="flex justify-between items-center w-full">
                                                <span className="text-gray-900">
                                                    {p.name}
                                                </span>
                                                <span className="text-gray-500 font-medium">
                                                    {formatCurrency(p.value)}
                                                </span>
                                            </div>
                                        </Select.Option>
                                    ),
                                )}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item name="product_id" label="Properties">
                            <Select
                                mode="multiple"
                                placeholder="Select Properties"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {products.map((product: any) => (
                                    <Select.Option
                                        key={product.id}
                                        value={product.id}
                                    >
                                        {product.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="deal_watcher" label="Deal Watchers">
                            <Select
                                mode="multiple"
                                placeholder="Select Watchers"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {employees.map((employee: any) => (
                                    <Select.Option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item
                            name="deal_participant"
                            label="Deal Participants"
                        >
                            <Select
                                mode="multiple"
                                placeholder="Select Participants"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {employees.map((employee: any) => (
                                    <Select.Option
                                        key={employee.id}
                                        value={employee.id}
                                    >
                                        {employee.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    {data ? (
                        <>
                            <Col span={8}>
                                <Form.Item
                                    name="strategy_accepted"
                                    label="Strategy Accepted"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                            <Col span={8}>
                                <Form.Item
                                    name="downpayment_confirmed"
                                    label="Downpayment Confirmed"
                                    valuePropName="checked"
                                >
                                    <Switch />
                                </Form.Item>
                            </Col>
                        </>
                    ) : null}
                </Row>
                <Divider />

                <Row justify="end" gutter={8} style={{ marginTop: 24 }}>
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
            </Card>
        </Form>
    );
};

export default DealDetailsTab;
