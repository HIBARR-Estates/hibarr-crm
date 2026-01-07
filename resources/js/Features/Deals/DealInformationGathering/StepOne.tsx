import React, { useState } from "react";
import { Form, Input, Select, Radio, Button, Row, Col, Divider } from "antd";
import { SearchOutlined, UserOutlined, ShopOutlined } from "@ant-design/icons";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import axios from "axios";
import FormDataSelector from "@/Components/FormDataSelector";

interface StepOneProps {
    onNext: (deal: any, lead: any) => void;
    existingLead?: any;
    existingDeal?: any;
}

const StepOne: React.FC<StepOneProps> = ({
    onNext,
    existingLead,
    existingDeal,
}) => {
    const [form] = Form.useForm();
    const [leadType, setLeadType] = useState<"client" | "agent">("client");
    // Track if user explicitly selected a lead from search (not just editing existing)
    const [selectedLead, setSelectedLead] = useState<any>(null);
    // Track if we're in "edit mode" for the existing lead
    const [isEditingExisting, setIsEditingExisting] = useState<boolean>(false);

    // Initialize form with existing lead data when component mounts or existingLead changes
    React.useEffect(() => {
        if (existingLead) {
            // Pre-fill form but DON'T set selectedLead - allow editing
            setIsEditingExisting(true);
            form.setFieldsValue({
                name: existingLead.client_name,
                email: existingLead.client_email,
                phone: existingLead.mobile,
                company_name: existingLead.company_name,
                referral: existingLead.note,
            });
            // Auto-detect lead type based on company name
            if (existingLead.company_name) {
                setLeadType("agent");
            } else {
                setLeadType("client");
            }
        }
    }, [existingLead, form]);

    const { mutate, status } = useApiMutate<any, any, ApiResponse<any>>(
        route("deals.gathering.init"),
        "POST"
    );

    const loading = isLoading({ status });

    const handleSelectLead = (lead: any) => {
        console.log(lead, "LLLLL");
        if (lead) {
            setSelectedLead(lead);
            form.setFieldsValue({
                name: lead.client_name,
                email: lead.client_email,
                phone: lead.mobile,
                company_name: lead.company_name,
                referral: lead.note,
            });
            // Auto-detect lead type based on company name
            if (lead.company_name) {
                setLeadType("agent");
            } else {
                setLeadType("client");
            }
        } else {
            handleClearLead();
        }
    };

    const handleClearLead = () => {
        setSelectedLead(null);
        setIsEditingExisting(false);
        form.resetFields([
            "name",
            "email",
            "phone",
            "company_name",
            "referral",
        ]);
        setLeadType("client");
    };

    const onFinish = (values: any) => {
        // Build payload - include deal_id if we're editing an existing deal
        const payload: any = {
            lead_type: leadType,
        };

        // If we have an existing deal, include its ID for update logic
        if (existingDeal?.id) {
            payload.deal_id = existingDeal.id;
        }

        // If a lead is selected (existing lead), send lead_id
        // Otherwise send lead_data for creation/update
        if (selectedLead?.id) {
            payload.lead_id = selectedLead.id;
        } else {
            payload.lead_data = values;
        }

        mutate(payload, {
            onSuccess: (response: any) => {
                if (response.status === "success") {
                    onNext(response.deal, response.lead);
                }
            },
        });
    };

    const isFieldDisabled = !!selectedLead;

    return (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="space-y-6"
        >
            {/* Header Section: Lead Type + Search */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-4 border-b border-gray-100">
                {/* Left: Lead Type Question (only visible when creating new) */}
                <div
                    className={`transition-opacity duration-300 ${
                        selectedLead
                            ? "opacity-40 pointer-events-none"
                            : "opacity-100"
                    }`}
                >
                    <div className="text-sm font-medium text-gray-700 mb-2">
                        Is this a Client or an Agent?
                    </div>
                    <Radio.Group
                        value={leadType}
                        onChange={(e) => setLeadType(e.target.value)}
                        disabled={isFieldDisabled}
                        optionType="button"
                        buttonStyle="solid"
                        size="middle"
                    >
                        <Radio.Button value="client">
                            <UserOutlined className="mr-1.5" />
                            Client
                        </Radio.Button>
                        <Radio.Button value="agent">
                            <ShopOutlined className="mr-1.5" />
                            Agent
                        </Radio.Button>
                    </Radio.Group>
                </div>

                {/* Right: Search Existing Lead */}
                <div className="md:w-72">
                    <div className="text-sm font-medium text-gray-700 mb-2">
                        Or select an existing lead
                    </div>
                    <div className="">
                        <FormDataSelector
                            type="leads"
                            placeholder="Search for Leads"
                            className="w-full"
                            onSelect={(_, entity) => handleSelectLead(entity)}
                        />
                    </div>
                </div>
            </div>

            {/* Selected Lead Indicator (from search) */}
            {selectedLead && (
                <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3 text-sm text-blue-700 flex items-center justify-between">
                    <div>
                        <span className="font-medium">
                            Using existing lead:
                        </span>{" "}
                        {selectedLead.client_name}
                        {selectedLead.company_name &&
                            ` • ${selectedLead.company_name}`}
                    </div>
                    <Button
                        type="link"
                        size="small"
                        onClick={handleClearLead}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        Clear & Enter New
                    </Button>
                </div>
            )}

            {/* Editing Existing Lead Indicator */}
            {isEditingExisting && !selectedLead && (
                <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 text-sm text-amber-700">
                    <span className="font-medium">Editing lead info:</span> You
                    can update the details below or search for a different lead
                    above.
                </div>
            )}

            {/* Form Fields */}
            <div className="pt-2">
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label="Name"
                            rules={[
                                {
                                    required: !selectedLead,
                                    message: "Name is required",
                                },
                            ]}
                        >
                            <Input
                                disabled={isFieldDisabled}
                                placeholder="Enter full name"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label="Email"
                            rules={[
                                {
                                    type: "email",
                                    message: "Enter a valid email",
                                },
                            ]}
                        >
                            <Input
                                disabled={isFieldDisabled}
                                placeholder="email@example.com"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="phone" label="Phone">
                            <Input
                                disabled={isFieldDisabled}
                                placeholder="Phone number"
                            />
                        </Form.Item>
                    </Col>
                    {leadType === "agent" && (
                        <Col span={12}>
                            <Form.Item
                                name="company_name"
                                label="Company / Agency Name"
                                rules={[
                                    {
                                        required: !selectedLead,
                                        message:
                                            "Company name is required for agents",
                                    },
                                ]}
                            >
                                <Input
                                    disabled={isFieldDisabled}
                                    placeholder="Company or agency name"
                                />
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                {leadType === "agent" && (
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item name="referral" label="Referral Source">
                                <Input
                                    disabled={isFieldDisabled}
                                    placeholder="How did they find you?"
                                />
                            </Form.Item>
                        </Col>
                    </Row>
                )}
            </div>

            <Divider className="my-6" />

            {/* Submit */}
            <div className="flex justify-end">
                <Button type="primary" htmlType="submit" loading={loading}>
                    Save & Continue
                </Button>
            </div>
        </Form>
    );
};

export default StepOne;
