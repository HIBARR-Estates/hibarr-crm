import React, { useState } from "react";
import {
    Form,
    Input,
    Radio,
    Button,
    Row,
    Col,
    Divider,
} from "antd";
import {
    SearchOutlined,
    UserOutlined,
    ShopOutlined,
    PlusOutlined,
    ArrowLeftOutlined,
} from "@ant-design/icons";
import { usePage } from "@inertiajs/react";
import { useApiMutate } from "@/lib/api/client";
import { ApiResponse } from "@/lib/api/types";
import { isLoading } from "@/lib/utils";
import FormDataSelector from "@/Components/FormDataSelector";
import PhoneInput from "antd-phone-input";
import { useTd } from "@/Hooks/useDynamicTranslation";

type FlowStep = "search" | "create" | "selected";

interface StepOneProps {
    onNext: (deal: any, lead: any) => void;
    existingLead?: any;
    existingDeal?: any;
    pipelineId?: number; // Pipeline ID for new deals
}

const StepOne: React.FC<StepOneProps> = ({
    onNext,
    existingLead,
    existingDeal,
    pipelineId,
}) => {
    const { td } = useTd();
    const { props } = usePage<any>();
    const { permissions } = props;
    const [form] = Form.useForm();
    const [leadType, setLeadType] = useState<"client" | "agent">("client");
    // Track the current flow step
    const [flowStep, setFlowStep] = useState<FlowStep>(
        existingLead ? "selected" : "search"
    );
    // Track selected lead
    const [selectedLead, setSelectedLead] = useState<any>(existingLead || null);

    // Initialize form with existing lead data when component mounts or existingLead changes
    React.useEffect(() => {
        if (existingLead) {
            setSelectedLead(existingLead);
            setFlowStep("selected");
            // Auto-detect lead type based on company name
            if (existingLead.company_name) {
                setLeadType("agent");
            } else {
                setLeadType("client");
            }
        }
    }, [existingLead]);

    const { mutate, status } = useApiMutate<any, any, ApiResponse<any>>(
        route("deals.gathering.init"),
        "POST"
    );

    const loading = isLoading({ status });

    const handleSelectLead = (lead: any) => {
        if (lead) {
            setSelectedLead(lead);
            setFlowStep("selected");
            // Auto-detect lead type based on company name
            if (lead.company_name) {
                setLeadType("agent");
            } else {
                setLeadType("client");
            }
        }
    };

    const handleCreateNew = () => {
        setSelectedLead(null);
        setFlowStep("create");
        form.resetFields();
        setLeadType("client");
    };

    const handleBackToSearch = () => {
        setSelectedLead(null);
        setFlowStep("search");
        form.resetFields();
        setLeadType("client");
    };

    const handleChangeLead = () => {
        setSelectedLead(null);
        setFlowStep("search");
    };

    const onFinish = (values: any) => {
        // Transform phone value from PhoneInput object to string format
        if (values.phone && typeof values.phone === 'object') {
            const phoneObj = values.phone;
            // Combine countryCode, areaCode, and phoneNumber into a single string
            // Format: +{countryCode}{areaCode}{phoneNumber}
            const parts = [
                phoneObj.countryCode,
                phoneObj.areaCode,
                phoneObj.phoneNumber
            ].filter(Boolean);
            values.phone = parts.length > 0 ? `+${parts.join('')}` : '';
        }
        // Build payload - include deal_id if we're editing an existing deal
        const payload: any = {
            lead_type: leadType,
        };

        // If we have an existing deal, include its ID for update logic
        if (existingDeal?.id) {
            payload.deal_id = existingDeal.id;
        }

        // Include pipeline_id for new deals
        if (!existingDeal && pipelineId) {
            payload.pipeline_id = pipelineId;
        }

        // If a lead is selected (existing lead), send lead_id
        // Otherwise send lead_data for creation
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

    // Render search step
    const renderSearchStep = () => (
        <div className="py-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <SearchOutlined className="text-2xl text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    {td("Find an Existing Lead", { source: "en" })}
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    {td("Search for an existing lead by name, email, or company. If you can't find them, you can create a new lead.", { source: "en" })}
                </p>
            </div>

            <div className="max-w-md mx-auto mb-8">
                <FormDataSelector
                    type="leads"
                    placeholder={td("Search by name, email, or company...", { source: "en" })}
                    className="w-full"
                    onSelect={(_, entity) => handleSelectLead(entity)}
                />
            </div>

            <Divider className="my-8">
                <span className="text-gray-400 text-sm">or</span>
            </Divider>

            <div className="text-center">
                <Button
                    type="default"
                    icon={<PlusOutlined />}
                    onClick={handleCreateNew}
                    className="px-8"
                >
                    {td("Create New Lead", { source: "en" })}
                </Button>
            </div>
        </div>
    );

    // Render selected lead step
    const renderSelectedStep = () => (
        <div className="py-6">
            {/* Selected Lead Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-6 mb-6">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg font-semibold">
                            {selectedLead?.client_name
                                ?.charAt(0)
                                ?.toUpperCase() || "?"}
                        </div>
                        <div>
                            <h3 className="text-lg font-semibold text-gray-800">
                                {selectedLead?.client_name || "Unknown"}
                            </h3>
                            <div className="text-sm text-gray-500 space-y-0.5">
                                {selectedLead?.client_email && (
                                    <div>{selectedLead.client_email}</div>
                                )}
                                {selectedLead?.mobile && (
                                    <div>{selectedLead.mobile}</div>
                                )}
                                {(() => {
                                    const addressParts = [
                                        selectedLead?.address,
                                        selectedLead?.city,
                                        selectedLead?.state,
                                        selectedLead?.country,
                                        selectedLead?.postal_code,
                                    ].filter(Boolean);
                                    return addressParts.length > 0 && (
                                        <div>{addressParts.join(", ")}</div>
                                    );
                                })()}
                                {selectedLead?.company_name && (
                                    <div className="text-blue-600 font-medium">
                                        {selectedLead.company_name}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <Button
                        type="link"
                        onClick={handleChangeLead}
                        className="text-blue-600 hover:text-blue-800"
                    >
                        {td("Change Lead", { source: "en" })}
                    </Button>
                </div>
            </div>

            {/* Continue Button */}
            <div className="flex justify-end">
                <Button
                    type="primary"
                    onClick={() => onFinish({})}
                    loading={loading}
                >
                    {td("Continue with this Lead", { source: "en" })}
                </Button>
            </div>
        </div>
    );

    // Render create new lead form
    const renderCreateStep = () => (
        <Form
            form={form}
            layout="vertical"
            onFinish={onFinish}
            className="py-4"
        >
            {/* Back Button */}
            <div className="mb-6">
                <Button
                    type="text"
                    icon={<ArrowLeftOutlined />}
                    onClick={handleBackToSearch}
                    className="text-gray-500 hover:text-gray-700 -ml-2"
                >
                    {td("Back to Search", { source: "en" })}
                </Button>
            </div>

            {/* Lead Type Selection */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-3">
                    {td("What type of lead is this?", { source: "en" })}
                </div>
                <Radio.Group
                    value={leadType}
                    onChange={(e) => setLeadType(e.target.value)}
                    optionType="button"
                    buttonStyle="solid"
                    size="middle"
                >
                    <Radio.Button value="client">
                        <UserOutlined className="mr-1.5" />
                        {td("Client", { source: "en" })}
                    </Radio.Button>
                    <Radio.Button value="agent">
                        <ShopOutlined className="mr-1.5" />
                        {td("Agent", { source: "en" })}
                    </Radio.Button>
                </Radio.Group>
            </div>

            {/* Form Fields */}
            <div>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="salutation" label={td("Salutation", { source: "en" })}>
                            <FormDataSelector
                                type="salutations"
                                placeholder="—"
                            />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="gender" label={td("Gender", { source: "en" })}>
                            <FormDataSelector
                                type="genders"
                                placeholder="—"
                            />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label={td("Name", { source: "en" })}
                            rules={[
                                {
                                    required: true,
                                    message: "Name is required",
                                },
                            ]}
                        >
                            <Input placeholder={td("Enter full name", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item
                            name="email"
                            label={td("Email", { source: "en" })}
                            rules={[
                                {
                                    type: "email",
                                    message: "Enter a valid email",
                                },
                            ]}
                        >
                            <Input placeholder={td("email@example.com", { source: "en" })} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="phone" label={td("Phone", { source: "en" })}>
                            <PhoneInput
                                enableSearch
                                placeholder={td("Phone number", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                    {permissions?.view_lead_sources !== "none" && (
                        <Col span={12}>
                            <Form.Item
                                name="lead_source_id"
                                label={td("Lead Source", { source: "en" })}
                            >
                                <FormDataSelector
                                    type="sources"
                                    placeholder={td("Lead source", { source: "en" })}
                                />
                            </Form.Item>
                        </Col>
                    )}
                </Row>

                <Row gutter={16}>
                    <Col span={24}>
                        <Form.Item name="address" label={td("Address", { source: "en" })}>
                            <Input placeholder={td("Enter street address", { source: "en" })} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="postal_code" label={td("Postcode", { source: "en" })}>
                            <Input placeholder={td("Enter postcode", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="city" label={td("City", { source: "en" })}>
                            <Input placeholder={td("Enter city", { source: "en" })} />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="state" label={td("State / Province", { source: "en" })}>
                            <Input placeholder={td("Enter state or province", { source: "en" })} />
                        </Form.Item>
                    </Col>
                    <Col span={12}>
                        <Form.Item name="country" label={td("Country", { source: "en" })}>
                            <FormDataSelector
                                type="countries"
                                placeholder={td("— Select country —", { source: "en" })}
                            />
                        </Form.Item>
                    </Col>
                </Row>

                {leadType === "agent" && (
                    <Row gutter={16}>
                        <Col span={12}>
                            <Form.Item
                                name="company_name"
                                label={td("Company / Agency Name", { source: "en" })}
                                rules={[
                                    {
                                        required: true,
                                        message:
                                            "Company name is required for agents",
                                    },
                                ]}
                            >
                                <Input placeholder={td("Company or agency name", { source: "en" })} />
                            </Form.Item>
                        </Col>
                        <Col span={12}>
                            <Form.Item name="referral" label={td("Referral Source", { source: "en" })}>
                                <Input placeholder={td("How did they find you?", { source: "en" })} />
                            </Form.Item>
                        </Col>
                    </Row>
                )}
            </div>

            <Divider className="my-6" />

            {/* Submit */}
            <div className="flex justify-end">
                <Button type="primary" htmlType="submit" loading={loading}>
                    Create Lead & Continue
                </Button>
            </div>
        </Form>
    );

    return (
        <div>
            {flowStep === "search" && renderSearchStep()}
            {flowStep === "selected" && renderSelectedStep()}
            {flowStep === "create" && renderCreateStep()}
        </div>
    );
};

export default StepOne;
