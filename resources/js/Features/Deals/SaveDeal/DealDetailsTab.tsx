import React, { useEffect, useState } from "react";
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
    Space,
    Card,
    Divider,
    Tag,
} from "antd";
import { Deal } from "@/Types/api/deals";
import { usePage } from "@inertiajs/react";
import dayjs from "dayjs";
import { SaveOutlined } from "@ant-design/icons";
import { DealFormProps } from "./DealForm";
import { formatCurrency } from "@/lib/utils";

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
        company = {},
        stages = [],
        packages = [],
    } = props;

    const [pipelineId, setPipelineId] = useState<number>();

    const [agents, setAgents] = useState([]);

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            const formData = {
                ...data,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
            };
            setPipelineId(data.pipeline);
            form.setFieldsValue(formData);
        }
    }, [data, form]);

    // Initialize form with default values
    useEffect(() => {
        if (columnId && !data?.stage_id) {
            form.setFieldValue("stage_id", columnId);
        }
        if (stage && stage.lead_pipeline_id && !data?.pipeline) {
            form.setFieldValue("pipeline", stage.lead_pipeline_id);
        }
    }, [contactID, columnId, stage, data, form]);

    // Fetch stages when pipeline changes
    const handlePipelineChange = (pipelineId: number) => {
        form.setFieldValue("pipeline", pipelineId);
        form.setFieldValue("stage_id", undefined); // Reset stage when pipeline changes
        setPipelineId(pipelineId);
    };

    // Fetch agents when category changes
    const handleCategoryChange = (categoryId: number) => {
        form.setFieldValue("category_id", categoryId);
        if (categoryId) {
            fetchAgents(categoryId);
        }
    };

    useEffect(() => {
        if (data?.category_id) {
            fetchAgents(data.category_id);
        }
    }, [data?.category_id]);

    const fetchAgents = async (categoryId: number) => {
        try {
            const response = await fetch(route("deals.get_agents", categoryId));
            const result = await response.json();
            if (result.status === "success") {
                setAgents(result.data);
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
        }
    };

    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
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
            <Card title="Deal Information" size="small">
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
                                placeholder="Select Lead Contact"
                                showSearch
                                filterOption={(input, option) =>
                                    (option?.children as unknown as string)
                                        ?.toLowerCase()
                                        .includes(input.toLowerCase())
                                }
                                optionFilterProp="children"
                                options={leadContacts.map((contact: any) => ({
                                    label: contact.client_name_salutation,
                                    value: contact.id,
                                }))}
                            />
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
                            <Select placeholder="Select Stage">
                                {stages
                                    .filter((stage: any) =>
                                        pipelineId
                                            ? stage.lead_pipeline_id ===
                                              pipelineId
                                            : false
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
                            name="value"
                            label="Deal Value"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter deal value",
                                },
                            ]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Enter Value"
                                min={0}
                                prefix={defaultCurrencySymbol}
                                parser={(value) => {
                                    const num = parseFloat(
                                        value?.replace(/\$\s?|(,*)/g, "") || "0"
                                    );
                                    return num as any;
                                }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="close_date"
                            label="Close Date"
                            rules={[
                                {
                                    required: true,
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
                                {agents.map((agent: any) => (
                                    <Select.Option
                                        key={agent.id}
                                        value={agent.id}
                                    >
                                        {agent.name}
                                    </Select.Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item name="package_id" label="Package">
                            <Select
                                placeholder="Select Package"
                                allowClear
                                showSearch
                                optionFilterProp="children"
                            >
                                {packages.map(
                                    (p: {
                                        id: number;
                                        name: string;
                                        value: number;
                                    }) => (
                                        <Select.Option key={p.id} value={p.id}>
                                            <div className="flex gap-x-4">
                                                <span>{p.name}</span>
                                                <Tag color={"blue"}>
                                                    {formatCurrency(p.value)}
                                                </Tag>
                                            </div>
                                        </Select.Option>
                                    )
                                )}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={24}>
                        <Form.Item name="product_id" label="Products">
                            <Select
                                mode="multiple"
                                placeholder="Select Products"
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
