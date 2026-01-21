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
import { useEffect, useState, useRef, useMemo } from "react";
import { usePage } from "@inertiajs/react";
import { PageProps } from "@/Components/DashboardLayout";
import CurrencyInput from "@/Components/CurrencyInput";

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
    const { props } = usePage<PageProps>();
    // const defaultCurrencyId = props.company?.currency_id;
    // const currencies = props.currencies || [];
    // TODO: Refactor the property model to use currency id instead of symbol, also this will mean the import template needs to be updated
    const defaultCurrencySymbol = props.default_currency_symbol || "£";
    
    // Use ref to track previous data ID to prevent unnecessary updates
    const previousDataIdRef = useRef<number | undefined>(undefined);
    const isInitialMountRef = useRef(true);

    // Populate form when data changes (only on initial mount or when data ID changes)
    useEffect(() => {
        // Only update form on initial mount or when switching to a different property
        const shouldUpdate = isInitialMountRef.current || (data?.id !== previousDataIdRef.current);
        
        if (data && shouldUpdate) {
            isInitialMountRef.current = false;
            previousDataIdRef.current = data.id;

            // Handle price: can be number (old format) or {amount, currency} object (new format) or JSON string
            let priceValue = data.price;
            if (priceValue && typeof priceValue === "number") {
                // Old format: convert to {amount, currency} object
                priceValue = {
                    amount: priceValue,
                    currency: props.default_currency_code || "TRY",
                };
            } else if (typeof priceValue === "string") {
                // Try to parse as JSON
                try {
                    const parsed = JSON.parse(priceValue);
                    if (typeof parsed === "number") {
                        priceValue = {
                            amount: parsed,
                            currency: props.default_currency_code || "TRY",
                        };
                    } else {
                        priceValue = parsed;
                    }
                } catch {
                    // If not JSON, treat as number string
                    const numValue = parseFloat(priceValue);
                    if (!isNaN(numValue)) {
                        priceValue = {
                            amount: numValue,
                            currency: props.default_currency_code || "TRY",
                        };
                    }
                }
            }

            // Transform the data to handle null values properly
            const formData = {
                ...data,
                price: priceValue,
                exterior_features: data.exterior_features || [],
                interior_features: data.interior_features || [],
                location_features: data.location_features || [],
                photos: data.photos || [],
                add_ons: data.add_ons || [],
                assets: data.assets || [],
            };
            
            // Use a microtask to defer the update and break the synchronous update cycle
            Promise.resolve().then(() => {
                form.setFieldsValue(formData);
            });
        } else if (!data) {
            // Reset when data is cleared
            previousDataIdRef.current = undefined;
            isInitialMountRef.current = true;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data?.id, props.default_currency_code]);
    const handleSubmit = (values: any) => {
        // Transform the values to match the API expectations
        // Handle price: CurrencyInput returns {amount, currency} object, convert to JSON string for storage
        let priceValue = values.price;
        if (priceValue && typeof priceValue === "object" && priceValue.amount !== undefined) {
            // New format: store as JSON string
            priceValue = JSON.stringify(priceValue);
        } else if (priceValue && typeof priceValue === "number") {
            // Old format: keep as number (for backward compatibility)
            priceValue = priceValue;
        }

        const formData = {
            ...values,
            price: priceValue,
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
                            <CurrencyInput
                                placeholder="Enter price"
                                showLabel={false}
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
