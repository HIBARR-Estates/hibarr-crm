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
    const [form] = Form.useForm<Omit<Property, "id">>();

    // Populate form when data changes
    useEffect(() => {
        if (data) {
            // Transform the data to handle null values properly
            const formData = {
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
                    errorInfo.errorFields.map((field) => field.errors).flat()
                );
                // Extract validation errors and add to errors list
                if (onErrorsClear) {
                    onErrorsClear();
                }
            }}
            size="middle"
        >
            <Card title="Property Specifications" size="small">
                <Row gutter={[16, 16]}>
                    <Col span={8}>
                        <Form.Item name="bedrooms" label="Bedrooms">
                            <Select placeholder="Select bedrooms">
                                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((num) => (
                                    <Option key={num} value={num.toString()}>
                                        {num}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="bathrooms" label="Bathrooms">
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Number of bathrooms"
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="living_room" label="Living Rooms">
                            <Select placeholder="Select living rooms">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <Option key={num} value={num.toString()}>
                                        {num}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item name="floor_number" label="Floor Number">
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Floor number"
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="floors_in_building"
                            label="Total Floors"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Total floors in building"
                                min={1}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={8}>
                        <Form.Item
                            name="building_age"
                            label="Building Age (years)"
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Building age"
                                min={0}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="furniture_status"
                            label="Furniture Status"
                        >
                            <Select placeholder="Select furniture status">
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
