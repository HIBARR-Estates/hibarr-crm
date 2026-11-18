import { SaveOutlined } from "@ant-design/icons";
import { Form, Input, Select, Card, Row, Col, Button } from "antd";
import { PropertyFormProps } from "./PropertyForm";
import { Property } from "@/Types";
import { useEffect } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

const { Option } = Select;

const TITLE_DEED_TYPES = [
    "Exchange Title Deed",
    "Turkish Title Deed",
    "British Title Deed",
    "Tahsis Title Deed",
    "Mujahit Title Deed",
];

const TITLE_DEED_STAGES = [
    "Land Title Deed",
    "Shared Holder Title Deed",
    "Individual Title Deed",
    "Individiual (Kat Irtirfakli) Title Deed",
];

const RENT_PAYMENT_INTERVALS = ["monthly", "quarterly", "yearly"];

type Props = Pick<
    PropertyFormProps,
    | "onCancel"
    | "loading"
    | "submitText"
    | "cancelText"
    | "data"
    | "onSubmit"
    | "setErrors"
    | "onErrorsClear"
>;

export default function LegalFinancialTab({
    onCancel,
    cancelText,
    loading,
    submitText,
    data,
    onSubmit,
    onErrorsClear,
    setErrors,
}: Props) {
    const { td } = useTd();
    const [form] = Form.useForm<Omit<Property, "id">>();

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            // Transform the data to handle null values properly
            const formData: any = {
                ...data,
                exterior_features: data.exterior_features || [],
                interior_features: data.interior_features || [],
                location_features: data.location_features || [],
                photos: data.photos || [],
                add_ons: data.add_ons || [],
            };
            form.setFieldsValue(formData);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);
    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        const formData = {
            ...values,
            within_site: values.within_site || false,
            // Handle array fields
            exterior_features: values.exterior_features || [],
            interior_features: values.interior_features || [],
            location_features: values.location_features || [],
            photos: values.photos || [],
            add_ons: values.add_ons || [],
        };

        onSubmit(formData);
    };

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            onFinishFailed={(errorInfo) => {
                // console.log("Form validation failed:", errorInfo);
                setErrors?.(
                    errorInfo.errorFields.map((field) => field.errors).flat(),
                );
                // Extract validation errors and add to errors list
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <Card title={td("Legal & Financial Information", { source: "en" })} size="small">
                <Row gutter={[16, 16]}>
                    <Col span={12}>
                        <Form.Item
                            name="title_deed_type"
                            label={td("Title Deed Type", { source: "en" })}
                        >
                            <Select placeholder={td("Select title deed type", { source: "en" })}>
                                {TITLE_DEED_TYPES.map((type) => (
                                    <Option key={type} value={type}>
                                        {type}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="title_deed_stage"
                            label={td("Title Deed Stage", { source: "en" })}
                        >
                            <Select placeholder={td("Select title deed stage", { source: "en" })}>
                                {TITLE_DEED_STAGES.map((stage) => (
                                    <Option key={stage} value={stage}>
                                        {stage}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    {/* Rental-specific fields */}
                    {data?.sale_type === "rent" && (
                        <>
                            <Col span={12}>
                                <Form.Item
                                    name="minimal_rental_period"
                                    label={td("Minimum Rental Period", { source: "en" })}
                                >
                                    <Input placeholder={td("e.g., 6 months, 1 year", { source: "en" })} />
                                </Form.Item>
                            </Col>

                            <Col span={12}>
                                <Form.Item
                                    name="rent_payment_interval"
                                    label={td("Payment Interval", { source: "en" })}
                                >
                                    <Select placeholder={td("Select payment interval", { source: "en" })}>
                                        {RENT_PAYMENT_INTERVALS.map(
                                            (interval) => (
                                                <Option
                                                    key={interval}
                                                    value={interval}
                                                >
                                                    {interval
                                                        .charAt(0)
                                                        .toUpperCase() +
                                                        interval.slice(1)}
                                                </Option>
                                            ),
                                        )}
                                    </Select>
                                </Form.Item>
                            </Col>
                        </>
                    )}
                </Row>
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
            </Card>
        </Form>
    );
}
