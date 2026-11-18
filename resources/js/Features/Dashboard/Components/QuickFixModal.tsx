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
import PhoneInput from "antd-phone-input";
import { useTd } from "@/Hooks/useDynamicTranslation";

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
        lead_agent_id?: number;
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
    countries?: any[];
    leadAgents?: any[];
}

const QuickFixModal: React.FC<QuickFixModalProps> = ({
    record,
    open: visible,
    onClose: onCancel,
    countries = [],
    leadAgents = [],
}) => {
    const { td } = useTd();
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
                        message.success(td("Deal updated successfully", { source: "en" }));
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
                        message.success(td("Lead updated successfully", { source: "en" }));
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
            message.error(td("An unexpected error occurred", { source: "en" }));
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
            if (record.type === "deal") {
                if (record.value) {
                    initialValues.value = record.value;
                }
                if (record.agent?.lead_agent_id) {
                    initialValues.lead_agent_id = record.agent.lead_agent_id;
                }
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
                                {td("Please correct the following errors:", { source: "en" })}
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
                            {td("Contact Information", { source: "en" })}
                        </h4>

                        <Form.Item name="client_name" label={td("Contact Name", { source: "en" })}>
                            <Input placeholder={td("Enter contact name", { source: "en" })} />
                        </Form.Item>

                        <Form.Item
                            name="client_email"
                            label={td("Email Address", { source: "en" })}
                            rules={[
                                {
                                    type: "email",
                                    message: "Please enter a valid email",
                                },
                            ]}
                        >
                            <Input placeholder={td("Enter email address", { source: "en" })} />
                        </Form.Item>

                        <Form.Item name="mobile" label={td("Phone Number", { source: "en" })}>
                            <PhoneInput 
                                enableSearch 
                                placeholder={td("Enter phone number", { source: "en" })}
                                country=""
                            />
                        </Form.Item>
                    </div>

                    {/* Deal-specific fields */}
                    {record.type === "deal" && (
                        <div className="mb-4">
                            <h4 className="font-medium mb-3">
                                {td("Deal Information", { source: "en" })}
                            </h4>

                            <Form.Item
                                name="lead_agent_id"
                                label={td("Assigned Agent", { source: "en" })}
                            >
                                <Select
                                    showSearch
                                    placeholder={td("Select an agent", { source: "en" })}
                                    optionFilterProp="children"
                                    filterOption={(input, option) =>
                                        (option?.children as unknown as string)
                                            ?.toLowerCase()
                                            ?.includes(input.toLowerCase())
                                    }
                                >
                                    {leadAgents.map((agent: any) => (
                                        <Select.Option
                                            key={agent.id}
                                            value={agent.id}
                                        >
                                            {agent.user?.name || agent.name}
                                        </Select.Option>
                                    ))}
                                </Select>
                            </Form.Item>
                        </div>
                    )}

                    {/* Lead-specific fields */}
                    {record.type === "lead" && (
                        <div className="mb-4">
                            <h4 className="font-medium mb-3">
                                {td("Lead Information", { source: "en" })}
                            </h4>

                            <Form.Item name="company_name" label={td("Company Name", { source: "en" })}>
                                <Input placeholder={td("Enter company name", { source: "en" })} />
                            </Form.Item>

                            <Form.Item name="website" label={td("Website", { source: "en" })}>
                                <Input placeholder={td("Enter website URL", { source: "en" })} />
                            </Form.Item>

                            <h5 className="font-medium mt-4 mb-2 text-gray-600">
                                {td("Address Information", { source: "en" })}
                            </h5>

                            <Form.Item name="address" label={td("Address", { source: "en" })}>
                                <Input.TextArea
                                    rows={2}
                                    placeholder={td("Enter address", { source: "en" })}
                                />
                            </Form.Item>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item name="city" label={td("City", { source: "en" })}>
                                    <Input placeholder={td("Enter city", { source: "en" })} />
                                </Form.Item>

                                <Form.Item name="state" label={td("State", { source: "en" })}>
                                    <Input placeholder={td("Enter state", { source: "en" })} />
                                </Form.Item>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <Form.Item
                                    name="postal_code"
                                    label={td("Postal Code", { source: "en" })}
                                >
                                    <Input placeholder={td("Enter postal code", { source: "en" })} />
                                </Form.Item>

                                <Form.Item name="country" label={td("Country", { source: "en" })}>
                                    <Select
                                        showSearch
                                        placeholder={td("Select country", { source: "en" })}
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
                        <Button onClick={handleCancel}>{td("Cancel", { source: "en" })}</Button>
                        <Button
                            type="primary"
                            htmlType="submit"
                            loading={isLoading}
                        >
                            {td("Update Record", { source: "en" })}
                        </Button>
                    </div>
                </Form>
            )}
        </Modal>
    );
};

export default QuickFixModal;
