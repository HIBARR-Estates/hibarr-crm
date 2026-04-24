import React, { useState, useEffect } from "react";
import {
    Modal,
    Button,
    Form,
    Input,
    Select,
    Radio,
    Row,
    Col,
    Divider,
    Table,
    Checkbox,
    Tag,
    Empty,
    Alert,
    Space,
    Typography,
    Spin,
    message,
} from "antd";
import {
    SearchOutlined,
    UserOutlined,
    ShopOutlined,
    PlusOutlined,
    ArrowLeftOutlined,
    FilePdfOutlined,
    CheckCircleOutlined,
} from "@ant-design/icons";
import type { TableColumnsType } from "antd";
import FormDataSelector from "@/Components/FormDataSelector";
import PhoneInput from "antd-phone-input";
import axios from "axios";
import { generatePropertySubtitle } from "@/lib/utils";

const { Text, Paragraph } = Typography;

// ============================================
// Types
// ============================================

interface Property {
    id: number;
    title: string;
    price: number | null;
    status: string;
    bedrooms: string | null;
    bathrooms: number | null;
}

interface PriceListItem {
    type: string;
    count: number;
    min_price: number | null;
    max_price: number | null;
    properties: Property[];
}

interface Lead {
    id: number;
    client_name: string;
    client_email?: string;
    mobile?: string;
    company_name?: string;
    address?: string;
    city?: string;
    state?: string;
    country?: string;
    postal_code?: string;
}

interface ExposeGenerationModalProps {
    open: boolean;
    onClose: () => void;
    projectId: number;
    projectName: string;
    priceListItem: PriceListItem;
}

type FlowStep =
    | "lead-search"
    | "lead-create"
    | "lead-selected"
    | "property-select"
    | "generating";

// ============================================
// Main Component
// ============================================

const ExposeGenerationModal: React.FC<ExposeGenerationModalProps> = ({
    open,
    onClose,
    projectId,
    projectName,
    priceListItem,
}) => {
    const [form] = Form.useForm();
    const [flowStep, setFlowStep] = useState<FlowStep>("lead-search");
    const [leadType, setLeadType] = useState<"client" | "agent">("client");
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
    const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>(
        [],
    );
    const [loading, setLoading] = useState(false);

    // Reset state when modal opens
    useEffect(() => {
        if (open) {
            setFlowStep("lead-search");
            setSelectedLead(null);
            setSelectedPropertyIds([]);
            setLeadType("client");
            form.resetFields();
        }
    }, [open, form]);

    const formatPrice = (price: number | null) => {
        if (!price) return "-";
        return new Intl.NumberFormat("en-GB", {
            style: "currency",
            currency: "GBP",
            maximumFractionDigits: 0,
        }).format(price);
    };

    // ============================================
    // Lead Selection Handlers
    // ============================================

    const handleSelectLead = (lead: Lead) => {
        if (lead) {
            setSelectedLead(lead);
            setFlowStep("lead-selected");
            // Auto-detect lead type based on company name
            if (lead.company_name) {
                setLeadType("agent");
            } else {
                setLeadType("client");
            }
        }
    };

    const handleCreateNewLead = () => {
        setSelectedLead(null);
        setFlowStep("lead-create");
        form.resetFields();
        setLeadType("client");
    };

    const handleBackToSearch = () => {
        setSelectedLead(null);
        setFlowStep("lead-search");
        form.resetFields();
        setLeadType("client");
    };

    const handleChangeLead = () => {
        setSelectedLead(null);
        setFlowStep("lead-search");
    };

    const handleContinueToProperties = () => {
        setFlowStep("property-select");
    };

    const handleCreateLeadAndContinue = async (values: any) => {
        // Transform phone value from PhoneInput object to string format
        if (values.phone && typeof values.phone === "object") {
            const phoneObj = values.phone;
            const parts = [
                phoneObj.countryCode,
                phoneObj.areaCode,
                phoneObj.phoneNumber,
            ].filter(Boolean);
            values.phone = parts.length > 0 ? `+${parts.join("")}` : "";
        }

        // For now, we'll store the lead data to send with the expose request
        // The backend will create the lead if needed
        setSelectedLead({
            id: 0, // New lead marker
            client_name: values.name,
            client_email: values.email,
            mobile: values.phone,
            company_name: values.company_name,
        } as Lead);
        setFlowStep("property-select");
    };

    // ============================================
    // Property Selection Handlers
    // ============================================

    const handlePropertySelect = (propertyIds: React.Key[]) => {
        setSelectedPropertyIds(propertyIds as number[]);
    };

    const handleBackToLead = () => {
        if (selectedLead?.id === 0) {
            // If lead was being created, go back to create form
            setFlowStep("lead-create");
        } else {
            setFlowStep("lead-selected");
        }
    };

    // ============================================
    // Generate Expose
    // ============================================

    const handleGenerateExpose = async () => {
        if (selectedPropertyIds.length === 0) {
            message.warning("Please select at least one property");
            return;
        }

        setLoading(true);
        setFlowStep("generating");

        try {
            const payload: any = {
                property_ids: selectedPropertyIds,
                lead_type: leadType,
                property_type: priceListItem.type,
            };

            // If lead is selected (existing), send lead_id
            // If lead is new (id = 0), send lead_data for creation
            if (selectedLead && selectedLead.id > 0) {
                payload.lead_id = selectedLead.id;
            } else if (selectedLead) {
                payload.lead_data = {
                    name: selectedLead.client_name,
                    email: selectedLead.client_email,
                    phone: selectedLead.mobile,
                    company_name: selectedLead.company_name,
                };
            }

            const response = await axios.post(
                route("developer-projects.expose.generate", projectId),
                payload,
                { responseType: "blob" },
            );

            // Create download link
            const blob = new Blob([response.data], { type: "application/pdf" });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${projectName}-${priceListItem.type}-expose.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);

            message.success("Expose generated successfully!");
            onClose();
        } catch (error: any) {
            console.error("Failed to generate expose:", error);
            message.error("Failed to generate expose. Please try again.");
            setFlowStep("property-select");
        } finally {
            setLoading(false);
        }
    };

    // ============================================
    // Render Functions
    // ============================================

    const renderLeadSearchStep = () => (
        <div className="py-8">
            <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-50 rounded-full mb-4">
                    <SearchOutlined className="text-2xl text-blue-500" />
                </div>
                <h3 className="text-lg font-semibold text-gray-800 mb-2">
                    Find a Lead / Client
                </h3>
                <p className="text-gray-500 max-w-md mx-auto">
                    Search for an existing lead by name, email, or company. The
                    expose will be personalized for this client.
                </p>
            </div>

            <div className="max-w-md mx-auto mb-8">
                <FormDataSelector
                    type="leads"
                    placeholder="Search by name, email, or company..."
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
                    onClick={handleCreateNewLead}
                    className="px-8"
                >
                    Create New Lead
                </Button>
            </div>
        </div>
    );

    const renderLeadSelectedStep = () => (
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
                                    return (
                                        addressParts.length > 0 && (
                                            <div>{addressParts.join(", ")}</div>
                                        )
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
                        Change Lead
                    </Button>
                </div>
            </div>

            {/* Continue Button */}
            <div className="flex justify-end">
                <Button type="primary" onClick={handleContinueToProperties}>
                    Continue to Select Properties
                </Button>
            </div>
        </div>
    );

    const renderLeadCreateStep = () => (
        <Form
            form={form}
            layout="vertical"
            onFinish={handleCreateLeadAndContinue}
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
                    Back to Search
                </Button>
            </div>

            {/* Lead Type Selection */}
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="text-sm font-medium text-gray-700 mb-3">
                    What type of lead is this?
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
                        Client
                    </Radio.Button>
                    <Radio.Button value="agent">
                        <ShopOutlined className="mr-1.5" />
                        Agent
                    </Radio.Button>
                </Radio.Group>
            </div>

            {/* Form Fields */}
            <div>
                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item
                            name="name"
                            label="Name"
                            rules={[
                                { required: true, message: "Name is required" },
                            ]}
                        >
                            <Input placeholder="Enter full name" />
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
                            <Input placeholder="email@example.com" />
                        </Form.Item>
                    </Col>
                </Row>

                <Row gutter={16}>
                    <Col span={12}>
                        <Form.Item name="phone" label="Phone">
                            <PhoneInput
                                enableSearch
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
                                        required: true,
                                        message:
                                            "Company name is required for agents",
                                    },
                                ]}
                            >
                                <Input placeholder="Company or agency name" />
                            </Form.Item>
                        </Col>
                    )}
                </Row>
            </div>

            <Divider className="my-6" />

            {/* Submit */}
            <div className="flex justify-end">
                <Button type="primary" htmlType="submit">
                    Continue to Select Properties
                </Button>
            </div>
        </Form>
    );

    const renderPropertySelectStep = () => {
        const columns: TableColumnsType<Property> = [
            {
                title: "Property",
                dataIndex: "title",
                key: "title",
                render: (title: string, record) =>
                    generatePropertySubtitle(record as any) ||
                    title ||
                    `Property #${record.id}`,
            },
            {
                title: "Beds",
                dataIndex: "bedrooms",
                key: "bedrooms",
                align: "center",
                width: 80,
            },
            {
                title: "Baths",
                dataIndex: "bathrooms",
                key: "bathrooms",
                align: "center",
                width: 80,
            },
            {
                title: "Price",
                dataIndex: "price",
                key: "price",
                render: (price: number | null) => formatPrice(price),
                width: 120,
            },
            {
                title: "Status",
                dataIndex: "status",
                key: "status",
                width: 100,
                render: (status: string) => {
                    const colors: Record<string, string> = {
                        Available: "green",
                        "Under offer": "orange",
                        Sold: "red",
                        Withdrawn: "default",
                    };
                    return <Tag color={colors[status]}>{status}</Tag>;
                },
            },
        ];

        return (
            <div className="py-4">
                {/* Back Button */}
                <div className="mb-4">
                    <Button
                        type="text"
                        icon={<ArrowLeftOutlined />}
                        onClick={handleBackToLead}
                        className="text-gray-500 hover:text-gray-700 -ml-2"
                    >
                        Back to Lead Selection
                    </Button>
                </div>

                {/* Summary */}
                <Alert
                    type="info"
                    showIcon
                    className="mb-4"
                    message={
                        <span>
                            Generating expose for{" "}
                            <strong>{selectedLead?.client_name}</strong> with{" "}
                            <strong>{priceListItem.type}</strong> properties
                        </span>
                    }
                />

                {/* Property Selection Table */}
                <div className="mb-4">
                    <Text strong>
                        Select properties to include (
                        {selectedPropertyIds.length} selected)
                    </Text>
                </div>

                <Table
                    rowSelection={{
                        type: "checkbox",
                        selectedRowKeys: selectedPropertyIds,
                        onChange: handlePropertySelect,
                    }}
                    columns={columns}
                    dataSource={priceListItem.properties}
                    rowKey="id"
                    size="small"
                    pagination={{ pageSize: 10 }}
                />

                <Divider className="my-6" />

                {/* Generate Button */}
                <div className="flex justify-end gap-3">
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        type="primary"
                        icon={<FilePdfOutlined />}
                        onClick={handleGenerateExpose}
                        disabled={selectedPropertyIds.length === 0}
                    >
                        Generate Expose ({selectedPropertyIds.length}{" "}
                        properties)
                    </Button>
                </div>
            </div>
        );
    };

    const renderGeneratingStep = () => (
        <div className="py-12 text-center">
            <Spin size="large" />
            <div className="mt-4">
                <Text>Generating your expose PDF...</Text>
            </div>
            <div className="mt-2">
                <Text type="secondary">
                    This may take a moment depending on the number of
                    properties.
                </Text>
            </div>
        </div>
    );

    const renderContent = () => {
        switch (flowStep) {
            case "lead-search":
                return renderLeadSearchStep();
            case "lead-selected":
                return renderLeadSelectedStep();
            case "lead-create":
                return renderLeadCreateStep();
            case "property-select":
                return renderPropertySelectStep();
            case "generating":
                return renderGeneratingStep();
            default:
                return null;
        }
    };

    const getModalTitle = () => {
        switch (flowStep) {
            case "lead-search":
            case "lead-selected":
            case "lead-create":
                return "Generate Expose - Select Lead";
            case "property-select":
                return "Generate Expose - Select Properties";
            case "generating":
                return "Generating Expose...";
            default:
                return "Generate Expose";
        }
    };

    return (
        <Modal
            open={open}
            onCancel={onClose}
            title={getModalTitle()}
            width={800}
            footer={null}
            destroyOnClose
            maskClosable={false}
        >
            {renderContent()}
        </Modal>
    );
};

export default ExposeGenerationModal;
