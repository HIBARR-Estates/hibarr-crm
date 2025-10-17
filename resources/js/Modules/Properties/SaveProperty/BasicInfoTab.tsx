import { SaveOutlined } from "@ant-design/icons";
import {
    Form,
    Input,
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
import { useEffect, useState } from "react";

const { Option } = Select;
const { TextArea } = Input;

// Property type categories for better organization
const PROPERTY_CATEGORIES = {
    housing: {
        label: "Housing",
        types: [
            "Villa",
            "Twin Villa",
            "Apartment",
            "Family Home",
            "Townhouse",
            "Loft",
            "Penthouse",
            "Bungalow",
            "Commercial Property",
            "Block of apartments",
            "Complete Building",
            "Abandoned Building",
            "Residence",
            "Half Construction",
            "Time Share",
        ],
    },
    land: {
        label: "Land",
        types: [
            "Residentially Zoned Land",
            "Field",
            "Residentially and Commercially Zoned Land",
            "Commercially Zoned Land",
            "Industrially Zoned land",
            "Tourism Zoned Land",
            "Olive Grove",
        ],
    },
    commercial: {
        label: "Commercial Real Estate",
        types: [
            "Shop",
            "Hotel",
            "Workplace",
            "Warehouse",
            "Workplace for sale",
            "Office",
        ],
    },
};

const SALE_TYPES = ["For Sale", "For Rent", "For Daily Rental"];
const STATUS_OPTIONS = ["Available", "Under offer", "Sold", "Withdrawn"];

interface BasicInfoTabProps
    extends Pick<
        PropertyFormProps,
        | "onCancel"
        | "loading"
        | "submitText"
        | "cancelText"
        | "data"
        | "onSubmit"
        | "setErrors"
        | "onErrorsClear"
    > {
    setProperty?: (property: Property | undefined) => void;
}

export default function BasicInfoTab({
    onCancel,
    loading,
    submitText,
    cancelText,
    setProperty,
    data,
    onSubmit,
    onErrorsClear,
    setErrors,
}: BasicInfoTabProps) {
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
    }, [data, form]);
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
            <Card title="Basic Property Information" size="small">
                <Row gutter={[16, 16]}>
                    <Col span={24}>
                        <Form.Item
                            name="title"
                            label="Property Title"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter property title",
                                },
                            ]}
                        >
                            <Input placeholder="Enter property title" />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="sale_type"
                            label="Sale Type"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select sale type",
                                },
                            ]}
                        >
                            <Select placeholder="Select sale type">
                                {SALE_TYPES.map((type) => (
                                    <Option key={type} value={type}>
                                        {type}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="property_type"
                            label="Property Type"
                            rules={[
                                {
                                    required: true,
                                    message: "Please select property type",
                                },
                            ]}
                        >
                            <Select
                                placeholder="Select property type"
                                showSearch
                                optionFilterProp="children"
                            >
                                {Object.entries(PROPERTY_CATEGORIES).map(
                                    ([key, category]) => (
                                        <Select.OptGroup
                                            key={key}
                                            label={category.label}
                                        >
                                            {category.types.map((type) => (
                                                <Option key={type} value={type}>
                                                    {type}
                                                </Option>
                                            ))}
                                        </Select.OptGroup>
                                    )
                                )}
                            </Select>
                        </Form.Item>
                    </Col>

                    <Col span={24}>
                        <Form.Item
                            name="description"
                            label="Description"
                            rules={[
                                {
                                    required: true,
                                    message:
                                        "Please enter property description",
                                },
                            ]}
                        >
                            <TextArea
                                rows={4}
                                placeholder="Describe the property..."
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="price"
                            label="Price"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter price",
                                },
                            ]}
                        >
                            <InputNumber
                                style={{ width: "100%" }}
                                placeholder="Enter price"
                                min={0}
                                formatter={(value) =>
                                    `$ ${value}`.replace(
                                        /\B(?=(\d{3})+(?!\d))/g,
                                        ","
                                    )
                                }
                                parser={(value) => {
                                    const num = parseFloat(
                                        value?.replace(/\$\s?|(,*)/g, "") || "0"
                                    );
                                    return num as any;
                                }}
                            />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="status"
                            label="Status"
                            initialValue="Available"
                        >
                            <Select placeholder="Select status">
                                {STATUS_OPTIONS.map((status) => (
                                    <Option key={status} value={status}>
                                        {status}
                                    </Option>
                                ))}
                            </Select>
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="city"
                            label="City"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter city",
                                },
                            ]}
                        >
                            <Input placeholder="Enter city" />
                        </Form.Item>
                    </Col>

                    <Col span={12}>
                        <Form.Item
                            name="area"
                            label="Area/District"
                            rules={[
                                {
                                    required: true,
                                    message: "Please enter area",
                                },
                            ]}
                        >
                            <Input placeholder="Enter area or district" />
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
