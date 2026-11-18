import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { usePage } from "@inertiajs/react";
import { useFormDataBatch } from "@/Hooks/useFormData";
import { useTranslation } from "@/Hooks/useTranslation";
import { useTd } from "@/Hooks/useDynamicTranslation";

export interface LeadDealCreationProps {}

const LeadDealCreation: React.FC<LeadDealCreationProps> = () => {
    const { t } = useTranslation();
    const { td } = useTd();
    const form = Form.useFormInstance();
    const categoryId = Form.useWatch("category_id", form);
    const { props } = usePage<any>();
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const {
        leadContacts = [],
        leadPipelines: propPipelines = [],
        categories: propCategories = [],
        products: propProducts = [],
        employees: propEmployees = [],
        leadAgents: propLeadAgents = [],
        stages: propStages = [],
    } = props;
    const currentUserId = props.auth?.user?.id as number | undefined;
    const agentDirtyRef = useRef(false);

    const { data: fetchedFormData } = useFormDataBatch(
        [
            "lead-agents",
            "lead-pipelines",
            "lead-stages",
            "categories",
            "products",
            "employees",
        ],
        { enabled: true },
    );

    const pickFetchedArray = (type: string, fallback: any[] = []) => {
        const value = fetchedFormData[type];
        return Array.isArray(value) && value.length > 0 ? value : fallback;
    };

    const leadAgents = pickFetchedArray("lead-agents", propLeadAgents);
    const leadPipelines = pickFetchedArray("lead-pipelines", propPipelines);
    const stages = pickFetchedArray("lead-stages", propStages);
    const categories = pickFetchedArray("categories", propCategories);
    const products = pickFetchedArray("products", propProducts);
    const employees = pickFetchedArray("employees", propEmployees);

    const [pipelineId, setPipelineId] = useState<number>();

    const displayedAgents = useMemo(() => {
        if (categoryId) {
            return leadAgents.filter(
                (agent: any) => agent.lead_category_id === categoryId,
            );
        }
        const unique = new Map();
        leadAgents.forEach((agent: any) => {
            if (agent.user && !unique.has(agent.user_id)) {
                unique.set(agent.user_id, agent);
            }
        });
        return Array.from(unique.values());
    }, [categoryId, leadAgents]);

    // Fetch stages when pipeline changes
    const handlePipelineChange = (pipelineId: number) => {
        form.setFieldValue("stage_id", undefined); // Reset stage when pipeline changes
        setPipelineId(pipelineId);
    };

    // Fetch agents when category changes
    const handleCategoryChange = (categoryId: number) => {
        form.setFieldValue("category_id", categoryId);
    };

    // Prefill deal agent from current user (lead owner defaults to creator on save).
    useEffect(() => {
        if (agentDirtyRef.current || !currentUserId || leadAgents.length === 0) {
            return;
        }
        if (form.getFieldValue("agent_id") != null) {
            return;
        }

        const match =
            (categoryId != null
                ? leadAgents.find(
                      (agent: any) =>
                          agent.user_id === currentUserId &&
                          agent.lead_category_id === categoryId,
                  )
                : undefined) ||
            leadAgents.find((agent: any) => agent.user_id === currentUserId);

        if (match?.id) {
            form.setFieldValue("agent_id", match.id);
        }
    }, [categoryId, currentUserId, leadAgents, form]);

    return (
        <Card title={t("pages.leads.save_form.deal_information")} size="small">
            <Row gutter={[16, 16]}>
                <Col span={8}>
                    <Form.Item
                        name="lead_contact"
                        label={t("pages.leads.save_form.lead_contact")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.save_form.select_lead_contact_required"),
                            },
                        ]}
                    >
                        <Select
                            placeholder={t("pages.leads.save_form.select_lead_contact")}
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
                        label={t("pages.leads.save_form.deal_name")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.save_form.deal_name_required"),
                            },
                        ]}
                    >
                        <Input placeholder={t("pages.leads.save_form.enter_deal_name")} />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        name="pipeline"
                        label={t("pages.leads.save_form.pipeline")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.save_form.pipeline_required"),
                            },
                        ]}
                    >
                        <Select
                            placeholder={t("pages.leads.save_form.select_pipeline")}
                            onChange={handlePipelineChange}
                        >
                            {leadPipelines.map((pipeline: any) => (
                                <Select.Option
                                    key={pipeline.id}
                                    value={pipeline.id}
                                >
                                    {td(pipeline.name, { source: "en" })}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        name="stage_id"
                        label={t("pages.leads.save_form.stage")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.save_form.stage_required"),
                            },
                        ]}
                    >
                        <Select placeholder={t("pages.leads.save_form.select_stage")}>
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
                                        {td(stage.name, { source: "en" })}
                                    </Select.Option>
                                ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item
                        name="value"
                        label={t("pages.leads.save_form.deal_value")}
                        rules={[
                            {
                                required: true,
                                message: t("pages.leads.save_form.deal_value_required"),
                            },
                        ]}
                    >
                        <InputNumber
                            style={{ width: "100%" }}
                            placeholder={t("pages.leads.save_form.enter_value")}
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
                    <Form.Item name="close_date" label={t("pages.leads.save_form.close_date")}>
                        <DatePicker
                            placeholder={t("pages.leads.save_form.select_close_date")}
                            className="w-full"
                            format="YYYY-MM-DD"
                            allowClear
                        />
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="category_id" label={t("pages.leads.save_form.deal_category")}>
                        <Select
                            placeholder={t("pages.leads.save_form.select_category")}
                            onChange={handleCategoryChange}
                            allowClear
                        >
                            {categories.map((category: any) => (
                                <Select.Option
                                    key={category.id}
                                    value={category.id}
                                >
                                    {td(category.category_name, { source: "en" })}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={8}>
                    <Form.Item name="agent_id" label={t("pages.leads.save_form.deal_agent")}>
                        <Select
                            placeholder={t("pages.leads.save_form.select_agent")}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                            onChange={() => {
                                agentDirtyRef.current = true;
                            }}
                        >
                            {displayedAgents.map((agent: any) => (
                                <Select.Option key={agent.id} value={agent.id}>
                                    {agent.user?.name}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item name="product_id" label={t("pages.leads.save_form.products")}>
                        <Select
                            mode="multiple"
                            placeholder={t("pages.leads.save_form.select_products")}
                            allowClear
                            showSearch
                            optionFilterProp="children"
                        >
                            {products.map((product: any) => (
                                <Select.Option
                                    key={product.id}
                                    value={product.id}
                                >
                                    {td(product.name, { source: "en" })}
                                </Select.Option>
                            ))}
                        </Select>
                    </Form.Item>
                </Col>

                <Col span={24}>
                    <Form.Item name="deal_watcher" label={t("pages.leads.save_form.deal_watchers")}>
                        <Select
                            mode="multiple"
                            placeholder={t("pages.leads.save_form.select_watchers")}
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
