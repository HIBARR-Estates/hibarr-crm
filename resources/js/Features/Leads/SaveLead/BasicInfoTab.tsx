import React, { useEffect } from "react";
import {
    Form,
    Input,
    Select,
    Row,
    Col,
    Checkbox,
    Card,
    Divider,
    Button,
} from "antd";
import { SaveOutlined } from "@ant-design/icons";
import { Lead } from "@/Types/api/leads";
import { usePage } from "@inertiajs/react";
import { LeadFormProps } from "./LeadForm";
import LeadDealCreation from "./LeadDealCreation";
import dayjs from "dayjs";

interface BasicInfoTabProps
    extends Pick<
        LeadFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    setLead?: (lead: Lead | undefined) => void;
}

const BasicInfoTab: React.FC<BasicInfoTabProps> = ({
    data,
    onSubmit,
    onCancel,
    loading = false,
    submitText = "Save Lead",
    cancelText = "Cancel",
    onErrorsClear,
    setErrors,
    setLead,
}) => {
    const { props } = usePage<any>();
    const { salutations, sources, categories, employees, permissions } = props;
    console.log("data passed for lead basic info", data);
    const [form] = Form.useForm();
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    const isEditing = data ? true : false;
    // Populate form when data changes
    useEffect(() => {
        if (data) {
            const formData = {
                ...data,
                close_date: data.close_date ? dayjs(data.close_date) : null,
                deal_watcher: data.deal_watcher || [],
                product_id: data.product_id || [],
            };
            form.setFieldsValue(formData);
        }
    }, [data, form]);

    // watch create_deal and create_client checkboxes to update form values
    const createDeal = Form.useWatch("create_deal", form);
    const createClient = Form.useWatch("create_client", form);

    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        console.log(values, createDeal, createClient, "Submit lead basic info");
        const formData = {
            ...values,
            close_date: values.close_date
                ? values.close_date.format("YYYY-MM-DD")
                : "",
            deal_watcher: values.deal_watcher || [],
            product_id: values.product_id || [],
            strategy_accepted: values.strategy_accepted || false,
            downpayment_confirmed: values.downpayment_confirmed || false,
            create_deal: createDeal,
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
            <div className="space-y-4">
                <Card title="Lead Information" size="small">
                    <Row gutter={[24, 16]}>
                        <Col span={8}>
                            <Form.Item label="Salutation" name="salutation">
                                <Select placeholder="--" allowClear>
                                    {salutations?.map((salutation: any) => (
                                        <Select.Option
                                            key={salutation.value}
                                            value={salutation.value}
                                        >
                                            {salutation.label}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item
                                label="Name"
                                name={"client_name"}
                                rules={[
                                    {
                                        required: true,
                                        message: "Name is required",
                                    },
                                ]}
                            >
                                <Input placeholder="Enter full name" />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Email" name={"client_email"}>
                                <Input
                                    type="email"
                                    placeholder="Enter email address"
                                />
                            </Form.Item>
                        </Col>

                        <Col span={8}>
                            <Form.Item label="Mobile" name="mobile">
                                <Input placeholder="Enter mobile number" />
                            </Form.Item>
                        </Col>

                        {permissions?.view_lead_sources !== "none" && (
                            <Col span={8}>
                                <Form.Item
                                    label="Lead Source"
                                    name={"source_id"}
                                >
                                    <Select
                                        placeholder="--"
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            (
                                                option?.children as unknown as string
                                            )
                                                ?.toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                    >
                                        {sources?.map((source: any) => (
                                            <Select.Option
                                                key={source.id}
                                                value={source.id}
                                            >
                                                {source.type}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </Col>
                        )}

                        {permissions?.add_lead === "all" && (
                            <Col span={8}>
                                <Form.Item label="Added By" name={"added_by"}>
                                    <Select
                                        placeholder="--"
                                        allowClear
                                        showSearch
                                        filterOption={(input, option) =>
                                            (
                                                option?.children as unknown as string
                                            )
                                                ?.toLowerCase()
                                                .includes(input.toLowerCase())
                                        }
                                    >
                                        {employees?.map((employee: any) => (
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
                        )}

                        <Col span={8}>
                            <Form.Item label="Lead Owner" name={"lead_owner"}>
                                <Select
                                    placeholder="--"
                                    allowClear
                                    showSearch
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)
                                            ?.toLowerCase()
                                            .includes(input.toLowerCase())
                                    }
                                >
                                    {employees?.map((employee: any) => (
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

                    {/* Deal Creation Options */}
                    {isEditing && (
                        <Row gutter={[24, 16]} className="mt-4">
                            {["all", "added"].includes(
                                permissions?.add_deals
                            ) && (
                                <Col span={12}>
                                    <Form.Item name={"create_deal"}>
                                        <Checkbox value={"on"}>
                                            Create Deal
                                        </Checkbox>
                                    </Form.Item>
                                </Col>
                            )}

                            <Col span={12}>
                                <Form.Item name={"create_client"}>
                                    <Checkbox value={true}>
                                        Auto Convert lead to client when deal
                                        stage is set to 'Win'
                                    </Checkbox>
                                </Form.Item>
                            </Col>
                        </Row>
                    )}

                    {createDeal && <LeadDealCreation />}
                </Card>

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
            </div>
        </Form>
    );
};

export default BasicInfoTab;
