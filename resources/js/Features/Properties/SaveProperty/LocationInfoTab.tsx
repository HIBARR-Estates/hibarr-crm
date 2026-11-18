import { SaveOutlined } from "@ant-design/icons";
import {
    Form,
    Input,
    InputNumber,
    Switch,
    Card,
    Row,
    Col,
    Divider,
    Button,
} from "antd";
import { PropertyFormProps } from "./PropertyForm";
import { Property } from "@/Types";
import { useEffect } from "react";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
export default function LocationInfoTab({
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
                console.log("Form validation failed:", errorInfo);
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
            <Card title={td("Location Details", { source: "en" })} size="small">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Form.Item name="map" label={td("Map URL", { source: "en" })}>
                            <Input placeholder={td("Google Maps URL or coordinates", { source: "en" })} />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item name="land_size" label={td("Land Size (m²)", { source: "en" })}>
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={td("Enter land size", { source: "en" })}
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="within_site"
                            label={td("Within Site/Complex", { source: "en" })}
                            valuePropName="checked"
                        >
                            <Switch />
                        </Form.Item>
                    </Col>
                </Row>

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
            </Card>
        </Form>
    );
}
