import { SaveOutlined } from "@ant-design/icons";
import {
    Form,
    Select,
    InputNumber,
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

const { Option } = Select;

const FURNITURE_STATUS = [
    "Unfurnished",
    "Fully Furnished",
    "Part Furnished",
    "White Goods Only",
];

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

export default function PropertyDetailsTab({
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
            <Card title={td("Property Specifications", { source: "en" })} size="small">
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Form.Item name="bedrooms" label={td("Bedrooms", { source: "en" })}>
                            <Select placeholder={td("Select bedrooms", { source: "en" })}>
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <Option key={num} value={num.toString()}>
                                        {num}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="bathrooms" label={td("Bathrooms", { source: "en" })}>
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={td("Number of bathrooms", { source: "en" })}
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="living_room" label={td("Living Rooms", { source: "en" })}>
                            <Select placeholder={td("Select living rooms", { source: "en" })}>
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <Option key={num} value={num.toString()}>
                                        {num}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="floor_number" label={td("Floor Number", { source: "en" })}>
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={td("Floor number", { source: "en" })}
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="floors_in_building"
                            label={td("Total Floors", { source: "en" })}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={td("Total floors in building", { source: "en" })}
                                min={1}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="building_age"
                            label={td("Building Age (years)", { source: "en" })}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder={td("Building age", { source: "en" })}
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="furniture_status"
                            label={td("Furniture Status", { source: "en" })}
                        >
                            <Select placeholder={td("Select furniture status", { source: "en" })}>
                                {FURNITURE_STATUS.map((status) => (
                                    <Option key={status} value={status}>
                                        {status}
                                    </Option>
                                ))}
                            </Select>
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
