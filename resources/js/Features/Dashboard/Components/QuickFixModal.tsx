import React, { useState } from "react";
import {
    Modal,
    Form,
    Input,
    Select,
    Button,
    message,
    Divider,
    DatePicker,
    InputNumber,
} from "antd";
import { router } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading as getLoadingStatus } from "@/lib/utils";
import { errorFormatter } from "@/lib/api/utils/common";
import { IModalProps } from "@/Types/common";

interface DataQualityRecord {
    id: number;
    type: "deal" | "lead";
    name: string;
    data_quality_score: number;
    missing_fields: string[];
    contact?: {
        id: number;
        client_name: string;
        client_email?: string;
        mobile?: string;
    };
    value?: number;
    stage?: string;
    pipeline?: number;
    stage_id?: number;
    agent?: {
        id: number;
        name: string;
        image?: string;
    };
    updated_at: string;
    priority_score: number;
}

interface QuickFixFormData {
    [key: string]: any;
}

interface QuickFixModalProps extends IModalProps {
    record?: DataQualityRecord;
    products?: any[];
    packages?: any[];
    countries?: any[];
}

const QuickFixModal: React.FC<QuickFixModalProps> = ({
    record,
    open: visible,
    onClose: onCancel,
    products = [],
    packages = [],
    countries = [],
}) => {
    const [form] = Form.useForm<QuickFixFormData>();
    const [errors, setErrors] = useState<string[]>([]);

    // Setup API mutations for deals
    const { mutate: updateDeal, status: dealStatus } = useApiMutate<
        QuickFixFormData,
        any,
        ApiResponse<any>
    >(record?.type === "deal" ? `/account/deals/${record.id}` : "", "PATCH");

    // Setup API mutations for leads
    const { mutate: updateLead, status: leadStatus } = useApiMutate<
        QuickFixFormData,
        any,
        ApiResponse<any>
    >(
        record?.type === "lead" ? `/account/lead-contact/${record.id}` : "",
        "PATCH"
    );

    const isLoading =
        getLoadingStatus({ status: dealStatus }) ||
        getLoadingStatus({ status: leadStatus });

    const handleFinish = async (values: QuickFixFormData) => {
        if (!record) return;

        // Clear previous errors
        setErrors([]);

        try {
            if (record.type === "deal") {
                // Add required fields for deal update
                const dealData = {
                    ...values,
                    name: record.name,
                    pipeline: record.pipeline,
                    stage_id: record.stage_id,
                    value: values.value || record.value || 0,
                };

                updateDeal(dealData, {
                    onSuccess: () => {
                        setErrors([]);
                        handleCancel();
                        router.reload();
                        message.success("Deal updated successfully");
                    },
                    onError: (errorResponse) => {
                        const responseErrors =
                            errorFormatter(errorResponse)?.errors || [];
                        setErrors((prev) => [
                            ...prev,
                            ...Object.values(responseErrors).flat(),
                        ]);
                    },
                });
            } else if (record.type === "lead") {
                updateLead(values, {
                    onSuccess: () => {
                        setErrors([]);
                        handleCancel();
                        router.reload();
                        message.success("Lead updated successfully");
                    },
                    onError: (errorResponse) => {
                        const responseErrors =
                            errorFormatter(errorResponse)?.errors || [];
                        setErrors((prev) => [
                            ...prev,
                            ...Object.values(responseErrors).flat(),
                        ]);
                    },
                });
            }
        } catch (error) {
            message.error("An unexpected error occurred");
        }
    };

    const handleCancel = () => {
        form.resetFields();
        setErrors([]);
        onCancel();
    };

    // Pre-fill form when record changes
    React.useEffect(() => {
        if (record) {
            const initialValues: QuickFixFormData = {};

            // Add existing contact data
            if (record.contact) {
                initialValues.client_name = record.contact.client_name;
                initialValues.client_email = record.contact.client_email;
                initialValues.mobile = record.contact.mobile;
            }

            // Add deal-specific data
            if (record.type === "deal" && record.value) {
                initialValues.value = record.value;
            }

            form.setFieldsValue(initialValues);
        }
    }, [record, form]);

    return (
        <Modal
            title={`Quick ${record?.type === "deal" ? "Deal" : "Lead"} Fix: ${
                record?.name
            }`}
            open={visible}
            onCancel={handleCancel}
            footer={null}
            width={600}
        >
            {record && (
                <Form
                    form={form}
                    layout="vertical"
                    onFinish={handleFinish}
                    className="pt-4"
                >
                    {/* Error Display */}
                    {errors.length > 0 && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
                            <div className="text-red-800 text-sm font-medium mb-1">
                                Please correct the following errors:
                            </div>
                            <ul className="text-red-700 text-sm list-disc list-inside">
                                {errors.map((error, index) => (
                                    <li key={index}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {/* Contact Information */}
                    <div className="mb-4">
                        <h4 className="font-medium mb-3">
                            Contact Information
                        </h4>

                        <Form.Item name="client_name" label="Contact Name">
                            <Input placeholder="Enter contact name" />
                        </Form.Item>

                        <Form.Item
                            name="client_email"
                            label="Email Address"
                            rules={[
                                {
                                    type: "email",
                                    message: "Please enter a valid email",
                                },
                            ]}
                        >
                            <Input placeholder="Enter email address" />
                        </Form.Item>

                        <Form.Item name="mobile" label="Phone Number">
                            <Input placeholder="Enter phone number" />
                        </Form.Item>
                    </div>

                    {/* Deal-specific fields */}
                    {record.type === "deal" && (
                        <div className="mb-4">
                            <h4 className="font-medium mb-3">
                                Deal Information
                            </h4>

                            <Form.Item name="package_id" label="Package">
                                <Select placeholder="Select package">
                                    {packages.map((pkg) => (
                                        <Select.Option
                                            key={pkg.id}
                                            value={pkg.id}
                                        >
                                            {pkg.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="product_id" label="Products">
                                <Select
                                    mode="multiple"
                                    placeholder="Select products"
                                    optionFilterProp="children"
                                >
                                    {products.map((prod) => (
                                        <Select.Option
                                            key={prod.id}
                                            value={prod.id}
                                        >
                                            {prod.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>

                            <Form.Item name="value" label="Deal Value">
                                <Input
                                    type="number"
                                    placeholder="Enter deal value"
                                    prefix="$"
                                />
                            </Form.Item>
                        </div>
                    )}

                    {/* Lead-specific fields */}
                    {record.type === "lead" && (
                        <div className="mb-4">
                            <h4 className="font-medium mb-3">
                                Lead Information
                            </h4>

                            <Form.Item name="company_name" label="Company Name">
                                <Input placeholder="Enter company name" />
                            </Form.Item>

                            <Form.Item name="website" label="Website">
                                <Input placeholder="Enter website URL" />
                            </Form.Item>

                            <h5 className="font-medium mt-4 mb-2 text-gray-600">
                                Address Information
                            </h5>

                            <Form.Item name="address" label="Address">
                                <Input.TextArea
                                    rows={2}
                                    placeholder="Enter address"
                                />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item name="city" label="City">
                                    <Input placeholder="Enter city" />
                                </Form.Item>

                                <Form.Item name="state" label="State">
                                    <Input placeholder="Enter state" />
                                </Form.Item>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item
                                    name="postal_code"
                                    label="Postal Code"
                                >
                                    <Input placeholder="Enter postal code" />
                                </Form.Item>

                                <Form.Item name="country" label="Country">
                                    <Select
                                        showSearch
                                        placeholder="Select country"
                                        optionFilterProp="children"
                                    >
                                        {countries.map((country: any) => (
                                            <Select.Option
                                                key={country.id}
                                                value={country.name}
                                            >
                                                {country.name}
                                            </Select.Option>
                                        ))}
                                    </Select>
                                </Form.Item>
                            </div>
                        </div>
                    )}
                    <Divider />
                    <div className="flex justify-end gap-x-2 pt-4 ">
                        <Button onClick={handleCancel}>Cancel</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isLoading}
                        >
                            Update Record
                        </Button>
                    </div>
                </Form>
            )}
        </Modal>
    );
};

export default QuickFixModal;
