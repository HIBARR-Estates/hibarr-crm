import React, { useEffect, useState } from "react";
import {
    Form,
    Input,
    Select,
    Row,
    Col,
    InputNumber,
    DatePicker,
    Card,
} from "antd";
import { CreateLeadFormData } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";

export interface LeadDealCreationProps {}

const LeadDealCreation: React.FC<LeadDealCreationProps> = () => {
    const form = Form.useFormInstance();
    const categoryId = Form.useWatch("category_id", form);
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
    } = props;

    const [pipelineId, setPipelineId] = useState<number>();

    const [agents, setAgents] = useState([]);

    // Fetch stages when pipeline changes
    const handlePipelineChange = (pipelineId: number) => {
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
        if (categoryId) {
            fetchAgents(categoryId);
        }
    }, [categoryId]);

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

    return (
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
                                        ? stage.lead_pipeline_id === pipelineId
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
                                <Select.Option key={agent.id} value={agent.id}>
                                    {agent.name}
                                </Select.Option>
                            ))}
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
            </Row>
        </Card>
    );
};

export default LeadDealCreation;
